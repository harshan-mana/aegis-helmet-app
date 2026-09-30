import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, LayoutDashboard, Settings, LogOut, X, Gauge, AlertTriangle, Database, ChevronDown, Palette, Moon, Sun, Sparkles, RefreshCw, User } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AegisNavbarProps {
  userRole: string | null;
  onViewChange: (view: 'dashboard' | 'violations' | 'authority' | 'profile' | 'settings') => void;
  currentView: string;
  onSignOut?: () => void;
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

const THEMES = [
  { id: 'cyber', name: 'Cyber Night', icon: Moon, color: 'text-cyber-blue' },
  { id: 'sunset', name: 'Sunset Glow', icon: Sun, color: 'text-cyber-orange' },
  { id: 'aurora', name: 'Aurora', icon: Sparkles, color: 'text-cyber-purple' },
  { id: 'ocean', name: 'Ocean', icon: Palette, color: 'text-cyber-green' },
];

const AVATAR_COLORS = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500'];

export default function AegisNavbar({ userRole, onViewChange, currentView, onSignOut, onServiceProviderLogin, userName, userPhoto, showUserMenu, setShowUserMenu, showThemeMenu, setShowThemeMenu, currentTheme, setCurrentTheme, onSwitchAccount }: AegisNavbarProps) {
  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const appsMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileIncomplete(!data.phone || !data.emergencyContact1?.phone);
      }
    }, () => {});
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (appsMenuRef.current && !appsMenuRef.current.contains(e.target as Node)) {
        setShowAppsMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu?.(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu?.(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [setShowUserMenu, setShowThemeMenu]);

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

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] w-[95%] max-w-5xl">
      <div className="glass-panel px-6 py-3.5 border-white/10 flex items-center justify-between relative overflow-hidden group shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-24 h-full bg-gradient-to-r from-transparent via-cyber-blue to-transparent skew-x-12"
          />
        </div>

        {/* Aegis Shield Logo - Click to show all options */}
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="relative" ref={appsMenuRef}>
            <button
              onClick={() => { setShowAppsMenu(!showAppsMenu); setShowUserMenu?.(false); setShowThemeMenu?.(false); }}
              className="flex items-center gap-3 group"
            >
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
            </button>

            {/* Apps Menu Dropdown - Shows all options */}
            <AnimatePresence>
              {showAppsMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute left-0 top-14 w-64 glass-panel border-white/10 shadow-2xl overflow-hidden"
                >
                  <div className="p-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/40 px-3 py-2">All Options</p>
                    {navItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { onViewChange(item.id as any); setShowAppsMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          currentView === item.id ? 'bg-cyber-blue/10 text-cyber-blue' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        {item.label}
                        {currentView === item.id && <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue ml-auto" />}
                      </button>
                    ))}
                    <div className="border-t border-white/10 mt-2 pt-2">
                      <button
                        onClick={() => { onServiceProviderLogin?.(); setShowAppsMenu(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-cyber-purple hover:bg-cyber-purple/10 transition-all"
                      >
                        <Database className="w-4 h-4" />
                        Service Provider
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Nav - Hidden on mobile */}
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

        {/* Right Side - Theme + User */}
        <div className="flex items-center gap-3 relative z-10">
          {/* Theme Selector */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => { setShowThemeMenu?.(!showThemeMenu); setShowUserMenu?.(false); setShowAppsMenu(false); }}
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

          {/* User Profile Dropdown - Google Style */}
          {userName && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => { setShowUserMenu?.(!showUserMenu); setShowThemeMenu?.(false); setShowAppsMenu(false); }}
                className="flex items-center gap-2 pl-1 pr-2 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"
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
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 top-12 w-64 glass-panel border-white/10 shadow-2xl overflow-hidden"
                  >
                    <div className="p-4 bg-white/5 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        {userPhoto ? (
                          <img src={userPhoto} alt={userName} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full ${getAvatarColor(userName)} flex items-center justify-center`}>
                            <span className="text-sm font-black text-white">{userName.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{userName}</p>
                          <p className="text-[10px] text-white/40 truncate">Driver</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => { onSwitchAccount?.(); setShowUserMenu?.(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Switch Account
                      </button>
                      <button
                        onClick={() => { onSignOut?.(); setShowUserMenu?.(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-cyber-red hover:bg-cyber-red/10 transition-all"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}