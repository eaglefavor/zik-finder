import { useState, useEffect } from 'react';

type NetworkType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

export function useNetworkQuality() {
  const [quality, setQuality] = useState<NetworkType>('4g');
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API
    // @ts-expect-error - Navigator interface extension
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const updateConnectionStatus = () => {
      if (connection) {
        setQuality(connection.effectiveType as NetworkType);
      }
    };

    if (connection) {
      updateConnectionStatus();
      connection.addEventListener('change', updateConnectionStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, []);

  return { 
    quality, 
    isOnline,
    isLowData: quality === 'slow-2g' || quality === '2g' || quality === '3g'
  };
}
