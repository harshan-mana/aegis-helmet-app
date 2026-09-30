import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, LayoutDashboard, Settings, LogOut, Menu, X, Gauge, AlertTriangle, Database, ChevronDown, Palette, Moon, Sun, Sparkles, RefreshCw, User, LogIn, Users, Bell, LogOut as LogOutIcon } from 'lucide-react';
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

const THEMES = [
  { id: 'cyber', name: 'Cyber Night', icon: Moon, color: 'text-cyber-blue' },
  { id: 'sunset', name: 'Sunset Glow', icon: Sun, color: 'text-cyber-orange' },
  { id: 'aurora', name: 'Aurora', icon: Sparkles, color: 'text-cyber-purple' },
  { id: 'ocean', name: 'Ocean', icon: Palette, color: 'text-cyber-green' },
];

const AVATAR_COLORS = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 'bg-teal-500', 'bg-indigo-500'];

export default function AegisNavbar({ userRole, onViewChange, currentView, onSignOut, onLogin, onServiceProviderLogin, userName, userPhoto, showUserMenu, setShowUserMenu, showThemeMenu, setShowThemeMenu, currentTheme, setCurrentTheme, onSwitchAccount }: AegisNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileIncomplete(!data.phone || !data.emergencyContact1?.phone);
      }
    }, () => {});
  }, []);

  // Calculate dropdown position based on avatar position
  const updateDropdownPosition = useCallback(() => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      const dropdownWidth = 260;
      let left = rect.right - dropdownWidth;
      // Ensure dropdown stays within viewport
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

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (!showUserMenu) {
      updateDropdownPosition();
    }
    setShowUserMenu?.(!showUserMenu);
    setShowThemeMenu?.(false);
  }, [showUserMenu, setShowUserMenu, setShowThemeMenu, updateDropdownPosition]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
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

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu?.(false);
        setShowLogoutConfirm(false);
        setShowSwitchAccount(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setShowUserMenu]);

  // Update position on window resize
  useEffect(() => {
    window.addEventListener('resize', updateDropdownPosition);
    return () => window.removeEventListener('resize', updateDropdownPosition);
  }, [updateDropdownPosition]);

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

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setShowUserMenu?.(false);
    onSignOut?.();
  };

  const handleSwitchAccount = () => {
    setShowSwitchAccount(true);
    setShowUserMenu?.(false);
  };

  // Render dropdown via portal to avoid clipping
  const renderDropdown = () => {
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
            onClick={() => { /* Notifications */ setShowUserMenu?.(false); }}
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

          {/* Center Nav - All options visible directly */}
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
                onClick={() => { setShowThemeMenu?.(!showThemeMenu); setShowUserMenu?.(false); }}
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

            {/* User Profile Avatar - Google Style */}
            {userName && (
              <div className="relative" ref={userMenuRef}>
                <button
                  ref={avatarRef}
                  onClick={toggleDropdown}
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

      {/* Portal-based dropdowns - rendered outside navbar to avoid clipping */}
      <AnimatePresence>{renderDropdown()}</AnimatePresence>
      <AnimatePresence>{renderLogoutConfirm()}</AnimatePresence>
      <AnimatePresence>{renderSwitchAccount()}</AnimatePresence>
    </>
  );
}