import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, LayoutDashboard, Settings, LogOut, Menu, X, Gauge, AlertTriangle,
  Database, ChevronDown, Palette, Moon, Sun, Sparkles, RefreshCw, User,
  LogIn, Users, Bell, LogOut as LogOutIcon, Grid3x3, Pencil, Plus, Trash2,
  ChevronUp, ChevronDown as ChevronDownIcon, Check, Car, FileText, Monitor,
  Bot, BarChart3
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AegisNavbarProps {
  userRole: string | null;
  onViewChange: (view: 'dashboard' | 'violations' | 'authority' | 'profile' | 'settings') => void;
  currentView: string;
  onSignOut?: () => void;
  onLogin?: () => void;
  onServiceProviderLogin?: () => void;
  userName?: string;
  userPhoto?: string;
  showUserMenu?: boolean;
  setShowUserMenu?: (show: boolean) => void;
  showThemeMenu?: boolean;
  setShowThemeMenu?: (show: boolean) => void;
  currentTheme?: string;
  setCurrentTheme?: (theme: string) => void;
  onSwitchAccount?: () => void;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  category: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_FEATURES: Feature[] = [
  { id: 'dashboard', name: 'Dashboard', description: 'Main dashboard', icon: 'gauge', route: 'dashboard', category: 'General', enabled: true, order: 0 },
  { id: 'violations', name: 'Violations', description: 'Violation monitor', icon: 'alert', route: 'violations', category: 'General', enabled: true, order: 1 },
  { id: 'authority', name: 'RTO Command', description: 'RTO command center', icon: 'layout', route: 'authority', category: 'General', enabled: true, order: 2 },
  { id: 'analytics', name: 'Analytics', description: 'Data analytics', icon: 'chart', route: 'authority', category: 'General', enabled: true, order: 3 },
  { id: 'reports', name: 'Reports', description: 'Generate reports', icon: 'file', route: 'authority', category: 'General', enabled: true, order: 4 },
  { id: 'alerts', name: 'Alerts', description: 'System alerts', icon: 'bell', route: 'violations', category: 'General', enabled: true, order: 5 },
  { id: 'users', name: 'Users', description: 'User management', icon: 'users', route: 'settings', category: 'General', enabled: true, order: 6 },
  { id: 'vehicles', name: 'Vehicles', description: 'Vehicle registry', icon: 'car', route: 'authority', category: 'General', enabled: true, order: 7 },
  { id: 'documents', name: 'Documents', description: 'Document management', icon: 'file', route: 'settings', category: 'General', enabled: true, order: 8 },
  { id: 'ai', name: 'AI Assistant', description: 'AI helper', icon: 'bot', route: 'dashboard', category: 'General', enabled: true, order: 9 },
  { id: 'monitor', name: 'System Monitor', description: 'System status', icon: 'monitor', route: 'settings', category: 'General', enabled: true, order: 10 },
];

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

export default function AegisNavbar({ userRole, onViewChange, currentView, onSignOut, onLogin, onServiceProviderLogin, userName, userPhoto, showUserMenu, setShowUserMenu, showThemeMenu, setShowThemeMenu, currentTheme, setCurrentTheme, onSwitchAccount }: AegisNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [features, setFeatures] = useState<Feature[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_features');
      const parsed = saved ? JSON.parse(saved) : DEFAULT_FEATURES;
      return parsed.filter(f => f.id !== 'settings');
    } catch { return DEFAULT_FEATURES; }
  });
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ name: '', description: '', icon: 'gauge', route: 'dashboard', category: 'General' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const [launcherPos, setLauncherPos] = useState({ top: 0, left: 0 });
  const [accountPos, setAccountPos] = useState({ top: 0, left: 0 });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLButtonElement>(null);

  // Save features to localStorage
  useEffect(() => { localStorage.setItem('aegis_features', JSON.stringify(features)); }, [features]);

  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setProfileIncomplete(!snap.data().phone || !snap.data().emergencyContact1?.phone);
    }, () => {});
  }, []);

  // Calculate launcher position from grid button
  const updateLauncherPosition = useCallback(() => {
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const launcherWidth = 480;
      let left = rect.right - launcherWidth;
      if (left < 8) left = 8;
      if (left + launcherWidth > window.innerWidth - 8) {
        left = window.innerWidth - launcherWidth - 8;
      }
      setLauncherPos({ top: rect.bottom + 10, left });
    }
  }, []);

  // Calculate account menu position from avatar
  const updateAccountPosition = useCallback(() => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      const menuWidth = 280;
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }
      setAccountPos({ top: rect.bottom + 8, left });
    }
  }, []);

  // Toggle launcher
  const toggleLauncher = useCallback(() => {
    if (!launcherOpen) updateLauncherPosition();
    setLauncherOpen(!launcherOpen);
    setShowUserMenu?.(false);
    setCustomizeMode(false);
  }, [launcherOpen, setShowUserMenu, updateLauncherPosition]);

  // Toggle account menu
  const toggleAccountMenu = useCallback(() => {
    if (!showUserMenu) updateAccountPosition();
    setShowUserMenu?.(!showUserMenu);
    setLauncherOpen(false);
    setCustomizeMode(false);
  }, [showUserMenu, setShowUserMenu, updateAccountPosition]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const insideAccount = target.closest('[data-account-menu]') !== null || (avatarRef.current !== null && avatarRef.current.contains(target));
      if (!insideAccount) setShowUserMenu?.(false);
      const isInsideLauncher = target.closest('[data-launcher]') !== null;
      const isInsideGridButton = gridRef.current !== null && gridRef.current.contains(target);
      if (!isInsideLauncher && !isInsideGridButton) { setLauncherOpen(false); setCustomizeMode(false); }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [setShowUserMenu]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu?.(false); setLauncherOpen(false); setCustomizeMode(false);
        setShowLogoutConfirm(false); setShowSwitchAccount(false); setShowAddFeature(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [setShowUserMenu]);

  // Update position on resize
  useEffect(() => {
    window.addEventListener('resize', updateLauncherPosition);
    return () => window.removeEventListener('resize', updateLauncherPosition);
  }, [updateLauncherPosition]);

  const navItems = [
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-gray-500' },
  ];

  const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const getIcon = (iconName: string) => ICON_MAP[iconName] || Gauge;

  const handleFeatureClick = (route: string) => {
    setLauncherOpen(false);
    setCustomizeMode(false);
    if (['dashboard', 'violations', 'authority', 'settings'].includes(route)) {
      onViewChange(route as any);
    }
  };

  const handleAddFeature = () => {
    if (!newFeature.name.trim()) return;
    setFeatures([...features, {
      id: `feature-${Date.now()}`, name: newFeature.name, description: newFeature.description,
      icon: newFeature.icon, route: newFeature.route, category: newFeature.category,
      enabled: true, order: features.length,
    }]);
    setNewFeature({ name: '', description: '', icon: 'gauge', route: 'dashboard', category: 'General' });
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

  const handleLogout = () => { setShowLogoutConfirm(false); setShowUserMenu?.(false); onSignOut?.(); };
  const handleSwitchAccount = () => { setShowSwitchAccount(true); setShowUserMenu?.(false); };

  // Render launcher via portal to document.body - escapes all clipping contexts
  const renderLauncher = () => {
    if (!launcherOpen) return null;

    return createPortal(
      <motion.div
        data-launcher
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[480px] max-w-[calc(100vw-16px)] bg-[#1a1a1d] border border-white/10 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
        style={{ top: launcherPos.top, left: launcherPos.left, zIndex: 99999, maxHeight: 'calc(100vh - 120px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-bold text-white/90">
            {customizeMode ? 'Customize AEGIS' : 'Your favorites'}
          </h3>
          <div className="flex items-center gap-2">
            {!customizeMode && (
              <button onClick={() => setCustomizeMode(true)} className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-all" aria-label="Customize features">
                <Pencil className="w-5 h-5" />
              </button>
            )}
            {customizeMode && (
              <button onClick={() => setCustomizeMode(false)} className="p-1.5 text-cyber-green hover:text-white rounded-lg hover:bg-white/5" aria-label="Done customizing">
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
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
                    <button onClick={() => handleMoveFeature(f.id, 'down')} disabled={i === features.length - 1} className="p-1 text-white/40 hover:text-white disabled:opacity-30" aria-label="Move down"><ChevronDownIcon className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteFeature(f.id)} className="p-1 text-white/40 hover:text-cyber-red" aria-label="Delete feature"><Trash2 className="w-3 h-3" /></button>
                  </div>
                );
              })}
              <button onClick={() => setShowAddFeature(true)} className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/20 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:border-white/40 transition-all">
                <Plus className="w-4 h-4" /> Add Feature
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {features.filter(f => f.enabled).map((f, idx) => {
                const Icon = getIcon(f.icon);
                const palette = [
                  'from-rose-500/30 to-rose-600/20',
                  'from-emerald-500/30 to-emerald-600/20',
                  'from-blue-500/30 to-blue-600/20',
                  'from-amber-500/30 to-amber-600/20',
                  'from-purple-500/30 to-purple-600/20',
                  'from-cyan-500/30 to-cyan-600/20',
                ][idx % 6];
                return (
                  <button key={f.id} onClick={() => handleFeatureClick(f.route)}
                    className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-white/5 transition-all group">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${palette} border border-white/10 flex items-center justify-center group-hover:scale-105 transition-all`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-white/80 group-hover:text-white text-center leading-tight">{f.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Themes */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2">Themes</p>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => setCurrentTheme?.(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentTheme === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
                  }`}>
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

  // Account menu via portal
  const renderAccountMenu = () => {
    if (!showUserMenu) return null;

    return createPortal(
      <motion.div
        data-account-menu
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[280px] bg-[#0d0d0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        style={{ top: accountPos.top, left: accountPos.left, zIndex: 99999 }}
      >
        <div className="p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {userPhoto ? <img src={userPhoto} alt={userName} className="w-10 h-10 rounded-full object-cover" /> :
              <div className={`w-10 h-10 rounded-full ${getAvatarColor(userName || 'U')} flex items-center justify-center`}>
                <span className="text-sm font-black text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>}
            <div><p className="text-sm font-bold text-white truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-white/40 truncate">{auth.currentUser?.email || 'Local guest account'}</p></div>
          </div>
        </div>
        <div className="p-2">
          <button onClick={() => { onLogin?.(); setShowUserMenu?.(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white">
            <Plus className="w-4 h-4" />Add another account
          </button>
          <button onClick={handleSwitchAccount} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white">
            <Users className="w-4 h-4" />Switch account
          </button>
          <button onClick={() => { onViewChange('settings'); setShowUserMenu?.(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white">
            <Settings className="w-4 h-4" />Manage Account
          </button>
          <button onClick={() => { onViewChange('settings'); setShowUserMenu?.(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white">
            <Bell className="w-4 h-4" />Notifications
          </button>
          <button onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-cyber-red hover:bg-cyber-red/10">
            <LogOutIcon className="w-4 h-4" />Sign out
          </button>
        </div>
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-[9px] text-white/30">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
      </motion.div>,
      document.body
    );
  };

  // Add Feature Modal
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
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Feature Name</label>
              <input type="text" value={newFeature.name} onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue" placeholder="Enter feature name" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Description</label>
              <input type="text" value={newFeature.description} onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue" placeholder="Enter description" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Icon</label>
              <select value={newFeature.icon} onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue">
                <option value="gauge">Gauge</option>
                <option value="alert">Alert</option>
                <option value="layout">Layout</option>
                <option value="chart">Chart</option>
                <option value="file">File</option>
                <option value="bell">Bell</option>
                <option value="users">Users</option>
                <option value="car">Car</option>
                <option value="bot">Bot</option>
                <option value="monitor">Monitor</option>
                <option value="settings">Settings</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Route</label>
              <input type="text" value={newFeature.route} onChange={(e) => setNewFeature({ ...newFeature, route: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue" placeholder="dashboard, violations, authority, settings" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Category</label>
              <select value={newFeature.category} onChange={(e) => setNewFeature({ ...newFeature, category: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue">
                <option value="General">General</option>
                <option value="Analytics">Analytics</option>
                <option value="Management">Management</option>
                <option value="System">System</option>
              </select>
            </div>
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

  // Logout confirmation
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

  // Switch account modal
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
    <>
      <nav className="relative z-[80] w-full max-w-5xl mx-auto px-4 sm:px-8 pt-6">
        <div className="glass-panel px-6 py-3.5 border-white/10 grid grid-cols-[1fr_auto_1fr] items-center relative overflow-hidden group shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-24 h-full bg-gradient-to-r from-transparent via-cyber-blue to-transparent skew-x-12" />
          </div>

          {/* Left spacer — no branding on the left */}
          <div />

          {/* Centered AEGIS branding */}
          <div className="flex items-center gap-3.5 relative z-10">
            <button ref={gridRef} onClick={toggleLauncher} aria-label="Open feature launcher"
              className="p-2.5 bg-cyber-blue rounded-2xl shadow-[0_0_20px_#FF6B35] hover:scale-105 transition-transform flex items-center justify-center">
              <Shield className="w-5 h-5 text-black" />
            </button>
            <div className="flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-display font-black tracking-[0.3em] text-white drop-shadow leading-none">AEGIS AI</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
                <span className="text-[10px] font-mono text-cyber-blue/80 uppercase tracking-widest">v2.5</span>
              </div>
            </div>
          </div>

          {/* Right-side controls: Settings gear + H account */}
          <div className="flex items-center justify-end gap-3 relative z-10">
            <button onClick={() => onViewChange('settings')} aria-label="Open settings"
              className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white/50 hover:text-white transition-all">
              <Settings className="w-5 h-5" />
            </button>
            <button className="md:hidden p-2 text-white/50 hover:text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button ref={avatarRef} onClick={toggleAccountMenu} aria-label="Open account menu"
              className="flex items-center gap-2 pl-1 pr-2 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10">
              {userPhoto ? <img src={userPhoto} alt={userName || 'User'} className="w-7 h-7 rounded-full object-cover" /> :
                <div className="w-7 h-7 rounded-full bg-pink-500 flex items-center justify-center">
                  <span className="text-xs font-black text-white">{(userName || 'H').charAt(0).toUpperCase()}</span>
                </div>}
              <ChevronDown className={`w-3 h-3 text-white/40 ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Mobile Menu */}
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="md:hidden mt-3 bg-[#0d0d0f] border border-white/10 rounded-2xl p-4 space-y-2 shadow-2xl">
              {navItems.map((item) => (
                <button key={item.id} onClick={() => { onViewChange(item.id as any); setIsMenuOpen(false); }}
                  className={`w-full p-4 rounded-xl text-left text-[11px] font-black uppercase tracking-wider flex items-center gap-3 ${
                    currentView === item.id ? 'bg-cyber-blue text-black' : 'text-white/60 hover:bg-white/5'
                  }`}>
                  <item.icon className="w-5 h-5" />{item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Portal-based dropdowns - rendered to document.body to escape all clipping contexts */}
      {renderLauncher()}
      {renderAccountMenu()}
      <AnimatePresence>{renderAddFeatureModal()}</AnimatePresence>
      <AnimatePresence>{renderLogoutConfirm()}</AnimatePresence>
      <AnimatePresence>{renderSwitchAccount()}</AnimatePresence>
    </>
  );
}