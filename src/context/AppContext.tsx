import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AegisAuthUser } from '../types/auth';

interface AppState {
  user: AegisAuthUser | null;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  theme: string;
  esp32Connected: boolean;
  speed: number;
  persons: number;
  plates: string[];
  alerts: Array<{ type: string; message: string; timestamp: number }>;
}

interface AppContextType extends AppState {
  login: (user: AegisAuthUser) => void;
  logout: () => void;
  completeProfile: (profile: any) => void;
  setTheme: (theme: string) => void;
  setESP32Status: (connected: boolean, data?: { speed: number; persons: number; plates: string[] }) => void;
  addAlert: (type: string, message: string) => void;
  clearAlerts: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AegisAuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('aegis_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [isProfileComplete, setIsProfileComplete] = useState(() => {
    try {
      const saved = localStorage.getItem('aegis_user_profile');
      if (saved) {
        const profile = JSON.parse(saved);
        return !!(profile.name && profile.phone && profile.emergencyContact1?.name && profile.emergencyContact1?.phone);
      }
    } catch {}
    return false;
  });

  const [theme, setTheme] = useState(() => localStorage.getItem('aegis_theme') || 'cyber');
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [persons, setPersons] = useState(0);
  const [plates, setPlates] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Array<{ type: string; message: string; timestamp: number }>>([]);

  const login = useCallback((authUser: AegisAuthUser) => {
    localStorage.setItem('aegis_auth_user', JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('aegis_auth_user');
    localStorage.removeItem('aegis_guest_role');
    setUser(null);
    setIsProfileComplete(false);
  }, []);

  const completeProfile = useCallback((profile: any) => {
    localStorage.setItem('aegis_user_profile', JSON.stringify(profile));
    setIsProfileComplete(true);
  }, []);

  const handleSetTheme = useCallback((newTheme: string) => {
    localStorage.setItem('aegis_theme', newTheme);
    setTheme(newTheme);
  }, []);

  const setESP32Status = useCallback((connected: boolean, data?: { speed: number; persons: number; plates: string[] }) => {
    setEsp32Connected(connected);
    if (data) {
      setSpeed(data.speed);
      setPersons(data.persons);
      setPlates(data.plates);
    }
  }, []);

  const addAlert = useCallback((type: string, message: string) => {
    setAlerts(prev => [...prev, { type, message, timestamp: Date.now() }]);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isProfileComplete,
        theme,
        esp32Connected,
        speed,
        persons,
        plates,
        alerts,
        login,
        logout,
        completeProfile,
        setTheme: handleSetTheme,
        setESP32Status,
        addAlert,
        clearAlerts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
