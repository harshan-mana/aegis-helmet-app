import { useState, useEffect, useCallback } from 'react';
import { AegisAuthUser, LOCAL_AUTH_STORAGE_KEY } from '../types/auth';

interface SessionState {
  user: AegisAuthUser | null;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  isLoading: boolean;
}

interface UseSessionReturn extends SessionState {
  login: (user: AegisAuthUser) => void;
  logout: () => void;
  completeProfile: (profile: any) => void;
  updateProfile: (updates: any) => void;
}

export function useSession(): UseSessionReturn {
  const [user, setUser] = useState<AegisAuthUser | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const savedAuth = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
        const savedProfile = localStorage.getItem('aegis_user_profile');

        if (savedAuth) {
          const authUser: AegisAuthUser = JSON.parse(savedAuth);
          setUser(authUser);

          if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            const complete = profile.name && profile.phone &&
                           profile.emergencyContact1?.name &&
                           profile.emergencyContact1?.phone;
            setIsProfileComplete(complete);
          }
        }
      } catch (e) {
        console.error('Session load error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const login = useCallback((authUser: AegisAuthUser) => {
    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
    setIsProfileComplete(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    localStorage.removeItem('aegis_guest_role');
    setUser(null);
    setIsProfileComplete(false);
  }, []);

  const completeProfile = useCallback((profile: any) => {
    localStorage.setItem('aegis_user_profile', JSON.stringify(profile));
    setIsProfileComplete(true);
  }, []);

  const updateProfile = useCallback((updates: any) => {
    const saved = localStorage.getItem('aegis_user_profile');
    const current = saved ? JSON.parse(saved) : {};
    const updated = { ...current, ...updates };
    localStorage.setItem('aegis_user_profile', JSON.stringify(updated));
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isProfileComplete,
    isLoading,
    login,
    logout,
    completeProfile,
    updateProfile,
  };
}
