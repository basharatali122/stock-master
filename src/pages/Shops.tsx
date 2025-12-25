import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Edit, Trash2, Store, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Shop {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  address: string | null;
  route_id: string;
  credit_balance: number;
  created_at: string;
  routes?: { name: string; city_id: string };
}

interface Route {
  id: string;
  name: string;
  cities?: { name: string };
}

const Shops: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone: '',
    address: '',
    route_id: '',
  });

  const fetchData = async () => {
    try {
      // For order bookers, first get their assigned route IDs
      let assignedRouteIds: string[] = [];
      
      if (!isAdmin && user) {
        const { data: userRoutes, error: userRoutesError } = await supabase
          .from('routes')
          .select('id')
          .eq('assigned_booker_id', user.id)
          .eq('is_active', true);
        
        if (userRoutesError) throw userRoutesError;
        assignedRouteIds = userRoutes?.map(r => r.id) || [];
      }

      // Fetch shops with route info
      let shopsQuery = supabase
        .from('shops')
        .select(`
          *,
          routes(name, city_id)
        `)
        .order('created_at', { ascending: false });
      
      // Order bookers only see shops on their assigned routes
      if (!isAdmin && assignedRouteIds.length > 0) {
        shopsQuery = shopsQuery.in('route_id', assignedRouteIds);
      } else if (!isAdmin && assignedRouteIds.length === 0) {
        // No assigned routes means no shops to show
        setShops([]);
        setRoutes([]);
        setLoading(false);
        return;
      }

      const { data: shopsData, error: shopsError } = await shopsQuery;
      if (shopsError) throw shopsError;
      setShops(shopsData || []);

      // Fetch routes for dropdown - order bookers only see their assigned routes
      let routesQuery = supabase
        .from('routes')
        .select(`
          id,
          name,
          cities(name)
        `)
        .eq('is_active', true)
        .order('name');
      
      if (!isAdmin && assignedRouteIds.length > 0) {
        routesQuery = routesQuery.in('id', assignedRouteIds);
      }

      const { data: routesData, error: routesError } = await routesQuery;
      if (routesError) throw routesError;
      setRoutes(routesData || []);
    } catch (error: any) {
      toast.error('Failed to load shops: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin, user]);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.owner_name || !formData.route_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('shops').insert({
        name: formData.name.trim(),
        owner_name: formData.owner_name.trim(),
        phone: formData.phone || null,
        address: formData.address || null,
        route_id: formData.route_id,
      });

      if (error) throw error;

      toast.success('Shop added successfully');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Failed to add shop: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop || !formData.name || !formData.owner_name || !formData.route_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({
          name: formData.name.trim(),
          owner_name: formData.owner_name.trim(),
          phone: formData.phone || null,
          address: formData.address || null,
          route_id: formData.route_id,
        })
        .eq('id', editingShop.id);

      if (error) throw error;

      toast.success('Shop updated successfully');
      setShowEditModal(false);
      setEditingShop(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update shop: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShop = async (shop: Shop) => {
    if (!confirm(`Are you sure you want to delete "${shop.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shop.id);

      if (error) throw error;

      toast.success('Shop deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete shop: ' + error.message);
    }
  };

  const openEditModal = (shop: Shop) => {
    setEditingShop(shop);
    setFormData({
      name: shop.name,
      owner_name: shop.owner_name,
      phone: shop.phone || '',
      address: shop.address || '',
      route_id: shop.route_id,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      owner_name: '',
      phone: '',
      address: '',
      route_id: '',
    });
  };

  const filteredShops = shops.filter(
    (shop) =>
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.routes?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const totalCredit = shops.reduce((acc, shop) => acc + (shop.credit_balance || 0), 0);

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
            <p className="text-xs text-muted-foreground">{item.owner_name}</p>
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
          <span className="text-sm">{item.phone || 'N/A'}</span>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (item: Shop) => (
        <span className="rounded bg-secondary px-2 py-1 text-xs font-medium">
          {item.routes?.name || 'N/A'}
        </span>
      ),
    },
    {
      key: 'credit_balance',
      header: 'Credit Balance',
      render: (item: Shop) => (
        <span className={(item.credit_balance || 0) > 0 ? 'text-warning font-medium' : ''}>
          {formatCurrency(item.credit_balance || 0)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Shop) => (
        <div className="flex gap-2">
          <button onClick={() => openEditModal(item)} className="rounded-lg p-2 hover:bg-muted">
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>
          {isAdmin && (
            <button onClick={() => handleDeleteShop(item)} className="rounded-lg p-2 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Shops</h1>
            <p className="page-subtitle">Manage registered shops and their payment status</p>
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
          <p className="mt-1 text-2xl font-bold">{shops.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Credit</p>
          <p className="mt-1 text-2xl font-bold text-warning">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Shops with Credit</p>
          <p className="mt-1 text-2xl font-bold text-destructive">
            {shops.filter((s) => (s.credit_balance || 0) > 0).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Clear Balance</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {shops.filter((s) => (s.credit_balance || 0) === 0).length}
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
            <p className="mt-1 text-sm text-muted-foreground">Register a new shop</p>

            <form onSubmit={handleAddShop} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Shop Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Al-Madina General Store"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Owner Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Muhammad Iqbal"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone Number</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Address</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Shop address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Route *</label>
                <select
                  className="input-field"
                  value={formData.route_id}
                  onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} {route.cities ? `(${route.cities.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shop Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Edit Shop</h2>
            <p className="mt-1 text-sm text-muted-foreground">Update shop details</p>

            <form onSubmit={handleEditShop} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Shop Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Owner Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone Number</label>
                  <input
                    type="tel"
                    className="input-field"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Address</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Route *</label>
                <select
                  className="input-field"
                  value={formData.route_id}
                  onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} {route.cities ? `(${route.cities.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingShop(null); resetForm(); }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Shop
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
