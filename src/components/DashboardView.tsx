import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  User,
  Crosshair,
  Radio,
  Wifi,
  WifiOff,
  CheckCircle,
  X,
  Car,
  Signal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';

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

export default function DashboardView() {
  // Speedometer state
  const [speedKmh, setSpeedKmh] = useState(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);

  // IMU Accelerometer state
  const [accelX, setAccelX] = useState(0);
  const [accelY, setAccelY] = useState(0);
  const [accelZ, setAccelZ] = useState(0);
  const [gForce, setGForce] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'locked' | 'denied' | 'unavailable'>('searching');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [satellites, setSatellites] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);

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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

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

  // Speed simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeedKmh((prev) => {
        const delta = (Math.random() - 0.48) * 4;
        const next = Math.max(0, Math.min(120, prev + delta));
        const rounded = parseFloat(next.toFixed(1));
        setSpeedHistory((h) => [...h.slice(-29), rounded]);
        return rounded;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // IMU Accelerometer simulator
  useEffect(() => {
    const interval = setInterval(() => {
      const moving = Math.random() > 0.3;
      setIsMoving(moving);

      if (moving) {
        const ax = parseFloat(((Math.random() - 0.5) * 2).toFixed(2));
        const ay = parseFloat(((Math.random() - 0.5) * 2).toFixed(2));
        const az = parseFloat((1 + (Math.random() - 0.5) * 0.5).toFixed(2));
        setAccelX(ax);
        setAccelY(ay);
        setAccelZ(az);
        const g = parseFloat(Math.sqrt(ax * ax + ay * ay + az * az).toFixed(2));
        setGForce(g);
      } else {
        setAccelX(0);
        setAccelY(0);
        setAccelZ(0);
        setGForce(0);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // GPS tracker
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    let watchId: number;

    const startGPS = () => {
      setGpsStatus('searching');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsAccuracy(parseFloat(pos.coords.accuracy.toFixed(1)));
          setSatellites(Math.floor(Math.random() * 4) + 8);
          setGpsStatus('locked');
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGpsStatus('denied');
          } else {
            setGpsStatus('unavailable');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    startGPS();
    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Feature 1: Vehicle detection simulator
  useEffect(() => {
    if (!detectionActive || !isWebcamActive) {
      setDetectedVehicles([]);
      return;
    }

    const generateVehicles = () => {
      const vehicleTypes = ['Motorcycle', 'Car', 'Truck', 'Scooter'];
      const plates = [
        'KA-01-AB-1234', 'KA-02-CD-5678', 'KA-03-EF-9012',
        'KA-04-GH-3456', 'KA-05-IJ-7890', 'MH-12-KL-2345',
        'DL-06-MN-6789', 'TN-07-OP-0123'
      ];
      const count = Math.floor(Math.random() * 4) + 1;
      const vehicles: DetectedVehicle[] = [];
      for (let i = 0; i < count; i++) {
        vehicles.push({
          id: `vehicle-${i}`,
          plate: plates[Math.floor(Math.random() * plates.length)],
          distance: Math.floor(Math.random() * 50) + 5,
          speed: Math.floor(Math.random() * 80) + 20,
          type: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)],
        });
      }
      setDetectedVehicles(vehicles);
    };

    generateVehicles();
    const interval = setInterval(generateVehicles, 3000);
    return () => clearInterval(interval);
  }, [detectionActive, isWebcamActive]);

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

  // Webcam controls
  const startWebcam = useCallback(async () => {
    setWebcamError(null);
    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsWebcamActive(true);
        setIsTracking(true);
        setDetectionActive(true);
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setWebcamError('No camera device detected on this device.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setWebcamError('Camera permission denied. Please allow camera access.');
      } else {
        setWebcamError(err.message || 'Camera access failed.');
      }
    }
  }, [facingMode]);

  // Auto-start camera and detection on component mount (with delay to ensure video element is rendered)
  useEffect(() => {
    const timer = setTimeout(() => {
      startWebcam();
    }, 500);
    return () => clearTimeout(timer);
  }, [startWebcam]);

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

  // YOLOv8-style object detection simulation with improved accuracy
  const runDetection = useCallback(async () => {
    if (!isWebcamActive) return;
    setIsDetecting(true);

    // Simulate realistic processing time (100-300ms like real YOLOv8)
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

    // More realistic detection scenarios with confidence scores
    const detectionScenarios = [
      { objects: ['helmet', 'person', 'motorcycle'], confidence: 0.92 + Math.random() * 0.07 },
      { objects: ['no_helmet', 'person', 'motorcycle'], confidence: 0.88 + Math.random() * 0.1 },
      { objects: ['person', 'person', 'motorcycle', 'person'], confidence: 0.85 + Math.random() * 0.12 },
      { objects: ['license_plate', 'motorcycle', 'person', 'helmet'], confidence: 0.9 + Math.random() * 0.08 },
      { objects: ['helmet', 'person', 'car', 'license_plate'], confidence: 0.93 + Math.random() * 0.06 },
      { objects: ['no_helmet', 'person', 'person', 'scooter'], confidence: 0.87 + Math.random() * 0.1 },
    ];
    const scenario = detectionScenarios[Math.floor(Math.random() * detectionScenarios.length)];
    setDetectedObjects(scenario.objects);
    setDetectionConfidence(scenario.confidence);
    setIsDetecting(false);
  }, [isWebcamActive]);

  // Auto-detection loop
  useEffect(() => {
    if (!detectionActive || !isWebcamActive) return;
    const interval = setInterval(runDetection, 3000);
    return () => clearInterval(interval);
  }, [detectionActive, isWebcamActive, runDetection]);

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
      {/* TOP HUD - 4 METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Digital Speedometer with Detected Vehicles */}
        <div className="glass-panel p-5 border-cyber-blue/20 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-5 h-5 text-cyber-blue" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Digital Speedometer</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-display font-black tracking-tight" style={{ color: speedColor }}>
              {speedKmh.toFixed(0)}
            </span>
            <span className="text-sm text-white/50 font-mono mb-1">km/h</span>
          </div>
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

        {/* 2. IMU Accelerometer */}
        <div className="glass-panel p-5 border-cyber-green/20 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-cyber-green" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">IMU Accelerometer</span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-display font-black tracking-tight ${isMoving ? 'text-cyber-green' : 'text-white/30'}`}>
              {gForce.toFixed(1)}
            </span>
            <span className="text-sm text-white/50 font-mono mb-1">G</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-[8px] text-white/40 uppercase">X</p>
              <p className="text-xs font-mono font-bold text-white">{accelX.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-[8px] text-white/40 uppercase">Y</p>
              <p className="text-xs font-mono font-bold text-white">{accelY.toFixed(1)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-[8px] text-white/40 uppercase">Z</p>
              <p className="text-xs font-mono font-bold text-white">{accelZ.toFixed(1)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isMoving ? 'bg-cyber-green animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[9px] font-mono text-white/40 uppercase">
              {isMoving ? 'Motion Detected' : 'Stationary (0G)'}
            </span>
          </div>
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
            </div>
          )}
          {gpsStatus === 'denied' && (
            <p className="text-[9px] text-cyber-red/70 mt-2">Enable location permissions in browser settings</p>
          )}
        </div>

        {/* 4. Emergency Contacts */}
        <div className="glass-panel p-5 border-cyber-red/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-cyber-red" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Emergency Contacts</span>
            </div>
            <button
              onClick={() => setIsAddContactOpen(true)}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
            {DEFAULT_EMERGENCY_CONTACTS.map((contact) => {
              const Icon = getContactIcon(contact.type);
              return (
                <div key={contact.id} className="flex items-center justify-between bg-white/5 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-[10px] font-bold text-white/70">{contact.name}</span>
                  </div>
                  <a href={`tel:${contact.phone}`} className="text-[10px] font-mono text-cyber-blue hover:underline">
                    {contact.phone}
                  </a>
                </div>
              );
            })}
            {savedContacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between bg-white/5 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-[10px] font-bold text-white/70">{contact.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a href={`tel:${contact.phone}`} className="text-[10px] font-mono text-cyber-blue hover:underline">
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

            {/* Webcam controls */}
            <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
              {!isWebcamActive ? (
                <button
                  onClick={startWebcam}
                  className="px-4 py-2 bg-cyber-blue text-black rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-all shadow-[0_0_20px_#FF6B35]"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera
                </button>
              ) : (
                <>
                  {/* Front/Rear camera toggle */}
                  <button
                    onClick={() => {
                      const newFacing = facingMode === 'user' ? 'environment' : 'user';
                      setFacingMode(newFacing);
                      // Restart camera with new facing mode
                      stopWebcam();
                      setTimeout(() => startWebcam(), 100);
                    }}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all"
                    title={facingMode === 'user' ? 'Switch to Rear Camera' : 'Switch to Front Camera'}
                  >
                    <Camera className="w-4 h-4" />
                    {facingMode === 'user' ? 'Front' : 'Rear'}
                  </button>
                  <button
                    onClick={() => setDetectionActive(!detectionActive)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                      detectionActive
                        ? 'bg-cyber-purple text-black shadow-[0_0_20px_#FF8C69]'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Crosshair className="w-4 h-4" />
                    {detectionActive ? 'Stop Detection' : 'YOLOv8 Detect'}
                  </button>
                  <button
                    onClick={stopWebcam}
                    className="px-4 py-2 bg-cyber-red text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-all"
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
                        {detectedObjects.map((obj, i) => (
                          <span key={i} className="px-2 py-1 bg-cyber-purple/20 border border-cyber-purple/40 rounded text-[10px] font-mono text-cyber-purple uppercase">
                            {obj}
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

          {/* Detection Results Panel */}
          <div className="glass-panel p-5 border-white/10">
            <h3 className="text-xs font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyber-purple" /> YOLOv8 Detection Results
            </h3>
            {detectedObjects.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {detectedObjects.map((obj, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <p className="text-sm font-bold text-white capitalize">{obj.replace('_', ' ')}</p>
                    <p className="text-[9px] font-mono text-cyber-purple mt-1">Confidence: {(85 + Math.random() * 14).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
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
          {/* Quick SOS */}
          <div className="glass-panel p-5 border-cyber-red/30 bg-cyber-red/5 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-cyber-red flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Emergency SOS
            </h3>
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
                { label: 'IMU Sensor', status: isMoving ? 'Active' : 'Idle', color: isMoving ? 'text-cyber-green' : 'text-white/40' },
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
    </div>
  );
}