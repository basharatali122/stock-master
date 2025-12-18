import React, { useState } from 'react';
import DataTable from '@/components/ui/DataTable';
import { Search, Check, X, UserCheck, UserX, Trash2, User as UserIcon } from 'lucide-react';
import { User, UserStatus } from '@/types';

// Mock users data
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@artraders.com',
    phone: '+92 300 1234567',
    role: 'admin',
    status: 'approved',
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
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Hassan Ali',
    email: 'hassan@artraders.com',
    phone: '+92 301 2345678',
    role: 'order_booker',
    status: 'approved',
    assignedRouteId: '2',
    createdAt: new Date(),
  },
  {
    id: '4',
    name: 'Bilal Ahmed',
    email: 'bilal@artraders.com',
    phone: '+92 302 3456789',
    role: 'order_booker',
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: '5',
    name: 'Usman Malik',
    email: 'usman@artraders.com',
    phone: '+92 303 4567890',
    role: 'order_booker',
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: '6',
    name: 'Faisal Qureshi',
    email: 'faisal@artraders.com',
    phone: '+92 304 5678901',
    role: 'order_booker',
    status: 'inactive',
    createdAt: new Date(),
  },
  {
    id: '7',
    name: 'Rashid Mehmood',
    email: 'rashid@artraders.com',
    phone: '+92 305 6789012',
    role: 'order_booker',
    status: 'rejected',
    createdAt: new Date(),
  },
];

const statusFilters: (UserStatus | 'all')[] = ['all', 'pending', 'approved', 'rejected', 'inactive'];

const Users: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'approved':
        return 'badge-success';
      case 'pending':
        return 'badge-pending';
      case 'rejected':
        return 'badge-destructive';
      case 'inactive':
        return 'badge-info';
      default:
        return 'badge-info';
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (item: User) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {item.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone' },
    {
      key: 'role',
      header: 'Role',
      render: (item: User) => (
        <span className="rounded bg-secondary px-2 py-1 text-xs font-medium capitalize">
          {item.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: User) => (
        <span className={getStatusBadge(item.status)}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: User) => (
        <div className="flex gap-1">
          {item.status === 'pending' && (
            <>
              <button
                className="rounded-lg p-2 hover:bg-success/10"
                title="Approve"
              >
                <Check className="h-4 w-4 text-success" />
              </button>
              <button
                className="rounded-lg p-2 hover:bg-destructive/10"
                title="Reject"
              >
                <X className="h-4 w-4 text-destructive" />
              </button>
            </>
          )}
          {item.status === 'approved' && item.role !== 'admin' && (
            <button
              className="rounded-lg p-2 hover:bg-warning/10"
              title="Deactivate"
            >
              <UserX className="h-4 w-4 text-warning" />
            </button>
          )}
          {item.status === 'inactive' && (
            <button
              className="rounded-lg p-2 hover:bg-success/10"
              title="Activate"
            >
              <UserCheck className="h-4 w-4 text-success" />
            </button>
          )}
          {item.role !== 'admin' && (
            <button
              className="rounded-lg p-2 hover:bg-destructive/10"
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = mockUsers.filter((u) => u.status === 'pending').length;
  const approvedCount = mockUsers.filter((u) => u.status === 'approved').length;
  const inactiveCount = mockUsers.filter((u) => u.status === 'inactive').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">
          Manage order bookers and their account status
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="mt-1 text-2xl font-bold">{mockUsers.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Pending Approval</p>
          <p className="mt-1 text-2xl font-bold text-warning">{pendingCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Active Users</p>
          <p className="mt-1 text-2xl font-bold text-success">{approvedCount}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-muted-foreground">
            {inactiveCount}
          </p>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-warning/10 border border-warning/20 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
            <UserIcon className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {pendingCount} user(s) awaiting approval
            </p>
            <p className="text-sm text-muted-foreground">
              Review and approve or reject pending registrations
            </p>
          </div>
        </div>
      )}

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        emptyMessage="No users found"
      />
    </div>
  );
};

export default Users;
