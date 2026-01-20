'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider, Persister } from '@tanstack/react-query-persist-client';
import { useState } from 'react';
import { get, set, del } from 'idb-keyval';

// Async Persister for IndexedDB
function createIDBPersister(idbValidKey: IDBValidKey = 'reactQuery'): Persister {
  return {
    persistClient: async (client) => {
      try {
        await set(idbValidKey, client);
      } catch (error) {
        console.error('Persist failed:', error);
      }
    },
    restoreClient: async () => {
      try {
        return await get(idbValidKey);
      } catch (error) {
        console.error('Restore failed:', error);
        return undefined;
      }
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  };
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days (Offline First)
            refetchOnWindowFocus: false, 
            refetchOnReconnect: true,
            networkMode: 'offlineFirst', // Critical: Try cache, then fetch. Don't pause if offline.
          },
        },
      })
  );

  const [persister] = useState<Persister>(() => {
    if (typeof window !== 'undefined') {
      return createIDBPersister('zik_query_cache');
    }
    // Fallback for SSR (though this component is client-only, safe guard)
    return {
        persistClient: async () => {},
        restoreClient: async () => undefined,
        removeClient: async () => {},
    };
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ 
          persister,
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
