'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UserRole, Profile } from './types';
import { supabase } from './supabase';
import { usePathname, useRouter } from 'next/navigation';

interface AppContextType {
  user: Profile | null;
  role: UserRole;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signup: (userData: { email: string; name: string; phone: string; role: UserRole }, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const profile = data as Profile;
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
    let profileSubscription: RealtimeChannel | null = null;

    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const userId = session.user.id;
        fetchProfile(userId).finally(() => setIsLoading(false));

        // Subscribe to realtime changes for this user's profile
        profileSubscription = supabase
          .channel(`profile:${userId}`)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${userId}` 
          }, (payload) => {
            const updatedProfile = payload.new as Profile;
            setUser(updatedProfile);
            setRole(updatedProfile.role);
          })
          .subscribe();
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const userId = session.user.id;
        fetchProfile(userId);
        
        // Re-subscribe if user changes
        if (profileSubscription) supabase.removeChannel(profileSubscription);
        profileSubscription = supabase
          .channel(`profile:${userId}`)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${userId}` 
          }, (payload) => {
            const updatedProfile = payload.new as Profile;
            setUser(updatedProfile);
            setRole(updatedProfile.role);
          })
          .subscribe();

      } else {
        setUser(null);
        setRole('student');
        if (profileSubscription) supabase.removeChannel(profileSubscription);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (profileSubscription) supabase.removeChannel(profileSubscription);
    };
  }, []);

  // Redirect to onboarding if profile is incomplete
  useEffect(() => {
    const isProfileIncomplete = user && (!user.name || !user.phone_number);
    if (!isLoading && isProfileIncomplete && pathname !== '/onboarding') {
      router.push('/onboarding');
    }
  }, [user, isLoading, pathname, router]);

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

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AppContext.Provider value={{ user, role, login, signup, logout, isLoading, refreshProfile }}>
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