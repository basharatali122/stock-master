import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Search, Check, X, UserCheck, UserX, Trash2, User as UserIcon, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

type UserStatus = 'pending' | 'approved' | 'rejected' | 'inactive';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  created_at: string;
  role?: string;
}

const statusFilters: (UserStatus | 'all')[] = ['all', 'pending', 'approved', 'rejected', 'inactive'];

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesMap = roles?.reduce((acc, r) => {
        acc[r.user_id] = r.role;
        return acc;
      }, {} as Record<string, string>) || {};

      const usersWithRoles = profiles?.map(p => ({
        ...p,
        role: rolesMap[p.user_id] || 'order_booker'
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error('Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUserStatus = async (userId: string, newStatus: UserStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`User ${newStatus} successfully`);
      fetchUsers();
    } catch (error: any) {
      toast.error('Failed to update user: ' + error.message);
    }
  };

  const deleteUser = async (user: UserProfile) => {
    if (!confirm(`Are you sure you want to permanently delete "${user.full_name}"? This will remove their account and they will no longer be able to log in.`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.user_id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      toast.error('Failed to delete user: ' + error.message);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'pending': return 'badge-pending';
      case 'rejected': return 'badge-destructive';
      case 'inactive': return 'badge-info';
      default: return 'badge-info';
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (item: UserProfile) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {item.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-foreground">{item.full_name}</p>
            <p className="text-xs text-muted-foreground">{item.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (item: UserProfile) => item.phone || 'N/A' },
    {
      key: 'role',
      header: 'Role',
      render: (item: UserProfile) => (
        <span className="rounded bg-secondary px-2 py-1 text-xs font-medium capitalize">
          {item.role?.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: UserProfile) => (
        <span className={getStatusBadge(item.status)}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: UserProfile) => (
        <div className="flex gap-1">
          {item.status === 'pending' && (
            <>
              <button onClick={() => updateUserStatus(item.user_id, 'approved')} className="rounded-lg p-2 hover:bg-success/10" title="Approve">
                <Check className="h-4 w-4 text-success" />
              </button>
              <button onClick={() => updateUserStatus(item.user_id, 'rejected')} className="rounded-lg p-2 hover:bg-destructive/10" title="Reject">
                <X className="h-4 w-4 text-destructive" />
              </button>
            </>
          )}
          {item.status === 'approved' && item.role !== 'admin' && (
            <button onClick={() => updateUserStatus(item.user_id, 'inactive')} className="rounded-lg p-2 hover:bg-warning/10" title="Deactivate">
              <UserX className="h-4 w-4 text-warning" />
            </button>
          )}
          {item.status === 'inactive' && (
            <button onClick={() => updateUserStatus(item.user_id, 'approved')} className="rounded-lg p-2 hover:bg-success/10" title="Activate">
              <UserCheck className="h-4 w-4 text-success" />
            </button>
          )}
          {item.role !== 'admin' && (
            <button onClick={() => deleteUser(item)} className="rounded-lg p-2 hover:bg-destructive/10" title="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const approvedCount = users.filter((u) => u.status === 'approved').length;
  const inactiveCount = users.filter((u) => u.status === 'inactive').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">Manage order bookers and their account status</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((status) => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${statusFilter === status ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card"><p className="text-sm text-muted-foreground">Total Users</p><p className="mt-1 text-2xl font-bold">{users.length}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Pending Approval</p><p className="mt-1 text-2xl font-bold text-warning">{pendingCount}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Active Users</p><p className="mt-1 text-2xl font-bold text-success">{approvedCount}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Inactive</p><p className="mt-1 text-2xl font-bold text-muted-foreground">{inactiveCount}</p></div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-warning/10 border border-warning/20 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20"><UserIcon className="h-5 w-5 text-warning" /></div>
          <div><p className="font-medium text-foreground">{pendingCount} user(s) awaiting approval</p><p className="text-sm text-muted-foreground">Review and approve or reject pending registrations</p></div>
        </div>
      )}

      <DataTable columns={columns} data={filteredUsers} keyExtractor={(item) => item.id} emptyMessage="No users found" />
    </div>
  );
};

export default Users;
