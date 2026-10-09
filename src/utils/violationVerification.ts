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
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  minDetectionConfidence: 0.5,
  temporalConsistencyFrames: 3,
  overspeedLimitKmh: 60,
  dedupWindowMs: 5000,
};

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
}

/**
 * Evaluate one detection against the configured rules.
 * Honest by design:
 *  - OVER_SPEEDING: only when a trustworthy GPS speed exceeds the limit AND a
 *    vehicle is in frame. Speed comes from GPS, never from a single frame.
 *  - TRIPLE_RIDING / NO_HELMET / FAKE_PLATE / ACCIDENT: COCO-SSD cannot prove
 *    these -> always UNVERIFIED (human review), never falsely confirmed.
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

  // OVER_SPEEDING is the only rule supportable with the available data.
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

  // Rules the current model/sensors cannot prove — require human review.
  return {
    status: 'unverified',
    violationType: null,
    reasons: [
      `Detection: ${input.detectedClass} at ${(input.confidence * 100).toFixed(0)}% confidence`,
      ...reasons,
      'No provable violation rule satisfied with the available model/sensors',
      'Marked UNVERIFIED — requires human review',
      'Not provable without a dedicated model: TRIPLE_RIDING, NO_HELMET, FAKE_PLATE, ACCIDENT',
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
