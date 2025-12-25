import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Eye, RotateCcw, Loader2, X, Printer, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { printContent, formatCurrencyForPrint, getStatusBadgeClass } from '@/lib/print';

interface Return {
  id: string;
  shop_id: string;
  product_id: string;
  booker_id: string;
  quantity: number;
  reason: string | null;
  status: string;
  created_at: string;
  shops?: { name: string };
  products?: { name: string; price: number };
  booker_profile?: { full_name: string } | null;
}

interface Shop {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const Returns: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [returns, setReturns] = useState<Return[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingReturn, setViewingReturn] = useState<Return | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingReturnId, setUpdatingReturnId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    shop_id: '',
    product_id: '',
    quantity: '1',
    reason: '',
  });

  const fetchData = async () => {
    try {
      let query = supabase
        .from('returns')
        .select(`
          *,
          shops(name),
          products(name, price)
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin && user) {
        query = query.eq('booker_id', user.id);
      }

      const { data: returnsData, error: returnsError } = await query;
      if (returnsError) throw returnsError;

      // Fetch booker profiles
      const returnsWithBookers = await Promise.all(
        (returnsData || []).map(async (ret) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', ret.booker_id)
            .maybeSingle();
          return { ...ret, booker_profile: profile };
        })
      );

      setReturns(returnsWithBookers);

      // Fetch shops
      const { data: shopsData } = await supabase.from('shops').select('id, name').order('name');
      setShops(shopsData || []);

      // Fetch products
      const { data: productsData } = await supabase.from('products').select('id, name, price').eq('is_active', true).order('name');
      setProducts(productsData || []);
    } catch (error: any) {
      toast.error('Failed to load returns: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin, user]);

  // Real-time subscription for returns
  useEffect(() => {
    const channel = supabase
      .channel('returns-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'returns'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, user]);

  const handleUpdateReturnStatus = async (returnId: string, newStatus: string) => {
    setUpdatingReturnId(returnId);
    try {
      const { error } = await supabase
        .from('returns')
        .update({ status: newStatus })
        .eq('id', returnId);

      if (error) throw error;

      toast.success(`Return ${newStatus === 'approved' ? 'approved - stock restored' : 'status updated'}`);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update return: ' + error.message);
    } finally {
      setUpdatingReturnId(null);
    }
  };

  const handleAddReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shop_id || !formData.product_id || !formData.quantity) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('returns').insert({
        shop_id: formData.shop_id,
        product_id: formData.product_id,
        booker_id: user.id,
        quantity: parseInt(formData.quantity),
        reason: formData.reason || null,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Return recorded successfully');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Failed to record return: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ shop_id: '', product_id: '', quantity: '1', reason: '' });
  };

  const viewReturn = (ret: Return) => {
    setViewingReturn(ret);
    setShowViewModal(true);
  };

  const printReturn = (ret: Return) => {
    const content = `
      <div class="header">
        <h1>AR Traders</h1>
        <p>Return Receipt</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Return ID:</span><span class="info-value">${ret.id.slice(0, 8)}</span></div>
        <div class="info-item"><span class="info-label">Date:</span><span class="info-value">${new Date(ret.created_at).toLocaleDateString()}</span></div>
        <div class="info-item"><span class="info-label">Shop:</span><span class="info-value">${ret.shops?.name || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Processed By:</span><span class="info-value">${ret.booker_profile?.full_name || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Product:</span><span class="info-value">${ret.products?.name || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Quantity:</span><span class="info-value">${ret.quantity}</span></div>
        <div class="info-item"><span class="info-label">Reason:</span><span class="info-value">${ret.reason || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Status:</span><span class="badge ${getStatusBadgeClass(ret.status)}">${ret.status}</span></div>
      </div>
      <div class="summary">
        <div class="summary-row total"><span>Return Value:</span><span>${formatCurrencyForPrint((ret.products?.price || 0) * ret.quantity)}</span></div>
      </div>
    `;
    printContent(content, 'Return Receipt');
  };

  const printAllReturns = () => {
    const returnsHtml = filteredReturns.map(ret => `
      <tr>
        <td>${ret.id.slice(0, 8)}</td>
        <td>${ret.shops?.name || 'N/A'}</td>
        <td>${ret.products?.name || 'N/A'}</td>
        <td>${ret.quantity}</td>
        <td>${ret.booker_profile?.full_name || 'N/A'}</td>
        <td>${formatCurrencyForPrint((ret.products?.price || 0) * ret.quantity)}</td>
        <td><span class="badge ${getStatusBadgeClass(ret.status)}">${ret.status}</span></td>
      </tr>
    `).join('');

    const content = `
      <div class="header">
        <h1>AR Traders</h1>
        <p>Returns Report</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Total Returns:</span><span class="info-value">${filteredReturns.length}</span></div>
        <div class="info-item"><span class="info-label">Total Return Value:</span><span class="info-value">${formatCurrencyForPrint(totalReturnsValue)}</span></div>
        <div class="info-item"><span class="info-label">Pending Returns:</span><span class="info-value">${returns.filter(r => r.status === 'pending').length}</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Shop</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Processed By</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${returnsHtml}</tbody>
      </table>
    `;
    printContent(content, 'Returns Report');
  };

  const filteredReturns = returns.filter(
    (ret) =>
      ret.shops?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.products?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

  const calculateReturnValue = (ret: Return) => {
    return (ret.products?.price || 0) * ret.quantity;
  };

  const totalReturnsValue = returns.reduce((acc, ret) => acc + calculateReturnValue(ret), 0);

  const columns = [
    {
      key: 'id',
      header: 'Return ID',
      render: (item: Return) => (
        <span className="font-mono text-sm font-medium text-accent">{item.id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'shop',
      header: 'Shop',
      render: (item: Return) => <p className="font-medium">{item.shops?.name}</p>,
    },
    {
      key: 'product',
      header: 'Product',
      render: (item: Return) => <p>{item.products?.name}</p>,
    },
    { key: 'quantity', header: 'Qty', render: (item: Return) => item.quantity },
    { key: 'booker', header: 'Processed By', render: (item: Return) => item.booker_profile?.full_name || 'N/A' },
    {
      key: 'value',
      header: 'Value',
      render: (item: Return) => (
        <span className="font-medium text-destructive">{formatCurrency(calculateReturnValue(item))}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Return) => (
        <span className={item.status === 'approved' ? 'badge-success' : item.status === 'rejected' ? 'badge-destructive' : 'badge-pending'}>
          {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Return) => (
        <div className="flex gap-1">
          <button onClick={() => viewReturn(item)} className="rounded-lg p-2 hover:bg-muted" title="View">
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
          {isAdmin && item.status === 'pending' && (
            <>
              <button 
                onClick={() => handleUpdateReturnStatus(item.id, 'approved')} 
                className="rounded-lg p-2 hover:bg-success/20" 
                title="Approve & Restore Stock"
                disabled={updatingReturnId === item.id}
              >
                {updatingReturnId === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-success" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-success" />
                )}
              </button>
              <button 
                onClick={() => handleUpdateReturnStatus(item.id, 'rejected')} 
                className="rounded-lg p-2 hover:bg-destructive/20" 
                title="Reject"
                disabled={updatingReturnId === item.id}
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </button>
            </>
          )}
          <button onClick={() => printReturn(item)} className="rounded-lg p-2 hover:bg-muted" title="Print">
            <Printer className="h-4 w-4 text-muted-foreground" />
          </button>
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
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Product Returns</h1>
            <p className="page-subtitle">Track and manage product returns from shops</p>
          </div>
          <div className="flex gap-2">
            <button onClick={printAllReturns} className="btn-secondary">
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              New Return
            </button>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Search returns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-10" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card"><p className="text-sm text-muted-foreground">Total Returns</p><p className="mt-1 text-2xl font-bold">{returns.length}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Total Return Value</p><p className="mt-1 text-2xl font-bold text-destructive">{formatCurrency(totalReturnsValue)}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Pending Returns</p><p className="mt-1 text-2xl font-bold">{returns.filter(r => r.status === 'pending').length}</p></div>
      </div>

      <DataTable columns={columns} data={filteredReturns} keyExtractor={(item) => item.id} emptyMessage="No returns found" />

      {/* Add Return Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Record Product Return</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter return details to update inventory</p>

            <form onSubmit={handleAddReturn} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Shop *</label>
                <select className="input-field" value={formData.shop_id} onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })} disabled={submitting}>
                  <option value="">Select shop</option>
                  {shops.map((shop) => (<option key={shop.id} value={shop.id}>{shop.name}</option>))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Product *</label>
                <select className="input-field" value={formData.product_id} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })} disabled={submitting}>
                  <option value="">Select product</option>
                  {products.map((p) => (<option key={p.id} value={p.id}>{p.name} - Rs. {p.price}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Quantity *</label>
                  <input type="number" className="input-field" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} disabled={submitting} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Return Value</label>
                  <input type="text" className="input-field" value={formatCurrency((products.find(p => p.id === formData.product_id)?.price || 0) * parseInt(formData.quantity || '0'))} disabled />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Return Reason</label>
                <select className="input-field" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} disabled={submitting}>
                  <option value="">Select reason</option>
                  <option value="Damaged Packaging">Damaged Packaging</option>
                  <option value="Expired Products">Expired Products</option>
                  <option value="Wrong Order">Wrong Order</option>
                  <option value="Quality Issues">Quality Issues</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Record Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Return Modal */}
      {showViewModal && viewingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Return Details</h2>
              <button onClick={() => setShowViewModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Shop:</span><span className="font-medium">{viewingReturn.shops?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Product:</span><span className="font-medium">{viewingReturn.products?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Quantity:</span><span className="font-medium">{viewingReturn.quantity}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Value:</span><span className="font-medium text-destructive">{formatCurrency(calculateReturnValue(viewingReturn))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reason:</span><span className="font-medium">{viewingReturn.reason || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className={viewingReturn.status === 'approved' ? 'badge-success' : 'badge-pending'}>{viewingReturn.status}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Processed By:</span><span className="font-medium">{viewingReturn.booker_profile?.full_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span className="font-medium">{new Date(viewingReturn.created_at).toLocaleDateString()}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;
