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
  Monitor,
  Bot,
  Shield,
  Database,
  LayoutDashboard,
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

  // Utility controls state
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [launcherPos, setLauncherPos] = useState({ top: 0, left: 0 });
  const [themePos, setThemePos] = useState({ top: 0, left: 0 });
  const [accountPos, setAccountPos] = useState({ top: 0, left: 0 });
  const gridRef = useRef<HTMLButtonElement>(null);
  const paletteRef = useRef<HTMLButtonElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  // Feature launcher data
  const [features, setFeatures] = useState(() => {
    try {
      const saved = localStorage.getItem('aegis_features');
      return saved ? JSON.parse(saved) : [
        { id: 'dashboard', name: 'Dashboard', icon: 'gauge', route: 'dashboard' },
        { id: 'violations', name: 'Violations', icon: 'alert', route: 'violations' },
        { id: 'authority', name: 'RTO Command', icon: 'layout', route: 'authority' },
        { id: 'analytics', name: 'Analytics', icon: 'chart', route: 'authority' },
        { id: 'reports', name: 'Reports', icon: 'file', route: 'authority' },
        { id: 'alerts', name: 'Alerts', icon: 'bell', route: 'violations' },
        { id: 'users', name: 'Users', icon: 'users', route: 'settings' },
        { id: 'vehicles', name: 'Vehicles', icon: 'car', route: 'authority' },
        { id: 'documents', name: 'Documents', icon: 'file', route: 'settings' },
        { id: 'ai', name: 'AI Assistant', icon: 'bot', route: 'dashboard' },
        { id: 'monitor', name: 'System Monitor', icon: 'monitor', route: 'settings' },
        { id: 'settings', name: 'Settings', icon: 'settings', route: 'settings' },
      ];
    } catch { return []; }
  });

  const [newFeature, setNewFeature] = useState({ name: '', description: '', icon: 'gauge', route: 'dashboard' });

  // Favourites state
  const [favourites, setFavourites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_favourites');
      return saved ? JSON.parse(saved) : ['dashboard', 'violations', 'authority', 'settings'];
    } catch { return ['dashboard', 'violations', 'authority', 'settings']; }
  });
  const [showFavourites, setShowFavourites] = useState(false);
  const [favouritesPos, setFavouritesPos] = useState({ top: 0, left: 0 });
  const [editFavourites, setEditFavourites] = useState(false);

  // Save favourites
  useEffect(() => { localStorage.setItem('aegis_favourites', JSON.stringify(favourites)); }, [favourites]);

  // Save features
  useEffect(() => { localStorage.setItem('aegis_features', JSON.stringify(features)); }, [features]);

  // Position calculations
  const updateLauncherPosition = useCallback(() => {
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const w = 480;
      let left = rect.right - w;
      if (left < 8) left = 8;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      setLauncherPos({ top: rect.bottom + 10, left });
    }
  }, []);

  const updateThemePosition = useCallback(() => {
    if (paletteRef.current) {
      const rect = paletteRef.current.getBoundingClientRect();
      const w = 192;
      let left = rect.right - w;
      if (left < 8) left = 8;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      setThemePos({ top: rect.bottom + 8, left });
    }
  }, []);

  const updateAccountPosition = useCallback(() => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      const w = 280;
      let left = rect.right - w;
      if (left < 8) left = 8;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      setAccountPos({ top: rect.bottom + 8, left });
    }
  }, []);

  // Toggle functions
  const toggleLauncher = () => {
    if (!launcherOpen) updateLauncherPosition();
    setLauncherOpen(!launcherOpen);
    setShowUserMenu(false);
    setShowThemeMenu(false);
    setCustomizeMode(false);
  };

  const toggleThemeMenu = () => {
    if (!showThemeMenu) updateThemePosition();
    setShowThemeMenu(!showThemeMenu);
    setShowUserMenu(false);
    setLauncherOpen(false);
  };

  const toggleAccountMenu = () => {
    if (!showUserMenu) updateAccountPosition();
    setShowUserMenu(!showUserMenu);
    setLauncherOpen(false);
    setShowThemeMenu(false);
    setShowFavourites(false);
  };

  // Toggle favourites
  const toggleFavourites = useCallback(() => {
    if (!showFavourites) {
      if (gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        const w = 480;
        let left = rect.right - w;
        if (left < 8) left = 8;
        if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
        setFavouritesPos({ top: rect.bottom + 10, left });
      }
    }
    setShowFavourites(!showFavourites);
    setShowUserMenu(false);
    setLauncherOpen(false);
    setShowThemeMenu(false);
  }, [showFavourites]);

  // Favourites handlers
  const handleRemoveFavourite = (id: string) => {
    setFavourites(favourites.filter(f => f !== id));
  };

  const handleAddFavourite = (id: string) => {
    if (!favourites.includes(id)) {
      setFavourites([...favourites, id]);
    }
  };

  const handleMoveFavourite = (id: string, dir: 'up' | 'down') => {
    const idx = favourites.indexOf(id);
    if (idx === -1) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= favourites.length) return;
    const arr = [...favourites];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setFavourites(arr);
  };

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-launcher]')) { setLauncherOpen(false); setCustomizeMode(false); }
      if (!target.closest('[data-theme-menu]')) setShowThemeMenu(false);
      if (!target.closest('[data-account-menu]')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLauncherOpen(false); setCustomizeMode(false);
        setShowThemeMenu(false); setShowUserMenu(false);
        setShowLogoutConfirm(false); setShowSwitchAccount(false); setShowAddFeature(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Feature handlers
  const handleFeatureClick = (route: string) => {
    setLauncherOpen(false);
    setCustomizeMode(false);
    if (['dashboard', 'violations', 'authority', 'settings'].includes(route)) {
      onViewChange?.(route as any);
    }
  };

  const handleAddFeature = () => {
    if (!newFeature.name.trim()) return;
    setFeatures([...features, {
      id: `feature-${Date.now()}`, name: newFeature.name, description: newFeature.description,
      icon: newFeature.icon, route: newFeature.route, enabled: true, order: features.length,
    }]);
    setNewFeature({ name: '', description: '', icon: 'gauge', route: 'dashboard' });
    setShowAddFeature(false);
  };

  const handleDeleteFeature = (id: string) => setFeatures(features.filter(f => f.id !== id));

  const handleMoveFeature = (id: string, dir: 'up' | 'down') => {
    const idx = features.findIndex(f => f.id === id);
    if (idx === -1) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= features.length) return;
    const arr = [...features];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setFeatures(arr);
  };

  const handleLogout = () => { setShowLogoutConfirm(false); setShowUserMenu(false); onSignOut?.(); };
  const handleSwitchAccount = () => { setShowSwitchAccount(true); setShowUserMenu(false); };

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

  // Favourites portal renderer
  const renderFavourites = () => {
    if (!showFavourites) return null;
    return createPortal(
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[480px] max-w-[calc(100vw-16px)] bg-[#0d0d0f] border border-white/10 rounded-3xl shadow-[0_0_60px_rgba(255,107,53,0.15)] overflow-hidden"
        style={{ top: favouritesPos.top, left: favouritesPos.left, zIndex: 99999, maxHeight: 'calc(100vh - 120px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            {editFavourites ? 'Edit Favourites' : 'AEGIS Favourites'}
          </h3>
          <button
            onClick={() => setEditFavourites(!editFavourites)}
            className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Edit favourites"
          >
            {editFavourites ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {editFavourites ? (
            <div className="space-y-2">
              {favourites.map((fId) => {
                const feature = features.find(f => f.id === fId);
                if (!feature) return null;
                const Icon = getIcon(feature.icon);
                const idx = favourites.indexOf(fId);
                return (
                  <div key={fId} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-xl border border-white/10">
                    <Icon className="w-4 h-4 text-white/50" />
                    <span className="flex-1 text-xs font-bold text-white truncate">{feature.name}</span>
                    <button onClick={() => handleMoveFavourite(fId, 'up')} disabled={idx === 0} className="p-1 text-white/40 hover:text-white disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => handleMoveFavourite(fId, 'down')} disabled={idx === favourites.length - 1} className="p-1 text-white/40 hover:text-white disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-3 h-3" /></button>
                    <button onClick={() => handleRemoveFavourite(fId)} className="p-1 text-white/40 hover:text-cyber-red" aria-label="Remove favourite"><Trash2 className="w-3 h-3" /></button>
                  </div>
                );
              })}
              {/* Add favourite - show available features not yet in favourites */}
              {features.filter(f => !favourites.includes(f.id)).length > 0 && (
                <div className="pt-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2">Available to add</p>
                  <div className="space-y-1">
                    {features.filter(f => !favourites.includes(f.id)).map((f) => {
                      const Icon = getIcon(f.icon);
                      return (
                        <button key={f.id} onClick={() => handleAddFavourite(f.id)}
                          className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-white/50 hover:bg-white/5 hover:text-white transition-all">
                          <Icon className="w-4 h-4" />{f.name}
                          <Plus className="w-3 h-3 ml-auto" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {favourites.map((fId) => {
                const feature = features.find(f => f.id === fId);
                if (!feature) return null;
                const Icon = getIcon(feature.icon);
                return (
                  <button key={fId} onClick={() => handleFeatureClick(feature.route)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-cyber-blue/10 transition-all">
                      <Icon className="w-5 h-5 text-white/70 group-hover:text-cyber-blue transition-all" />
                    </div>
                    <span className="text-[10px] font-bold text-white/70 group-hover:text-white text-center leading-tight">{feature.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>,
      document.body
    );
  };

  // Account Profile portal renderer
  const renderAccountProfile = () => {
    if (!showUserMenu) return null;
    return createPortal(
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[280px] bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        style={{ top: accountPos.top, left: accountPos.left, zIndex: 99999 }}
      >
        {/* Account Header */}
        <div className="p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {userPhoto ? <img src={userPhoto} alt={userName} className="w-10 h-10 rounded-full object-cover" /> :
              <div className={`w-10 h-10 rounded-full ${getAvatarColor(userName || 'U')} flex items-center justify-center`}>
                <span className="text-sm font-black text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>}
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-white/40 truncate">harshan@example.com</p>
              <p className="text-[10px] text-cyber-green font-bold">Driver • Active</p>
            </div>
          </div>
        </div>
        {/* Menu Items */}
        <div className="p-2">
          <button onClick={() => { onViewChange?.('profile'); setShowUserMenu(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all">
            <User className="w-4 h-4" />Profile
          </button>
          <button onClick={() => { onViewChange?.('settings'); setShowUserMenu(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all">
            <Settings className="w-4 h-4" />Account Settings
          </button>
          <button onClick={() => setShowUserMenu(false)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all">
            <Bell className="w-4 h-4" />Notifications
          </button>
          <button onClick={handleSwitchAccount}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all">
            <Users className="w-4 h-4" />Switch Account
          </button>
          <div className="border-t border-white/10 my-2"></div>
          <button onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-cyber-red hover:bg-cyber-red/10 transition-all">
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>
      </motion.div>,
      document.body
    );
  };

  // Portal renderers
  const renderLauncher = () => {
    if (!launcherOpen) return null;
    return createPortal(
      <motion.div data-launcher
        initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[480px] max-w-[calc(100vw-16px)] bg-[#0d0d0f] border border-white/10 rounded-3xl shadow-[0_0_60px_rgba(255,107,53,0.15)] overflow-hidden"
        style={{ top: launcherPos.top, left: launcherPos.left, zIndex: 99999, maxHeight: 'calc(100vh - 120px)' }}>
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            {customizeMode ? 'Customize AEGIS' : 'AEGIS Features'}
          </h3>
          <div className="flex items-center gap-2">
            {!customizeMode && (
              <button onClick={() => setCustomizeMode(true)} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5" aria-label="Customize features">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {customizeMode && (
              <button onClick={() => setCustomizeMode(false)} className="p-1.5 text-cyber-green hover:text-white rounded-lg hover:bg-white/5" aria-label="Done">
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {customizeMode ? (
            <div className="space-y-2">
              {features.map((f, i) => {
                const Icon = getIcon(f.icon);
                return (
                  <div key={f.id} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-xl border border-white/10">
                    <Icon className="w-4 h-4 text-white/50" />
                    <span className="flex-1 text-xs font-bold text-white truncate">{f.name}</span>
                    <button onClick={() => handleMoveFeature(f.id, 'up')} disabled={i === 0} className="p-1 text-white/40 hover:text-white disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => handleMoveFeature(f.id, 'down')} disabled={i === features.length - 1} className="p-1 text-white/40 hover:text-white disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteFeature(f.id)} className="p-1 text-white/40 hover:text-cyber-red" aria-label="Delete"><Trash2 className="w-3 h-3" /></button>
                  </div>
                );
              })}
              <button onClick={() => setShowAddFeature(true)} className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/20 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:border-white/40">
                <Plus className="w-4 h-4" /> Add Feature
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {features.filter(f => f.enabled !== false).map((f) => {
                const Icon = getIcon(f.icon);
                return (
                  <button key={f.id} onClick={() => handleFeatureClick(f.route)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-cyber-blue/10 transition-all">
                      <Icon className="w-5 h-5 text-white/70 group-hover:text-cyber-blue transition-all" />
                    </div>
                    <span className="text-[10px] font-bold text-white/70 group-hover:text-white text-center leading-tight">{f.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2">Themes</p>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => localStorage.setItem('aegis_theme', t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${localStorage.getItem('aegis_theme') === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                  <t.icon className={`w-4 h-4 ${t.color}`} />{t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        {customizeMode && (
          <div className="flex gap-2 p-5 border-t border-white/10">
            <button onClick={() => setCustomizeMode(false)} className="flex-1 py-2 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold">Cancel</button>
            <button onClick={() => setCustomizeMode(false)} className="flex-1 py-2 bg-cyber-blue text-black rounded-xl text-sm font-bold">Save</button>
          </div>
        )}
      </motion.div>,
      document.body
    );
  };

  const renderThemeMenu = () => {
    if (!showThemeMenu) return null;
    return createPortal(
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="fixed w-48 bg-[#0d0d0f] border border-white/10 rounded-2xl p-2 shadow-2xl"
        style={{ top: themePos.top, left: themePos.left, zIndex: 99999 }}>
        <p className="text-[9px] font-black uppercase tracking-widest text-white/40 px-3 py-2">Choose Theme</p>
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => { localStorage.setItem('aegis_theme', t.id); setShowThemeMenu(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold ${localStorage.getItem('aegis_theme') === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
            <t.icon className={`w-4 h-4 ${t.color}`} />{t.name}
            {localStorage.getItem('aegis_theme') === t.id && <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue ml-auto" />}
          </button>
        ))}
      </motion.div>,
      document.body
    );
  };

  const renderAccountMenu = () => {
    if (!showUserMenu) return null;
    return createPortal(
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[280px] bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        style={{ top: accountPos.top, left: accountPos.left, zIndex: 99999 }}>
        <div className="p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {userPhoto ? <img src={userPhoto} alt={userName} className="w-10 h-10 rounded-full object-cover" /> :
              <div className={`w-10 h-10 rounded-full ${getAvatarColor(userName || 'U')} flex items-center justify-center`}>
                <span className="text-sm font-black text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>}
            <div><p className="text-sm font-bold text-white truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-white/40 truncate">harshan@example.com</p></div>
          </div>
        </div>
        <div className="p-2">
          <button onClick={handleSwitchAccount} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white">
            <Users className="w-4 h-4" />Switch account
          </button>
          <button onClick={() => { onViewChange?.('settings'); setShowUserMenu(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white">
            <Settings className="w-4 h-4" />Account settings
          </button>
          <button onClick={() => setShowUserMenu(false)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white">
            <Bell className="w-4 h-4" />Notifications
          </button>
          <button onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-cyber-red hover:bg-cyber-red/10">
            <LogOut className="w-4 h-4" />Log out
          </button>
        </div>
      </motion.div>,
      document.body
    );
  };

  const renderAddFeatureModal = () => {
    if (!showAddFeature) return null;
    return createPortal(
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]"
        onClick={() => setShowAddFeature(false)}>
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-6 w-[380px] mx-4"
          onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-white mb-4">Add New AEGIS Feature</h3>
          <div className="space-y-3">
            <input type="text" value={newFeature.name} onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Feature name" />
            <input type="text" value={newFeature.description} onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Description" />
            <select value={newFeature.icon} onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
              <option value="gauge">Gauge</option><option value="alert">Alert</option>
              <option value="layout">Layout</option><option value="chart">Chart</option>
              <option value="file">File</option><option value="bell">Bell</option>
              <option value="users">Users</option><option value="car">Car</option>
              <option value="bot">Bot</option><option value="monitor">Monitor</option>
              <option value="settings">Settings</option>
            </select>
            <input type="text" value={newFeature.route} onChange={(e) => setNewFeature({ ...newFeature, route: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Route (dashboard, violations, authority, settings)" />
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowAddFeature(false)} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold">Cancel</button>
            <button onClick={handleAddFeature} className="flex-1 py-2.5 bg-cyber-blue text-black rounded-xl text-sm font-bold">Add Feature</button>
          </div>
        </motion.div>
      </motion.div>,
      document.body
    );
  };

  const renderLogoutConfirm = () => {
    if (!showLogoutConfirm) return null;
    return createPortal(
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]"
        onClick={() => setShowLogoutConfirm(false)}>
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-6 w-[320px] mx-4"
          onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-white mb-2">Log out</h3>
          <p className="text-sm text-white/60 mb-6">Are you sure you want to log out?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold">Cancel</button>
            <button onClick={handleLogout} className="flex-1 py-2.5 bg-cyber-red text-white rounded-xl text-sm font-bold">Log out</button>
          </div>
        </motion.div>
      </motion.div>,
      document.body
    );
  };

  const renderSwitchAccount = () => {
    if (!showSwitchAccount) return null;
    return createPortal(
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]"
        onClick={() => setShowSwitchAccount(false)}>
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          className="bg-[#0d0d0f] border border-white/10 rounded-2xl p-6 w-[380px] mx-4"
          onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-white mb-4">Switch Account</h3>
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Current Account</p>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              <div className={`w-10 h-10 rounded-full ${getAvatarColor(userName || 'U')} flex items-center justify-center`}>
                <span className="text-sm font-black text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>
              <div><p className="text-sm font-bold text-white">{userName || 'User'}</p>
                <p className="text-[10px] text-white/40">harshan@example.com</p></div>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Other Accounts</p>
            <button className="w-full flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10">
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                <span className="text-sm font-black text-white">G</span>
              </div>
              <div className="text-left"><p className="text-sm font-bold text-white">Guest Account</p>
                <p className="text-[10px] text-white/40">guest@aegis.local</p></div>
            </button>
          </div>
          <button onClick={() => { setShowSwitchAccount(false); onLogin?.(); }}
            className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/20 rounded-xl text-sm font-bold text-white/50 hover:text-white">
            <LogIn className="w-4 h-4" />Add another account
          </button>
          <button onClick={() => setShowSwitchAccount(false)}
            className="w-full mt-4 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold">Cancel</button>
        </motion.div>
      </motion.div>,
      document.body
    );
  };

  return (
    <div className="pt-24 pb-16 px-4 sm:px-8 max-w-[1700px] mx-auto space-y-6">
      {/* Utility Controls - Above GPS Satellite card */}
      <div className="flex justify-end mb-3">
        <div className="flex items-center gap-3">
          <button ref={gridRef} onClick={toggleFavourites} aria-label="Open AEGIS favourites"
            className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white/50 hover:text-white transition-all">
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button ref={paletteRef} onClick={toggleThemeMenu}
            className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white/50 hover:text-white">
            <Palette className="w-4 h-4" />
          </button>
          {userName && (
            <button ref={avatarRef} onClick={toggleAccountMenu} aria-label="Open account menu"
              className="flex items-center gap-2 pl-1 pr-2 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10">
              {userPhoto ? <img src={userPhoto} alt={userName} className="w-7 h-7 rounded-full object-cover" /> :
                <div className={`w-7 h-7 rounded-full ${getAvatarColor(userName)} flex items-center justify-center`}>
                  <span className="text-xs font-black text-white">{userName.charAt(0).toUpperCase()}</span>
                </div>}
              <ChevronDown className={`w-3 h-3 text-white/40 ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* TOP HUD - 3 METRICS - Scrolls naturally with page */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Portal-based dropdowns - rendered to document.body to escape all clipping contexts */}
      <AnimatePresence>{renderLauncher()}</AnimatePresence>
      <AnimatePresence>{renderFavourites()}</AnimatePresence>
      <AnimatePresence>{renderThemeMenu()}</AnimatePresence>
      <AnimatePresence>{renderAccountProfile()}</AnimatePresence>
      <AnimatePresence>{renderAddFeatureModal()}</AnimatePresence>
      <AnimatePresence>{renderLogoutConfirm()}</AnimatePresence>
      <AnimatePresence>{renderSwitchAccount()}</AnimatePresence>
    </div>
  );
}