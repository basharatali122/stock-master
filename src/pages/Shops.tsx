import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import ShopHistory from '@/components/ShopHistory';
import { Plus, Search, Edit, Trash2, Store, Phone, Loader2, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { printContent, formatCurrencyForPrint } from '@/lib/print';
import { shopSchema, validateInput } from '@/lib/validation';

interface Shop {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  address: string | null;
  route_id: string;
  credit_balance: number;
  created_at: string;
  shop_code: string | null;
  routes?: { name: string; city_id: string };
}

interface Route {
  id: string;
  name: string;
  cities?: { name: string };
}

interface OrderBooker {
  id: string;
  full_name: string;
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
  const [selectedShopForHistory, setSelectedShopForHistory] = useState<Shop | null>(null);
  const [showPrintCreditsModal, setShowPrintCreditsModal] = useState(false);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [selectedBookerId, setSelectedBookerId] = useState<string>('all');
  const [loadingBookers, setLoadingBookers] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone: '',
    address: '',
    route_id: '',
    shop_code: '',
  });

  const fetchData = useCallback(async () => {
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

      // For order bookers with no routes, exit early
      if (!isAdmin && assignedRouteIds.length === 0) {
        setShops([]);
        setRoutes([]);
        setLoading(false);
        return;
      }

      // Build queries
      let shopsQuery = supabase
        .from('shops')
        .select('*, routes(name, city_id)')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      let routesQuery = supabase
        .from('routes')
        .select('id, name, cities(name)')
        .eq('is_active', true)
        .order('name');
      
      if (!isAdmin && assignedRouteIds.length > 0) {
        shopsQuery = shopsQuery.in('route_id', assignedRouteIds);
        routesQuery = routesQuery.in('id', assignedRouteIds);
      }

      // Batch both queries in parallel
      const [shopsResult, routesResult] = await Promise.all([
        shopsQuery,
        routesQuery
      ]);

      if (shopsResult.error) throw shopsResult.error;
      if (routesResult.error) throw routesResult.error;

      setShops(shopsResult.data || []);
      setRoutes(routesResult.data || []);
    } catch (error: any) {
      toast.error('Failed to load shops: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validationResult = validateInput(shopSchema, {
      name: formData.name,
      owner_name: formData.owner_name,
      phone: formData.phone || '',
      address: formData.address || '',
      route_id: formData.route_id,
      shop_code: formData.shop_code,
    });
    
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }
    
    const validatedData = validationResult.data;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('shops').insert({
        name: validatedData.name,
        owner_name: validatedData.owner_name,
        phone: validatedData.phone || null,
        address: validatedData.address || null,
        route_id: validatedData.route_id,
        shop_code: validatedData.shop_code,
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
    if (!editingShop) {
      toast.error('No shop selected for editing');
      return;
    }

    // Validate input
    const validationResult = validateInput(shopSchema, {
      name: formData.name,
      owner_name: formData.owner_name,
      phone: formData.phone || '',
      address: formData.address || '',
      route_id: formData.route_id,
      shop_code: formData.shop_code,
    });
    
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }
    
    const validatedData = validationResult.data;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({
          name: validatedData.name,
          owner_name: validatedData.owner_name,
          phone: validatedData.phone || null,
          address: validatedData.address || null,
          route_id: validatedData.route_id,
          shop_code: validatedData.shop_code,
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
      shop_code: shop.shop_code || '',
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
      shop_code: '',
    });
  };

  const filteredShops = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(searchLower) ||
        shop.owner_name.toLowerCase().includes(searchLower) ||
        shop.routes?.name?.toLowerCase().includes(searchLower) ||
        (shop.shop_code && shop.shop_code.toLowerCase().includes(searchLower))
    );
  }, [shops, searchQuery]);

  const formatCurrency = useCallback((amount: number) => `Rs. ${amount.toLocaleString()}`, []);

  const { totalCredit, shopsWithCredit, shopsWithZeroCredit } = useMemo(() => {
    let total = 0;
    let withCredit = 0;
    let zeroCredit = 0;
    
    shops.forEach(shop => {
      const balance = shop.credit_balance || 0;
      total += balance;
      if (balance > 0) withCredit++;
      else zeroCredit++;
    });
    
    return { totalCredit: total, shopsWithCredit: withCredit, shopsWithZeroCredit: zeroCredit };
  }, [shops]);

  const fetchOrderBookers = async () => {
    setLoadingBookers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_id')
        .eq('status', 'approved')
        .order('full_name');
      
      if (error) throw error;
      
      // Map to use user_id as the id since orders use booker_id which is user_id
      setOrderBookers((data || []).map(p => ({ id: p.user_id, full_name: p.full_name })));
    } catch (error: any) {
      toast.error('Failed to load order bookers: ' + error.message);
    } finally {
      setLoadingBookers(false);
    }
  };

  const openPrintCreditsModal = () => {
    setSelectedBookerId('all');
    fetchOrderBookers();
    setShowPrintCreditsModal(true);
  };

  const handlePrintPendingCredits = async () => {
    try {
      // Build query for orders with pending payment
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          total_amount,
          paid_amount,
          payment_status,
          booker_id,
          shops!inner(
            id,
            name,
            phone,
            routes!inner(name)
          )
        `)
        .in('payment_status', ['credit', 'partial', 'pending'])
        .order('created_at', { ascending: false });

      // Filter by booker if selected
      if (selectedBookerId !== 'all') {
        query = query.eq('booker_id', selectedBookerId);
      }

      const { data: ordersWithDues, error } = await query;

      if (error) throw error;

      if (!ordersWithDues || ordersWithDues.length === 0) {
        toast.info('No pending credits found');
        return;
      }

      // Get booker name for the report title
      const selectedBooker = orderBookers.find(b => b.id === selectedBookerId);
      const bookerName = selectedBookerId === 'all' ? 'All Order Bookers' : selectedBooker?.full_name || 'Unknown';

      const now = new Date();
      let tableRows = '';
      let totalPending = 0;

      ordersWithDues.forEach((order: any, index: number) => {
        const remainingBalance = (order.total_amount || 0) - (order.paid_amount || 0);
        totalPending += remainingBalance;
        
        const orderDate = new Date(order.created_at);
        const pendingDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        tableRows += `
          <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td>${orderDate.toLocaleDateString()}</td>
            <td>${order.order_number}</td>
            <td>${order.shops?.name || 'N/A'}</td>
            <td>${order.shops?.routes?.name || 'N/A'}</td>
            <td style="text-align: right;">${formatCurrencyForPrint(order.total_amount)}</td>
            <td style="text-align: right; font-weight: bold; color: #dc2626;">${formatCurrencyForPrint(remainingBalance)}</td>
            <td style="text-align: center;">${pendingDays} days</td>
            <td>${order.shops?.phone || 'N/A'}</td>
          </tr>
        `;
      });

      const content = `
        <div class="header">
          <h1>Pending Credits Report</h1>
          <p>Order Booker: ${bookerName}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Total Orders with Dues:</span>
            <span class="info-value">${ordersWithDues.length}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Total Pending Amount:</span>
            <span class="info-value" style="color: #dc2626;">${formatCurrencyForPrint(totalPending)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Report Date:</span>
            <span class="info-value">${now.toLocaleDateString()}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Report Time:</span>
            <span class="info-value">${now.toLocaleTimeString()}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center;">Sr. No.</th>
              <th>Delivery Date</th>
              <th>Order ID</th>
              <th>Shop/Client Name</th>
              <th>Route Name</th>
              <th style="text-align: right;">Total Amount</th>
              <th style="text-align: right;">Remaining Balance</th>
              <th style="text-align: center;">Pending Days</th>
              <th>Contact No.</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row total">
            <span>Grand Total Pending:</span>
            <span style="color: #dc2626;">${formatCurrencyForPrint(totalPending)}</span>
          </div>
        </div>
      `;

      printContent(content, `Pending Credits Report - ${bookerName}`);
      setShowPrintCreditsModal(false);
    } catch (error: any) {
      toast.error('Failed to generate report: ' + error.message);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'shop_code',
      header: 'Code',
      render: (item: Shop) => (
        <span className="rounded bg-primary/10 px-2 py-1 text-xs font-mono font-medium text-primary">
          {item.shop_code || 'N/A'}
        </span>
      ),
    },
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
          {isAdmin && (
            <button 
              onClick={() => setSelectedShopForHistory(item)} 
              className="rounded-lg p-2 hover:bg-primary/10"
              title="View History"
            >
              <Eye className="h-4 w-4 text-primary" />
            </button>
          )}
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
  ], [isAdmin, formatCurrency]);

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
          {isAdmin && (
            <button onClick={openPrintCreditsModal} className="btn-secondary">
              <Printer className="mr-2 h-4 w-4" />
              Print Pending Credits
            </button>
          )}
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
            {shopsWithCredit}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Clear Balance</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {shopsWithZeroCredit}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Shop Code *</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="e.g., SH001"
                    value={formData.shop_code}
                    onChange={(e) => setFormData({ ...formData, shop_code: e.target.value })}
                    disabled={submitting}
                  />
                </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Shop Code *</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    value={formData.shop_code}
                    onChange={(e) => setFormData({ ...formData, shop_code: e.target.value })}
                    disabled={submitting}
                  />
                </div>
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

      {/* Print Credits Modal */}
      {showPrintCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-elevated p-6 w-full max-w-md mx-4 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Print Pending Credits</h2>
                <p className="text-sm text-muted-foreground">Select an order booker to filter</p>
              </div>
              <button
                onClick={() => setShowPrintCreditsModal(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Order Booker</label>
                {loadingBookers ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading bookers...
                  </div>
                ) : (
                  <select
                    value={selectedBookerId}
                    onChange={(e) => setSelectedBookerId(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="all">All Order Bookers</option>
                    {orderBookers.map((booker) => (
                      <option key={booker.id} value={booker.id}>
                        {booker.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPrintCreditsModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrintPendingCredits}
                  className="btn-primary flex-1"
                  disabled={loadingBookers}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shop History Modal */}
      {selectedShopForHistory && (
        <ShopHistory
          shopId={selectedShopForHistory.id}
          shopName={selectedShopForHistory.name}
          onClose={() => setSelectedShopForHistory(null)}
        />
      )}
    </div>
  );
};

export default Shops;
