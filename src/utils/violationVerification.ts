// Cross-checking pipeline for violation candidates.
//
// A general-purpose object detector does NOT prove a legal violation. This
// module decides whether a detection is a CONFIRMED violation, an UNVERIFIED
// candidate (needs human review), or is REJECTED — using only the data the
// app actually has (detector class + confidence, GPS speed, time).

export interface VerificationConfig {
  /** Minimum detector confidence (0..1) for any candidate. */
  minDetectionConfidence: number;
  /** Consecutive frames a class must be seen for temporal consistency. */
  temporalConsistencyFrames: number;
  /** Speed (km/h) above which an OVER_SPEEDING candidate is raised. */
  overspeedLimitKmh: number;
  /** Minimum time (ms) between saving the same violation type (de-dup). */
  dedupWindowMs: number;
  /** Distinct people required on one two-wheeler for TRIPLE_RIDING. */
  tripleRidingMinPeople: number;
  /** Fraction of a person box that must sit over the two-wheeler to count. */
  personAssocOverlap: number;
  /** Automatically capture evidence once a candidate is CONFIRMED. */
  autoCaptureConfirmed: boolean;
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  minDetectionConfidence: 0.5,
  temporalConsistencyFrames: 3,
  overspeedLimitKmh: 60,
  dedupWindowMs: 5000,
  tripleRidingMinPeople: 3,
  personAssocOverlap: 0.35,
  autoCaptureConfirmed: true,
};

// ---------------------------------------------------------------------------
// Geometry helpers (shared by the triple-riding rule)
// ---------------------------------------------------------------------------
export type Box = { x: number; y: number; width: number; height: number };

export function iou(a: Box, b: Box): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = ix2 - ix1;
  const ih = iy2 - iy1;
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  if (areaA <= 0 || areaB <= 0) return 0;
  return inter / (areaA + areaB - inter);
}

/**
 * Fraction of `inner` (a person box) that overlaps `outer` (a two-wheeler box).
 * Used to decide whether a person is plausibly RIDING that two-wheeler rather
 * than merely standing next to it.
 */
export function overlapRatio(inner: Box, outer: Box): number {
  const areaInner = inner.width * inner.height;
  if (areaInner <= 0) return 0;
  const ix1 = Math.max(inner.x, outer.x);
  const iy1 = Math.max(inner.y, outer.y);
  const ix2 = Math.min(inner.x + inner.width, outer.x + outer.width);
  const iy2 = Math.min(inner.y + inner.height, outer.y + outer.height);
  const iw = ix2 - ix1;
  const ih = iy2 - iy1;
  if (iw <= 0 || ih <= 0) return 0;
  return (iw * ih) / areaInner;
}

/** Collapse duplicate detections of the same object (IoU NMS). */
export function dedupeByIoU(boxes: Box[], iouThreshold = 0.5): Box[] {
  const kept: Box[] = [];
  for (const b of boxes) {
    if (!kept.some((k) => iou(k, b) > iouThreshold)) kept.push(b);
  }
  return kept;
}

/** COCO classes that are two-wheelers (the plausible TRIPLE_RIDING host). */
export const TWO_WHEELER_CLASSES = ['motorcycle', 'bicycle', 'scooter'];

export interface TripleRidingInput {
  /** Box of the detected two-wheeler, in video pixels. */
  twoWheeler: Box;
  /** Boxes of every detected person, in video pixels. */
  persons: Box[];
  /** Two-wheeler frame streak (temporal consistency). */
  frameStreak: number;
}

export interface TripleRidingResult {
  /** Distinct persons plausibly associated with this two-wheeler. */
  associatedPeople: number;
  confirmed: boolean;
  reasons: string[];
}

/**
 * TRIPLE_RIDING cross-check.
 *
 * Counts DISTINCT people (duplicate person boxes are collapsed first, so one
 * person detected twice is never counted twice) whose box sits over the
 * two-wheeler. Confirmation additionally requires temporal consistency.
 *
 * Honest limitation: association is geometric, not identity tracking — it
 * cannot prove which person is on which vehicle when two-wheels overlap in
 * frame, so borderline cases stay UNVERIFIED.
 */
export function evaluateTripleRiding(
  cfg: VerificationConfig,
  input: TripleRidingInput
): TripleRidingResult {
  const distinctPersons = dedupeByIoU(input.persons, 0.5);
  const associated = distinctPersons.filter(
    (p) => overlapRatio(p, input.twoWheeler) >= cfg.personAssocOverlap
  );
  const count = associated.length;

  if (count < cfg.tripleRidingMinPeople) {
    return {
      associatedPeople: count,
      confirmed: false,
      reasons: [
        `${count} of ${cfg.tripleRidingMinPeople} required people associated with the two-wheeler`,
      ],
    };
  }

  if (input.frameStreak < cfg.temporalConsistencyFrames) {
    return {
      associatedPeople: count,
      confirmed: false,
      reasons: [
        `${count} people associated, but only ${input.frameStreak}/${cfg.temporalConsistencyFrames} frames`,
        'Needs temporal consistency across frames',
      ],
    };
  }

  return {
    associatedPeople: count,
    confirmed: true,
    reasons: [
      `${count} distinct people associated with one two-wheeler (>= ${cfg.tripleRidingMinPeople})`,
      `Duplicate person boxes removed before counting (${input.persons.length} raw -> ${distinctPersons.length} distinct)`,
      `Consistent across ${input.frameStreak} frames`,
      'Geometric association only — not identity tracking',
    ],
  };
}

export type VerificationStatus = 'confirmed' | 'unverified' | 'rejected';

export interface VerificationResult {
  status: VerificationStatus;
  /** Best-effort violation type, e.g. 'OVER_SPEEDING'. */
  violationType: string | null;
  reasons: string[];
}

export interface CandidateInput {
  detectedClass: string; // raw COCO class
  confidence: number; // 0..1
  speedKmh: number; // device GPS speed (trustworthy, not frame-inferred)
  hasGpsFix: boolean;
  isVehicle: boolean;
  /** consecutive frames this class has been detected */
  frameStreak: number;
  now: number; // epoch ms
  /**
   * Optional TRIPLE_RIDING context: this detection's box plus every detected
   * person box in the same frame (video pixels).
   */
  tripleRiding?: { twoWheeler: Box; persons: Box[] } | null;
}

/**
 * Evaluate one detection against the configured rules.
 *
 * Rules that ARE supportable with the data this app actually has:
 *  - OVER_SPEEDING: trustworthy GPS speed over the limit AND a vehicle in
 *    frame. Speed is never inferred from a single camera frame.
 *  - TRIPLE_RIDING: 3+ DISTINCT people (duplicates removed) associated with
 *    one two-wheeler, seen consistently across frames.
 *
 * Rules that are NOT supportable and must never be auto-confirmed:
 *  - NO_HELMET (needs a helmet-capable model), FAKE_PLATE (needs a plate/OCR
 *    or an authorised database service), ACCIDENT (needs an accident model).
 *  These stay UNVERIFIED / require human review.
 */
export function verifyCandidate(
  cfg: VerificationConfig,
  input: CandidateInput
): VerificationResult {
  if (input.confidence < cfg.minDetectionConfidence) {
    return {
      status: 'rejected',
      violationType: null,
      reasons: [
        `Confidence ${(input.confidence * 100).toFixed(0)}% below minimum ${(cfg.minDetectionConfidence * 100).toFixed(0)}%`,
      ],
    };
  }

  const reasons: string[] = [];
  if (input.frameStreak < cfg.temporalConsistencyFrames) {
    reasons.push(
      `Seen ${input.frameStreak}/${cfg.temporalConsistencyFrames} frames — needs temporal consistency`
    );
  }

  // --- OVER_SPEEDING: device GPS speed, never inferred from a frame --------
  if (input.isVehicle && input.hasGpsFix && input.speedKmh > cfg.overspeedLimitKmh) {
    if (input.frameStreak >= cfg.temporalConsistencyFrames) {
      return {
        status: 'confirmed',
        violationType: 'OVER_SPEEDING',
        reasons: [
          `GPS speed ${input.speedKmh.toFixed(0)} km/h > limit ${cfg.overspeedLimitKmh} km/h`,
          `Vehicle (${input.detectedClass}) at ${(input.confidence * 100).toFixed(0)}% confidence`,
          'Speed measured by device GPS (not inferred from a single frame)',
        ],
      };
    }
    reasons.push('Overspeed candidate pending temporal consistency');
    return { status: 'unverified', violationType: 'OVER_SPEEDING', reasons };
  }

  // --- TRIPLE_RIDING: distinct people on one two-wheeler ------------------
  if (input.tripleRiding) {
    const tr = evaluateTripleRiding(cfg, {
      twoWheeler: input.tripleRiding.twoWheeler,
      persons: input.tripleRiding.persons,
      frameStreak: input.frameStreak,
    });
    if (tr.confirmed) {
      return {
        status: 'confirmed',
        violationType: 'TRIPLE_RIDING',
        reasons: tr.reasons,
      };
    }
    if (tr.associatedPeople >= 2) {
      // Close, but not provable — surface it as a candidate for review.
      return {
        status: 'unverified',
        violationType: 'TRIPLE_RIDING',
        reasons: [
          ...tr.reasons,
          'Marked UNVERIFIED — association is geometric and could be ambiguous',
        ],
      };
    }
  }

  // Everything else: no rule is provable with the current model + sensors.
  return {
    status: 'unverified',
    violationType: null,
    reasons: [
      `Detection: ${input.detectedClass} at ${(input.confidence * 100).toFixed(0)}% confidence`,
      ...reasons,
      'No provable violation rule satisfied with the available model/sensors',
      'Marked UNVERIFIED — requires human review',
      'Not provable without a dedicated model: NO_HELMET, FAKE_PLATE, ACCIDENT',
    ],
  };
}

/**
 * In-memory temporal-consistency + de-dup tracker. One instance per dashboard.
 */
export class VerificationTracker {
  private cfg: VerificationConfig;
  private streaks = new Map<string, number>();
  private lastSaved = new Map<string, number>();

  constructor(cfg: VerificationConfig = DEFAULT_VERIFICATION_CONFIG) {
    this.cfg = cfg;
  }

  /** Call on every inference with the set of currently-detected classes. */
  updateFrame(classes: string[]): void {
    const seen = new Set(classes);
    for (const key of this.streaks.keys()) {
      if (!seen.has(key)) this.streaks.set(key, 0);
    }
    for (const cls of classes) {
      this.streaks.set(cls, (this.streaks.get(cls) ?? 0) + 1);
    }
  }

  streakFor(cls: string): number {
    return this.streaks.get(cls) ?? 0;
  }

  /** True if this violation type was already saved within the dedup window. */
  isDuplicate(violationType: string, now: number): boolean {
    const last = this.lastSaved.get(violationType);
    return last !== undefined && now - last < this.cfg.dedupWindowMs;
  }

  markSaved(violationType: string, now: number): void {
    this.lastSaved.set(violationType, now);
  }

  reset(): void {
    this.streaks.clear();
    this.lastSaved.clear();
  }
}
