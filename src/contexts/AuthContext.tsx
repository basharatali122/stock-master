import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
  isOrderBooker: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: (User & { password: string })[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@artraders.com',
    phone: '+92 300 1234567',
    role: 'admin',
    status: 'approved',
    password: 'admin123',
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'Ahmed Khan',
    email: 'ahmed@artraders.com',
    phone: '+92 300 7654321',
    role: 'order_booker',
    status: 'approved',
    assignedRouteId: '1',
    password: 'booker123',
    createdAt: new Date(),
  },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('artraders_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const foundUser = mockUsers.find(u => u.email === email && u.password === password);
    
    if (!foundUser) {
      setIsLoading(false);
      return { success: false, error: 'Invalid email or password' };
    }
    
    if (foundUser.status === 'pending') {
      setIsLoading(false);
      return { success: false, error: 'Your account is pending approval. Please wait for admin approval.' };
    }
    
    if (foundUser.status === 'rejected') {
      setIsLoading(false);
      return { success: false, error: 'Your account has been rejected. Please contact admin.' };
    }
    
    if (foundUser.status === 'inactive') {
      setIsLoading(false);
      return { success: false, error: 'Your account has been deactivated. Please contact admin.' };
    }
    
    const { password: _, ...userWithoutPassword } = foundUser;
    setUser(userWithoutPassword);
    localStorage.setItem('artraders_user', JSON.stringify(userWithoutPassword));
    setIsLoading(false);
    
    return { success: true };
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const existingUser = mockUsers.find(u => u.email === data.email);
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: 'Email already registered' };
    }
    
    setIsLoading(false);
    return { 
      success: true, 
      error: data.role === 'order_booker' 
        ? 'Registration successful! Your account is pending approval. You will be able to login once an admin approves your account.' 
        : undefined 
    };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('artraders_user');
  };

  const isAdmin = user?.role === 'admin';
  const isOrderBooker = user?.role === 'order_booker';

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAdmin, isOrderBooker }}>
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
