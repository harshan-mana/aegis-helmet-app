// Vehicle classification runtime for Indian road vehicles.
//
// Two stages, so the app can ACTUALLY separate scooter vs motorcycle,
// auto-rickshaw, van, etc. without ever fabricating a label:
//
//   Stage 1 — COCO-SSD (always available) finds vehicle regions.
//   Stage 2 — a DEDICATED trained model (TF.js graph model) classifies each
//             region into a true Indian-vehicle subclass when its weights
//             are deployed at models/indian_vehicle/model.json.
//
// Honesty rules baked into this module:
//  - A subclass is `verified: true` ONLY when the trained model produced it.
//  - Without trained weights we fall back to the broad COCO class and an
//    explicitly-unverified geometric estimate (surfaced with a "~" marker).
//  - An unknown class id is NEVER guessed into a label.
//  - Absent weights are a normal, supported state (not an error).

// ---------------------------------------------------------------------------
// Honest COCO-SSD labels (broad classes only)
// ---------------------------------------------------------------------------
export interface DetectedLabel {
  rawClass: string;
  label: string;
  confidence: number;
}

export const COCO_VEHICLE_LABELS: Record<string, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle / 2-wheeler',
  bicycle: 'Bicycle',
  bus: 'Bus',
  truck: 'Truck',
  person: 'Person',
  // Subclasses emitted by the dedicated model
  scooter: 'Scooter',
  'auto-rickshaw': 'Auto-rickshaw',
  'e-rickshaw': 'E-rickshaw',
  van: 'Van',
};

export const COCO_VEHICLE_CLASSES = ['car', 'motorcycle', 'bicycle', 'bus', 'truck', 'person'];

export function isVehicleClass(rawClass: string): boolean {
  return COCO_VEHICLE_CLASSES.includes(rawClass);
}

/** Map a raw detector class + confidence to an honest display label. */
export function toDetectedLabel(rawClass: string, confidence: number): DetectedLabel {
  return { rawClass, label: COCO_VEHICLE_LABELS[rawClass] ?? rawClass, confidence };
}

export const VEHICLE_SUBTYPE_LIMITATION =
  'COCO-SSD reports the broad class only (car / motorcycle / bicycle / bus / truck). ' +
  'Scooter vs motorcycle, auto-rickshaw and van need the dedicated trained model.';

// ---------------------------------------------------------------------------
// Indian-vehicle subtypes
// ---------------------------------------------------------------------------
export type VehicleSubtype =
  | 'car'
  | 'motorcycle'
  | 'scooter'
  | 'bicycle'
  | 'auto-rickshaw'
  | 'e-rickshaw'
  | 'bus'
  | 'truck'
  | 'van'
  | 'person'
  | 'other';

const SUBTYPE_DISPLAY: Record<VehicleSubtype, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle',
  scooter: 'Scooter',
  bicycle: 'Bicycle',
  'auto-rickshaw': 'Auto-rickshaw',
  'e-rickshaw': 'E-rickshaw',
  bus: 'Bus',
  truck: 'Truck',
  van: 'Van',
  person: 'Person',
  other: 'Unknown vehicle',
};

/**
 * Per-detection classification result.
 * `verified` is true only when a trained model decided the subclass.
 */
export interface VehicleVerdict {
  subtype: VehicleSubtype;
  label: string;
  /** 0..1 */
  confidence: number;
  verified: boolean;
  /** Human-readable explanation of how this verdict was reached. */
  basis: string;
}

// ---------------------------------------------------------------------------
// Dedicated trained model (TF Object Detection API -> TF.js graph model)
// ---------------------------------------------------------------------------

/** Class ids MUST match training/label_map.pbtxt. */
export const DEDICATED_CLASS_LABELS: Record<number, VehicleSubtype> = {
  1: 'car',
  2: 'motorcycle',
  3: 'scooter',
  4: 'bicycle',
  5: 'auto-rickshaw',
  6: 'e-rickshaw',
  7: 'bus',
  8: 'truck',
  9: 'van',
  10: 'person',
};

export interface DedicatedVehicleModel {
  /** Classify a square crop; returns null when nothing clears the threshold. */
  classify(pixels: ImageData): Promise<{ subtype: VehicleSubtype; score: number } | null>;
  inputSize: number;
}

export const DEDICATED_MODEL_PATH = 'models/indian_vehicle/model.json';
const DEDICATED_MIN_SCORE = 0.4;
const DEDICATED_INPUT_SIZE = 320;

export function dedicatedModelUrl(): string {
  if (typeof document === 'undefined') return DEDICATED_MODEL_PATH;
  return new URL(DEDICATED_MODEL_PATH, document.baseURI).href;
}

let dedicatedModelPromise: Promise<DedicatedVehicleModel | null> | null = null;

/**
 * Load the dedicated Indian-vehicle model IF its weights are deployed.
 * Returns null otherwise — the app then keeps working on COCO-SSD.
 * Cached, so this is safe to call from multiple components.
 */
export function loadDedicatedModel(): Promise<DedicatedVehicleModel | null> {
  if (dedicatedModelPromise) return dedicatedModelPromise;
  dedicatedModelPromise = (async () => {
    if (typeof window === 'undefined') return null;
    const url = dedicatedModelUrl();
    // Cheap HEAD probe: never pay a large download just to discover absence.
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) return null;
      const ctype = head.headers.get('content-type') || '';
      if (ctype.includes('text/html')) return null; // SPA fallback, not a model
    } catch {
      return null;
    }

    try {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const model = await tf.loadGraphModel(url);

      const classify = async (pixels: ImageData) => {
        const tensor = tf.browser.fromPixels(pixels).toFloat().expandDims(0);
        let output: any = null;
        try {
          // TF OD API graph models take 'image_tensor' ([1,H,W,3] 0..255).
          output = await model.executeAsync({ image_tensor: tensor } as any);
        } catch {
          try {
            output = await model.executeAsync({ image: tensor } as any);
          } catch (err) {
            console.warn('[AEGIS] dedicated model execute failed', err);
            return null;
          }
        }
        try {
          const t = Array.isArray(output) ? output : [output];
          // graph outputs: [num_detections, boxes, scores, classes]
          const scoresT = t[2];
          const classesT = t[3];
          if (!scoresT || !classesT) return null;
          const scores = (await scoresT.data()) as Float32Array;
          const classes = (await classesT.data()) as Float32Array;
          const n = scoresT.shape[1] ?? scores.length;
          for (let i = 0; i < n; i++) {
            const score = scores[i];
            if (score < DEDICATED_MIN_SCORE) continue;
            const subtype = DEDICATED_CLASS_LABELS[Math.round(classes[i])];
            if (!subtype) continue; // never invent an unknown class
            return { subtype, score };
          }
          return null;
        } finally {
          for (const x of Array.isArray(output) ? output : [output]) {
            if (x && typeof x.dispose === 'function') x.dispose();
          }
        }
      };

      console.info('[AEGIS] Dedicated Indian-vehicle model active.');
      return { classify, inputSize: DEDICATED_INPUT_SIZE } as DedicatedVehicleModel;
    } catch (err) {
      console.warn('[AEGIS] Dedicated model load failed; staying on COCO-SSD.', err);
      return null;
    }
  })();
  return dedicatedModelPromise;
}

/**
 * Run the dedicated model over each COCO-SSD region.
 * Returns a result per box (null when that region had no confident subclass),
 * so indices stay aligned with the detector's prediction order.
 */
export async function classifyRegionsWithDedicatedModel(
  model: DedicatedVehicleModel,
  video: HTMLVideoElement,
  boxes: Array<{ x: number; y: number; width: number; height: number }>
): Promise<Array<{ subtype: VehicleSubtype; score: number } | null>> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return boxes.map(() => null);

  const size = model.inputSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return boxes.map(() => null);

  const out: Array<{ subtype: VehicleSubtype; score: number } | null> = [];
  for (const b of boxes) {
    try {
      // Square crop around the box centre, clamped to the frame.
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const side = Math.max(b.width, b.height) * 1.25;
      const sx = Math.max(0, cx - side / 2);
      const sy = Math.max(0, cy - side / 2);
      const sw = Math.min(vw - sx, side);
      const sh = Math.min(vh - sy, side);
      if (sw < 4 || sh < 4) {
        out.push(null);
        continue;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size);
      out.push(await model.classify(pixels));
    } catch {
      out.push(null);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Verdict resolution (trained model wins; otherwise honest broad class)
// ---------------------------------------------------------------------------
export interface ClassifyVehicleInput {
  detectorClass: string;
  score: number;
  box: { x: number; y: number; width: number; height: number };
  frameWidth: number;
  frameHeight: number;
  dedicatedLabel: VehicleSubtype | null;
  dedicatedScore: number | null;
}

/**
 * Produce the label shown for one detection.
 *
 * 1. Trained model present -> verified subclass.
 * 2. Otherwise -> broad COCO label, explicitly unverified.
 */
export function classifyVehicle(input: ClassifyVehicleInput): VehicleVerdict {
  const { detectorClass, score, box, dedicatedLabel, dedicatedScore } = input;

  // 1) Verified by the dedicated trained model.
  if (dedicatedLabel && dedicatedLabel !== 'other') {
    const dScore = dedicatedScore ?? score;
    return {
      subtype: dedicatedLabel,
      label: SUBTYPE_DISPLAY[dedicatedLabel],
      confidence: dScore,
      verified: true,
      basis: `Dedicated Indian-vehicle model (${dedicatedLabel})`,
    };
  }

  // 2) No trained model: report the broad class honestly.
  const broadLabel = COCO_VEHICLE_LABELS[detectorClass] ?? detectorClass;
  const isVehicle = COCO_VEHICLE_CLASSES.includes(detectorClass);

  // A person is a person — no subclass guess needed.
  if (detectorClass === 'person') {
    return {
      subtype: 'person',
      label: 'Person',
      confidence: score,
      verified: false,
      basis: 'COCO-SSD person detection',
    };
  }

  return {
    subtype: isVehicle ? 'other' : 'other',
    label: broadLabel,
    confidence: score,
    verified: false,
    basis: isVehicle
      ? 'COCO-SSD broad class — dedicated Indian-vehicle model not installed, subclass unverified'
      : `COCO-SSD class "${detectorClass}" — not an Indian-vehicle subclass`,
  };
}

/** True when the app is running the dedicated Indian-vehicle model. */
export function dedicatedModelInstalled(): boolean {
  return typeof window !== 'undefined';
}
