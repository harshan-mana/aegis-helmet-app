import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Gauge,
  Activity,
  Phone,
  Camera,
  CameraOff,
  ShieldAlert,
  Plus,
  Trash2,
  Heart,
  AlertOctagon,
  AlertTriangle,
  User,
  Crosshair,
  Radio,
  Wifi,
  WifiOff,
  CheckCircle,
  X,
  Car,
  Signal,
  Grid3x3,
  Palette,
  ChevronDown,
  Moon,
  Sun,
  Sparkles,
  Pencil,
  Check,
  ChevronUp,
  LogOut,
  Users,
  Bell,
  Settings,
  LogIn,
  BarChart3,
  FileText,
  Download,
  Eye,
  Monitor,
  Bot,
  Shield,
  Database,
  LayoutDashboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import type * as cocoSsd from '@tensorflow-models/coco-ssd';
import { saveViolation, getAllViolations, deleteViolation, updateViolation, ViolationRecord } from '../utils/violationStorage';
import {
  toDetectedLabel,
  isVehicleClass,
  VEHICLE_SUBTYPE_LIMITATION,
  classifyVehicle,
  loadDedicatedModel,
  classifyRegionsWithDedicatedModel,
  type VehicleVerdict,
  type VehicleSubtype,
} from '../utils/vehicleClassification';
import {
  DEFAULT_VERIFICATION_CONFIG,
  verifyCandidate,
  VerificationTracker,
  TWO_WHEELER_CLASSES,
  type Box,
} from '../utils/violationVerification';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  type: 'police' | 'ambulance' | 'personal' | 'fire';
}

interface SavedContact {
  id: string;
  name: string;
  phone: string;
}

interface DetectedVehicle {
  id: string;
  plate: string;
  distance: number;
  speed: number;
  type: string;
}

const DEFAULT_EMERGENCY_CONTACTS: EmergencyContact[] = [
  { id: 'police', name: 'Traffic Police', phone: '100', type: 'police' },
  { id: 'ambulance', name: 'Ambulance', phone: '102', type: 'ambulance' },
  { id: 'fire', name: 'Fire & Rescue', phone: '101', type: 'fire' },
  { id: 'emergency', name: 'National Emergency', phone: '112', type: 'police' },
];

export default function DashboardView({ userName, userPhoto, onViewChange, onSignOut, onLogin }: {
  userName?: string;
  userPhoto?: string;
  onViewChange?: (view: 'dashboard' | 'violations' | 'authority' | 'profile' | 'settings') => void;
  onSignOut?: () => void;
  onLogin?: () => void;
}) {
  // Speedometer state
  const [speedKmh, setSpeedKmh] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);


  const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    gauge: Gauge, alert: AlertTriangle, layout: LayoutDashboard, chart: BarChart3,
    file: FileText, bell: Bell, users: Users, car: Car, bot: Bot,
    monitor: Monitor, settings: Settings, database: Database, shield: Shield,
  };

  const THEMES = [
    { id: 'cyber', name: 'AEGIS Dark', icon: Moon, color: 'text-cyber-blue' },
    { id: 'sunset', name: 'Orange Glow', icon: Sun, color: 'text-cyber-orange' },
    { id: 'aurora', name: 'Midnight', icon: Sparkles, color: 'text-cyber-purple' },
    { id: 'ocean', name: 'High Contrast', icon: Palette, color: 'text-cyber-green' },
  ];

  const AVATAR_COLORS = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500'];
  const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const getIcon = (iconName: string) => ICON_MAP[iconName] || Gauge;

  // ESP32-CAM state
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [esp32StreamUrl, setEsp32StreamUrl] = useState('http://192.168.4.1:81/stream');
  const [esp32Data, setEsp32Data] = useState<{ speed: number; persons: number; plates: string[] } | null>(null);

  // Person detection state
  const [detectedPersons, setDetectedPersons] = useState<string[]>([]);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [evidenceViolations, setEvidenceViolations] = useState<{ id: string; url: string; label: string; record: ViolationRecord }[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Load existing evidence from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const records = await getAllViolations();
      if (cancelled) return;
      const items = records.map((r) => ({ id: r.id, url: URL.createObjectURL(r.blob), label: r.type, record: r }));
      setEvidenceViolations(items);
    })();
    return () => { cancelled = true; };
  }, []);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'locked' | 'denied' | 'unavailable'>('searching');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [satellites, setSatellites] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [gpsAltitude, setGpsAltitude] = useState<number | null>(null);
  const [gpsHeading, setGpsHeading] = useState<number | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState(0);
  const [gpsSignalWeak, setGpsSignalWeak] = useState(false);
  const lastGpsFixAtRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

  // Webcam state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [detectionActive, setDetectionActive] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const detectCanvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const lastPredictionsRef = useRef<cocoSsd.DetectedObject[]>([]);
  const lastClassesRef = useRef<string>('');
  const lastInferRef = useRef(0);
  // Throttles the automatic-capture candidate check (ms since last frame).
  const lastAutoCaptureCheckRef = useRef(0);
  // Latest live values, so the capture path never reads a stale render
  // (the detection loop intentionally keeps a stable effect closure).
  const liveCaptureCtxRef = useRef({
    speedKmh: 0,
    gpsStatus: 'searching' as 'searching' | 'locked' | 'denied' | 'unavailable',
    gpsCoords: null as { lat: number; lng: number } | null,
    detectedObjects: [] as string[],
  });
  liveCaptureCtxRef.current = { speedKmh, gpsStatus, gpsCoords, detectedObjects };

  // Indian-vehicle classification:
  //  - dedicatedModelRef holds trained weights if they exist at
  //    models/indian_vehicle/model.json (verified subclass).
  //  - lastVerdictsRef holds the latest per-detection verdicts.
  // Both are non-blocking: with no weights the app keeps using COCO-SSD.
  const dedicatedModelRef = useRef<import('../utils/vehicleClassification').DedicatedVehicleModel | null>(null);
  const [dedicatedModelActive, setDedicatedModelActive] = useState(false);
  const lastVerdictsRef = useRef<VehicleVerdict[]>([]);
  const dedicatedResultsRef = useRef<Array<{ subtype: VehicleSubtype; score: number } | null>>([]);
  const lastDedicatedInferRef = useRef(0);
  const rafRef = useRef(0);
  // Try to load trained Indian-vehicle weights in the background.
  // Absent weights are the normal case: we simply keep using COCO-SSD.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await loadDedicatedModel();
      if (cancelled) return;
      dedicatedModelRef.current = m;
      setDedicatedModelActive(!!m);
    })();
    return () => { cancelled = true; };
  }, []);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  // Mirrors facingMode so startWebcam (a stable callback) can read the latest
  // value without re-creating itself.
  const facingModeRef = useRef<'user' | 'environment'>('environment');
  facingModeRef.current = facingMode;

  // Violation verification (cross-checking pipeline).
  // Single source of truth for candidate evaluation + temporal
  // consistency + de-dup. Configurable thresholds live in
  // violationVerification.ts (DEFAULT_VERIFICATION_CONFIG).
  const verificationRef = useRef(new VerificationTracker(DEFAULT_VERIFICATION_CONFIG));
  const [captureResult, setCaptureResult] = useState<{
    status: 'confirmed' | 'unverified' | 'rejected';
    violationType: string | null;
    reasons: string[];
  } | null>(null);
  const captureResultTimerRef = useRef(0);
  // Guards against overlapping manual + automatic captures writing twice.
  const autoCaptureInFlightRef = useRef(false);

  // Evidence management: view details, edit metadata, human review, delete.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<ViolationRecord | null>(null);
  const [editingEvidence, setEditingEvidence] = useState<{
    id: string;
    type: string;
    verificationStatus: 'confirmed' | 'unverified';
    speed: string;
    objects: string;
    reviewStatus: 'pending' | 'approved' | 'rejected';
    reviewNote: string;
  } | null>(null);

  /** Patch one record inside the gallery state (keeps UI + IndexedDB in sync). */
  const patchEvidenceInState = (id: string, patch: Partial<ViolationRecord>) => {
    setEvidenceViolations(prev =>
      prev.map((x) =>
        x.id === id
          ? { ...x, label: patch.type ?? x.label, record: { ...x.record, ...patch } }
          : x
      )
    );
    // Keep the open "view details" modal in sync with the edit.
    setViewingEvidence(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const downloadEvidence = (v: { id: string; url: string; record: ViolationRecord }) => {
    // Prefer the stored Blob so the download still works even if the
    // cached object URL was revoked; fall back to the object URL.
    const href = v.record.blob ? URL.createObjectURL(v.record.blob) : v.url;
    const a = document.createElement('a');
    a.href = href;
    a.download = `aegis-evidence-${v.record.createdAt}-${v.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (v.record.blob) setTimeout(() => URL.revokeObjectURL(href), 2000);
  };

  /** Cached object URL for a stored record, or undefined if it is gone. */
  const evidenceUrlFor = (id: string) => evidenceViolations.find((x) => x.id === id)?.url;

  const openEditEvidence = (record: ViolationRecord) => {
    setEditingEvidence({
      id: record.id,
      type: record.type,
      verificationStatus: record.verificationStatus || 'unverified',
      speed: record.speed != null ? String(record.speed) : '',
      objects: record.objects || '',
      reviewStatus: record.reviewStatus || 'pending',
      reviewNote: record.reviewNote || '',
    });
  };

  const saveEvidenceEdit = async () => {
    if (!editingEvidence) return;
    const trimmedSpeed = editingEvidence.speed.trim();
    const parsedSpeed = Number(trimmedSpeed);
    const speedValid = trimmedSpeed !== '' && Number.isFinite(parsedSpeed);
    // Only include speed when the user entered a valid number, so a blank
    // field never erases the originally captured measurement.
    const updates: Partial<ViolationRecord> = {
      type: editingEvidence.type,
      verificationStatus: editingEvidence.verificationStatus,
      objects: editingEvidence.objects,
      reviewStatus: editingEvidence.reviewStatus,
      reviewNote: editingEvidence.reviewNote,
    };
    if (speedValid) updates.speed = parsedSpeed;

    const ok = await updateViolation(editingEvidence.id, updates);
    if (ok) {
      patchEvidenceInState(editingEvidence.id, updates);
    } else {
      setStorageError('Could not update evidence metadata.');
    }
    setEditingEvidence(null);
  };

  /** Evidence for a detection, shown in the capture toast. */
  type CaptureCandidate = {
    status: 'confirmed' | 'unverified' | 'rejected';
    violationType: string | null;
    reasons: string[];
  };

  const showCaptureResult = (result: CaptureCandidate, ms = 6000) => {
    setCaptureResult(result);
    if (captureResultTimerRef.current) clearTimeout(captureResultTimerRef.current);
    captureResultTimerRef.current = setTimeout(() => setCaptureResult(null), ms);
  };

  /**
   * Capture the current camera frame and persist it as evidence.
   *
   * `mode`:
   *  - 'manual'  — user pressed Capture; the image is always saved, but the
   *                violation verdict is still decided by the verification
   *                pipeline (never assumed).
   *  - 'auto'    — fired by the detection loop once a candidate is CONFIRMED;
   *                nothing is saved if the candidate is not confirmed, and the
   *                de-dup window stops repeated captures of one event.
   */
  const captureEvidence = async (mode: 'manual' | 'auto' = 'manual') => {
    if (autoCaptureInFlightRef.current) return; // never overlap captures
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    autoCaptureInFlightRef.current = true;
    try {
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 360;
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const now = Date.now();
      const live = liveCaptureCtxRef.current;
      const top = lastPredictionsRef.current
        .slice()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      const rawClass = top?.class || 'manual_capture';
      const confidence = top?.score ?? 0;
      const topIndex = top ? lastPredictionsRef.current.indexOf(top) : -1;
      const verdict = topIndex >= 0 ? lastVerdictsRef.current[topIndex] ?? null : null;
      const classified = verdict ? verdict.subtype : 'other';
      const streak = verificationRef.current.streakFor(rawClass);
      const minConf = DEFAULT_VERIFICATION_CONFIG.minDetectionConfidence;

      // TRIPLE_RIDING context: this two-wheeler's box + every person box.
      let candidate: CaptureCandidate;
      if (top && confidence >= minConf) {
        const personBoxes: Box[] = lastPredictionsRef.current
          .filter((p) => p.class === 'person')
          .map((p) => ({ x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] }));
        const twoWheelerBox: Box = {
          x: top.bbox[0],
          y: top.bbox[1],
          width: top.bbox[2],
          height: top.bbox[3],
        };
        candidate = verifyCandidate(DEFAULT_VERIFICATION_CONFIG, {
          detectedClass: rawClass,
          confidence,
          speedKmh: live.speedKmh,
          hasGpsFix: live.gpsStatus === 'locked',
          isVehicle: isVehicleClass(rawClass),
          frameStreak: streak,
          now,
          tripleRiding: TWO_WHEELER_CLASSES.includes(rawClass)
            ? { twoWheeler: twoWheelerBox, persons: personBoxes }
            : null,
        });
      } else {
        candidate = {
          status: 'unverified',
          violationType: null,
          reasons: [
            top
              ? `Confidence ${(confidence * 100).toFixed(0)}% below minimum ${(minConf * 100).toFixed(0)}%`
              : 'No active detection — manual capture',
            'Saved as UNVERIFIED candidate for human review (not a confirmed violation)',
          ],
        };
      }

      if (verdict) {
        candidate.reasons = [
          ...candidate.reasons,
          `Classification: ${verdict.label} (${verdict.verified ? 'verified by trained model' : 'unverified heuristic'}) — ${verdict.basis}`,
        ];
      }

      // Automatic capture only fires for a CONFIRMED violation.
      if (mode === 'auto' && candidate.status !== 'confirmed') return;

      // De-dup: one record per continuing violation event.
      if (
        candidate.violationType &&
        verificationRef.current.isDuplicate(candidate.violationType, now)
      ) {
        if (mode === 'manual') {
          showCaptureResult({
            status: 'unverified',
            violationType: candidate.violationType,
            reasons: ['Duplicate suppressed — same violation event captured recently'],
          });
        }
        return;
      }

      if (mode === 'manual') setCapturedImages(prev => [...prev, dataUrl]);

      try {
        const resp = await fetch(dataUrl);
        const blob = await resp.blob();
        const id = `${now}_${Math.floor(Math.random() * 1e6)}`;
        const record: ViolationRecord = {
          id,
          type: candidate.violationType || rawClass,
          createdAt: now,
          speed: speedKmh,
          objects: live.detectedObjects.join(', '),
          confidence: Math.round(confidence * 100),
          lat: live.gpsCoords?.lat ?? null,
          lng: live.gpsCoords?.lng ?? null,
          blob,
          verificationStatus: candidate.status === 'confirmed' ? 'confirmed' : 'unverified',
          reasons: candidate.reasons,
          vehicleClass: classified,
        };
        const ok = await saveViolation(record);
        if (!ok) {
          setStorageError('Evidence could not be saved locally.');
          return;
        }
        if (candidate.violationType) {
          verificationRef.current.markSaved(candidate.violationType, now);
        }
        setEvidenceViolations(prev => [
          { id, url: URL.createObjectURL(blob), label: record.type, record },
          ...prev,
        ]);
        showCaptureResult(
          {
            status: candidate.status === 'confirmed' ? 'confirmed' : 'unverified',
            violationType: candidate.violationType,
            reasons: candidate.reasons,
          },
          mode === 'auto' ? 5000 : 6000
        );
      } catch (e) {
        console.error('Violation save failed:', e);
        setStorageError('Evidence could not be saved locally.');
      }
    } finally {
      autoCaptureInFlightRef.current = false;
    }
  };

  const confirmDeleteEvidence = async (id: string) => {
    const ok = await deleteViolation(id);
    if (ok) {
      setEvidenceViolations(prev => {
        const target = prev.find((x) => x.id === id);
        if (target) URL.revokeObjectURL(target.url);
        return prev.filter((x) => x.id !== id);
      });
    } else {
      setStorageError('Could not delete evidence.');
    }
    setConfirmDeleteId(null);
  };

  // Feature 1: Detected vehicles with license plates
  const [detectedVehicles, setDetectedVehicles] = useState<DetectedVehicle[]>([]);

  // Feature 7: Tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [wifiRange, setWifiRange] = useState(0);
  const [trackingData, setTrackingData] = useState<{ lat: number; lng: number; speed: number; timestamp: number }[]>([]);

  // Emergency contacts state
  const [savedContacts, setSavedContacts] = useState<SavedContact[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_emergency_contacts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // GPS tracker — high-accuracy, rapid updates
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    let watchId: number;

    const toRad = (d: number) => (d * Math.PI) / 180;
    const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };

    const startGPS = () => {
      setGpsStatus('searching');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: any = pos.coords;
          const lat = coords.latitude;
          const lng = coords.longitude;
          const acc = typeof coords.accuracy === 'number' ? parseFloat(coords.accuracy.toFixed(1)) : 0;
          const alt = typeof coords.altitude === 'number' && !isNaN(coords.altitude) ? parseFloat(coords.altitude.toFixed(1)) : null;
          const heading = typeof coords.heading === 'number' && !isNaN(coords.heading) ? Math.round(coords.heading) : null;

          lastGpsFixAtRef.current = Date.now();
          setGpsCoords({ lat, lng });
          setGpsAccuracy(acc);
          setGpsAltitude(alt);
          setGpsHeading(heading);
          setGpsSignalWeak(acc > 30 || (typeof pos.coords.accuracy !== 'number' && acc === 0));

          // Native speed in m/s, with a distance/time fallback when the device doesn't supply it
          let speedMps = typeof coords.speed === 'number' && !isNaN(coords.speed) && coords.speed >= 0 ? coords.speed : null;
          if (speedMps === null && lastPosRef.current) {
            const dt = Math.max(0.001, (pos.timestamp - lastPosRef.current.t) / 1000);
            speedMps = haversine(lastPosRef.current, { lat, lng }) / dt;
          }
          let speedKmhVal = speedMps !== null ? Math.max(0, parseFloat((speedMps * 3.6).toFixed(1))) : 0;
          // Stationary filter: sub-jitter speeds (e.g. GPS drift while parked) become zero
          if (speedKmhVal < 1.5) speedKmhVal = 0;
          // Reject physically small position jumps that can't be real movement
          if (speedMps !== null && speedKmhVal === 0 && lastPosRef.current) {
            const dt = Math.max(0.001, (pos.timestamp - lastPosRef.current.t) / 1000);
            const jumpM = haversine(lastPosRef.current, { lat, lng });
            if (jumpM / dt * 3.6 < 1.5) speedKmhVal = 0;
          }
          setGpsSpeed(speedKmhVal);
          setSpeedKmh(speedKmhVal);
          setSpeedHistory((h) => [...h.slice(-29), speedKmhVal]);

          lastPosRef.current = { lat, lng, t: pos.timestamp };
          setSatellites(Math.floor(Math.random() * 4) + 8);
          setGpsStatus('locked');
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatus('denied');
            setGpsSpeed(0); setSpeedKmh(0);
          } else if (err.code === err.TIMEOUT) {
            setGpsSignalWeak(true);
            setGpsStatus('searching');
            setGpsSpeed(0); setSpeedKmh(0);
          } else {
            setGpsSignalWeak(true);
            setGpsStatus('unavailable');
            setGpsSpeed(0); setSpeedKmh(0);
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    };

    startGPS();
    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Feature 7: Tracking with wifi range data
  useEffect(() => {
    if (!isTracking || !isWebcamActive) return;

    const interval = setInterval(() => {
      setWifiRange(Math.floor(Math.random() * 100) + 1);
      if (gpsCoords) {
        setTrackingData((prev) => [
          ...prev.slice(-50),
          {
            lat: gpsCoords.lat + (Math.random() - 0.5) * 0.001,
            lng: gpsCoords.lng + (Math.random() - 0.5) * 0.001,
            speed: speedKmh,
            timestamp: Date.now(),
          },
        ]);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isTracking, isWebcamActive, gpsCoords, speedKmh]);

  // Webcam controls.
  // `mode` is passed explicitly so a front/rear switch never uses a stale
  // closure value; it defaults to the currently selected facing mode.
  const startWebcam = useCallback(async (mode?: 'user' | 'environment') => {
    const want = mode ?? facingModeRef.current;
    setWebcamError(null);
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setWebcamError('Camera is not supported in this browser.');
      setIsWebcamActive(false);
      return;
    }

    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    videoEl.srcObject = null;

    // `ideal` (not an exact value) so devices that lack the requested facing
    // mode still resolve instead of throwing OverconstrainedError, with a
    // progressively more permissive fallback.
    const attempts: MediaStreamConstraints[] = [
      {
        video: { facingMode: { ideal: want }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      },
      { video: { facingMode: { ideal: want } }, audio: false },
      { video: true, audio: false },
    ];

    let stream: MediaStream | null = null;
    let lastErr: any = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err: any) {
        lastErr = err;
        // A hard permission denial will not be fixed by weaker constraints.
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') break;
      }
    }

    if (!stream) {
      const name = lastErr?.name;
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        setWebcamError('No camera device detected on this device.');
      } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        setWebcamError('Camera permission denied. Please allow camera access in your browser settings.');
      } else {
        setWebcamError(lastErr?.message || 'Camera access failed.');
      }
      setIsWebcamActive(false);
      return;
    }

    // Bind the stream and start playback before reporting the active state.
    streamRef.current = stream;
    videoEl.srcObject = stream;
    videoEl.muted = true;
    try {
      await videoEl.play();
    } catch {
      // Autoplay can be blocked; muted + playsInline normally recovers it.
      try {
        videoEl.muted = true;
        await videoEl.play();
      } catch {
        /* reported below as a permission-style message */
      }
    }

    if (videoEl.readyState < 2) {
      // Switching cameras briefly leaves readyState at 0. Give the new stream
      // a moment to deliver frames before deciding it failed.
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          videoEl.removeEventListener('loadeddata', done);
          videoEl.removeEventListener('canplay', done);
          resolve();
        };
        videoEl.addEventListener('loadeddata', done);
        videoEl.addEventListener('canplay', done);
        setTimeout(done, 2000);
      });
    }

    if (videoEl.readyState < 2) {
      setWebcamError('Camera started but the video stream did not play. Please try again.');
      setIsWebcamActive(false);
      return;
    }

    setWebcamError(null);
    setIsWebcamActive(true);
    setIsTracking(true);
    setDetectionActive(true);
  }, []);

  // Auto-start the camera once on mount only. The dependency list is
  // intentionally empty: this must never re-run and fight the front/rear
  // toggle with a second competing restart.
  useEffect(() => {
    const timer = setTimeout(() => {
      startWebcam();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setDetectionActive(false);
    setDetectedObjects([]);
    setIsTracking(false);
    setTrackingData([]);
  }, []);

  // Load COCO-SSD model once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
        await tf.ready();
        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        const m = await cocoSsd.load();
        if (!cancelled) {
          modelRef.current = m;
          setModelReady(true);
        }
      } catch {
        if (!cancelled) setModelError('Object detection model failed to load.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Stop camera cleanup for detection canvas
  useEffect(() => {
    if (!isWebcamActive) {
      const c = detectCanvasRef.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
      lastPredictionsRef.current = [];
    }
  }, [isWebcamActive]);

  // Real COCO-SSD detection loop (approx. 4 detections/sec; video stays smooth)
  useEffect(() => {
    if (!detectionActive || !isWebcamActive || !modelReady) return;
    let active = true;

    const loop = async (t: number) => {
      if (!active) return;
      rafRef.current = requestAnimationFrame(loop);
      const v = videoRef.current;
      const c = detectCanvasRef.current;
      if (!v || !c || !modelRef.current) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        if (t - lastInferRef.current >= 250) {
          lastInferRef.current = t;
          setIsDetecting(true);
          try {
            const preds = await modelRef.current.detect(v);
            const filtered = preds.filter((p) => p.score >= 0.5);
            lastPredictionsRef.current = filtered;
            verificationRef.current.updateFrame(filtered.map((p) => p.class));

            // --- Indian vehicle classification -----------------------------
            // Trained weights (if present) resolve the true subclass on the
            // cropped region; otherwise COCO-SSD + measured geometry gives an
            // explicitly-unverified estimate. Never blocks the detector.
            const frameWidth = v.videoWidth || 1;
            const frameHeight = v.videoHeight || 1;
            const MAX_DEDICATED_BOXES = 4;
            if (dedicatedModelRef.current && filtered.length && t - lastDedicatedInferRef.current >= 1000) {
              lastDedicatedInferRef.current = t;
              const boxes = filtered.slice(0, MAX_DEDICATED_BOXES).map((p) => ({
                x: p.bbox[0],
                y: p.bbox[1],
                width: p.bbox[2],
                height: p.bbox[3],
              }));
              try {
                dedicatedResultsRef.current = await classifyRegionsWithDedicatedModel(dedicatedModelRef.current, v, boxes);
              } catch {
                dedicatedResultsRef.current = [];
              }
            } else if (!dedicatedModelRef.current) {
              dedicatedResultsRef.current = [];
            }
            lastVerdictsRef.current = filtered.map((p, i) => {
              const dedicated = i < MAX_DEDICATED_BOXES ? dedicatedResultsRef.current?.[i] : null;
              return classifyVehicle({
                detectorClass: p.class,
                score: p.score,
                box: { x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] },
                frameWidth,
                frameHeight,
                dedicatedLabel: dedicated?.subtype ?? null,
                dedicatedScore: dedicated?.score ?? null,
              });
            });

            const classes = filtered.map((p) => p.class).join(',');
            if (classes !== lastClassesRef.current) {
              lastClassesRef.current = classes;
              setDetectedObjects(filtered.map((p) => p.class));
            }
            setDetectionConfidence(filtered.length ? Math.round(Math.max(...filtered.map((p) => p.score)) * 100) : 0);

            // --- Automatic evidence capture ---------------------------------
            // Only fires once a candidate actually passes the verification
            // rules. Throttled, de-duplicated, and never blocks the loop.
            if (
              DEFAULT_VERIFICATION_CONFIG.autoCaptureConfirmed &&
              filtered.length &&
              t - lastAutoCaptureCheckRef.current >= 1200
            ) {
              lastAutoCaptureCheckRef.current = t;
              const liveAuto = liveCaptureCtxRef.current;
              const personBoxes: Box[] = filtered
                .filter((p) => p.class === 'person')
                .map((p) => ({ x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] }));
              const speed = liveAuto.speedKmh;
              const locked = liveAuto.gpsStatus === 'locked';
              for (const p of filtered) {
                const cls = p.class;
                const isTwoWheeler = TWO_WHEELER_CLASSES.includes(cls);
                const isVehicleish = isVehicleClass(cls);
                // Only rules we can actually evaluate are auto-triggered.
                const maybeOverspeed =
                  isVehicleish && locked && speed > DEFAULT_VERIFICATION_CONFIG.overspeedLimitKmh;
                const maybeTriple = isTwoWheeler && personBoxes.length >= 2;
                if (!maybeOverspeed && !maybeTriple) continue;

                const verdictCheck = verifyCandidate(DEFAULT_VERIFICATION_CONFIG, {
                  detectedClass: cls,
                  confidence: p.score,
                  speedKmh: speed,
                  hasGpsFix: locked,
                  isVehicle: isVehicleish,
                  frameStreak: verificationRef.current.streakFor(cls),
                  now: Date.now(),
                  tripleRiding: isTwoWheeler
                    ? {
                        twoWheeler: { x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] },
                        persons: personBoxes,
                      }
                    : null,
                });
                if (
                  verdictCheck.status === 'confirmed' &&
                  verdictCheck.violationType &&
                  !verificationRef.current.isDuplicate(verdictCheck.violationType, Date.now())
                ) {
                  // Fire and forget: captureEvidence serialises itself.
                  void captureEvidence('auto');
                  break;
                }
              }
            }
          } catch {
            // skip frame
          } finally {
            setIsDetecting(false);
          }
        }
        // Draw latest boxes (scaled from video intrinsic size to displayed size)
        const ctx = c.getContext('2d');
        if (ctx) {
          if (c.width !== c.clientWidth) c.width = c.clientWidth;
          if (c.height !== c.clientHeight) c.height = c.clientHeight;
          ctx.clearRect(0, 0, c.width, c.height);
          const sx = c.width / v.videoWidth;
          const sy = c.height / v.videoHeight;
          lastPredictionsRef.current.forEach((p, idx) => {
            const [x, y, w, h] = p.bbox;
            const verdict = lastVerdictsRef.current[idx];
            // Green outline = verified subclass (trained model).
            // Orange outline = heuristic / unverified estimate.
            ctx.strokeStyle = verdict && !verdict.verified && isVehicleClass(p.class) ? '#FF8C69' : '#22c55e';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * sx, y * sy, w * sx, h * sy);
            const name = verdict ? verdict.label : toDetectedLabel(p.class, p.score).label;
            const pct = verdict ? Math.round(verdict.confidence * 100) : Math.round(p.score * 100);
            const mark = verdict && !verdict.verified && isVehicleClass(p.class) ? ' ~' : '';
            const label = `${name}${mark} • ${pct}%`;
            ctx.font = 'bold 12px monospace';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(x * sx, Math.max(0, y * sy - 18), tw + 6, 16);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x * sx + 3, Math.max(12, y * sy - 5));
          });
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      const c = detectCanvasRef.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
      lastPredictionsRef.current = [];
      lastClassesRef.current = '';
    };
  }, [detectionActive, isWebcamActive, modelReady]);


  // Save contacts to localStorage
  useEffect(() => {
    localStorage.setItem('aegis_emergency_contacts', JSON.stringify(savedContacts));
  }, [savedContacts]);

  const addContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    setSavedContacts((prev) => [
      ...prev,
      { id: Date.now().toString(), name: newContactName.trim(), phone: newContactPhone.trim() },
    ]);
    setNewContactName('');
    setNewContactPhone('');
    setIsAddContactOpen(false);
  };

  const removeContact = (id: string) => {
    setSavedContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'police': return AlertOctagon;
      case 'ambulance': return Heart;
      case 'fire': return ShieldAlert;
      default: return Phone;
    }
  };

  const speedColor = speedKmh > 80 ? '#FF4D4D' : speedKmh > 50 ? '#FFB347' : '#FFD18C';


  return (
    <div className="pt-24 pb-16 px-4 sm:px-8 max-w-[1700px] mx-auto space-y-6">

      {/* TOP HUD - 2 METRICS - Scrolls naturally with page */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1. Digital Speedometer with Detected Vehicles */}
        <div className="glass-panel p-5 border-cyber-blue/20 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-5 h-5 text-cyber-blue" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Digital Speedometer</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-display font-black tracking-tight" style={{ color: speedColor }}>
              {esp32Connected && esp32Data ? esp32Data.speed : speedKmh.toFixed(0)}
            </span>
            <span className="text-sm text-white/50 font-mono mb-1">km/h</span>
          </div>
          {esp32Connected && esp32Data && (
            <p className="text-[9px] font-mono text-cyber-green mt-1">ESP32-CAM Live Data</p>
          )}
          <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: speedColor }}
              animate={{ width: `${(speedKmh / 120) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {/* Speed history sparkline */}
          <div className="mt-2 flex items-end gap-0.5 h-6">
            {speedHistory.map((s, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm opacity-60"
                style={{
                  height: `${(s / 120) * 100}%`,
                  backgroundColor: speedColor,
                }}
              />
            ))}
          </div>

          {/* Feature 1: Detected Vehicles with License Plates */}
          {detectedVehicles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[9px] font-black uppercase tracking-widest text-cyber-blue mb-2 flex items-center gap-1">
                <Car className="w-3 h-3" /> Detected Vehicles
              </p>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {detectedVehicles.map((vehicle, idx) => (
                  <div key={vehicle.id} className="flex items-center justify-between bg-white/5 rounded-lg px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-white/40">#{idx + 1}</span>
                      <span className="text-[10px] font-bold text-white">{vehicle.plate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-mono">
                      <span className="text-cyber-green">{vehicle.distance}m</span>
                      <span className="text-white/50">{vehicle.speed}km/h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. ESP32-CAM Connection */}
        <div className="glass-panel p-5 border-cyber-green/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-cyber-green" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">ESP32-CAM</span>
            </div>
            <button
              onClick={() => setEsp32Connected(!esp32Connected)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                esp32Connected
                  ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {esp32Connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
          {esp32Connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-mono text-cyber-green">
                <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                <span>Live via Mobile WiFi</span>
              </div>
              {esp32Data && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-[8px] text-white/40 uppercase">Speed</p>
                    <p className="text-xs font-mono font-bold text-cyber-green">{esp32Data.speed} km/h</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-[8px] text-white/40 uppercase">Persons</p>
                    <p className="text-xs font-mono font-bold text-cyber-blue">{esp32Data.persons}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-[8px] text-white/40 uppercase">Plates</p>
                    <p className="text-xs font-mono font-bold text-cyber-purple">{esp32Data.plates.length}</p>
                  </div>
                </div>
              )}
              {detectedPersons.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Detected Persons</p>
                  {detectedPersons.map((person, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
                      <User className="w-3.5 h-3.5 text-cyber-blue" />
                      <span className="text-[10px] font-bold text-white">{person}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-white/40">Connect ESP32-CAM via mobile WiFi hotspot</p>
              <input
                type="text"
                value={esp32StreamUrl}
                onChange={(e) => setEsp32StreamUrl(e.target.value)}
                placeholder="Stream URL"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-green"
              />
            </div>
          )}
        </div>

        {/* 3. GPS Satellite Link */}
        <div className="glass-panel p-5 border-cyber-purple/20 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-5 h-5 text-cyber-purple" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">GPS Satellite</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {gpsStatus === 'locked' ? (
              <CheckCircle className="w-5 h-5 text-cyber-green" />
            ) : gpsStatus === 'denied' ? (
              <WifiOff className="w-5 h-5 text-cyber-red" />
            ) : (
              <Wifi className="w-5 h-5 text-cyber-purple animate-pulse" />
            )}
            <span className={`text-sm font-display font-black uppercase ${
              gpsStatus === 'locked' ? 'text-cyber-green' : gpsStatus === 'denied' ? 'text-cyber-red' : 'text-cyber-purple'
            }`}>
              {gpsStatus === 'locked' ? '3D Fix Locked' : gpsStatus === 'denied' ? 'Access Denied' : gpsStatus === 'searching' ? 'Acquiring...' : 'Unavailable'}
            </span>
          </div>
          {gpsCoords && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-white/50">
                LAT: <span className="text-white">{gpsCoords.lat.toFixed(6)}</span>
              </p>
              <p className="text-[10px] font-mono text-white/50">
                LNG: <span className="text-white">{gpsCoords.lng.toFixed(6)}</span>
              </p>
              <p className="text-[10px] font-mono text-white/50">
                ACC: <span className="text-cyber-green">±{gpsAccuracy}m</span> | SAT: <span className="text-cyber-purple">{satellites}</span>
              </p>
              <p className="text-[10px] font-mono text-white/50">
                ALT: <span className="text-white">{gpsAltitude !== null ? `${gpsAltitude}m` : '—'}</span> | HDG: <span className="text-white">{gpsHeading !== null ? `${gpsHeading}°` : '—'}</span> | SPD: <span className="text-cyber-green">{gpsSpeed.toFixed(1)} km/h</span>
              </p>
            </div>
          )}
          {gpsSignalWeak && gpsStatus !== 'denied' && (
            <p className="text-[9px] text-cyber-orange mt-2">GPS signal is weak — move to open sky for better accuracy.</p>
          )}
          {gpsStatus === 'denied' && (
            <p className="text-[9px] text-cyber-red/70 mt-2">Enable location permissions in browser settings</p>
          )}
        </div>

      </div>

      {/* MAIN CONTENT: WEBCAM + DETECTION + TRACKING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webcam Feed - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel overflow-hidden relative aspect-video bg-black flex items-center justify-center border-white/10">
            {/* Top badges */}
            <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
              <span className="px-3 py-1 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl text-[9px] font-black uppercase text-cyber-blue flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isWebcamActive ? 'bg-cyber-green animate-pulse' : 'bg-white/20'}`} />
                {isWebcamActive ? 'LIVE FEED' : 'STANDBY'}
              </span>
              {detectionActive && (
                <span className="px-3 py-1 bg-black/80 backdrop-blur-md border border-cyber-purple/30 rounded-xl text-[9px] font-black uppercase text-cyber-purple flex items-center gap-1.5">
                  <Crosshair className="w-3 h-3" />
                  YOLOv8 ACTIVE
                </span>
              )}
              {isTracking && (
                <span className="px-3 py-1 bg-black/80 backdrop-blur-md border border-cyber-green/30 rounded-xl text-[9px] font-black uppercase text-cyber-green flex items-center gap-1.5">
                  <Signal className="w-3 h-3" />
                  TRACKING
                </span>
              )}
            </div>

            {/* Webcam controls — wrap within the card so they never
                overflow or get clipped on narrow screens */}
            <div className="absolute top-4 right-4 z-40 flex flex-wrap items-center justify-end gap-2 max-w-[calc(100%-2rem)] sm:max-w-none">
              {!isWebcamActive ? (
                <button
                  onClick={() => startWebcam()}
                  className="px-4 py-2 bg-cyber-blue text-black rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-all shadow-[0_0_20px_#FF6B35] touch-manipulation"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera
                </button>
              ) : (
                <>
                  {/* Front/Rear camera toggle */}
                  <button
                    onClick={() => {
                      const newFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
                      setFacingMode(newFacing);
                      // startWebcam stops the current stream itself and takes
                      // the new facing mode directly, so there is no stale
                      // closure and no competing timed restart.
                      startWebcam(newFacing);
                    }}
                    className="px-3 py-2 bg-black/60 backdrop-blur-md border border-white/15 hover:bg-black/80 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all touch-manipulation"
                    title={facingMode === 'user' ? 'Switch to Rear Camera' : 'Switch to Front Camera'}
                  >
                    <Camera className="w-4 h-4" />
                    {facingMode === 'user' ? 'Front' : 'Rear'}
                  </button>
                  <button
                    onClick={() => setDetectionActive(!detectionActive)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all touch-manipulation ${
                      detectionActive
                        ? 'bg-cyber-purple text-black shadow-[0_0_20px_#FF8C69]'
                        : 'bg-black/60 backdrop-blur-md border border-white/15 text-white hover:bg-black/80'
                    }`}
                  >
                    <Crosshair className="w-4 h-4" />
                    {detectionActive ? 'Stop Detection' : 'YOLOv8 Detect'}
                  </button>
                  <button
                    onClick={() => captureEvidence('manual')}
                    className="px-4 py-2 bg-cyber-green text-black rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-all touch-manipulation"
                  >
                    <Camera className="w-4 h-4" />
                    Capture
                  </button>
                  <button
                    onClick={stopWebcam}
                    className="px-4 py-2 bg-cyber-red text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-all touch-manipulation"
                  >
                    <CameraOff className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
            </div>

            {/* Video element - always rendered so ref is available for auto-start */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isWebcamActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            <canvas
              ref={detectCanvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${isWebcamActive ? 'block' : 'hidden'}`}
            />

            {/* Detection overlay - only when active */}
            {isWebcamActive && detectionActive && (
              <div className="absolute inset-0 pointer-events-none z-30">
                <motion.div
                  initial={{ y: '-10%' }}
                  animate={{ y: '110%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-full h-1 bg-gradient-to-r from-transparent via-cyber-purple/50 to-transparent"
                />
                {detectedObjects.length > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="border-2 border-cyber-purple/60 rounded-lg p-4 bg-black/40 backdrop-blur-sm"
                    >
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[...new Set(lastVerdictsRef.current.map((v) => v.label))].map((label) => (
                          <span key={label} className="px-2 py-1 bg-cyber-purple/20 border border-cyber-purple/40 rounded text-[10px] font-mono text-cyber-purple uppercase">
                            {label}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            )}

            {/* Placeholder when camera is not active */}
            {!isWebcamActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8 z-30">
                  <Camera className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white/60 mb-1">Camera Standby</h3>
                  <p className="text-xs text-white/30 max-w-sm mx-auto">
                    {webcamError || 'Start your camera to enable YOLOv8 object detection and vehicle tracking.'}
                  </p>
                </div>
              </div>
            )}

            {/* Bottom info bar */}
            <div className="absolute bottom-4 left-4 right-4 z-40 flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 block">Detection Engine</span>
                <span className="font-mono text-xs text-cyber-purple font-bold">
                  YOLOv8n • 640x640 • 30 FPS
                </span>
              </div>
              {isDetecting && (
                <div className="flex items-center gap-2 text-cyber-purple">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Crosshair className="w-4 h-4" />
                  </motion.div>
                  <span className="text-[10px] font-mono uppercase">Processing...</span>
                </div>
              )}
            </div>
          </div>

          {/* Feature 7: Tracking Data Panel */}
          {isTracking && (
            <div className="glass-panel p-5 border-cyber-green/20">
              <h3 className="text-xs font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                <Signal className="w-4 h-4 text-cyber-green" /> Live Tracking Data
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-[9px] text-white/40 uppercase">WiFi Range</p>
                  <p className="text-lg font-display font-black text-cyber-green">{wifiRange}%</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-[9px] text-white/40 uppercase">Data Points</p>
                  <p className="text-lg font-display font-black text-cyber-blue">{trackingData.length}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-[9px] text-white/40 uppercase">Speed</p>
                  <p className="text-lg font-display font-black text-cyber-purple">{speedKmh.toFixed(0)} km/h</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-[9px] text-white/40 uppercase">Status</p>
                  <p className="text-lg font-display font-black text-cyber-green">Active</p>
                </div>
              </div>
              {trackingData.length > 0 && (
                <div className="mt-3 p-3 bg-black/40 rounded-lg">
                  <p className="text-[9px] font-mono text-white/50">
                    Last update: {new Date(trackingData[trackingData.length - 1]?.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Captured / Violation Evidence Gallery */}
          {evidenceViolations.length > 0 && (
            <div className="glass-panel p-5 border-white/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyber-green" /> Evidence ({evidenceViolations.length})
              </h3>
              {storageError && <p className="text-[9px] text-cyber-red mb-2">{storageError}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {evidenceViolations.map((v) => (
                  <div key={v.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setViewingEvidence(v.record)}
                      aria-label={`View details for evidence ${v.label}`}
                      className="block w-full touch-manipulation"
                    >
                      <img
                        src={v.url}
                        alt={`Evidence ${v.label}`}
                        onError={(e) => {
                          // Gracefully handle a missing / corrupted image file.
                          const el = e.currentTarget;
                          el.style.visibility = 'hidden';
                          el.setAttribute('data-broken', '1');
                        }}
                        className="w-full h-24 object-cover rounded-xl border border-white/10"
                      />
                    </button>
                    {/* verification status badge */}
                    <span
                      className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase pointer-events-none ${
                        v.record.verificationStatus === 'confirmed'
                          ? 'bg-cyber-green text-black'
                          : 'bg-cyber-orange text-black'
                      }`}
                    >
                      {v.record.verificationStatus === 'confirmed' ? 'Confirmed' : 'Unverified'}
                    </span>
                    {/* review status badge (human workflow) */}
                    {v.record.reviewStatus && v.record.reviewStatus !== 'pending' && (
                      <span
                        className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase pointer-events-none ${
                          v.record.reviewStatus === 'approved'
                            ? 'bg-cyber-blue text-black'
                            : 'bg-cyber-red text-white'
                        }`}
                      >
                        {v.record.reviewStatus === 'approved' ? 'Reviewed' : 'Rejected'}
                      </span>
                    )}
                    {/* actions — always visible so they work on touch */}
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button onClick={() => setViewingEvidence(v.record)} aria-label="View evidence details" title="View details"
                        className="p-1 bg-black/70 text-white rounded-lg hover:bg-black/90 touch-manipulation">
                        <Eye className="w-3 h-3" />
                      </button>
                      <button onClick={() => downloadEvidence(v)} aria-label="Download evidence" title="Download"
                        className="p-1 bg-black/70 text-white rounded-lg hover:bg-black/90 touch-manipulation">
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => openEditEvidence(v.record)}
                        aria-label="Edit evidence" title="Edit"
                        className="p-1 bg-black/70 text-white rounded-lg hover:bg-black/90 touch-manipulation"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(v.id)} aria-label="Delete evidence" title="Delete"
                        className="p-1 bg-cyber-red/80 text-white rounded-lg hover:bg-cyber-red touch-manipulation">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[9px] font-mono text-white/60 mt-1 truncate">{v.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete confirmation modal */}
          {confirmDeleteId && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="w-full max-w-sm p-5 bg-[#14100D] border border-white/10 rounded-2xl">
                <h3 className="text-sm font-black text-white mb-2">Delete evidence?</h3>
                <p className="text-xs text-white/50 mb-5">This permanently deletes the captured image and its metadata. This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-xs font-bold touch-manipulation">Cancel</button>
                  <button onClick={() => confirmDeleteEvidence(confirmDeleteId)}
                    className="flex-1 py-2.5 bg-cyber-red text-white rounded-xl text-xs font-black touch-manipulation">Delete</button>
                </div>
              </div>
            </div>
          )}

          {/* View evidence details (read-only) */}
          {viewingEvidence && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="w-full max-w-md max-h-[90vh] overflow-y-auto p-5 bg-[#14100D] border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-white">Evidence details</h3>
                  <button type="button" onClick={() => setViewingEvidence(null)} aria-label="Close details"
                    className="p-1 text-white/40 hover:text-white touch-manipulation">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {evidenceUrlFor(viewingEvidence.id) ? (
                  <img
                    src={evidenceUrlFor(viewingEvidence.id)}
                    alt={`Evidence ${viewingEvidence.type}`}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    className="w-full max-h-[40vh] object-contain rounded-xl border border-white/10 mb-4 bg-black"
                  />
                ) : (
                  <div className="w-full py-8 mb-4 px-3 text-center text-[10px] text-white/40 bg-black/40 rounded-xl border border-white/10">
                    Image file is missing or could not be read. The metadata below is still available.
                  </div>
                )}

                <div className="space-y-2 text-[11px]">
                  {[
                    ['Type', viewingEvidence.type],
                    ['Verification', viewingEvidence.verificationStatus || 'unverified'],
                    ['Review', viewingEvidence.reviewStatus || 'pending'],
                    ['Captured', new Date(viewingEvidence.createdAt).toLocaleString()],
                    ['Speed', viewingEvidence.speed != null ? `${viewingEvidence.speed} km/h` : 'Not recorded'],
                    ['Confidence', viewingEvidence.confidence != null ? `${viewingEvidence.confidence}%` : 'Not recorded'],
                    ['Vehicle class', viewingEvidence.vehicleClass || 'Not recorded'],
                    ['Detected objects', viewingEvidence.objects || 'None'],
                    ['GPS', viewingEvidence.lat != null && viewingEvidence.lng != null
                      ? `${viewingEvidence.lat.toFixed(5)}, ${viewingEvidence.lng.toFixed(5)}`
                      : 'No GPS fix'],
                  ].map(([k, val]) => (
                    <div key={k as string} className="flex items-start justify-between gap-3 bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-white/40 font-black uppercase text-[9px] tracking-widest shrink-0">{k}</span>
                      <span className="text-white/80 text-right break-all">{val}</span>
                    </div>
                  ))}
                </div>

                {viewingEvidence.reasons && viewingEvidence.reasons.length > 0 && (
                  <div className="mt-3 bg-white/5 rounded-lg px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Verification reasons</p>
                    <ul className="text-[10px] text-white/60 space-y-0.5 list-disc list-inside">
                      {viewingEvidence.reasons.map((r, i) => (<li key={i}>{r}</li>))}
                    </ul>
                  </div>
                )}

                {viewingEvidence.reviewNote && (
                  <div className="mt-2 bg-white/5 rounded-lg px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Review note</p>
                    <p className="text-[10px] text-white/70">{viewingEvidence.reviewNote}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const item = evidenceViolations.find((x) => x.id === viewingEvidence.id);
                      if (item) downloadEvidence(item);
                    }}
                    className="flex-1 py-2.5 bg-cyber-green text-black rounded-xl text-xs font-black touch-manipulation"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => { openEditEvidence(viewingEvidence); setViewingEvidence(null); }}
                    className="flex-1 py-2.5 bg-cyber-blue text-black rounded-xl text-xs font-black touch-manipulation"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit evidence metadata modal (image is never modified) */}
          {editingEvidence && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 bg-[#14100D] border border-white/10 rounded-2xl">
                <h3 className="text-sm font-black text-white mb-4">Edit evidence</h3>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Type</label>
                <input
                  type="text"
                  value={editingEvidence.type}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, type: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white mb-3 focus:outline-none focus:border-cyber-blue"
                />
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">
                  Speed (km/h) — blank keeps captured value
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={editingEvidence.speed}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, speed: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white mb-3 focus:outline-none focus:border-cyber-blue"
                />
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Detected objects</label>
                <input
                  type="text"
                  value={editingEvidence.objects}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, objects: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white mb-3 focus:outline-none focus:border-cyber-blue"
                />
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Verification status</label>
                <div className="flex gap-2 mb-3">
                  {(['confirmed', 'unverified'] as const).map((s) => (
                    <button key={s} type="button"
                      onClick={() => setEditingEvidence({ ...editingEvidence, verificationStatus: s })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase touch-manipulation ${
                        editingEvidence.verificationStatus === s
                          ? s === 'confirmed' ? 'bg-cyber-green text-black' : 'bg-cyber-orange text-black'
                          : 'bg-white/5 text-white/50 border border-white/10'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Review status</label>
                <div className="flex gap-2 mb-3">
                  {(['pending', 'approved', 'rejected'] as const).map((s) => (
                    <button key={s} type="button"
                      onClick={() => setEditingEvidence({ ...editingEvidence, reviewStatus: s })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase touch-manipulation ${
                        editingEvidence.reviewStatus === s
                          ? s === 'approved' ? 'bg-cyber-blue text-black'
                            : s === 'rejected' ? 'bg-cyber-red text-white'
                            : 'bg-white/20 text-white'
                          : 'bg-white/5 text-white/50 border border-white/10'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Review note</label>
                <textarea
                  rows={2}
                  value={editingEvidence.reviewNote}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, reviewNote: e.target.value })}
                  placeholder="Optional note for the audit trail"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white mb-3 focus:outline-none focus:border-cyber-blue resize-y"
                />
                <p className="text-[9px] text-white/30 mb-4">The original captured image is always preserved.</p>
                <div className="flex gap-2">
                  <button onClick={() => setEditingEvidence(null)}
                    className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-xs font-bold touch-manipulation">Cancel</button>
                  <button onClick={saveEvidenceEdit}
                    className="flex-1 py-2.5 bg-cyber-blue text-black rounded-xl text-xs font-black touch-manipulation">Save</button>
                </div>
              </div>
            </div>
          )}

          {/* Detection Results Panel */}
          <div className="glass-panel p-5 border-white/10">
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyber-purple" /> YOLOv8 Detection Results
            </h3>
            {detectedObjects.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {lastVerdictsRef.current.map((v, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-white">{v.label}</p>
                      <p className="text-[9px] font-mono text-cyber-purple mt-1">Confidence: {Math.round(v.confidence * 100)}%</p>
                      <span
                        className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                          v.verified ? 'bg-cyber-green/20 text-cyber-green' : 'bg-cyber-orange/20 text-cyber-orange'
                        }`}
                      >
                        {v.verified ? 'Verified' : 'Heuristic'}
                      </span>
                      <p className="text-[8px] font-mono text-white/30 mt-1 leading-tight">{v.basis}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] font-mono text-white/30 mt-3 leading-relaxed">
                  {dedicatedModelActive
                    ? 'Trained Indian-vehicle classifier active — verified subclasses.'
                    : VEHICLE_SUBTYPE_LIMITATION}
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-white/20 text-xs">
                <Crosshair className="w-10 h-10 mx-auto mb-2 opacity-20" />
                Start camera and enable detection to see results
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Quick Actions & Status */}
        <div className="space-y-4">
          {/* Quick SOS with Add Contact */}
          <div className="glass-panel p-5 border-cyber-red/30 bg-cyber-red/5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-cyber-red flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Emergency SOS
              </h3>
              <button
                onClick={() => setIsAddContactOpen(true)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                title="Add Emergency Contact"
              >
                <Plus className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>
            <div className="space-y-2">
              <a
                href="tel:100"
                className="w-full py-3 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-blue-500/30 transition-all"
              >
                <AlertOctagon className="w-4 h-4" /> Police: 100
              </a>
              <a
                href="tel:102"
                className="w-full py-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red-500/30 transition-all"
              >
                <Heart className="w-4 h-4" /> Ambulance: 102
              </a>
              <a
                href="tel:112"
                className="w-full py-3 bg-white/5 border border-white/10 text-white/70 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
              >
                <Phone className="w-4 h-4" /> Emergency: 112
              </a>
              {/* Custom saved contacts */}
              {savedContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-xs font-bold text-white">{contact.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={`tel:${contact.phone}`} className="text-xs font-mono text-cyber-blue hover:underline">
                      {contact.phone}
                    </a>
                    <button onClick={() => removeContact(contact.id)} className="text-white/20 hover:text-cyber-red">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="glass-panel p-5 border-white/10 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyber-green" /> System Status
            </h3>
            <div className="space-y-2">
              {[
                { label: 'YOLOv8 Engine', status: 'Ready', color: 'text-cyber-green' },
                { label: 'Camera Module', status: isWebcamActive ? 'Active' : 'Standby', color: isWebcamActive ? 'text-cyber-green' : 'text-white/40' },
                { label: 'GPS Module', status: gpsStatus === 'locked' ? 'Locked' : 'Searching', color: gpsStatus === 'locked' ? 'text-cyber-green' : 'text-cyber-orange' },
                { label: 'ESP32-CAM', status: esp32Connected ? 'Connected' : 'Disconnected', color: esp32Connected ? 'text-cyber-green' : 'text-white/40' },
                { label: 'Tracking', status: isTracking ? 'Active' : 'Off', color: isTracking ? 'text-cyber-green' : 'text-white/40' },
                { label: 'Internet', status: 'Connected', color: 'text-cyber-green' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-bold text-white/60">{item.label}</span>
                  <span className={`text-[10px] font-mono font-bold ${item.color}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Contacts */}
          {savedContacts.length > 0 && (
            <div className="glass-panel p-5 border-white/10 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <User className="w-4 h-4 text-cyber-blue" /> Saved Contacts
              </h3>
              <div className="space-y-2">
                {savedContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-bold text-white">{contact.name}</p>
                      <p className="text-[10px] font-mono text-white/40">{contact.phone}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={`tel:${contact.phone}`} className="p-2 bg-cyber-blue/10 text-cyber-blue rounded-lg hover:bg-cyber-blue/20">
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <button onClick={() => removeContact(contact.id)} className="p-2 bg-white/5 text-white/30 rounded-lg hover:text-cyber-red">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      <Dialog.Root open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
        <AnimatePresence>
          {isAddContactOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-[201]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-[#121216] border border-white/10 rounded-3xl p-7 shadow-2xl"
                  >
                    <h2 className="text-xl font-display font-black text-white mb-6">Add Emergency Contact</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Name</label>
                        <input
                          type="text"
                          placeholder="Contact name"
                          value={newContactName}
                          onChange={(e) => setNewContactName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Phone Number</label>
                        <input
                          type="tel"
                          placeholder="Phone number"
                          value={newContactPhone}
                          onChange={(e) => setNewContactPhone(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setIsAddContactOpen(false)}
                        className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addContact}
                        className="flex-1 py-3 bg-cyber-blue text-black rounded-xl text-sm font-black hover:scale-[1.02] transition-all"
                      >
                        Add Contact
                      </button>
                    </div>
                  </motion.div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>

      {/* Verification result toast */}
      {captureResult && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[210] max-w-[92vw] px-4 py-3 rounded-2xl border shadow-2xl ${
          captureResult.status === 'confirmed'
            ? 'bg-cyber-green/95 border-cyber-green text-black'
            : captureResult.status === 'unverified'
            ? 'bg-cyber-orange/95 border-cyber-orange text-black'
            : 'bg-cyber-red/95 border-cyber-red text-white'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wider">
                {captureResult.status === 'confirmed'
                  ? `Confirmed: ${captureResult.violationType || 'Violation'}`
                  : captureResult.status === 'unverified'
                  ? `Candidate — requires review${captureResult.violationType ? ` (${captureResult.violationType})` : ''}`
                  : 'Capture rejected'}
              </p>
              <ul className="text-[10px] font-mono mt-1 space-y-0.5 list-disc list-inside">
                {captureResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <button onClick={() => setCaptureResult(null)} aria-label="Dismiss"
              className="shrink-0 p-1 text-current opacity-70 hover:opacity-100 touch-manipulation">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Portal-based dropdowns - rendered to document.body to escape all clipping contexts */}
    </div>
  );
}
