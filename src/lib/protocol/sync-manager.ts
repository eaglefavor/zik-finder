
import { OfflineSync } from '../offline-sync';

export const SyncManager = {
  async registerSync() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('SyncManager' in window)) {
      console.warn('Background Sync not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-expect-error - SyncManager is not in all TS definitions
      await registration.sync.register('zik-sync-lodges');
      console.log('Background sync registered');
    } catch (err) {
      console.error('Failed to register background sync:', err);
    }
  }
};
