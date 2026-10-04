import { useState, useEffect, useCallback } from 'react';

interface PermissionState {
  camera: PermissionState | 'prompt' | 'denied' | 'granted';
  location: PermissionState | 'prompt' | 'denied' | 'granted';
  microphone: PermissionState | 'prompt' | 'denied' | 'granted';
}

interface UsePermissionsReturn {
  permissions: PermissionState;
  requestCamera: () => Promise<boolean>;
  requestLocation: () => Promise<boolean>;
  requestAll: () => Promise<boolean>;
  allGranted: boolean;
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: 'prompt',
    location: 'prompt',
    microphone: 'prompt',
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check permission states on mount
  useEffect(() => {
    const checkPermissions = async () => {
      if (!navigator.permissions) {
        setIsLoading(false);
        return;
      }

      try {
        const [camera, location] = await Promise.all([
          navigator.permissions.query({ name: 'camera' as PermissionName }),
          navigator.permissions.query({ name: 'geolocation' }),
        ]);

        setPermissions({
          camera: camera.state,
          location: location.state,
          microphone: 'prompt',
        });

        // Listen for permission changes
        camera.onchange = () => setPermissions(p => ({ ...p, camera: camera.state }));
        location.onchange = () => setPermissions(p => ({ ...p, location: location.state }));
      } catch (e) {
        console.warn('Permission API not fully supported:', e);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermissions();
  }, []);

  const requestCamera = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(p => ({ ...p, camera: 'granted' }));
      return true;
    } catch (e) {
      setPermissions(p => ({ ...p, camera: 'denied' }));
      return false;
    }
  }, []);

  const requestLocation = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissions(p => ({ ...p, location: 'granted' }));
          resolve(true);
        },
        () => {
          setPermissions(p => ({ ...p, location: 'denied' }));
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  const requestAll = useCallback(async (): Promise<boolean> => {
    const [cameraGranted, locationGranted] = await Promise.all([
      requestCamera(),
      requestLocation(),
    ]);
    return cameraGranted && locationGranted;
  }, [requestCamera, requestLocation]);

  const allGranted = permissions.camera === 'granted' && permissions.location === 'granted';

  return {
    permissions,
    requestCamera,
    requestLocation,
    requestAll,
    allGranted,
    isLoading,
  };
}
