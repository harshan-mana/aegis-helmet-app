import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Chrome, Apple, Mail, User, Lock, ArrowRight, Zap } from 'lucide-react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider, appleProvider } from '../lib/firebase';
import { AegisAuthUser } from '../types/auth';

interface LandingPageProps {
  onLogin: (user: AegisAuthUser) => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [view, setView] = useState<'options' | 'email' | 'guest'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Guest mode state
  const [guestId, setGuestId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  const deriveRole = (email: string): 'Driver' | 'RTO' =>
    email.toLowerCase().includes('rto') || email.toLowerCase().includes('admin') ? 'RTO' : 'Driver';

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setError('');
    setIsAuthenticating(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user: AegisAuthUser = {
        uid: cred.user.uid,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'User',
        email: cred.user.email || '',
        photoURL: cred.user.photoURL || undefined,
        provider: 'google',
        role: deriveRole(cred.user.email || ''),
      };
      onLogin(user);
    } catch (e: any) {
      setError(e?.message || 'Google sign-in failed');
      setIsAuthenticating(false);
    }
  };

  // Apple Sign In
  const handleAppleSignIn = async () => {
    setError('');
    setIsAuthenticating(true);
    try {
      const cred = await signInWithPopup(auth, appleProvider);
      const user: AegisAuthUser = {
        uid: cred.user.uid,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'User',
        email: cred.user.email || '',
        photoURL: cred.user.photoURL || undefined,
        provider: 'apple',
        role: deriveRole(cred.user.email || ''),
      };
      onLogin(user);
    } catch (e: any) {
      setError(e?.message || 'Apple sign-in failed');
      setIsAuthenticating(false);
    }
  };

  // Email Sign In
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setIsAuthenticating(true);
    try {
      let cred;
      if (isLogin) {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } else {
        cred = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
          await updateProfile(cred.user, { displayName: fullName });
        }
      }
      const user: AegisAuthUser = {
        uid: cred.user.uid,
        displayName: cred.user.displayName || email.split('@')[0],
        email: cred.user.email || email,
        photoURL: cred.user.photoURL || undefined,
        provider: 'email',
        role: deriveRole(email),
      };
      onLogin(user);
    } catch (e: any) {
      setError(e?.message || 'Authentication failed');
      setIsAuthenticating(false);
    }
  };

  // Guest Mode
  const handleGuestLogin = () => {
    if (isCreatingGuest) {
      // Create new guest account
      if (!guestId.trim() || !guestName.trim() || !guestPassword.trim()) {
        setError('Please fill all guest fields');
        return;
      }
      const guest: AegisAuthUser = {
        uid: `guest_${guestId}`,
        displayName: guestName,
        email: `${guestId}@guest.local`,
        provider: 'guest',
        role: 'Driver',
        isAnonymous: true,
      };
      localStorage.setItem('aegis_guest_data', JSON.stringify({
        guestId,
        guestName,
        guestPassword,
        profile: {},
      }));
      onLogin(guest);
    } else {
      // Login with existing guest account
      if (!guestId.trim() || !guestPassword.trim()) {
        setError('Please enter Guest ID and Password');
        return;
      }
      const savedData = localStorage.getItem('aegis_guest_data');
      if (savedData) {
        const data = JSON.parse(savedData);
        if (data.guestId === guestId && data.guestPassword === guestPassword) {
          const guest: AegisAuthUser = {
            uid: `guest_${guestId}`,
            displayName: data.guestName,
            email: `${guestId}@guest.local`,
            provider: 'guest',
            role: 'Driver',
            isAnonymous: true,
          };
          onLogin(guest);
        } else {
          setError('Invalid Guest ID or Password');
        }
      } else {
        setError('No guest account found. Please create one.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 relative">
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary rounded-full blur-[200px]" />
      </div>

      <div className="max-w-md w-full z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-brand-primary rounded-3xl shadow-2xl shadow-brand-primary/20 mb-4">
              <Shield className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-display font-black tracking-tight text-white">
              AEGIS AI
            </h1>
            <p className="text-white/40 text-sm mt-2">Smart Traffic Safety System</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Options View */}
          {view === 'options' && (
            <div className="space-y-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="w-full py-3.5 px-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all text-sm"
              >
                <Chrome className="w-4 h-4" />
                Sign in with Google
              </button>

              <button
                onClick={handleAppleSignIn}
                disabled={isAuthenticating}
                className="w-full py-3.5 px-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-sm"
              >
                <Apple className="w-4 h-4" />
                Sign in with Apple
              </button>

              <button
                onClick={() => setView('email')}
                className="w-full py-3 px-4 bg-transparent border border-white/10 text-white/80 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-sm"
              >
                <Mail className="w-4 h-4" />
                Email & Password
              </button>

              <button
                onClick={() => setView('guest')}
                className="w-full py-3 px-4 bg-transparent border border-white/10 text-white/80 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-sm"
              >
                <User className="w-4 h-4" />
                Guest Mode
              </button>
            </div>
          )}

          {/* Email View */}
          {view === 'email' && (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <button
                type="button"
                onClick={() => setView('options')}
                className="flex items-center gap-2 text-white/50 hover:text-white text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              {!isLogin && (
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                    placeholder="Enter your name"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3.5 bg-cyber-blue text-black rounded-2xl font-black text-sm"
              >
                {isAuthenticating ? 'Authenticating...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>

              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="w-full text-center text-white/50 hover:text-white text-sm"
              >
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </form>
          )}

          {/* Guest View */}
          {view === 'guest' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setView('options')}
                className="flex items-center gap-2 text-white/50 hover:text-white text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="flex items-center justify-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-cyber-blue" />
                <h2 className="text-lg font-bold text-white">Guest Mode</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Guest ID</label>
                  <input
                    type="text"
                    value={guestId}
                    onChange={(e) => setGuestId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                    placeholder="Enter Guest ID"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Guest Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                    placeholder="Enter Guest Name"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">Password</label>
                  <input
                    type="password"
                    value={guestPassword}
                    onChange={(e) => setGuestPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-blue"
                    placeholder="Enter Password"
                  />
                </div>
              </div>

              <button
                onClick={handleGuestLogin}
                className="w-full py-3.5 bg-cyber-blue text-black rounded-2xl font-black text-sm flex items-center justify-center gap-2"
              >
                {isCreatingGuest ? 'Create Guest Account' : 'Login as Guest'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsCreatingGuest(!isCreatingGuest)}
                className="w-full text-center text-white/50 hover:text-white text-sm"
              >
                {isCreatingGuest ? 'Already have a guest account? Login' : 'Create new guest account'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}