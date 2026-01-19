import { set, get, del } from 'idb-keyval';

const OUTBOX_KEY = 'zik_lodge_outbox';

export interface PendingLodge {
  id: string; // Timestamp ID
  formData: Record<string, unknown>;
  units: Record<string, unknown>[];
  timestamp: number;
}

export const OfflineSync = {
  // Save a failed submission to the outbox
  addToOutbox: async (data: Record<string, unknown>, units: Record<string, unknown>[]) => {
    const id = Date.now().toString();
    const pendingItem: PendingLodge = {
      id,
      formData: data,
      units,
      timestamp: Date.now(),
    };
    
    // Get existing outbox
    const outbox = (await get<PendingLodge[]>(OUTBOX_KEY)) || [];
    outbox.push(pendingItem);
    await set(OUTBOX_KEY, outbox);
    
    return id;
  },

  // Get all pending items
  getOutbox: async () => {
    return (await get<PendingLodge[]>(OUTBOX_KEY)) || [];
  },

  // Remove an item after successful sync
  removeFromOutbox: async (id: string) => {
    const outbox = (await get<PendingLodge[]>(OUTBOX_KEY)) || [];
    const newOutbox = outbox.filter(item => item.id !== id);
    await set(OUTBOX_KEY, newOutbox);
  },

  // Clear entire outbox
  clearOutbox: async () => {
    await del(OUTBOX_KEY);
  }
};
