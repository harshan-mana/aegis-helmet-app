import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldAlert, User, Phone, Save, X, Zap, Settings, LogOut, ChevronDown, Palette, Moon, Sun, Sparkles } from 'lucide-react';
import AegisNavbar from './components/AegisNavbar';
import AuthorityView from './components/AuthorityView';
import SettingsView from './components/SettingsView';
import DashboardView from './components/DashboardView';
import ViolationsView from './components/ViolationsView';
import AuthModal from './components/AuthModal';
import ServiceProviderLogin from './components/ServiceProviderLogin';
import { AegisAuthUser, LOCAL_AUTH_STORAGE_KEY } from './types/auth';

const THEMES = [
  { id: 'cyber', name: 'Cyber Night', icon: Moon, bg: 'bg-[#14100D]', accent: 'cyber-blue' },
  { id: 'sunset', name: 'Sunset Glow', icon: Sun, bg: 'bg-[#1a0a0a]', accent: 'cyber-orange' },
  { id: 'aurora', name: 'Aurora', icon: Sparkles, bg: 'bg-[#0a0a1a]', accent: 'cyber-purple' },
  { id: 'ocean', name: 'Ocean', icon: Palette, bg: 'bg-[#0a1a1a]', accent: 'cyber-green' },
];

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [localUser, setLocalUser] = useState<AegisAuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [userRole, setUserRole] = useState<string | null>(() => {
    try {
      const savedUser = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return parsed.role || 'Driver';
      }
      return localStorage.getItem('aegis_guest_role') || null;
    } catch {
      return null;
    }
  });
  const [currentView, setCurrentView] = useState<'dashboard' | 'violations' | 'authority' | 'profile' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isServiceProviderOpen, setIsServiceProviderOpen] = useState(false);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', phone: '', guardianName: '', guardianPhone: '' });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('aegis_theme') || 'cyber';
  });

  const effectiveUser = user || localUser;

  // Splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Apply theme
  useEffect(() => {
    localStorage.setItem('aegis_theme', currentTheme);
  }, [currentTheme]);

  const isProfileComplete = () => {
    const saved = localStorage.getItem('aegis_user_profile');
    if (saved) {
      const profile = JSON.parse(saved);
      return profile.name && profile.phone && profile.emergencyContact1?.name && profile.emergencyContact1?.phone;
    }
    return false;
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (unsubscribeProfile) unsubscribeProfile();

      if (u) {
        unsubscribeProfile = onSnapshot(doc(db, 'users', u.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserRole(data.role || 'Driver');
            if (!data.phone || !data.emergencyContact1?.phone) {
              setShowProfilePrompt(true);
            }
          } else {
            handleNewUser(u.uid, u.email || '');
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          setLoading(false);
        });
      } else {
        if (!localUser) {
          setUserRole(null);
          setShowProfilePrompt(false);
        } else {
          setUserRole(localUser.role || 'Driver');
          if (!isProfileComplete()) {
            setShowProfilePrompt(true);
          }
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [localUser]);

  const handleAuthSuccess = (authUser: AegisAuthUser) => {
    setLocalUser(authUser);
    setUserRole(authUser.role || 'Driver');
    setCurrentView('dashboard');
    setIsAuthModalOpen(false);
  };

  const handleGuestLogin = () => {
    const guest: AegisAuthUser = {
      uid: 'guest_sentry_node',
      displayName: 'Guest Sentry Pilot',
      email: 'guest@aegis-sentry.local',
      provider: 'guest',
      role: 'Driver',
      isAnonymous: true,
    };
    try {
      localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(guest));
      localStorage.setItem('aegis_guest_role', 'Driver');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    handleAuthSuccess(guest);
    if (!isProfileComplete()) {
      setShowProfilePrompt(true);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
      localStorage.removeItem('aegis_guest_active');
      localStorage.removeItem('aegis_guest_role');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    setLocalUser(null);
    setUser(null);
    setUserRole(null);
    setShowProfilePrompt(false);
    setShowUserMenu(false);
    try {
      await auth.signOut();
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }
  };

  const handleNewUser = async (uid: string, email: string) => {
    const defaultRole = email.includes('admin') || email.includes('rto') ? 'RTO' : 'Driver';
    try {
      await setDoc(doc(db, 'users', uid), {
        userId: uid,
        email: email,
        role: defaultRole,
        name: auth.currentUser?.displayName || '',
        createdAt: new Date().toISOString(),
        phone: '',
        emergencyContact1: { name: '', phone: '' },
        emergencyContact2: { name: '', phone: '' },
        autoReport: true,
        guardianNotifications: false
      });
      setUserRole(defaultRole);
      setShowProfilePrompt(true);
      setCurrentView('dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  const saveProfile = async () => {
    if (!effectiveUser) return;
    const profileDataToSave = {
      name: profileData.name,
      phone: profileData.phone,
      emergencyContact1: { name: profileData.guardianName, phone: profileData.guardianPhone },
      autoReport: true,
      guardianNotifications: true,
    };
    localStorage.setItem('aegis_user_profile', JSON.stringify(profileDataToSave));
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), profileDataToSave);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
    setShowProfilePrompt(false);
    setProfileData({ name: '', phone: '', guardianName: '', guardianPhone: '' });
  };

  const skipProfile = () => setShowProfilePrompt(false);

  const theme = THEMES.find(t => t.id === currentTheme) || THEMES[0];

  // Splash Screen
  if (showSplash) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-12 border-2 border-dashed border-cyber-blue/30 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-20 border border-cyber-orange/20 rounded-full"
          />
          <div className="p-10 bg-gradient-to-br from-cyber-blue/20 to-cyber-purple/20 rounded-full backdrop-blur-3xl border border-cyber-blue/30 relative overflow-hidden">
            <Shield className="w-20 h-20 text-cyber-blue" />
            <div className="absolute inset-0 bg-gradient-to-tr from-cyber-blue/30 to-transparent pointer-events-none" />
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-display font-black tracking-[0.3em] text-white uppercase mt-8 neon-text-blue"
          >
            AEGIS AI
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-xs font-mono text-cyber-blue/60 uppercase tracking-widest mt-2"
          >
            Smart Traffic Safety System
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 200 }}
            transition={{ delay: 0.8, duration: 1.2, ease: "easeInOut" }}
            className="h-1 bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-full mt-6"
          />
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-cyber-blue border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} transition-colors duration-500`}>
      <AegisNavbar
        userRole={userRole}
        onViewChange={setCurrentView}
        currentView={currentView}
        onSignOut={handleSignOut}
        onLogin={() => setIsAuthModalOpen(true)}
        onServiceProviderLogin={() => setIsServiceProviderOpen(true)}
        userName={effectiveUser?.displayName || undefined}
        userPhoto={effectiveUser?.photoURL || undefined}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        showThemeMenu={showThemeMenu}
        setShowThemeMenu={setShowThemeMenu}
        currentTheme={currentTheme}
        setCurrentTheme={setCurrentTheme}
        onSwitchAccount={() => { handleSignOut(); setIsAuthModalOpen(true); }}
      />

      <main>
        {!effectiveUser ? (
          <div className="min-h-screen flex items-center justify-center px-4 py-20 relative">
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary rounded-full blur-[200px]" />
            </div>
            <div className="max-w-2xl text-center z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex justify-center mb-8"
              >
                <div className="p-4 bg-brand-primary rounded-3xl shadow-2xl shadow-brand-primary/20">
                  <ShieldAlert className="w-16 h-16 text-white" />
                </div>
              </motion.div>
              <h1 className="text-5xl sm:text-7xl font-display font-bold tracking-tighter mb-6 leading-none">
                AI TRAFFIC <br /> <span className="text-brand-primary">SAFETY</span> FOR ALL
              </h1>
              <p className="text-white/40 text-lg mb-10 max-w-md mx-auto leading-relaxed">
                Integrating real-time image recognition with RTO databases to prevent accidents and enforce safety standards.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  id="btn-get-started"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full sm:w-auto px-10 py-4 bg-white text-black text-sm font-bold uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                >
                  Get Started
                </button>
                <button
                  id="btn-hero-continue-as-guest"
                  onClick={handleGuestLogin}
                  className="w-full sm:w-auto px-8 py-4 bg-cyber-blue/15 border border-cyber-blue/40 text-cyber-blue text-sm font-black uppercase tracking-widest rounded-full hover:bg-cyber-blue hover:text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyber-blue/10"
                >
                  <Zap className="w-4 h-4" />
                  Continue as Guest
                </button>
              </div>
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => setIsServiceProviderOpen(true)}
                  className="text-white/40 hover:text-white/70 text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Service Provider
                </button>
                <span className="text-white/20">|</span>
                <button
                  onClick={() => setShowThemeMenu(!showThemeMenu)}
                  className="text-white/40 hover:text-white/70 text-xs font-mono uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Theme
                </button>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'dashboard' && <DashboardView userName={effectiveUser?.displayName || undefined} userPhoto={effectiveUser?.photoURL || undefined} onViewChange={setCurrentView} onSignOut={handleSignOut} onLogin={() => setIsAuthModalOpen(true)} />}
              {currentView === 'violations' && <ViolationsView />}
              {currentView === 'authority' && <AuthorityView />}
              {currentView === 'settings' && <SettingsView />}
              {currentView === 'profile' && <div>Profile Settings (Coming Soon)</div>}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={handleAuthSuccess}
      />

      <ServiceProviderLogin
        isOpen={isServiceProviderOpen}
        onClose={() => setIsServiceProviderOpen(false)}
      />

      {/* Simple Profile Prompt - Non-blocking */}
      <AnimatePresence>
        {showProfilePrompt && effectiveUser && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-[95%] max-w-md"
          >
            <div className="glass-panel p-5 border-white/10 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyber-blue/10 rounded-xl shrink-0">
                  <User className="w-5 h-5 text-cyber-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-white mb-1">Complete Your Profile</h3>
                  <p className="text-[10px] text-white/50 mb-3">Add your details for emergency features</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-blue"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-blue"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Guardian Name"
                        value={profileData.guardianName}
                        onChange={(e) => setProfileData({ ...profileData, guardianName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      />
                      <input
                        type="tel"
                        placeholder="Guardian Phone"
                        value={profileData.guardianPhone}
                        onChange={(e) => setProfileData({ ...profileData, guardianPhone: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={skipProfile}
                      className="flex-1 py-2 bg-white/5 border border-white/10 text-white/60 rounded-lg text-xs font-bold hover:bg-white/10 transition-all"
                    >
                      Skip
                    </button>
                    <button
                      onClick={saveProfile}
                      className="flex-1 py-2 bg-cyber-blue text-black rounded-lg text-xs font-black hover:scale-[1.02] transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>
                <button onClick={skipProfile} className="p-1 text-white/30 hover:text-white shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-accent/5 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}