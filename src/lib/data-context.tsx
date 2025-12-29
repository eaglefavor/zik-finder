'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Lodge, Profile, LodgeRequest } from './types';
import { supabase } from './supabase';
import { useAppContext } from './context';

interface DataContextType {
  lodges: Lodge[];
  requests: LodgeRequest[];
  favorites: string[];
  isLoading: boolean;
  refreshLodges: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  toggleFavorite: (lodgeId: string) => Promise<void>;
  addLodge: (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'units'>, units?: Omit<import('./types').LodgeUnit, 'id' | 'lodge_id'>[]) => Promise<{ success: boolean; error?: string }>;
  updateLodge: (id: string, lodgeData: Partial<Omit<Lodge, 'id' | 'landlord_id' | 'created_at'>>) => Promise<{ success: boolean; error?: string }>;
  updateLodgeStatus: (id: string, status: 'available' | 'taken') => Promise<void>;
  addUnit: (unitData: { lodge_id: string, name: string, price: number, total_units: number, available_units: number, image_urls?: string[] }) => Promise<void>;
  updateUnitAvailability: (id: string, available_units: number) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  deleteLodge: (id: string) => Promise<void>;
  addRequest: (requestData: Omit<LodgeRequest, 'id' | 'student_id' | 'student_name' | 'student_phone' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  deleteRequest: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAppContext();
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [requests, setRequests] = useState<LodgeRequest[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshLodges = async () => {
    // Explicitly use the 'lodges_landlord_id_fkey' constraint we enforced in SQL
    // Also fetch the related units
    const { data, error } = await supabase
      .from('lodges')
      .select('*, profiles!lodges_landlord_id_fkey(phone_number, is_verified), lodge_units(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatted = (data as any[]).map(l => ({
        ...l,
        profiles: Array.isArray(l.profiles) ? l.profiles[0] : l.profiles,
        units: l.lodge_units // Assign the fetched units
      }));
      setLodges(formatted as Lodge[]);
    }
  };

  const refreshRequests = async () => {
    // Explicitly use 'requests_student_id_fkey' just in case
    const { data, error } = await supabase
      .from('requests')
      .select('*, profiles!requests_student_id_fkey(phone_number, name)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatted = (data as any[]).map(r => ({
        id: r.id,
        student_id: r.student_id,
        student_name: r.profiles?.name || 'Student',
        student_phone: r.profiles?.phone_number || '',
        budget_range: r.budget_range,
        location: r.location,
        description: r.description,
        created_at: r.created_at
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

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([refreshLodges(), refreshRequests(), refreshFavorites()]);
      setIsLoading(false);
    };
    loadData();
  }, [user]);

  const addLodge = async (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at' | 'units'>, units?: Omit<import('./types').LodgeUnit, 'id' | 'lodge_id'>[]) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // 1. Insert Lodge
    const { data: newLodge, error: lodgeError } = await supabase
      .from('lodges')
      .insert({
        ...lodgeData,
        landlord_id: user.id
      })
      .select()
      .single();

    if (lodgeError) return { success: false, error: lodgeError.message };

    // 2. Insert Units
    if (newLodge) {
      if (units && units.length > 0) {
        // Bulk insert provided units
        const unitsToInsert = units.map(u => ({
          ...u,
          lodge_id: newLodge.id
        }));
        const { error: unitError } = await supabase.from('lodge_units').insert(unitsToInsert);
        if (unitError) console.error('Error adding units:', unitError);
      } else {
        // Fallback: Default Unit
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
    
    await refreshLodges();
    return { success: true };
  };

  const updateLodge = async (id: string, lodgeData: Partial<Omit<Lodge, 'id' | 'landlord_id' | 'created_at'>>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('lodges')
      .update(lodgeData)
      .eq('id', id)
      .eq('landlord_id', user.id); // Ensure ownership

    if (error) return { success: false, error: error.message };
    
    await refreshLodges();
    return { success: true };
  };

  const updateLodgeStatus = async (id: string, status: 'available' | 'taken') => {
    const { error } = await supabase
      .from('lodges')
      .update({ status })
      .eq('id', id);

    if (!error) await refreshLodges();
  };

  const addUnit = async (unitData: { lodge_id: string, name: string, price: number, total_units: number, available_units: number, image_urls?: string[] }) => {
    const { error } = await supabase
      .from('lodge_units')
      .insert(unitData);
      
    if (error) console.error('Error adding unit:', error);
    await refreshLodges();
  };

  const updateUnitAvailability = async (id: string, available_units: number) => {
    const { error } = await supabase
      .from('lodge_units')
      .update({ available_units })
      .eq('id', id);

    if (!error) await refreshLodges();
  };

  const deleteUnit = async (id: string) => {
    const { error } = await supabase
      .from('lodge_units')
      .delete()
      .eq('id', id);
      
    if (error) console.error('Error deleting unit:', error);
    await refreshLodges();
  };

  const deleteLodge = async (id: string) => {
    if (!user) return;

    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      alert('Authentication error. Please log in again.');
      return;
    }

    // Optimistic update
    setLodges(prev => prev.filter(l => l.id !== id));

    try {
      // 1. Delete images via API (Server-side)
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

      // 2. Delete Lodge Record (Client-side, via RPC to bypass RLS quirks)
      const { error } = await supabase.rpc('delete_lodge', { lodge_id: id });

      if (error) {
        throw error;
      }

      await refreshLodges();

    } catch (error: any) {
      console.error('Error deleting lodge:', error);
      alert('Error deleting lodge: ' + error.message);
      await refreshLodges(); // Revert optimistic update
    }
  };

  const addRequest = async (requestData: Omit<LodgeRequest, 'id' | 'student_id' | 'student_name' | 'student_phone' | 'created_at'>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('requests')
      .insert({
        ...requestData,
        student_id: user.id
      });

    if (error) return { success: false, error: error.message };

    // Notification Logic: Notify landlords in the area
    try {
      // Normalize location (e.g. "Ifite (School Gate Area)" -> "Ifite")
      const normalizedLocation = requestData.location.split(' (')[0];
      
      let query = supabase.from('lodges').select('landlord_id');
      
      if (normalizedLocation !== 'Any Location') {
        query = query.eq('location', normalizedLocation);
      }

      const { data: lodgesInArea } = await query;

      if (lodgesInArea && lodgesInArea.length > 0) {
        const landlordIds = Array.from(new Set(lodgesInArea.map(l => l.landlord_id)));
        
        const notifications = landlordIds.map(id => ({
          user_id: id,
          title: 'New Student Request! 🎯',
          message: `A student is looking for a lodge in ${normalizedLocation}. Check the Market to see if you have a match!`,
          type: 'info',
          link: '/market'
        }));

        // Insert notifications in bulk
        const { error: insertError } = await supabase.from('notifications').insert(notifications);
        
        if (insertError) {
          console.error('NOTIFICATION INSERT FAILED:', insertError);
        } else {
          console.log(`Sent ${notifications.length} notifications to landlords.`);
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

  const toggleFavorite = async (lodgeId: string) => {
    if (!user) {
      alert('Please log in to save favorites');
      return;
    }

    const isFav = favorites.includes(lodgeId);
    
    // Optimistic Update
    setFavorites(prev => 
      isFav ? prev.filter(id => id !== lodgeId) : [...prev, lodgeId]
    );

    try {
      if (isFav) {
        // Remove from DB
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('lodge_id', lodgeId);
        if (error) throw error;
      } else {
        // Add to DB
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, lodge_id: lodgeId });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert on error
      await refreshFavorites();
    }
  };

  return (
    <DataContext.Provider value={{ 
      lodges, 
      requests,
      favorites, 
      isLoading, 
      refreshLodges, 
      refreshRequests,
      toggleFavorite,
      addLodge,
      updateLodge,
      updateLodgeStatus,
      addUnit,
      updateUnitAvailability,
      deleteUnit,
      deleteLodge,
      addRequest,
      deleteRequest
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
