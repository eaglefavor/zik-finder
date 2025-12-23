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
  addLodge: (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  updateLodgeStatus: (id: string, status: 'available' | 'taken') => Promise<void>;
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
    const { data, error } = await supabase
      .from('lodges')
      .select('*, profiles!lodges_landlord_id_fkey(phone_number, is_verified)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formatted = (data as any[]).map(l => ({
        ...l,
        profiles: Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
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

  const addLodge = async (lodgeData: Omit<Lodge, 'id' | 'landlord_id' | 'created_at'>) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('lodges')
      .insert({
        ...lodgeData,
        landlord_id: user.id
      });

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
      updateLodgeStatus,
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
