'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Lodge, LodgeRequest, LodgeUnit } from './types';
import { supabase } from './supabase';
import { useAppContext } from './context';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // ZIPS 3G: Added for persistent caching
import { OfflineSync } from './offline-sync'; // ZIPS 3G: Offline Sync

import { BinaryProtocol } from './protocol/binary-client'; // ZIPS 3G: Binary Protocol
import { uploadFileResumable } from './tus-upload'; // Added for offline sync

const LODGE_PAGE_SIZE = 8;

interface DataContextType {
  lodges: Lodge[];
  requests: LodgeRequest[];
  favorites: string[];
  unreadCount: number;
  viewGrowth: number;
  myLodges: Lodge[]; // New: Own lodges for landlords
  isLoading: boolean;
  isLodgesLoading: boolean;
  hasMoreLodges: boolean;
  fetchInitialLodges: () => Promise<void>;
  fetchMoreLodges: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  toggleFavorite: (lodgeId: string) => Promise<void>;
  addLodge: (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'units' | 'views'>, units?: Omit<import('./types').LodgeUnit, 'id' | 'lodge_id'>[], files?: Record<string, Blob>, isRetry?: boolean) => Promise<{ success: boolean; data?: Lodge; error?: string }>;
  updateLodge: (id: string, lodgeData: Partial<Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'views'>>) => Promise<{ success: boolean; error?: string }>;
  updateLodgeStatus: (id: string, status: 'available' | 'taken' | 'suspended') => Promise<void>;
  addUnit: (unitData: { lodge_id: string, name: string, price: number, image_urls?: string[] }) => Promise<void>;
  updateUnit: (id: string, unitData: Partial<{ name: string, price: number }>) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  deleteLodge: (id: string) => Promise<void>;
  addRequest: (requestData: Omit<LodgeRequest, 'id' | 'student_id' | 'student_name' | 'student_phone' | 'created_at' | 'expires_at'>) => Promise<{ success: boolean; error?: string }>;
  deleteRequest: (id: string) => Promise<void>;
  notifyStudentOfMatch: (studentId: string, lodgeId: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAppContext();
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [myLodges, setMyLodges] = useState<Lodge[]>([]); // New state
  const [requests, setRequests] = useState<LodgeRequest[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewGrowth, setViewGrowth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // ZIPS 3G: Sync Status

  // New state for infinite scroll
  const [lodgesPage, setLodgesPage] = useState(0);
  const [hasMoreLodges, setHasMoreLodges] = useState(true);
  const [isLodgesLoading, setIsLodgesLoading] = useState(false);

  // ZIPS 3G: TanStack Query for Instant Offline Load + Delta Sync
  const { data: cachedFeed } = useQuery({
    queryKey: ['lodges', 'feed'],
    queryFn: async () => {
      // 1. Get current cache to find last sync time
      const currentData = queryClient.getQueryData<Lodge[]>(['lodges', 'feed']);
      
      // Determine last sync time (using the newest updated_at in the list)
      // Or we can just use a separate key for metadata. For simplicity, we scan the list.
      // Actually, let's just use "now" minus some buffer if we have data?
      // Better: Store a hidden timestamp? 
      // Let's use a safe default: 1970 if no data.
      let lastSync = '1970-01-01T00:00:00Z';
      
      // We can also store the sync timestamp in localStorage separately
      const storedSync = localStorage.getItem('zik_feed_last_sync');
      if (storedSync) lastSync = storedSync;

      // 2. Fetch Data (Try Binary Delta first, then Fallback)
      let fullList: Lodge[] = [];
      const newSyncTime = new Date().toISOString();

      // Validate lastSync
      if (Number.isNaN(Date.parse(lastSync))) {
          console.warn('Invalid last_sync date detected, resetting to epoch.');
          lastSync = '1970-01-01T00:00:00Z';
      }

      try {
          // Attempt Binary Delta Sync
          type DeltaItem = Lodge & { _delta: 'update' | 'unchanged' };
          const response = (await BinaryProtocol.fetch('/api/feed-binary', {
            page_offset: 0,
            page_limit: LODGE_PAGE_SIZE,
            last_sync: lastSync
          })) as DeltaItem[];

          if (!Array.isArray(response)) {
            throw new Error('Invalid binary response format: ' + JSON.stringify(response));
          }

          // 3. Merge Logic (Delta Sync)
          if (!currentData) {
            fullList = formatLodgeData(response.filter(r => r._delta !== 'unchanged'));
          } else {
            const merged = [...currentData];
            let hasChanges = false;
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.forEach((item: any) => {
                if (!item) return;
                
                if (item._delta === 'update') {
                    const existingIdx = merged.findIndex(l => l.id === item.id);
                    const formattedItem = formatLodgeData([item])[0];
                    if (existingIdx >= 0) merged[existingIdx] = formattedItem;
                    else merged.push(formattedItem);
                    hasChanges = true;
                }
            });
            
            if (hasChanges) {
                 merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                 fullList = merged;
            } else {
                 fullList = currentData;
            }
          }
      } catch (err) {
          console.warn('Binary Sync failed, falling back to standard JSON RPC:', err);
          
          // Fallback: Standard JSON RPC
          const { data, error } = await supabase.rpc('get_lodges_feed', {
            page_offset: 0,
            page_limit: LODGE_PAGE_SIZE
          });
          
          if (error) throw error;
          fullList = formatLodgeData(data as unknown[]);
      }

      localStorage.setItem('zik_feed_last_sync', newSyncTime);
      return fullList;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Sync Cache to State (Hydration)
  useEffect(() => {
    if (cachedFeed && lodgesPage === 0) {
        setLodges(cachedFeed);
        setLodgesPage(1);
        setHasMoreLodges(cachedFeed.length === LODGE_PAGE_SIZE);
        setIsLoading(false); // Immediate visual feedback
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedFeed]);

      // ZIPS 3G: Offline Sync Manager
  useEffect(() => {
    const syncOutbox = async () => {
      if (!user) return;
      if (!navigator.onLine || isSyncing) return;
      
      const outbox = await OfflineSync.getOutbox();
      if (outbox.length === 0) return;

      setIsSyncing(true);
      toast.loading(`Syncing ${outbox.length} pending lodge(s)...`, { id: 'sync-toast' });

      for (const item of outbox) {
        try {
          // 1. Upload pending binary files if any
          const updatedLodgeData = { ...item.formData };
          let updatedUnits = [...item.units];

          if (item.files && Object.keys(item.files).length > 0) {
            toast.loading(`Uploading images for ${updatedLodgeData.title}...`, { id: 'sync-toast' });
            
            const urlMap: Record<string, string> = {};
            
            for (const [tempId, blob] of Object.entries(item.files)) {
              const fileName = `offline-${Date.now()}-${tempId}.jpg`;
              const filePath = `${user.id}/${fileName}`;
              // Convert Blob to File
              const file = new File([blob], fileName, { type: 'image/jpeg' });
              const publicUrl = await uploadFileResumable('lodge-images', filePath, file);
              urlMap[tempId] = publicUrl;
            }

            // Replace placeholder URLs with real ones
            updatedLodgeData.image_urls = (updatedLodgeData.image_urls as string[]).map(url => urlMap[url] || url);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updatedUnits = (updatedUnits as any[]).map(u => ({
              ...u,
              image_urls: (u.image_urls as string[]).map(url => urlMap[url] || url)
            }));
          }

          const res = await fetch('/api/lodges/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${item.authToken}`
            },
            body: JSON.stringify({
              lodgeData: updatedLodgeData,
              units: updatedUnits
            })
          });

          if (res.ok) {
            await OfflineSync.removeFromOutbox(item.id);
          } else {
            const err = await res.json();
            console.error('Sync failed for item:', item.id, err.error);
          }
        } catch (e) {
          console.error('Sync error:', e);
        }
      }

      const remaining = await OfflineSync.getOutbox();
      if (remaining.length === 0) {
        toast.success('All pending lodges published!', { id: 'sync-toast' });
      } else {
        toast.error(`${remaining.length} items failed to sync. Will retry later.`, { id: 'sync-toast' });
      }
      setIsSyncing(false);
    };

    window.addEventListener('online', syncOutbox);
    // Initial check on load
    syncOutbox();

    return () => window.removeEventListener('online', syncOutbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Re-run if user changes (auth required for upload)

  const formatLodgeData = (data: unknown[]) => {
    return (data as (Lodge & { profile_data?: import('./types').Profile; units_data?: import('./types').LodgeUnit[]; lodge_units?: import('./types').LodgeUnit[] })[]).map((l) => ({
      ...l,
      profiles: l.profile_data || l.profiles,
      units: l.units_data || l.lodge_units || []
    })) as unknown as Lodge[];
  }

  const fetchMyLodges = async () => {
    if (!user || user.role !== 'landlord') return;
    
    // Fetch ALL my lodges (including suspended/taken) with Z-Score
    const { data, error } = await supabase
      .from('lodges')
      .select('*, units:lodge_units(*), profiles!lodges_landlord_id_fkey(landlord_wallets(z_score))')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatted = (data as unknown as (Lodge & { profiles: { landlord_wallets: { z_score: number }[] } })[]).map(l => ({
        ...l,
        image_urls: l.image_urls || [],
        amenities: l.amenities || [],
        landlord_z_score: l.profiles?.landlord_wallets?.[0]?.z_score ?? 50
      }));
      setMyLodges(formatted);
    }
  };

  const queryClient = useQueryClient();

  const fetchInitialLodges = async () => {
    setIsLodgesLoading(true);
    try {
        // ZIPS 3G: Refresh the persistent cache
        await queryClient.invalidateQueries({ queryKey: ['lodges', 'feed'] });
        
        // State update is handled by the useEffect above
    } catch (error) {
        console.error('Error refreshing lodges:', error);
        toast.error("Failed to refresh feed");
    } finally {
        setIsLodgesLoading(false);
    }
  };
  
  const fetchMoreLodges = async () => {
    if (isLodgesLoading || !hasMoreLodges) return;
    setIsLodgesLoading(true);

    const offset = lodgesPage * LODGE_PAGE_SIZE;

    const { data, error } = await supabase.rpc('get_lodges_feed', {
      page_offset: offset,
      page_limit: LODGE_PAGE_SIZE
    });

    if (error) {
      console.error('Error fetching more lodges:', error.message);
      toast.error("Failed to load more lodges");
    }

    if (!error && data) {
      const formatted = formatLodgeData(data);
      setLodges(prev => [...prev, ...formatted]);
      setLodgesPage(prev => prev + 1);
      setHasMoreLodges(data.length === LODGE_PAGE_SIZE);
    }
    setIsLodgesLoading(false);
  }

  const refreshRequests = async () => {
    let { data, error } = await supabase
      .from('requests')
      .select('*, profiles!requests_student_id_fkey(phone_number, name)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Falling back to legacy requests fetch:', error.message);
      const fallback = await supabase
        .from('requests')
        .select('*, profiles!requests_student_id_fkey(phone_number, name)')
        .order('created_at', { ascending: false });
      
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data) {
      const formatted = (data as unknown as {
        id: string;
        student_id: string;
        profiles: { name?: string; phone_number?: string } | null;
        budget_range: string;
        min_budget?: number;
        max_budget?: number;
        location: string;
        locations?: string[];
        description: string;
        created_at: string;
        expires_at?: string;
      }[]).map((r) => ({
        id: r.id,
        student_id: r.student_id,
        student_name: r.profiles?.name || 'Student',
        student_phone: r.profiles?.phone_number || '',
        budget_range: r.budget_range,
        min_budget: r.min_budget || 0,
        max_budget: r.max_budget || 0,
        location: r.location,
        locations: r.locations || [r.location],
        description: r.description,
        created_at: r.created_at,
        expires_at: r.expires_at || new Date(new Date().getTime() + 1000*60*60*24*14).toISOString()
      }));
      setRequests(formatted);
    }
  };

  const refreshFavorites = async () => {
    if (!user) {
      setFavorites([]);
      return;
    }
    const { data, error } = await supabase
      .from('favorites')
      .select('lodge_id')
      .eq('user_id', user.id);

    if (!error && data) {
      setFavorites(data.map(f => f.lodge_id));
    }
  };

  const refreshUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error && count !== null) {
      setUnreadCount(count);
    }
  };

  const refreshViewGrowth = async () => {
    if (!user) return;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    try {
      const { data: landlordLodgeIds } = await supabase
        .from('lodges')
        .select('id')
        .eq('landlord_id', user.id);

      if (!landlordLodgeIds || landlordLodgeIds.length === 0) {
        setViewGrowth(0);
        return;
      }

      const ids = landlordLodgeIds.map(l => l.id);

      const { count: thisWeekCount } = await supabase
        .from('lodge_views_log')
        .select('*', { count: 'exact', head: true })
        .in('lodge_id', ids)
        .gte('created_at', sevenDaysAgo.toISOString());

      const { count: lastWeekCount } = await supabase
        .from('lodge_views_log')
        .select('*', { count: 'exact', head: true })
        .in('lodge_id', ids)
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      const current = thisWeekCount || 0;
      const previous = lastWeekCount || 0;

      if (previous === 0) {
        setViewGrowth(current > 0 ? 100 : 0);
      } else {
        const growth = ((current - previous) / previous) * 100;
        setViewGrowth(Math.round(growth));
      }
    } catch (err) {
      console.error('Failed to calculate view growth:', err);
      setViewGrowth(0);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadCriticalData = async () => {
      setIsLoading(true);
      
      // 1. Critical Data (Blocking UI)
      await Promise.all([
        fetchInitialLodges(),
        fetchMyLodges(), 
        refreshFavorites(),
        refreshUnreadCount()
      ]);
      
      if (mounted) setIsLoading(false);

      // 2. Non-Critical Data (Lazy Load)
      refreshRequests(); 
      if (user) refreshViewGrowth();
    };

    loadCriticalData();

    if (user) {
      const channel = supabase
        .channel(`unread-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refreshUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addLodge = async (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'units' | 'views'>, units?: Omit<import('./types').LodgeUnit, 'id' | 'lodge_id'>[], files?: Record<string, Blob>, isRetry = false) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // ZIPS 3G: Offline Intercept
    if (!navigator.onLine && !isRetry) {
        if (token) {
            await OfflineSync.addToOutbox(lodgeData, units || [], token, files);
            // Register for background sync if supported
            import('./protocol/sync-manager').then(m => m.SyncManager.registerSync());
        }
        toast.success('Offline: Lodge saved to Outbox', {
            description: 'We will automatically upload it when you are back online.'
        });
        return { success: true }; // Fake success to clear form
    }

    try {
        let { data: newLodge, error: lodgeError } = await supabase
          .from('lodges')
          .insert({ ...lodgeData, landlord_id: user.id })
          .select()
          .single();

        if (lodgeError) {
          console.warn('Falling back to legacy lodge insert:', lodgeError.message);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { landmark: _landmark, ...legacyData } = lodgeData as Record<string, unknown>;
          const fallback = await supabase
            .from('lodges')
            .insert({ ...legacyData, landlord_id: user.id })
            .select()
            .single();
          
          newLodge = fallback.data;
          lodgeError = fallback.error;
        }

        if (lodgeError) throw lodgeError;

        if (newLodge) {
          if (units && units.length > 0) {
            const unitsToInsert = units.map(u => ({ ...u, lodge_id: newLodge.id }));
            const { error: unitError } = await supabase.from('lodge_units').insert(unitsToInsert);
            if (unitError) console.error('Error adding units:', unitError);
          } else {
            const { error: unitError } = await supabase
              .from('lodge_units')
              .insert({
                lodge_id: newLodge.id,
                name: 'Standard Room',
                price: lodgeData.price,
                total_units: 1,
                available_units: 1,
                image_urls: lodgeData.image_urls
              });
            if (unitError) console.error('Error creating default unit:', unitError);
          }
        }
        
        await fetchInitialLodges();
        await fetchMyLodges();
        return { success: true, data: newLodge as Lodge };

    } catch (error: unknown) {
        console.error('Add Lodge Error:', error);
        
        // ZIPS 3G: If failed (and not already a retry loop), save to outbox
        if (!isRetry && token) {
            await OfflineSync.addToOutbox(lodgeData, units || [], token);
            // Register for background sync if supported
            import('./protocol/sync-manager').then(m => m.SyncManager.registerSync());
            toast.error('Upload Failed. Saved to Outbox.', {
                description: 'We will retry automatically when connection is stable.'
            });
            return { success: true }; // Treat as queued success
        }

        return { success: false, error: (error as Error).message || 'Failed to add lodge' };
    }
  };

  const updateLodge = async (id: string, lodgeData: Partial<Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'views'>>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    let query = supabase
      .from('lodges')
      .update(lodgeData)
      .eq('id', id);

    // If not admin, restrict to own lodges
    if (user.role !== 'admin') {
      query = query.eq('landlord_id', user.id);
    }

    let { error } = await query;

    if (error) {
      console.warn('Falling back to legacy lodge update:', error.message);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { landmark: _landmark, ...legacyData } = lodgeData as Record<string, unknown>;
      
      let fallbackQuery = supabase
        .from('lodges')
        .update(legacyData)
        .eq('id', id);
      
      if (user.role !== 'admin') {
        fallbackQuery = fallbackQuery.eq('landlord_id', user.id);
      }

      const fallback = await fallbackQuery;
      error = fallback.error;
    }

    if (error) return { success: false, error: error.message };

    await fetchInitialLodges();
    await fetchMyLodges();
    return { success: true };
  };

  const updateLodgeStatus = async (id: string, status: 'available' | 'taken' | 'suspended') => {
    if (!user) return;

    const updateAction = async () => {
      let query = supabase
        .from('lodges')
        .update({ status })
        .eq('id', id);
      
      // If not admin, restrict to own lodges
      if (user.role !== 'admin') {
        query = query.eq('landlord_id', user.id);
      }

      const { error } = await query.select();
      
      if (error) throw error;
      return status;
    };

    toast.promise(updateAction(), {
      loading: 'Updating status...',
      success: (data) => {
        fetchInitialLodges();
        fetchMyLodges(); // Refresh my list too
        return `Lodge marked as ${data}`;
      },
      error: (err) => `Failed to update: ${err.message}`
    });
  };

  const addUnit = async (unitData: { lodge_id: string, name: string, price: number, image_urls?: string[] }) => {
    const { error } = await supabase
      .from('lodge_units')
      .insert({
        ...unitData,
        total_units: 1,
        available_units: 1
      });
      
    if (error) console.error('Error adding unit:', error);
    await fetchInitialLodges();
    await fetchMyLodges();
  };

  const updateUnit = async (id: string, unitData: Partial<{ name: string, price: number }>) => {
    const { error } = await supabase
      .from('lodge_units')
      .update(unitData)
      .eq('id', id);
      
    if (error) console.error('Error updating unit:', error);
    await fetchInitialLodges();
    await fetchMyLodges();
  };

  const deleteUnit = async (id: string) => {
    const { error } = await supabase
      .from('lodge_units')
      .delete()
      .eq('id', id);
      
    if (error) console.error('Error deleting unit:', error);
    await fetchInitialLodges();
    await fetchMyLodges();
  };

  const deleteLodge = async (id: string) => {
    if (!user) return;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      toast.error('Authentication error. Please log in again.');
      return;
    }

    setLodges(prev => prev.filter(l => l.id !== id));
    setMyLodges(prev => prev.filter(l => l.id !== id)); // Also update landlord's list

    try {
      const res = await fetch('/api/lodges/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lodgeId: id, userId: user.id })
      });

      if (!res.ok) {
        console.warn('Image deletion API warning:', await res.json());
      }

      // The API route now handles DB deletion atomically.
      // We don't need to call supabase.rpc('delete_lodge') anymore.

      await fetchInitialLodges();
      await fetchMyLodges();

    } catch (error: unknown) {
      console.error('Error deleting lodge:', error);
      toast.error('Error deleting lodge: ' + (error instanceof Error ? error.message : 'Unknown error'));
      await fetchInitialLodges(); 
      await fetchMyLodges();
    }
  };

  const addRequest = async (requestData: Omit<LodgeRequest, 'id' | 'student_id' | 'student_name' | 'student_phone' | 'created_at' | 'expires_at'>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 14);

    const legacyLocation = requestData.location || (requestData.locations ? requestData.locations.join(', ') : 'Any Location');
    const legacyBudget = requestData.budget_range || (requestData.min_budget && requestData.max_budget ? `₦${requestData.min_budget.toLocaleString()} - ₦${requestData.max_budget.toLocaleString()}` : 'Any Budget');

    let { error } = await supabase
      .from('requests')
      .insert({
        ...requestData,
        location: legacyLocation,
        budget_range: legacyBudget,
        student_id: user.id,
        expires_at: expiryDate.toISOString()
      });

    if (error) {
      console.warn('Falling back to legacy requests insert:', error.message);
      const fallback = await supabase
        .from('requests')
        .insert({
          location: legacyLocation,
          budget_range: legacyBudget,
          description: requestData.description,
          student_id: user.id
        });
      error = fallback.error;
    }

    if (error) return { success: false, error: error.message };

    await refreshRequests();
    return { success: true };
  };

  const deleteRequest = async (id: string) => {
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', id);

    if (!error) await refreshRequests();
  };

  const notifyStudentOfMatch = async (studentId: string, lodgeId: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (!studentId) return { success: false, error: 'Invalid student ID' };

    try {
      const { data, error } = await supabase.rpc('notify_student_of_match', {
        p_student_id: studentId,
        p_lodge_id: lodgeId
      });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data && !(data as any).success) throw new Error((data as any).message);
      
      return { success: true };
    } catch (err: unknown) {
      console.error("Notification Error:", err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.message || (err as any)?.error_description || (typeof err === 'string' ? err : 'Unknown error');
      return { success: false, error: msg };
    }
  };

  const toggleFavorite = async (lodgeId: string) => {
    if (!user) {
      toast.error('Please log in to save favorites');
      return;
    }

    const isFav = favorites.includes(lodgeId);
    
    setFavorites(prev => 
      isFav ? prev.filter(id => id !== lodgeId) : [...prev, lodgeId]
    );

    try {
      if (isFav) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('lodge_id', lodgeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, lodge_id: lodgeId });
        if (error) throw error;

        try {
          const { data: lodge } = await supabase
            .from('lodges')
            .select('landlord_id, title')
            .eq('id', lodgeId)
            .single();

          if (lodge && lodge.landlord_id !== user.id) {
            await supabase.from('notifications').insert({
              user_id: lodge.landlord_id,
              title: 'New Interest! ❤️',
              message: `A student just favorited your lodge "${lodge.title}". They might be interested in a viewing!`,
              type: 'info',
              link: `/lodge/${lodgeId}`
            });
          }
        } catch (notifyErr) {
          console.error('Failed to notify landlord of favorite:', notifyErr);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      await refreshFavorites();
    }
  };

  return (
    <DataContext.Provider value={{ 
      lodges, 
      myLodges, // Expose this
      requests,
      favorites, 
      unreadCount,
      viewGrowth,
      isLoading, 
      isLodgesLoading,
      hasMoreLodges,
      fetchInitialLodges,
      fetchMoreLodges,
      refreshRequests,
      refreshUnreadCount,
      toggleFavorite,
      addLodge,
      updateLodge,
      updateLodgeStatus,
      addUnit,
      updateUnit,
      deleteUnit,
      deleteLodge,
      addRequest,
      deleteRequest,
      notifyStudentOfMatch
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}