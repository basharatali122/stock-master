import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

type UserRole = 'admin' | 'order_booker';
type UserStatus = 'pending' | 'approved' | 'rejected' | 'inactive';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isOrderBooker: boolean;
  isApproved: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      if (profileData) {
        setProfile(profileData as UserProfile);
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return;
      }

      if (roleData) {
        setRole(roleData.role as UserRole);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Fetch profile to check status
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('status')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (profileError) {
          setIsLoading(false);
          return { success: false, error: 'Error fetching user profile' };
        }

        if (profileData) {
          const status = profileData.status as UserStatus;
          
          if (status === 'pending') {
            await supabase.auth.signOut();
            setIsLoading(false);
            return { success: false, error: 'Your account is pending approval. Please wait for admin approval.' };
          }
          
          if (status === 'rejected') {
            await supabase.auth.signOut();
            setIsLoading(false);
            return { success: false, error: 'Your account has been rejected. Please contact admin.' };
          }
          
          if (status === 'inactive') {
            await supabase.auth.signOut();
            setIsLoading(false);
            return { success: false, error: 'Your account has been deactivated. Please contact admin.' };
          }
        }
      }

      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: data.name,
          },
        },
      });

      if (error) {
        setIsLoading(false);
        if (error.message.includes('already registered')) {
          return { success: false, error: 'This email is already registered. Please login instead.' };
        }
        return { success: false, error: error.message };
      }

      // Update the profile with phone number
      if (authData.user) {
        await supabase
          .from('profiles')
          .update({ phone: data.phone })
          .eq('user_id', authData.user.id);
      }

      setIsLoading(false);
      return { 
        success: true, 
        error: 'Registration successful! Your account is pending approval. You will be able to login once an admin approves your account.' 
      };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const isAdmin = role === 'admin';
  const isOrderBooker = role === 'order_booker';
  const isApproved = profile?.status === 'approved';

  return (
    <AuthContext.Provider value={{ 
      user, 
      session,
      profile,
      role,
      isLoading, 
      login, 
      register, 
      logout, 
      isAdmin, 
      isOrderBooker,
      isApproved
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
