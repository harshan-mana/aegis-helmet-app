import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Chrome, Apple, Mail, X, ArrowLeft, Zap, CheckCircle2, Loader2, Lock, Shield, User, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider, appleProvider } from '../lib/firebase';
import { AegisAuthUser, LOCAL_AUTH_STORAGE_KEY } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: AegisAuthUser) => void;
}

type AuthProvider = 'google' | 'apple' | 'email' | null;

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [view, setView] = useState<'options' | 'email'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  
  // Realistic simulated OAuth Handshake state
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeProvider, setActiveProvider] = useState<AuthProvider>(null);
  const [authStep, setAuthStep] = useState<'connecting' | 'verifying' | 'success'>('connecting');
  const [simulatedAccount, setSimulatedAccount] = useState<{
    name: string;
    email: string;
    avatar: string;
    role: 'Driver' | 'RTO';
  }>({
    name: '',
    email: '',
    avatar: '',
    role: 'Driver',
  });

  const resetState = () => {
    setView('options');
    setEmail('');
    setPassword('');
    setFullName('');
    setError('');
    setIsAuthenticating(false);
    setActiveProvider(null);
  };

  const handleModalClose = () => {
    resetState();
    onClose();
  };

  const deriveRole = (email: string): 'Driver' | 'RTO' =>
    email.toLowerCase().includes('rto') || email.toLowerCase().includes('admin') ? 'RTO' : 'Driver';

  const mapCredentialUser = (u: FirebaseUser, provider: 'google' | 'apple' | 'email'): AegisAuthUser => {
    const email = u.email || '';
    const name =
      u.displayName ||
      email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
      'Aegis Rider';
    return {
      uid: u.uid,
      displayName: name,
      email,
      photoURL: u.photoURL || undefined,
      provider,
      role: deriveRole(email),
    };
  };

  // 1. Real Google OAuth via Firebase popup
  const handleGoogleSignIn = async () => {
    setError('');
    setActiveProvider('google');
    setAuthStep('connecting');
    setIsAuthenticating(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setAuthStep('success');
      setSimulatedAccount({
        name: cred.user.displayName || cred.user.email?.split('@')[0] || '',
        email: cred.user.email || '',
        avatar: cred.user.photoURL || '',
        role: deriveRole(cred.user.email || ''),
      });
      onLogin(mapCredentialUser(cred.user, 'google'));
      setTimeout(handleModalClose, 400);
    } catch (e: any) {
      setIsAuthenticating(false);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        setError('Sign-in window was closed. Please try again.');
      } else if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        setError('Pop-up was blocked. Allow pop-ups for this site and try again.');
      } else if (e.code && (e.code.includes('configuration-not-found') || e.code.includes('admin-restricted-operation'))) {
        setError('Google sign-in is not enabled yet. Enable it in Firebase Console → Authentication → Sign-in method.');
      } else {
        setError(e?.message || 'Google sign-in failed. Please try again.');
      }
    }
  };

  // 2. Real Apple OAuth via Firebase popup
  const handleAppleSignIn = async () => {
    setError('');
    setActiveProvider('apple');
    setAuthStep('connecting');
    setIsAuthenticating(true);
    try {
      const cred = await signInWithPopup(auth, appleProvider);
      setAuthStep('success');
      setSimulatedAccount({
        name: cred.user.displayName || cred.user.email?.split('@')[0] || '',
        email: cred.user.email || '',
        avatar: cred.user.photoURL || '',
        role: deriveRole(cred.user.email || ''),
      });
      onLogin(mapCredentialUser(cred.user, 'apple'));
      setTimeout(handleModalClose, 400);
    } catch (e: any) {
      setIsAuthenticating(false);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        setError('Sign-in window was closed. Please try again.');
      } else if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        setError('Pop-up was blocked. Allow pop-ups for this site and try again.');
      } else if (e.code && (e.code.includes('configuration-not-found') || e.code.includes('admin-restricted-operation'))) {
        setError('Apple sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method (Apple provider requires paid Apple Developer account).');
      } else {
        setError(e?.message || 'Apple sign-in failed. Please try again.');
      }
    }
  };

  // 3. Real Email & Password Authentication via Firebase
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (cleanPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setActiveProvider('email');
    setAuthStep('connecting');
    setIsAuthenticating(true);
    try {
      let userCred;
      if (isLogin) {
        userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      } else {
        userCred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        if (fullName.trim()) {
          await updateProfile(userCred.user, { displayName: fullName.trim() });
        }
      }
      setAuthStep('success');
      setSimulatedAccount({
        name: userCred.user.displayName || cleanEmail.split('@')[0],
        email: userCred.user.email || cleanEmail,
        avatar: userCred.user.photoURL || '',
        role: deriveRole(cleanEmail),
      });
      onLogin(mapCredentialUser(userCred.user, 'email'));
      setTimeout(handleModalClose, 400);
    } catch (e: any) {
      setIsAuthenticating(false);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        setError('Incorrect email or password.');
      } else if (e.code === 'auth/email-already-in-use') {
        setError('An account already exists with this email. Try signing in.');
      } else if (e.code === 'auth/weak-password') {
        setError('Password is too weak.');
      } else if (e.code === 'auth/user-disabled') {
        setError('This account has been disabled.');
      } else if (e.code && (e.code.includes('admin-restricted-operation') || e.code.includes('operation-not-allowed'))) {
        setError('Email/password sign-in is not enabled yet. Enable it in Firebase Console → Authentication → Sign-in method.');
      } else {
        setError(e?.message || 'Sign-in failed. Please try again.');
      }
    }
  };

  // 4. Continue as Guest / Skip
  const handleGuestAccess = () => {
    const guestUser: AegisAuthUser = {
      uid: 'guest_sentry_node',
      displayName: 'Guest Sentry Pilot',
      email: 'guest@aegis-sentry.local',
      provider: 'guest',
      role: 'Driver',
      isAnonymous: true,
    };

    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(guestUser));
    onLogin(guestUser);
    handleModalClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 z-[101] focus:outline-none">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-[#121216] border border-white/10 rounded-3xl p-7 shadow-2xl relative overflow-hidden text-white"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-blue to-transparent" />
                  
                  {/* Top Header */}
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      {view === 'email' && !isAuthenticating && (
                        <button 
                          onClick={() => { setView('options'); setError(''); }} 
                          className="p-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                      )}
                      <div>
                        <Dialog.Title className="text-xl font-display font-black tracking-tight">
                          {isAuthenticating
                            ? activeProvider === 'google'
                              ? 'Google Authentication'
                              : 'Apple ID Verification'
                            : view === 'email'
                            ? (isLogin ? 'Sign In with Email' : 'Create Rider Account')
                            : 'Secure Access & Entry'}
                        </Dialog.Title>
                        <Dialog.Description className="text-white/40 text-xs">
                          {isAuthenticating
                            ? 'Connecting to identity provider credentials'
                            : view === 'email'
                            ? 'Enter your credentials to access the telemetry cockpit.'
                            : 'Select your preferred entry method or continue instantly.'}
                        </Dialog.Description>
                      </div>
                    </div>
                    <Dialog.Close asChild>
                      <button 
                        disabled={isAuthenticating}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white disabled:opacity-30"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </Dialog.Close>
                  </div>

                  {/* Error Notification */}
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20 flex flex-col gap-1.5"
                    >
                      <p className="font-mono">{error}</p>
                    </motion.div>
                  )}

                  {/* Simulated OAuth Handshake Animation */}
                  {isAuthenticating ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-8 flex flex-col items-center justify-center text-center space-y-5"
                    >
                      <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-3 shadow-inner">
                          {activeProvider === 'google' ? (
                            <Chrome className="w-10 h-10 text-white" />
                          ) : (
                            <Apple className="w-10 h-10 text-white" />
                          )}
                        </div>
                        {authStep === 'success' ? (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -bottom-2 -right-2 p-1.5 bg-cyber-green rounded-full shadow-lg shadow-cyber-green/50"
                          >
                            <CheckCircle2 className="w-5 h-5 text-black" />
                          </motion.div>
                        ) : (
                          <div className="absolute -bottom-2 -right-2 p-1.5 bg-cyber-blue rounded-full shadow-lg shadow-cyber-blue/50 animate-spin">
                            <Loader2 className="w-5 h-5 text-black" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-bold text-white flex items-center justify-center gap-2">
                          {authStep === 'connecting' && 'Connecting to Identity Service...'}
                          {authStep === 'verifying' && 'Verifying Security Token & Passkey...'}
                          {authStep === 'success' && 'Authenticated Successfully!'}
                        </div>
                        <div className="text-xs font-mono text-white/50">
                          {simulatedAccount.name} ({simulatedAccount.email})
                        </div>
                      </div>

                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-cyber-blue to-cyber-green"
                          initial={{ width: '10%' }}
                          animate={{ 
                            width: authStep === 'connecting' ? '40%' : authStep === 'verifying' ? '85%' : '100%' 
                          }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-3.5">
                      {view === 'options' ? (
                        <>
                          {/* 1. Google Sign-In */}
                          <button 
                            id="btn-google-auth"
                            onClick={handleGoogleSignIn}
                            className="w-full py-3.5 px-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all text-sm shadow-md group cursor-pointer"
                          >
                            <Chrome className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
                            <span>Continue with Google</span>
                          </button>

                          {/* 2. Apple Sign-In */}
                          <button 
                            id="btn-apple-auth"
                            onClick={handleAppleSignIn}
                            className="w-full py-3.5 px-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 hover:scale-[1.01] active:scale-95 transition-all text-sm group cursor-pointer"
                          >
                            <Apple className="w-4 h-4 text-white/70 group-hover:text-white group-hover:scale-110 transition-all" />
                            <span>Continue with Apple</span>
                          </button>

                          {/* 3. Email & Password Toggle */}
                          <button 
                            id="btn-email-auth-toggle"
                            onClick={() => { setView('email'); setError(''); }}
                            className="w-full py-3 bg-transparent border border-white/10 text-white/80 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/5 transition-all text-xs cursor-pointer"
                          >
                            <Mail className="w-4 h-4 text-brand-primary" />
                            <span>Email & Password</span>
                          </button>

                          <div className="flex items-center gap-4 py-1.5">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest font-mono">or instant access</span>
                            <div className="flex-1 h-px bg-white/10" />
                          </div>

                          {/* 4. Continue as Guest Button */}
                          <button 
                            id="btn-continue-as-guest"
                            onClick={handleGuestAccess}
                            className="w-full py-4 px-5 bg-gradient-to-r from-cyber-blue to-[#FF8C69] text-black font-black rounded-2xl flex items-center justify-between hover:scale-[1.02] active:scale-95 transition-all text-sm shadow-lg shadow-cyber-blue/25 group cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-black/10 rounded-lg">
                                <Zap className="w-4 h-4 text-black" />
                              </div>
                              <div className="text-left">
                                <div className="font-display font-black leading-tight">Continue as Guest</div>
                                <div className="text-[10px] text-black/70 font-mono tracking-wider">Instant Dashboard Access • No Sign-In</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-mono bg-black/10 px-3 py-1.5 rounded-full group-hover:translate-x-0.5 transition-transform">
                              <span>Skip</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        </>
                      ) : (
                        /* Expanded Email & Password Form */
                        <form onSubmit={handleEmailAuth} className="space-y-3.5">
                          {!isLogin && (
                            <div>
                              <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">
                                Full Name
                              </label>
                              <div className="relative">
                                <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input 
                                  id="input-auth-name"
                                  type="text"
                                  placeholder="e.g. Alex Rider"
                                  value={fullName}
                                  onChange={(e) => setFullName(e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyber-blue text-white placeholder:text-white/20 transition-colors"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">
                              Email Address
                            </label>
                            <div className="relative">
                              <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input 
                                id="input-auth-email"
                                type="email"
                                placeholder="name@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyber-blue text-white placeholder:text-white/20 transition-colors"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">
                              Password
                            </label>
                            <div className="relative">
                              <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input 
                                id="input-auth-password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyber-blue text-white placeholder:text-white/20 transition-colors"
                              />
                            </div>
                          </div>

                          <button 
                            id="btn-auth-submit"
                            type="submit"
                            className="w-full py-3.5 bg-cyber-blue text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-sm shadow-lg shadow-cyber-blue/20 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Shield className="w-4 h-4" />
                            {isLogin ? 'Sign In & Launch Cockpit' : 'Create Account & Launch'}
                          </button>
                          
                          <div className="flex items-center justify-between pt-1 text-xs">
                            <button 
                              type="button"
                              onClick={() => { setIsLogin(!isLogin); setError(''); }}
                              className="text-white/50 hover:text-white transition-colors cursor-pointer"
                            >
                              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                            </button>
                            <button 
                              type="button"
                              onClick={handleGuestAccess}
                              className="text-cyber-blue hover:underline font-mono cursor-pointer flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3" /> Skip to Guest
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  <p className="mt-6 text-center text-[10px] text-white/30 uppercase tracking-widest leading-loose font-mono">
                    Aegis AI Sentry Grid • Traffic Safety Mobile & RTO
                  </p>
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
