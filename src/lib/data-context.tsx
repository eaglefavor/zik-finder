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
  updateLodgeStatus: (id: string, status: 'available' | 'taken' | 'suspended') => Promise<void>;
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
    return (data as (Lodge & { profile_data?: import('./types').Profile; units_data?: import('./types').LodgeUnit[]; lodge_units?: import('./types').LodgeUnit[] })[]).map((l) => ({
      ...l,
      profiles: l.profile_data || l.profiles,
      units: l.units_data || l.lodge_units || []
    })) as unknown as Lodge[];
  }

  const fetchInitialLodges = async () => {
    setIsLodgesLoading(true);
    const { data, error } = await supabase.rpc('get_lodges_feed', {
      page_offset: 0,
      page_limit: LODGE_PAGE_SIZE
    });

    if (!error && data) {
      const formatted = formatLodgeData(data);
      setLodges(formatted);
      setLodgesPage(1);
      setHasMoreLodges(data.length === LODGE_PAGE_SIZE);
    } else if (error) {
      console.error('Error fetching initial lodges:', error.message);
      toast.error("Failed to load lodges");
    }
    setIsLodgesLoading(false);
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
        refreshFavorites(),
        refreshUnreadCount()
      ]);
      
      if (mounted) setIsLoading(false);

      // 2. Non-Critical Data (Lazy Load)
      // Requests are only needed for the Market page
      refreshRequests(); 
      
      // View Growth is only needed for Landlords
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
      const { landmark: _, ...legacyData } = lodgeData as Record<string, unknown>;
      
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

      const { error, data, count } = await query.select();
      
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