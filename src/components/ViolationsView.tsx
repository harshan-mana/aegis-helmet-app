import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  User,
  Phone,
  Bell,
  BellOff,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Activity,
  Eye,
  X,
  Save,
  RefreshCw,
  Download,
  DollarSign,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, onSnapshot, query, orderBy, limit, updateDoc } from 'firebase/firestore';

interface Violation {
  id: string;
  type: string;
  vehicleNumber: string;
  description: string;
  penaltyAmount: number;
  status: string;
  confidence: number;
  timestamp: any;
  photoUrl?: string;
}

interface Guardian {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

interface UserProfile {
  name: string;
  phone: string;
  licenseNumber: string;
  bloodGroup: string;
  autoReport: boolean;
  guardianNotifications: boolean;
}

const DEFAULT_VIOLATION_TYPES = [
  { id: 'NO_HELMET', label: 'No Helmet', icon: AlertTriangle, color: 'text-cyber-orange', fine: 1000 },
  { id: 'TRIPLE_RIDING', label: 'Triple Riding', icon: Users, color: 'text-cyber-red', fine: 1000 },
  { id: 'FAKE_PLATE', label: 'Fake/Unregistered Plate', icon: XCircle, color: 'text-cyber-red', fine: 5000 },
  { id: 'OVER_SPEEDING', label: 'Overspeeding', icon: Activity, color: 'text-cyber-orange', fine: 2000 },
  { id: 'ACCIDENT', label: 'Accident Detected', icon: ShieldAlert, color: 'text-cyber-red', fine: 0 },
];

export default function ViolationsView() {
  // User profile state
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('aegis_user_profile');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      name: '',
      phone: '',
      licenseNumber: '',
      bloodGroup: 'O+',
      autoReport: true,
      guardianNotifications: true,
    };
  });
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);

  // Feature 11: Custom fine amounts
  const [violationTypes, setViolationTypes] = useState(DEFAULT_VIOLATION_TYPES);
  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [editingFine, setEditingFine] = useState<{ id: string; amount: number } | null>(null);

  // Guardians state
  const [guardians, setGuardians] = useState<Guardian[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_guardians');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  });
  const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newGuardianPhone, setNewGuardianPhone] = useState('');
  const [newGuardianRelation, setNewGuardianRelation] = useState('');

  // Violations state
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);

  // Load violations from Firestore
  useEffect(() => {
    const q = query(collection(db, 'violations'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setViolations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Violation));
      },
      (error) => {
        console.warn('Violations listener warning:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Save profile to localStorage and Firestore
  const saveProfile = async () => {
    try {
      localStorage.setItem('aegis_user_profile', JSON.stringify(profileDraft));
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            name: profileDraft.name,
            phone: profileDraft.phone,
            licenseNumber: profileDraft.licenseNumber,
            bloodGroup: profileDraft.bloodGroup,
            autoReport: profileDraft.autoReport,
            guardianNotifications: profileDraft.guardianNotifications,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setProfile(profileDraft);
      setIsProfileEditing(false);
    } catch (error) {
      console.warn('Profile save error:', error);
      localStorage.setItem('aegis_user_profile', JSON.stringify(profileDraft));
      setProfile(profileDraft);
      setIsProfileEditing(false);
    }
  };

  // Save guardians to localStorage
  useEffect(() => {
    localStorage.setItem('aegis_guardians', JSON.stringify(guardians));
  }, [guardians]);

  const addGuardian = () => {
    if (!newGuardianName.trim() || !newGuardianPhone.trim()) return;
    setGuardians((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newGuardianName.trim(),
        phone: newGuardianPhone.trim(),
        relation: newGuardianRelation.trim() || 'Guardian',
      },
    ]);
    setNewGuardianName('');
    setNewGuardianPhone('');
    setNewGuardianRelation('');
    setIsGuardianModalOpen(false);
  };

  const removeGuardian = (id: string) => {
    setGuardians((prev) => prev.filter((g) => g.id !== id));
  };

  // Feature 11: Update fine amount
  const updateFineAmount = (typeId: string, newAmount: number) => {
    setViolationTypes((prev) =>
      prev.map((vt) => (vt.id === typeId ? { ...vt, fine: newAmount } : vt))
    );
    setIsFineModalOpen(false);
    setEditingFine(null);
  };

  // Feature 3: Export violations as text
  const exportViolationsAsText = () => {
    const header = 'AEGIS AI - VIOLATION REPORT\n';
    const separator = '='.repeat(60) + '\n';
    const date = `Generated: ${new Date().toLocaleString()}\n\n`;
    
    const violationLines = violations.map((v, idx) => {
      return `[${idx + 1}] ${v.type.replace('_', ' ')}
    Vehicle: ${v.vehicleNumber}
    Fine: ₹${v.penaltyAmount.toLocaleString()}
    Status: ${v.status}
    Confidence: ${(v.confidence * 100).toFixed(1)}%
    Description: ${v.description}
    Time: ${v.timestamp?.toDate ? v.timestamp.toDate().toLocaleString() : 'N/A'}
`;
    }).join('\n');

    const footer = `\n${separator}Total Violations: ${violations.length}\nTotal Fines: ₹${violations.reduce((sum, v) => sum + v.penaltyAmount, 0).toLocaleString()}\n`;

    const content = header + separator + date + separator + violationLines + footer;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis_violations_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Feature 9: Enhanced accident verification
  const simulateViolation = async () => {
    setIsSimulating(true);
    const violationType = violationTypes[Math.floor(Math.random() * violationTypes.length)];

    await new Promise((r) => setTimeout(r, 2000));

    // Feature 9: For accidents, add detailed verification data
    const isAccident = violationType.id === 'ACCIDENT';
    const newViolation: Omit<Violation, 'id'> = {
      type: violationType.id,
      vehicleNumber: `KA-0${Math.floor(Math.random() * 9)}-XX-${Math.floor(1000 + Math.random() * 9000)}`,
      description: isAccident
        ? `CRITICAL ACCIDENT DETECTED - Impact force: ${(Math.random() * 5 + 3).toFixed(1)}G | Location verified | Emergency services notified | GPS coordinates locked`
        : `${violationType.label} detected by YOLOv8 vision engine.`,
      penaltyAmount: violationType.fine,
      status: 'Pending',
      confidence: isAccident ? 0.95 + Math.random() * 0.05 : 0.85 + Math.random() * 0.14,
      timestamp: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'violations'), {
        ...newViolation,
        timestamp: serverTimestamp(),
        userId: auth.currentUser?.uid || 'guest',
        // Feature 9: Add accident-specific fields
        ...(isAccident && {
          accidentDetails: {
            impactForce: parseFloat((Math.random() * 5 + 3).toFixed(1)),
            gpsLocked: true,
            emergencyNotified: true,
            verificationStatus: 'CRITICAL',
          },
        }),
      });
    } catch (error) {
      console.warn('Violation log error:', error);
    }

    // Auto-report if enabled and critical
    if (profile.autoReport && (violationType.id === 'ACCIDENT' || violationType.id === 'FAKE_PLATE')) {
      try {
        await addDoc(collection(db, 'alerts'), {
          userId: auth.currentUser?.uid || 'guest',
          userName: profile.name || 'Guest',
          userPhone: profile.phone || 'N/A',
          actionType: 'AUTO_REPORT',
          violationType: violationType.id,
          timestamp: serverTimestamp(),
          googleMapsUrl: 'https://maps.google.com',
          message: `Critical violation auto-reported: ${violationType.label}`,
        });
      } catch (error) {
        console.warn('Auto-report error:', error);
      }
    }

    // Guardian notification if enabled
    if (profile.guardianNotifications && guardians.length > 0) {
      console.log(`Guardian SMS sent to ${guardians.map((g) => g.phone).join(', ')}: ${violationType.label} detected`);
    }

    setIsSimulating(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved': return 'text-cyber-green bg-cyber-green/10 border-cyber-green/30';
      case 'Endorsed': return 'text-cyber-blue bg-cyber-blue/10 border-cyber-blue/30';
      case 'Spam': return 'text-white/50 bg-white/5 border-white/10';
      default: return 'text-cyber-orange bg-cyber-orange/10 border-cyber-orange/30';
    }
  };

  return (
    <div className="pt-24 pb-16 px-4 sm:px-8 max-w-[1700px] mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-white">VIOLATION MONITOR</h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.25em] mt-1">
            YOLOv8 Detection Engine • Real-time Monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Feature 3: Export as text button */}
          <button
            onClick={exportViolationsAsText}
            className="px-4 py-3 bg-cyber-green/10 border border-cyber-green/30 text-cyber-green rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-cyber-green/20 transition-all"
          >
            <Download className="w-4 h-4" />
            Export .txt
          </button>
          <button
            onClick={simulateViolation}
            disabled={isSimulating}
            className="px-6 py-3 bg-cyber-purple text-black font-display font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_#FF8C69] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Simulate Detection
              </>
            )}
          </button>
        </div>
      </div>

      {/* VIOLATION TYPES GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {violationTypes.map((vt) => {
          const count = violations.filter((v) => v.type === vt.id).length;
          return (
            <div key={vt.id} className="glass-panel p-4 border-white/10 relative overflow-hidden group hover:border-white/20 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <vt.icon className={`w-5 h-5 ${vt.color}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-white/60">{vt.label}</span>
              </div>
              <p className="text-2xl font-display font-black text-white">{count}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[9px] font-mono text-white/30">Fine: ₹{vt.fine.toLocaleString()}</p>
                {/* Feature 11: Edit fine button */}
                <button
                  onClick={() => {
                    setEditingFine({ id: vt.id, amount: vt.fine });
                    setIsFineModalOpen(true);
                  }}
                  className="p-1 text-white/30 hover:text-cyber-blue transition-colors"
                  title="Edit fine amount"
                >
                  <DollarSign className="w-3 h-3" />
                </button>
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
            </div>
          );
        })}
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Violations List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyber-orange" /> Detected Violations
              </h2>
              <span className="text-[10px] font-mono text-white/40">{violations.length} records</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {violations.length === 0 ? (
                <div className="py-16 text-center">
                  <ShieldAlert className="w-12 h-12 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No violations detected yet</p>
                  <p className="text-white/20 text-xs mt-1">Click "Simulate Detection" to test the system</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {violations.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedViolation(v)}
                      className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(v.status)}`}>
                              {v.status}
                            </span>
                            <span className="text-[10px] font-mono text-white/40">{v.type.replace('_', ' ')}</span>
                          </div>
                          <p className="text-sm font-bold text-white">{v.vehicleNumber}</p>
                          <p className="text-[11px] text-white/50 mt-1">{v.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-bold text-cyber-green">₹{v.penaltyAmount.toLocaleString()}</p>
                          <p className="text-[9px] font-mono text-white/30 mt-1">
                            {(v.confidence * 100).toFixed(0)}% conf
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: User Profile + Guardians */}
        <div className="space-y-4">
          {/* User Profile Card */}
          <div className="glass-panel p-5 border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <User className="w-4 h-4 text-cyber-blue" /> User Information
              </h3>
              <button
                onClick={() => {
                  if (isProfileEditing) {
                    saveProfile();
                  } else {
                    setProfileDraft(profile);
                    setIsProfileEditing(true);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  isProfileEditing
                    ? 'bg-cyber-green text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {isProfileEditing ? (
                  <>
                    <Save className="w-3.5 h-3.5" /> Save
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" /> Edit
                  </>
                )}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Full Name</label>
                {isProfileEditing ? (
                  <input
                    type="text"
                    value={profileDraft.name}
                    onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue"
                    placeholder="Enter full name"
                  />
                ) : (
                  <p className="text-sm font-bold text-white">{profile.name || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Phone Number</label>
                {isProfileEditing ? (
                  <input
                    type="tel"
                    value={profileDraft.phone}
                    onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue"
                    placeholder="Enter phone number"
                  />
                ) : (
                  <p className="text-sm font-bold text-white">{profile.phone || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">License Number</label>
                {isProfileEditing ? (
                  <input
                    type="text"
                    value={profileDraft.licenseNumber}
                    onChange={(e) => setProfileDraft({ ...profileDraft, licenseNumber: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue"
                    placeholder="e.g. DL-1420110012345"
                  />
                ) : (
                  <p className="text-sm font-bold text-white">{profile.licenseNumber || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block mb-1">Blood Group</label>
                {isProfileEditing ? (
                  <select
                    value={profileDraft.bloodGroup}
                    onChange={(e) => setProfileDraft({ ...profileDraft, bloodGroup: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg} className="bg-black text-white">{bg}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-bold text-white">{profile.bloodGroup || 'Not set'}</p>
                )}
              </div>

              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <div>
                  <p className="text-xs font-bold text-white">Auto-Report Critical Accidents</p>
                  <p className="text-[9px] text-white/40">Automatically dispatch GPS to emergency services</p>
                </div>
                {isProfileEditing ? (
                  <input
                    type="checkbox"
                    checked={profileDraft.autoReport}
                    onChange={(e) => setProfileDraft({ ...profileDraft, autoReport: e.target.checked })}
                    className="w-5 h-5 accent-cyber-blue rounded"
                  />
                ) : (
                  <div className={`p-1.5 rounded-lg ${profile.autoReport ? 'bg-cyber-green/20' : 'bg-white/5'}`}>
                    {profile.autoReport ? (
                      <CheckCircle className="w-4 h-4 text-cyber-green" />
                    ) : (
                      <XCircle className="w-4 h-4 text-white/30" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <div>
                  <p className="text-xs font-bold text-white">Guardian SMS Notifications</p>
                  <p className="text-[9px] text-white/40">Send SMS alerts to guardians on incidents</p>
                </div>
                {isProfileEditing ? (
                  <input
                    type="checkbox"
                    checked={profileDraft.guardianNotifications}
                    onChange={(e) => setProfileDraft({ ...profileDraft, guardianNotifications: e.target.checked })}
                    className="w-5 h-5 accent-cyber-blue rounded"
                  />
                ) : (
                  <div className={`p-1.5 rounded-lg ${profile.guardianNotifications ? 'bg-cyber-green/20' : 'bg-white/5'}`}>
                    {profile.guardianNotifications ? (
                      <Bell className="w-4 h-4 text-cyber-green" />
                    ) : (
                      <BellOff className="w-4 h-4 text-white/30" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Guardians Card */}
          <div className="glass-panel p-5 border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyber-orange" /> Guardian Details
              </h3>
              <button
                onClick={() => setIsGuardianModalOpen(true)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>

            <div className="space-y-2">
              {guardians.length === 0 ? (
                <div className="text-center py-6 text-white/20 text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No guardians added yet
                </div>
              ) : (
                guardians.map((g) => (
                  <div key={g.id} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{g.name}</p>
                      <p className="text-[10px] font-mono text-white/40">{g.phone} • {g.relation}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={`tel:${g.phone}`} className="p-2 bg-cyber-blue/10 text-cyber-blue rounded-lg hover:bg-cyber-blue/20">
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <button onClick={() => removeGuardian(g.id)} className="p-2 bg-white/5 text-white/30 rounded-lg hover:text-cyber-red">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feature 11: Edit Fine Modal */}
      <Dialog.Root open={isFineModalOpen} onOpenChange={setIsFineModalOpen}>
        <AnimatePresence>
          {isFineModalOpen && editingFine && (
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
                    <h2 className="text-xl font-display font-black text-white mb-6">Edit Fine Amount</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Violation Type</label>
                        <p className="text-lg font-bold text-white">
                          {violationTypes.find((vt) => vt.id === editingFine.id)?.label}
                        </p>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Fine Amount (₹)</label>
                        <input
                          type="number"
                          value={editingFine.amount}
                          onChange={(e) => setEditingFine({ ...editingFine, amount: parseInt(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setIsFineModalOpen(false)}
                        className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => updateFineAmount(editingFine.id, editingFine.amount)}
                        className="flex-1 py-3 bg-cyber-blue text-black rounded-xl text-sm font-black hover:scale-[1.02] transition-all"
                      >
                        Update Fine
                      </button>
                    </div>
                  </motion.div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>

      {/* Violation Detail Modal */}
      <Dialog.Root open={!!selectedViolation} onOpenChange={() => setSelectedViolation(null)}>
        <AnimatePresence>
          {selectedViolation && (
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
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg p-4 z-[201]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-[#121216] border border-white/10 rounded-3xl p-7 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-display font-black text-white">Violation Details</h2>
                      <button onClick={() => setSelectedViolation(null)} className="p-2 text-white/40 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Violation Type</p>
                        <p className="text-lg font-display font-black text-cyber-orange">{selectedViolation.type.replace('_', ' ')}</p>
                      </div>

                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Vehicle Number</p>
                        <p className="text-lg font-mono font-bold text-white">{selectedViolation.vehicleNumber}</p>
                      </div>

                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Description</p>
                        <p className="text-sm text-white/70">{selectedViolation.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-xl p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Fine Amount</p>
                          <p className="text-xl font-display font-black text-cyber-green">₹{selectedViolation.penaltyAmount.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">AI Confidence</p>
                          <p className="text-xl font-display font-black text-cyber-blue">{(selectedViolation.confidence * 100).toFixed(1)}%</p>
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase border ${getStatusColor(selectedViolation.status)}`}>
                          {selectedViolation.status}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>

      {/* Add Guardian Modal */}
      <Dialog.Root open={isGuardianModalOpen} onOpenChange={setIsGuardianModalOpen}>
        <AnimatePresence>
          {isGuardianModalOpen && (
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
                    <h2 className="text-xl font-display font-black text-white mb-6">Add Guardian</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Guardian Name</label>
                        <input
                          type="text"
                          placeholder="Enter guardian name"
                          value={newGuardianName}
                          onChange={(e) => setNewGuardianName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Phone Number</label>
                        <input
                          type="tel"
                          placeholder="Enter phone number"
                          value={newGuardianPhone}
                          onChange={(e) => setNewGuardianPhone(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Relation</label>
                        <input
                          type="text"
                          placeholder="e.g. Father, Mother, Spouse"
                          value={newGuardianRelation}
                          onChange={(e) => setNewGuardianRelation(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setIsGuardianModalOpen(false)}
                        className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addGuardian}
                        className="flex-1 py-3 bg-cyber-blue text-black rounded-xl text-sm font-black hover:scale-[1.02] transition-all"
                      >
                        Add Guardian
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