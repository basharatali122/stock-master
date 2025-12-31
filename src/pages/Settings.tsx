import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { User, Lock, Bell, Shield, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Settings: React.FC = () => {
  const { profile, isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Shield },
  ];

  // Update profile
  const handleUpdateProfile = async () => {
    if (!user || !profile) return;
    
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Update form values when profile changes
  React.useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full lg:w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="rounded-xl border border-border bg-card p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Profile Information</h2>
                  <p className="text-sm text-muted-foreground">
                    Update your personal information
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                    {fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium">{fullName || 'User'}</p>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Full Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input-field"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      className="input-field bg-muted"
                      disabled
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-field"
                      placeholder="Enter your phone number"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Role</label>
                    <input
                      type="text"
                      value={isAdmin ? 'Administrator' : 'Order Booker'}
                      className="input-field bg-muted"
                      disabled
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    className="btn-primary"
                    onClick={handleUpdateProfile}
                    disabled={profileLoading}
                  >
                    {profileLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Change Password</h2>
                  <p className="text-sm text-muted-foreground">
                    Update your password to keep your account secure
                  </p>
                </div>

                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      New Password <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Must be at least 6 characters
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Confirm New Password <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    className="btn-primary"
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Update Password
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Notification Preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose what notifications you want to receive
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'New Orders', description: 'Get notified when a new order is placed' },
                    { label: 'Order Updates', description: 'Updates about order status changes' },
                    { label: 'Low Stock Alerts', description: 'Alerts when products are running low' },
                    { label: 'Payment Reminders', description: 'Reminders about pending payments' },
                    { label: 'Daily Reports', description: 'Receive daily sales summary' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input type="checkbox" className="peer sr-only" defaultChecked />
                        <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">App Preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    Customize your application experience
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Language
                    </label>
                    <select className="input-field">
                      <option value="en">English</option>
                      <option value="ur">Urdu</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Currency Format
                    </label>
                    <select className="input-field">
                      <option value="PKR">PKR (Rs.)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Date Format
                    </label>
                    <select className="input-field">
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="btn-primary">
                    <Save className="mr-2 h-4 w-4" />
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
