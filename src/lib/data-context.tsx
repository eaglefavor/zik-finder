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
    const { data, error } = await supabase
      .from('lodges')
      .select('*, profiles(phone_number, is_verified)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      console.log('Fetched Lodges with Profiles:', data);
      // Normalize profiles data (handle array vs object return from Supabase)
      const formatted = (data as any[]).map(l => ({
        ...l,
        profiles: Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
      }));
      setLodges(formatted as Lodge[]);
    }
  };

  const refreshRequests = async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*, profiles(phone_number, name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requests:', error.message, error.details, error.hint);
      return;
    }

    if (data) {
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

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([refreshLodges(), refreshRequests()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

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
    const { error } = await supabase
      .from('lodges')
      .delete()
      .eq('id', id);

    if (!error) await refreshLodges();
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
    setFavorites(prev => 
      prev.includes(lodgeId) ? prev.filter(id => id !== lodgeId) : [...prev, lodgeId]
    );
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
