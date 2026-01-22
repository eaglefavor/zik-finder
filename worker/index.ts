
/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, set } from 'idb-keyval';

const OUTBOX_KEY = 'zik_lodge_outbox';

// @ts-ignore - SW types
self.addEventListener('sync', (event) => {
  // @ts-ignore - SW types
  if (event.tag === 'zik-sync-lodges') {
    // @ts-ignore - SW types
    event.waitUntil(syncOutbox());
  }
});

async function syncOutbox() {
  const outbox = await get<any[]>(OUTBOX_KEY);
  if (!outbox || outbox.length === 0) return;

  console.log('SW: Syncing outbox...', outbox.length, 'items');

  for (const item of outbox) {
    // Safety Check: The SW cannot handle file uploads securely (auth storage access).
    // We defer these to the main thread (data-context.tsx).
    if (item.files && Object.keys(item.files).length > 0) {
      console.log(`SW: Skipping item ${item.id} (requires file upload - waiting for foreground)`);
      continue;
    }

    try {
      const res = await fetch('/api/lodges/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${item.authToken}`
        },
        body: JSON.stringify({
          lodgeData: item.formData,
          units: item.units
        })
      });

      if (res.ok) {
        // Success: remove from outbox
        const currentOutbox = (await get<any[]>(OUTBOX_KEY)) || [];
        const newOutbox = currentOutbox.filter(i => i.id !== item.id);
        await set(OUTBOX_KEY, newOutbox);
        
        // Notify open tabs
        // @ts-ignore - SW types
        const clients = await self.clients.matchAll();
        clients.forEach((client: any) => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            id: item.id
          });
        });
      }
    } catch (err) {
      console.error('SW: Sync failed for item:', item.id, err);
      // Let the browser retry the sync event later if it fails
      throw err; 
    }
  }
}
