'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, Profile } from './types';
import { supabase } from './supabase';

interface AppContextType {
  user: Profile | null;
  role: UserRole;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signup: (userData: { email: string; name: string; phone: string; role: UserRole }, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const profile = data as Profile;
        console.log('Profile loaded:', profile);
        setUser(profile);
        setRole(profile.role);
        return;
      }

      console.warn('Profile not found in DB, attempting fallback creation...');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser && authUser.id === userId) {
        const metadata = authUser.user_metadata;
        const newProfile: Profile = {
          id: userId,
          role: (metadata.role as UserRole) || 'student',
          phone_number: metadata.phone_number || null,
          is_verified: false,
          name: metadata.name,
          email: authUser.email
        };

        // Attempt to insert missing profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: newProfile.id,
            name: newProfile.name,
            role: newProfile.role,
            phone_number: newProfile.phone_number,
            is_verified: newProfile.is_verified
          }]);

        if (!insertError) {
          console.log('Profile created via fallback');
          setUser(newProfile);
          setRole(newProfile.role);
        } else {
          console.error('Failed to create fallback profile:', insertError);
        }
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    }
  };

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setRole('student');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Logged in successfully' };
  };

  const signup = async (userData: { email: string; name: string; phone: string; role: UserRole }, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        data: {
          name: userData.name,
          phone_number: userData.phone,
          role: userData.role
        }
      }
    });

    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Account created! Please check your email.' };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AppContext.Provider value={{ user, role, login, signup, logout, isLoading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}