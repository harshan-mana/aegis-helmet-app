import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, LayoutDashboard, Settings, LogOut, Menu, X, Gauge, AlertTriangle,
  Database, ChevronDown, Palette, Moon, Sun, Sparkles, RefreshCw, User,
  LogIn, Users, Bell, LogOut as LogOutIcon, Grid3x3, Pencil, Plus, Trash2,
  ChevronUp, ChevronDown as ChevronDownIcon, Check, Car, FileText, Monitor,
  Bot, BarChart3, BellRing, UserPlus, Edit3, GripVertical
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
  { id: 'documents', name: 'Documents', document: 'Document management', icon: 'file', route: 'settings', category: 'General', enabled: true, order: 8 },
  { id: 'ai', name: 'AI Assistant', description: 'AI helper', icon: 'bot', route: 'dashboard', category: 'General', enabled: true, order: 9 },
  { id: 'monitor', name: 'System Monitor', description: 'System status', icon: 'monitor', route: 'settings', category: 'General', enabled: true, order: 10 },
  { id: 'settings', name: 'Settings', description: 'System settings', icon: 'settings', route: 'settings', category: 'General', enabled: true, order: 11 },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  alert: AlertTriangle,
  layout: LayoutDashboard,
  chart: BarChart3,
  file: FileText,
  bell: Bell,
  users: Users,
  car: Car,
  bot: Bot,
  monitor: Monitor,
  settings: Settings,
  database: Database,
  shield: Shield,
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [features, setFeatures] = useState<Feature[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_features');
      return saved ? JSON.parse(saved) : DEFAULT_FEATURES;
    } catch {
      return DEFAULT_FEATURES;
    }
  });
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ name: '', description: '', icon: 'gauge', route: 'dashboard', category: 'General' });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLButtonElement>(null);
  const [launcherPos, setLauncherPos] = useState({ top: 0, left: 0 });

  // Save features to localStorage
  useEffect(() => {
    localStorage.setItem('aegis_features', JSON.stringify(features));
  }, [features]);

  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileIncomplete(!data.phone || !data.emergencyContact1?.phone);
      }
    }, () => {});
  }, []);

  // Calculate launcher position
  const updateLauncherPosition = useCallback(() => {
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const launcherWidth = 420;
      let left = rect.right - launcherWidth;
      if (left < 8) left = 8;
      if (left + launcherWidth > window.innerWidth - 8) {
        left = window.innerWidth - launcherWidth - 8;
      }
      setLauncherPos({
        top: rect.bottom + 10,
        left: left,
      });
    }
  }, []);

  // Calculate account menu position
  const updateDropdownPosition = useCallback(() => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      const dropdownWidth = 260;
      let left = rect.right - dropdownWidth;
      if (left < 8) left = 8;
      if (left + dropdownWidth > window.innerWidth - 8) {
        left = window.innerWidth - dropdownWidth - 8;
      }
      setDropdownPos({
        top: rect.bottom + 8,
        left: left,
      });
    }
  }, []);

  // Toggle launcher
  const toggleLauncher = useCallback(() => {
    if (!launcherOpen) {
      updateLauncherPosition();
    }
    setLauncherOpen(!launcherOpen);
    setShowUserMenu?.(false);
    setCustomizeMode(false);
  }, [launcherOpen, setShowUserMenu, updateLauncherPosition]);

  // Toggle account menu
  const toggleDropdown = useCallback(() => {
    if (!showUserMenu) {
      updateDropdownPosition();
    }
    setShowUserMenu?.(!showUserMenu);
    setLauncherOpen(false);
    setCustomizeMode(false);
  }, [showUserMenu, setShowUserMenu, updateDropdownPosition]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu?.(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu?.(false);
      }
      // Close launcher when clicking outside
      const target = e.target as HTMLElement;
      if (launcherOpen && !target.closest('[data-launcher]')) {
        setLauncherOpen(false);
        setCustomizeMode(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [setShowUserMenu, setShowThemeMenu, launcherOpen]);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu?.(false);
        setLauncherOpen(false);
        setCustomizeMode(false);
        setShowLogoutConfirm(false);
        setShowSwitchAccount(false);
        setShowAddFeature(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setShowUserMenu]);

  // Update position on window resize
  useEffect(() => {
    window.addEventListener('resize', updateLauncherPosition);
    return () => window.removeEventListener('resize', updateLauncherPosition);
  }, [updateLauncherPosition]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Gauge, color: 'text-blue-500' },
    { id: 'violations', label: 'Violations', icon: AlertTriangle, color: 'text-red-500' },
    { id: 'authority', label: 'RTO Command', icon: LayoutDashboard, color: 'text-green-500' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-gray-500' },
  ];

  const getAvatarColor = (name: string) => {
    const index = name.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
  };

  const getIcon = (iconName: string) => {
    return ICON_MAP[iconName] || Gauge;
  };

  const handleFeatureClick = (route: string) => {
    setLauncherOpen(false);
    setCustomizeMode(false);
    if (route === 'dashboard' || route === 'violations' || route === 'authority' || route === 'settings') {
      onViewChange(route as any);
    }
  };

  const handleAddFeature = () => {
    if (!newFeature.name.trim()) return;
    const feature: Feature = {
      id: `feature-${Date.now()}`,
      name: newFeature.name,
      description: newFeature.description,
      icon: newFeature.icon,
      route: newFeature.route,
      category: newFeature.category,
      enabled: true,
      order: features.length,
    };
    setFeatures([...features, feature]);
    setNewFeature({ name: '', description: '', icon: 'gauge', route: 'dashboard', category: 'General' });
    setShowAddFeature(false);
  };

  const handleDeleteFeature = (id: string) => {
    setFeatures(features.filter(f => f.id !== id));
  };

  const handleMoveFeature = (id: string, direction: 'up' | 'down') => {
    const index = features.findIndex(f => f.id === id);
    if (index === -1) return;
    const newFeatures = [...features];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newFeatures.length) return;
    [newFeatures[index], newFeatures[newIndex]] = [newFeatures[newIndex], newFeatures[index]];
    setFeatures(newFeatures);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setShowUserMenu?.(false);
    onSignOut?.();
  };

  const handleSwitchAccount = () => {
    setShowSwitchAccount(true);
    setShowUserMenu?.(false);
  };

  // Render launcher via portal
  const renderLauncher = () => {
    if (!launcherOpen) return null;

    return createPortal(
      <motion.div
        data-launcher
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[420px] max-w-[calc(100vw-16px)] glass-panel border-white/10 shadow-2xl overflow-hidden"
        style={{
          top: launcherPos.top,
          left: launcherPos.left,
          zIndex: 9999,
          maxHeight: 'calc(100vh - 100px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            {customizeMode ? 'Customize AEGIS' : 'AEGIS Features'}
          </h3>
          <div className="flex items-center gap-2">
            {!customizeMode && (
              <button
                onClick={() => setCustomizeMode(true)}
                className="p-1.5 text-white/40 hover:text-white transition-colors"
                aria-label="Customize features"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {customizeMode && (
              <button
                onClick={() => setCustomizeMode(false)}
                className="p-1.5 text-cyber-green hover:text-white transition-colors"
                aria-label="Done customizing"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {customizeMode ? (
            /* Customize Mode */
            <div className="space-y-2">
              {features.map((feature, index) => {
                const Icon = getIcon(feature.icon);
                return (
                  <div key={feature.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
                    <GripVertical className="w-4 h-4 text-white/20" />
                    <Icon className="w-4 h-4 text-white/50" />
                    <span className="flex-1 text-xs font-bold text-white truncate">{feature.name}</span>
                    <button
                      onClick={() => handleMoveFeature(feature.id, 'up')}
                      disabled={index === 0}
                      className="p-1 text-white/40 hover:text-white disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveFeature(feature.id, 'down')}
                      disabled={index === features.length - 1}
                      className="p-1 text-white/40 hover:text-white disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDownIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteFeature(feature.id)}
                      className="p-1 text-white/40 hover:text-cyber-red"
                      aria-label="Delete feature"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              <button
                onClick={() => setShowAddFeature(true)}
                className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/20 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:border-white/40 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Feature
              </button>
            </div>
          ) : (
            /* Normal Mode - Feature Grid */
            <div className="grid grid-cols-3 gap-3">
              {features.filter(f => f.enabled).map((feature) => {
                const Icon = getIcon(feature.icon);
                return (
                  <button
                    key={feature.id}
                    onClick={() => handleFeatureClick(feature.route)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-cyber-blue/10 transition-all">
                      <Icon className="w-5 h-5 text-white/70 group-hover:text-cyber-blue transition-all" />
                    </div>
                    <span className="text-[10px] font-bold text-white/70 group-hover:text-white text-center leading-tight">
                      {feature.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Themes Section */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2">Themes</p>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCurrentTheme?.(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentTheme === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <t.icon className={`w-4 h-4 ${t.color}`} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customize Mode Footer */}
        {customizeMode && (
          <div className="flex gap-2 p-4 border-t border-white/10">
            <button
              onClick={() => setCustomizeMode(false)}
              className="flex-1 py-2 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => setCustomizeMode(false)}
              className="flex-1 py-2 bg-cyber-blue text-black rounded-xl text-sm font-bold hover:scale-[1.02] transition-all"
            >
              Save
            </button>
          </div>
        )}
      </motion.div>,
      document.body
    );
  };

  // Add Feature Modal
  const renderAddFeatureModal = () => {
    if (!showAddFeature) return null;

    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]"
        onClick={() => setShowAddFeature(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="glass-panel border-white/10 shadow-2xl p-6 w-[360px] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold text-white mb-4">Add New AEGIS Feature</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Feature Name</label>
              <input
                type="text"
                value={newFeature.name}
                onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue"
                placeholder="Enter feature name"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Description</label>
              <input
                type="text"
                value={newFeature.description}
                onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue"
                placeholder="Enter description"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Route</label>
              <input
                type="text"
                value={newFeature.route}
                onChange={(e) => setNewFeature({ ...newFeature, route: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyber-blue"
                placeholder="dashboard, violations, authority, settings"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowAddFeature(false)}
              className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddFeature}
              className="flex-1 py-2.5 bg-cyber-blue text-black rounded-xl text-sm font-bold hover:scale-[1.02] transition-all"
            >
              Add Feature
            </button>
          </div>
        </motion.div>
      </motion.div>,
      document.body
    );
  };

  // Account menu via portal
  const renderAccountMenu = () => {
    if (!showUserMenu) return null;

    return createPortal(
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed w-[260px] glass-panel border-white/10 shadow-2xl overflow-hidden"
        style={{
          top: dropdownPos.top,
          left: dropdownPos.left,
          zIndex: 9999,
        }}
      >
        {/* Account Header */}
        <div className="p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {userPhoto ? (
              <img src={userPhoto} alt={userName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className={`w-10 h-10 rounded-full ${getAvatarColor(userName || 'U')} flex items-center justify-center`}>
                <span className="text-sm font-black text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-white/40 truncate">harshan@example.com</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-2">
          <button
            onClick={handleSwitchAccount}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all"
          >
            <Users className="w-4 h-4" />
            Switch account
          </button>
          <button
            onClick={() => { onViewChange('settings'); setShowUserMenu?.(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all"
          >
            <Settings className="w-4 h-4" />
            Account settings
          </button>
          <button
            onClick={() => { setShowUserMenu?.(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all"
          >
            <Bell className="w-4 h-4" />
            Notifications
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-cyber-red hover:bg-cyber-red/10 transition-all"
          >
            <LogOutIcon className="w-4 h-4" />
            Log out
          </button>
        </div>
      </motion.div>,
      document.body
    );
  };

  // Logout confirmation dialog
  const renderLogoutConfirm = () => {
    if (!showLogoutConfirm) return null;

    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]"
        onClick={() => setShowLogoutConfirm(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="glass-panel border-white/10 shadow-2xl p-6 w-[320px] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold text-white mb-2">Log out</h3>
          <p className="text-sm text-white/60 mb-6">Are you sure you want to log out?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-2.5 bg-cyber-red text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all"
            >
              Log out
            </button>
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]"
        onClick={() => setShowSwitchAccount(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="glass-panel border-white/10 shadow-2xl p-6 w-[360px] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold text-white mb-4">Switch Account</h3>

          {/* Current Account */}
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Current Account</p>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              <div className={`w-10 h-10 rounded-full ${getAvatarColor(userName || 'U')} flex items-center justify-center`}>
                <span className="text-sm font-black text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">{userName || 'User'}</p>
                <p className="text-[10px] text-white/40">harshan@example.com</p>
              </div>
            </div>
          </div>

          {/* Other Accounts */}
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Other Accounts</p>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <span className="text-sm font-black text-white">G</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Guest Account</p>
                  <p className="text-[10px] text-white/40">guest@aegis.local</p>
                </div>
              </button>
            </div>
          </div>

          {/* Add Account */}
          <button
            onClick={() => { setShowSwitchAccount(false); onLogin?.(); }}
            className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/20 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:border-white/40 transition-all"
          >
            <LogIn className="w-4 h-4" />
            Add another account
          </button>

          <button
            onClick={() => setShowSwitchAccount(false)}
            className="w-full mt-4 py-2.5 bg-white/5 border border-white/10 text-white/70 rounded-xl text-sm font-bold hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>,
      document.body
    );
  };

  return (
    <>
      <nav className="relative z-[80] w-full max-w-5xl mx-auto px-4 sm:px-8 pt-6">
        <div className="glass-panel px-6 py-3.5 border-white/10 flex items-center justify-between relative overflow-hidden group shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-24 h-full bg-gradient-to-r from-transparent via-cyber-blue to-transparent skew-x-12"
            />
          </div>

          {/* Aegis Shield Logo */}
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="p-2.5 bg-cyber-blue rounded-2xl shadow-[0_0_20px_#FF6B35] group-hover:scale-105 transition-transform flex items-center justify-center">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-sm font-display font-black tracking-[0.25em] text-white">AEGIS AI</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
                <span className="text-[9px] font-mono text-cyber-blue/80 uppercase tracking-widest">v2.5</span>
              </div>
            </div>
          </div>

          {/* Center Nav */}
          <div className="hidden md:flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/5 relative z-10">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id as any)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                  currentView === item.id
                    ? 'text-black bg-cyber-blue shadow-[0_0_20px_#FF6B35]'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Right Side - Grid + Theme + User */}
          <div className="flex items-center gap-3 relative z-10">
            {/* 9-Dot Grid - Feature Launcher */}
            <button
              ref={gridRef}
              onClick={toggleLauncher}
              className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white/50 hover:text-white transition-all"
              aria-label="Open AEGIS feature launcher"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>

            {/* Theme Selector */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => { setShowThemeMenu?.(!showThemeMenu); setShowUserMenu?.(false); setLauncherOpen(false); }}
                className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white/50 hover:text-white transition-all"
                title="Change Theme"
              >
                <Palette className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {showThemeMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 top-12 w-48 glass-panel p-2 border-white/10 shadow-2xl"
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/40 px-3 py-2">Choose Theme</p>
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setCurrentTheme?.(t.id); setShowThemeMenu?.(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          currentTheme === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <t.icon className={`w-4 h-4 ${t.color}`} />
                        {t.name}
                        {currentTheme === t.id && <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue ml-auto" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile Avatar */}
            {userName && (
              <div className="relative" ref={userMenuRef}>
                <button
                  ref={avatarRef}
                  onClick={toggleDropdown}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"
                  aria-label="Open account menu"
                >
                  {userPhoto ? (
                    <img src={userPhoto} alt={userName} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(userName)} flex items-center justify-center`}>
                      <span className="text-xs font-black text-white">{userName.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 text-white/50 hover:text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden mt-3 glass-panel p-4 border-white/10 space-y-2 shadow-2xl"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onViewChange(item.id as any); setIsMenuOpen(false); }}
                  className={`w-full p-4 rounded-xl text-left text-[11px] font-black uppercase tracking-wider flex items-center gap-3 transition-all ${
                    currentView === item.id ? 'bg-cyber-blue text-black' : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Portal-based dropdowns */}
      <AnimatePresence>{renderLauncher()}</AnimatePresence>
      <AnimatePresence>{renderAccountMenu()}</AnimatePresence>
      <AnimatePresence>{renderLogoutConfirm()}</AnimatePresence>
      <AnimatePresence>{renderSwitchAccount()}</AnimatePresence>
      <AnimatePresence>{renderAddFeatureModal()}</AnimatePresence>
    </>
  );
}