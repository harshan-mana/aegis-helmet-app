import { useState, useEffect, useCallback, useRef } from 'react';

interface ESP32State {
  isConnected: boolean;
  streamUrl: string;
  speed: number;
  persons: number;
  plates: string[];
  error: string | null;
  isConnecting: boolean;
}

interface UseESP32Return extends ESP32State {
  connect: (url?: string) => Promise<void>;
  disconnect: () => void;
  captureFrame: () => Promise<string | null>;
  setStreamUrl: (url: string) => void;
}

export function useESP32(): UseESP32Return {
  const [isConnected, setIsConnected] = useState(false);
  const [streamUrl, setStreamUrl] = useState('http://192.168.4.1:81/stream');
  const [speed, setSpeed] = useState(0);
  const [persons, setPersons] = useState(0);
  const [plates, setPlates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async (url?: string) => {
    const targetUrl = url || streamUrl;
    setIsConnecting(true);
    setError(null);

    try {
      // Test connection to ESP32-CAM stream
      const response = await fetch(targetUrl, {
        method: 'GET',
        mode: 'cors',
      });

      if (response.ok) {
        setIsConnected(true);
        setStreamUrl(targetUrl);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e: any) {
      setError(e.message || 'Connection failed');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [streamUrl]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setSpeed(0);
    setPersons(0);
    setPlates([]);
  }, []);

  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!isConnected) return null;

    try {
      const response = await fetch(streamUrl);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Capture error:', e);
      return null;
    }
  }, [isConnected, streamUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    streamUrl,
    speed,
    persons,
    plates,
    error,
    isConnecting,
    connect,
    disconnect,
    captureFrame,
    setStreamUrl,
  };
}
