'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Lodge, LodgeRequest, LodgeUnit } from './types';
import { supabase } from './supabase';
import { useAppContext } from './context';
import { toast } from 'sonner';

const LODGE_PAGE_SIZE = 8;

interface DataContextType {
  lodges: Lodge[];
  requests: LodgeRequest[];
  favorites: string[];
  unreadCount: number;
  viewGrowth: number;
  isLoading: boolean;
  isLodgesLoading: boolean;
  hasMoreLodges: boolean;
  fetchInitialLodges: () => Promise<void>;
  fetchMoreLodges: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  toggleFavorite: (lodgeId: string) => Promise<void>;
  addLodge: (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'units' | 'views'>, units?: Omit<import('./types').LodgeUnit, 'id' | 'lodge_id'>[]) => Promise<{ success: boolean; error?: string }>;
  updateLodge: (id: string, lodgeData: Partial<Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'views'>>) => Promise<{ success: boolean; error?: string }>;
  updateLodgeStatus: (id: string, status: 'available' | 'taken') => Promise<void>;
  addUnit: (unitData: { lodge_id: string, name: string, price: number, total_units: number, available_units: number, image_urls?: string[] }) => Promise<void>;
  updateUnit: (id: string, unitData: Partial<{ name: string, price: number, total_units: number, available_units: number }>) => Promise<void>;
  updateUnitAvailability: (id: string, available_units: number) => Promise<void>;
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
  const [requests, setRequests] = useState<LodgeRequest[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewGrowth, setViewGrowth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // New state for infinite scroll
  const [lodgesPage, setLodgesPage] = useState(0);
  const [hasMoreLodges, setHasMoreLodges] = useState(true);
  const [isLodgesLoading, setIsLodgesLoading] = useState(false);

  const formatLodgeData = (data: unknown[]) => {
    return (data as unknown as (Lodge & { lodge_units?: LodgeUnit[] })[]).map((l) => ({
      ...l,
      profiles: Array.isArray(l.profiles) ? l.profiles[0] : (l.profiles as unknown as { phone_number: string; is_verified: boolean }),
      units: l.lodge_units || [] // Assign fetched units or empty array
    })) as unknown as Lodge[];
  }

  const fetchInitialLodges = async () => {
    setIsLodgesLoading(true);
    let { data, error } = await supabase
      .from('lodges')
      .select('*, profiles!lodges_landlord_id_fkey(phone_number, is_verified), lodge_units(*)')
      .order('created_at', { ascending: false })
      .range(0, LODGE_PAGE_SIZE - 1);

    // Fallback logic remains the same for initial fetch
    if (error) {
      console.warn('Falling back to legacy lodges fetch:', error.message);
      const fallback = await supabase
        .from('lodges')
        .select('*, profiles!lodges_landlord_id_fkey(phone_number, is_verified)')
        .order('created_at', { ascending: false })
        .limit(LODGE_PAGE_SIZE);
      
      data = fallback.data;
      error = fallback.error;
    }

    if (!error && data) {
      const formatted = formatLodgeData(data);
      setLodges(formatted);
      setLodgesPage(1);
      setHasMoreLodges(data.length === LODGE_PAGE_SIZE);
    }
    setIsLodgesLoading(false);
  };
  
  const fetchMoreLodges = async () => {
    if (isLodgesLoading || !hasMoreLodges) return;
    setIsLodgesLoading(true);

    const from = lodgesPage * LODGE_PAGE_SIZE;
    const to = from + LODGE_PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('lodges')
      .select('*, profiles!lodges_landlord_id_fkey(phone_number, is_verified), lodge_units(*)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
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
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchInitialLodges(), refreshRequests(), refreshFavorites(), refreshUnreadCount(), refreshViewGrowth()]);
      setIsLoading(false);
    };
    loadData();

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
  }, [user]);

  const addLodge = async (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'units' | 'views'>, units?: Omit<import('./types').LodgeUnit, 'id' | 'lodge_id'>[]) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    let { data: newLodge, error: lodgeError } = await supabase
      .from('lodges')
      .insert({ ...lodgeData, landlord_id: user.id })
      .select()
      .single();

    if (lodgeError) {
      console.warn('Falling back to legacy lodge insert:', lodgeError.message);
      const { landmark: _, ...legacyData } = lodgeData as Record<string, unknown>;
      const fallback = await supabase
        .from('lodges')
        .insert({ ...legacyData, landlord_id: user.id })
        .select()
        .single();
      
      newLodge = fallback.data;
      lodgeError = fallback.error;
    }

    if (lodgeError) return { success: false, error: lodgeError.message };

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
    return { success: true };
  };

  const updateLodge = async (id: string, lodgeData: Partial<Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'views'>>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: oldLodge } = await supabase.from('lodges').select('price, title').eq('id', id).single();

    let { error } = await supabase
      .from('lodges')
      .update(lodgeData)
      .eq('id', id)
      .eq('landlord_id', user.id);

    if (error) {
      console.warn('Falling back to legacy lodge update:', error.message);
      const { landmark: _, ...legacyData } = lodgeData as Record<string, unknown>;
      const fallback = await supabase
        .from('lodges')
        .update(legacyData)
        .eq('id', id)
        .eq('landlord_id', user.id);
      error = fallback.error;
    }

    if (error) return { success: false, error: error.message };

    if (oldLodge && lodgeData.price && lodgeData.price < oldLodge.price) {
      try {
        const { data: favoritedBy } = await supabase
          .from('favorites')
          .select('user_id')
          .eq('lodge_id', id);

        if (favoritedBy && favoritedBy.length > 0) {
          const alerts = favoritedBy.map(fav => ({
            user_id: fav.user_id,
            title: 'Price Drop! 💸',
            message: `The rent for "${oldLodge.title}" has been reduced to ₦${lodgeData.price?.toLocaleString()}.`,
            type: 'info',
            link: `/lodge/${id}`
          }));
          await supabase.from('notifications').insert(alerts);
        }
      } catch (err) {
        console.error('Failed to send price drop notifications:', err);
      }
    }
    
    await fetchInitialLodges();
    return { success: true };
  };

  const updateLodgeStatus = async (id: string, status: 'available' | 'taken') => {
    if (!user) return;

    const updateAction = async () => {
      const { error } = await supabase
        .from('lodges')
        .update({ status })
        .eq('id', id)
        .eq('landlord_id', user.id);
      
      if (error) throw error;
      return status;
    };

    toast.promise(updateAction(), {
      loading: 'Updating status...',
      success: (data) => {
        fetchInitialLodges();
        return `Lodge marked as ${data}`;
      },
      error: (err) => `Failed to update: ${err.message}`
    });
  };

  const addUnit = async (unitData: { lodge_id: string, name: string, price: number, total_units: number, available_units: number, image_urls?: string[] }) => {
    const { error } = await supabase
      .from('lodge_units')
      .insert(unitData);
      
    if (error) console.error('Error adding unit:', error);
    await fetchInitialLodges();
  };

  const updateUnit = async (id: string, unitData: Partial<{ name: string, price: number, total_units: number, available_units: number }>) => {
    const { error } = await supabase
      .from('lodge_units')
      .update(unitData)
      .eq('id', id);
      
    if (error) console.error('Error updating unit:', error);
    await fetchInitialLodges();
  };

  const updateUnitAvailability = async (id: string, available_units: number) => {
    const { error } = await supabase
      .from('lodge_units')
      .update({ available_units })
      .eq('id', id);

    if (!error) {
      if (available_units > 0 && available_units <= 2) {
        try {
          const { data } = await supabase
            .from('lodge_units')
            .select('lodge_id, name, lodges(title)')
            .eq('id', id)
            .single();

          const unitData = data as { lodge_id: string, name: string, lodges: { title: string } | null } | null;

          if (unitData) {
            const { data: favoritedBy } = await supabase
              .from('favorites')
              .select('user_id')
              .eq('lodge_id', unitData.lodge_id);

            if (favoritedBy && favoritedBy.length > 0) {
              const alerts = favoritedBy.map(fav => ({
                user_id: fav.user_id,
                title: 'Hurry! ⏳',
                message: `Only ${available_units} room${available_units > 1 ? 's' : ''} left for the ${unitData.name} at "${unitData.lodges?.title || 'the lodge'}".`,
                type: 'warning',
                link: `/lodge/${unitData.lodge_id}`
              }));
              await supabase.from('notifications').insert(alerts);
            }
          }
        } catch (err) {
          console.error('Failed to send availability alerts:', err);
        }
      }
      await fetchInitialLodges();
    }
  };

  const deleteUnit = async (id: string) => {
    const { error } = await supabase
      .from('lodge_units')
      .delete()
      .eq('id', id);
      
    if (error) console.error('Error deleting unit:', error);
    await fetchInitialLodges();
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

      const { error } = await supabase.rpc('delete_lodge', { lodge_id: id });

      if (error) {
        throw error;
      }

      await fetchInitialLodges();

    } catch (error: unknown) {
      console.error('Error deleting lodge:', error);
      toast.error('Error deleting lodge: ' + (error instanceof Error ? error.message : 'Unknown error'));
      await fetchInitialLodges(); 
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

    try {
      const matchLocation = requestData.locations && requestData.locations.length > 0 
        ? requestData.locations[0].split(' (')[0] 
        : requestData.location?.split(' (')[0] || 'Any Location';
      
      let query = supabase.from('lodges').select('landlord_id');
      
      if (matchLocation !== 'Any Location') {
        query = query.eq('location', matchLocation);
      }

      const { data: lodgesInArea } = await query;

      if (lodgesInArea && lodgesInArea.length > 0) {
        const landlordIds = Array.from(new Set(lodgesInArea.map(l => l.landlord_id)));
        
        const notifications = landlordIds.map(id => ({
          user_id: id,
          title: 'New Student Request! 🎯',
          message: `A student is looking for a lodge in ${matchLocation}. Check the Market to see if you have a match!`,
          type: 'info',
          link: '/market'
        }));

        const { error: insertError } = await supabase.from('notifications').insert(notifications);
        
        if (insertError) {
          console.error('NOTIFICATION INSERT FAILED:', insertError);
        }
      }
    } catch (err) {
      console.error('Failed to send notifications for request:', err);
    }
    
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

    try {
      const { data: lodge } = await supabase
        .from('lodges')
        .select('title')
        .eq('id', lodgeId)
        .single();

      const { error } = await supabase.from('notifications').insert({
        user_id: studentId,
        title: 'Lodge Match! 🏠',
        message: `${user.name || 'A landlord'} has a lodge ("${lodge?.title || 'Untitled'}") that matches your request!`,
        type: 'success',
        link: `/lodge/${lodgeId}`
      });

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
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
      updateUnitAvailability,
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