import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Store, Package, CreditCard, Clock, TrendingUp, Receipt, ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ShopHistoryProps {
  shopId: string;
  shopName: string;
  onClose: () => void;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  booker?: { full_name: string };
}

interface Return {
  id: string;
  quantity: number;
  reason: string | null;
  status: string;
  created_at: string;
  products?: { name: string };
}

interface ShopDetails {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  address: string | null;
  credit_balance: number;
  created_at: string;
  routes?: { name: string };
}

const ShopHistory: React.FC<ShopHistoryProps> = ({ shopId, shopName, onClose }) => {
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'returns' | 'summary'>('summary');

  useEffect(() => {
    const fetchShopHistory = async () => {
      try {
        // Fetch shop details
        const { data: shopData, error: shopError } = await supabase
          .from('shops')
          .select('*, routes(name)')
          .eq('id', shopId)
          .maybeSingle();
        
        if (shopError) throw shopError;
        setShop(shopData);

        // Fetch orders for this shop
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false });
        
        if (ordersError) throw ordersError;
        setOrders(ordersData || []);

        // Fetch returns for this shop
        const { data: returnsData, error: returnsError } = await supabase
          .from('returns')
          .select('*, products(name)')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false });
        
        if (returnsError) throw returnsError;
        setReturns(returnsData || []);
      } catch (error: any) {
        console.error('Error fetching shop history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShopHistory();
  }, [shopId]);

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;
  const formatDate = (date: string) => format(new Date(date), 'dd MMM yyyy, HH:mm');

  // Calculate summary stats
  const totalOrders = orders.length;
  const totalOrderValue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalPaid = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
  const pendingDues = totalOrderValue - totalPaid;
  const completedOrders = orders.filter(o => o.status === 'delivered').length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const totalReturns = returns.length;
  const approvedReturns = returns.filter(r => r.status === 'approved').length;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning/10 text-warning',
      processing: 'bg-info/10 text-info',
      delivered: 'bg-success/10 text-success',
      cancelled: 'bg-destructive/10 text-destructive',
      approved: 'bg-success/10 text-success',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  const getPaymentBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-success/10 text-success',
      pending: 'bg-warning/10 text-warning',
      partial: 'bg-info/10 text-info',
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
        <div className="w-full max-w-4xl rounded-xl bg-card p-6 shadow-elevated">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-xl bg-card shadow-elevated animate-scale-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{shopName}</h2>
              <p className="text-sm text-muted-foreground">
                {shop?.owner_name} • {shop?.routes?.name || 'No Route'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 border-b border-border bg-muted/30">
          {(['summary', 'orders', 'returns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Receipt className="h-4 w-4" />
                    <span className="text-sm">Total Orders</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{totalOrders}</p>
                </div>
                <div className="stat-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Total Value</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(totalOrderValue)}</p>
                </div>
                <div className="stat-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm">Total Paid</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-success">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="stat-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Pending Dues</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-warning">{formatCurrency(pendingDues)}</p>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="font-semibold text-foreground mb-3">Order Status Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Completed Orders</span>
                      <span className="font-medium text-success">{completedOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Pending Orders</span>
                      <span className="font-medium text-warning">{pendingOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Credit Balance</span>
                      <span className="font-medium text-destructive">{formatCurrency(shop?.credit_balance || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="font-semibold text-foreground mb-3">Returns Overview</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Returns</span>
                      <span className="font-medium">{totalReturns}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Approved Returns</span>
                      <span className="font-medium text-success">{approvedReturns}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Customer Since</span>
                      <span className="font-medium">{shop?.created_at ? format(new Date(shop.created_at), 'dd MMM yyyy') : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground mb-3">Recent Orders</h3>
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders found</p>
                ) : (
                  <div className="space-y-2">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="font-medium text-sm">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">{formatCurrency(order.total_amount)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(order.status || 'pending')}`}>
                            {order.status || 'pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">All Orders ({orders.length})</h3>
              {orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orders found for this shop</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{order.order_number}</p>
                          <p className="text-sm text-muted-foreground mt-1">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(order.status || 'pending')}`}>
                            {order.status || 'pending'}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${getPaymentBadge(order.payment_status || 'pending')}`}>
                            {order.payment_status || 'pending'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <span className="ml-2 font-medium">{formatCurrency(order.total_amount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Paid:</span>
                          <span className="ml-2 font-medium text-success">{formatCurrency(order.paid_amount || 0)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Due:</span>
                          <span className="ml-2 font-medium text-warning">
                            {formatCurrency(order.total_amount - (order.paid_amount || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'returns' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">All Returns ({returns.length})</h3>
              {returns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowLeft className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No returns found for this shop</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {returns.map((ret) => (
                    <div key={ret.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{ret.products?.name || 'Unknown Product'}</p>
                          <p className="text-sm text-muted-foreground mt-1">Qty: {ret.quantity}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(ret.status || 'pending')}`}>
                          {ret.status || 'pending'}
                        </span>
                      </div>
                      {ret.reason && (
                        <p className="mt-2 text-sm text-muted-foreground">Reason: {ret.reason}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">{formatDate(ret.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopHistory;
