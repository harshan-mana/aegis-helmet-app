// Honest vehicle-classification adapter.
//
// The browser detector (TensorFlow.js COCO-SSD) only outputs a fixed set of
// COCO classes. It CANNOT reliably tell a scooter from a motorcycle, an
// auto-rickshaw from a car, or a van from a car/truck. This module is the
// single adapter between the detector and the UI so a dedicated, trained
// Indian-vehicle classifier can be plugged in later WITHOUT changing the UI.

export interface DetectedLabel {
  /** Raw class name reported by the detector (e.g. "motorcycle"). */
  rawClass: string;
  /** Honest, human-readable label shown in the UI. */
  label: string;
  /** 0..1 confidence from the detector. */
  confidence: number;
}

// COCO-SSD classes we care about on Indian roads, mapped to honest labels.
// We deliberately do NOT invent subtypes the model cannot prove.
export const COCO_VEHICLE_LABELS: Record<string, string> = {
  car: 'Car',
  motorcycle: 'Motorcycle / 2-wheeler',
  bicycle: 'Bicycle',
  bus: 'Bus',
  truck: 'Truck',
  person: 'Person',
};

// Classes COCO-SSD actually outputs that are vehicles / road users.
export const COCO_VEHICLE_CLASSES = [
  'car',
  'motorcycle',
  'bicycle',
  'bus',
  'truck',
  'person',
];

export function isVehicleClass(rawClass: string): boolean {
  return COCO_VEHICLE_CLASSES.includes(rawClass);
}

/**
 * Map a raw detector class + confidence to an honest display label.
 * Unknown classes are labelled exactly as the detector reported them so we
 * never assert an identity the model did not output.
 */
export function toDetectedLabel(rawClass: string, confidence: number): DetectedLabel {
  const label = COCO_VEHICLE_LABELS[rawClass] ?? rawClass;
  return { rawClass, label, confidence };
}

/**
 * LIMITATION (shown honestly to the user):
 * COCO-SSD cannot distinguish:
 *  - scooter vs motorcycle  (both -> "motorcycle")
 *  - auto-rickshaw          (usually -> "car" or "truck")
 *  - van vs car/truck       (usually -> "car" or "truck")
 *  - e-rickshaw, handcart, etc.
 * A dedicated, trained Indian-vehicle model is required for those subtypes.
 * See INDIAN_VEHICLE_MODEL.md for the dataset / training / export guide.
 */
export const VEHICLE_SUBTYPE_LIMITATION =
  'COCO-SSD reports the broad class only (car / motorcycle / bicycle / bus / truck). ' +
  'It cannot reliably separate scooter vs motorcycle, auto-rickshaw, or van. ' +
  'A dedicated trained Indian-vehicle classifier is required for those subtypes.';
