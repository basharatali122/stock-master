import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Edit, Trash2, Store, Phone, MapPin } from 'lucide-react';
import { Shop } from '@/types';

// Mock shops data
const mockShops: Shop[] = [
  {
    id: '1',
    name: 'Al-Madina General Store',
    ownerName: 'Muhammad Iqbal',
    phone: '+92 300 1234567',
    address: 'Shop #12, Main Boulevard, Gulberg',
    routeId: '1',
    routeName: 'Gulberg Route',
    creditBalance: 15000,
    pendingBalance: 5000,
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'City Mart',
    ownerName: 'Ali Hassan',
    phone: '+92 301 2345678',
    address: '45-A, Commercial Area, Model Town',
    routeId: '2',
    routeName: 'Model Town Route',
    creditBalance: 0,
    pendingBalance: 0,
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Quick Shop',
    ownerName: 'Usman Ahmed',
    phone: '+92 302 3456789',
    address: 'Phase 5, DHA, Lahore',
    routeId: '3',
    routeName: 'DHA Route',
    creditBalance: 28500,
    pendingBalance: 12000,
    createdAt: new Date(),
  },
  {
    id: '4',
    name: 'Family Store',
    ownerName: 'Imran Khan',
    phone: '+92 303 4567890',
    address: 'Block G, Johar Town',
    routeId: '4',
    routeName: 'Johar Town Route',
    creditBalance: 8000,
    pendingBalance: 0,
    createdAt: new Date(),
  },
  {
    id: '5',
    name: 'Corner Shop',
    ownerName: 'Farhan Ali',
    phone: '+92 304 5678901',
    address: 'Main Market, Gulberg III',
    routeId: '1',
    routeName: 'Gulberg Route',
    creditBalance: 0,
    pendingBalance: 3500,
    createdAt: new Date(),
  },
  {
    id: '6',
    name: 'Super Mart',
    ownerName: 'Kashif Mahmood',
    phone: '+92 305 6789012',
    address: 'Saddar, Karachi',
    routeId: '5',
    routeName: 'Saddar Route',
    creditBalance: 45000,
    pendingBalance: 20000,
    createdAt: new Date(),
  },
];

const Shops: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredShops = mockShops.filter(
    (shop) =>
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.routeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const columns = [
    {
      key: 'name',
      header: 'Shop',
      render: (item: Shop) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
            <Store className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.ownerName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (item: Shop) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{item.phone}</span>
        </div>
      ),
    },
    {
      key: 'routeName',
      header: 'Route',
      render: (item: Shop) => (
        <span className="rounded bg-secondary px-2 py-1 text-xs font-medium">
          {item.routeName}
        </span>
      ),
    },
    {
      key: 'creditBalance',
      header: 'Credit Given',
      render: (item: Shop) => (
        <span className={item.creditBalance > 0 ? 'text-warning font-medium' : ''}>
          {formatCurrency(item.creditBalance)}
        </span>
      ),
    },
    {
      key: 'pendingBalance',
      header: 'Pending',
      render: (item: Shop) => (
        <span
          className={
            item.pendingBalance > 0
              ? 'badge-destructive'
              : 'badge-success'
          }
        >
          {formatCurrency(item.pendingBalance)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Shop) => (
        <div className="flex gap-2">
          <button className="rounded-lg p-2 hover:bg-muted">
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>
          {isAdmin && (
            <button className="rounded-lg p-2 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const totalCredit = mockShops.reduce((acc, shop) => acc + shop.creditBalance, 0);
  const totalPending = mockShops.reduce((acc, shop) => acc + shop.pendingBalance, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Shops</h1>
            <p className="page-subtitle">
              Manage registered shops and their payment status
            </p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Add Shop
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search shops, owners, or routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Shops</p>
          <p className="mt-1 text-2xl font-bold">{mockShops.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Credit Given</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            {formatCurrency(totalCredit)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Pending</p>
          <p className="mt-1 text-2xl font-bold text-destructive">
            {formatCurrency(totalPending)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Clear Balance Shops</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {mockShops.filter((s) => s.pendingBalance === 0).length}
          </p>
        </div>
      </div>

      {/* Shops Table */}
      <DataTable
        columns={columns}
        data={filteredShops}
        keyExtractor={(item) => item.id}
        emptyMessage="No shops found"
      />

      {/* Add Shop Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Add New Shop</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Register a new shop under your route
            </p>

            <form className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Shop Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Al-Madina General Store"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Muhammad Iqbal"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+92 300 1234567"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Address
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Shop address"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Route</label>
                <select className="input-field">
                  <option value="">Select route</option>
                  <option value="1">Gulberg Route</option>
                  <option value="2">Model Town Route</option>
                  <option value="3">DHA Route</option>
                  <option value="4">Johar Town Route</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shops;
