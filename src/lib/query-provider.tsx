'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider, Persister } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
            refetchOnWindowFocus: false, // Don't refetch on every click (saves data)
            refetchOnReconnect: true, // Refetch when network comes back
          },
        },
      })
  );

  const [persister] = useState<Persister | null>(() => {
    if (typeof window !== 'undefined') {
      return createSyncStoragePersister({
        storage: window.localStorage,
        throttleTime: 1000,
      });
    }
    return null;
  });

  // We don't need the useEffect anymore for creating the persister


  if (!persister) {
    // During SSR or initial mount, just render without persistence to avoid hydration mismatch
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
