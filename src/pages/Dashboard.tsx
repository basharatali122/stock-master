import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/ui/StatCard';
import DataTable from '@/components/ui/DataTable';
import BookingSupplyRate from '@/components/dashboard/BookingSupplyRate';
import {
  DollarSign,
  ShoppingCart,
  Store,
  Package,
  AlertTriangle,
  Users,
  Map,
  Clock,
  TrendingUp,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalShops: number;
  totalProducts: number;
  pendingPayments: number;
  lowStockProducts: number;
  activeRoutes: number;
  pendingApprovals: number;
  dailySales: number;
  dailyOrders: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  shop_name: string;
  route_name: string;
  booker_name: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  category: string;
  stock_quantity: number;
}

interface BookerDailySale {
  booker_id: string;
  booker_name: string;
  daily_sales: number;
  daily_orders: number;
}

const Dashboard: React.FC = () => {
  const { isAdmin, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalOrders: 0,
    totalShops: 0,
    totalProducts: 0,
    pendingPayments: 0,
    lowStockProducts: 0,
    activeRoutes: 0,
    pendingApprovals: 0,
    dailySales: 0,
    dailyOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [bookerDailySales, setBookerDailySales] = useState<BookerDailySale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();

    // Set up real-time subscriptions for orders
    const ordersChannel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      // Fetch counts and daily orders
      const [ordersRes, shopsRes, productsRes, routesRes, pendingUsersRes, dailyOrdersRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, paid_amount', { count: 'exact' }),
        supabase.from('shops').select('id', { count: 'exact' }),
        supabase.from('products').select('id, stock_quantity', { count: 'exact' }),
        supabase.from('routes').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('orders').select('id, total_amount, booker_id, created_at').gte('created_at', startOfDay).lt('created_at', endOfDay),
      ]);

      const totalSales = ordersRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      const pendingPayments = ordersRes.data?.reduce((sum, o) => sum + (Number(o.total_amount || 0) - Number(o.paid_amount || 0)), 0) || 0;
      const lowStock = productsRes.data?.filter(p => (p.stock_quantity || 0) < 50).length || 0;
      
      // Calculate daily sales
      const dailySales = dailyOrdersRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      const dailyOrders = dailyOrdersRes.data?.length || 0;

      // Calculate booker-wise daily sales
      const bookerSalesMap: Record<string, { sales: number; orders: number }> = {};
      dailyOrdersRes.data?.forEach((order) => {
        const existing = bookerSalesMap[order.booker_id] || { sales: 0, orders: 0 };
        bookerSalesMap[order.booker_id] = {
          sales: existing.sales + Number(order.total_amount || 0),
          orders: existing.orders + 1,
        };
      });

      // Fetch booker names for daily sales
      const bookerIds = Object.keys(bookerSalesMap);
      let bookerProfiles: { user_id: string; full_name: string }[] = [];
      if (bookerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', bookerIds);
        bookerProfiles = profiles || [];
      }

      const bookerDailySalesData: BookerDailySale[] = Object.entries(bookerSalesMap).map(([bookerId, data]) => ({
        booker_id: bookerId,
        booker_name: bookerProfiles.find(p => p.user_id === bookerId)?.full_name || 'Unknown',
        daily_sales: data.sales,
        daily_orders: data.orders,
      })).sort((a, b) => b.daily_sales - a.daily_sales);

      setBookerDailySales(bookerDailySalesData);

      setStats({
        totalSales,
        totalOrders: ordersRes.count || 0,
        totalShops: shopsRes.count || 0,
        totalProducts: productsRes.count || 0,
        pendingPayments,
        lowStockProducts: lowStock,
        activeRoutes: routesRes.count || 0,
        pendingApprovals: pendingUsersRes.count || 0,
        dailySales,
        dailyOrders,
      });

      // Fetch recent orders with related data
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          payment_status,
          created_at,
          shops (name),
          profiles:booker_id (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (orders) {
        setRecentOrders(orders.map((o: any) => ({
          id: o.id,
          order_number: o.order_number,
          shop_name: o.shops?.name || 'Unknown',
          route_name: 'Route',
          booker_name: o.profiles?.full_name || 'Unknown',
          total_amount: o.total_amount,
          payment_status: o.payment_status,
          created_at: o.created_at,
        })));
      }

      // Fetch low stock products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, category, stock_quantity')
        .lt('stock_quantity', 50)
        .order('stock_quantity')
        .limit(5);

      if (products) {
        setLowStockProducts(products);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString()}`;
  };

  const orderColumns = [
    { key: 'shop_name', header: 'Shop' },
    { key: 'booker_name', header: 'Booker' },
    {
      key: 'total_amount',
      header: 'Amount',
      render: (item: RecentOrder) => formatCurrency(item.total_amount),
    },
    {
      key: 'payment_status',
      header: 'Status',
      render: (item: RecentOrder) => (
        <span
          className={
            item.payment_status === 'paid'
              ? 'badge-success'
              : item.payment_status === 'credit'
              ? 'badge-pending'
              : 'badge-info'
          }
        >
          {item.payment_status?.charAt(0).toUpperCase() + item.payment_status?.slice(1)}
        </span>
      ),
    },
  ];

  const stockColumns = [
    { key: 'name', header: 'Product' },
    { key: 'category', header: 'Category' },
    {
      key: 'stock_quantity',
      header: 'Stock',
      render: (item: LowStockProduct) => (
        <span className="badge-destructive">{item.stock_quantity} units</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">
              {isAdmin ? 'Admin Dashboard' : 'Order Booker Dashboard'}
            </h1>
            <p className="page-subtitle">
              Welcome back, {profile?.full_name || 'User'}! Here's what's happening today.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/orders" className="btn-primary">
              <ShoppingCart className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </div>
        </div>
      </div>

      {/* Daily Sales Highlight */}
      <div className="rounded-xl border border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20">
              <Calendar className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Today's Sales</h2>
              <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-card/80 p-4 border border-border/50">
            <p className="text-sm text-muted-foreground">Today's Revenue</p>
            <p className="text-2xl font-bold text-accent">{formatCurrency(stats.dailySales)}</p>
          </div>
          <div className="rounded-lg bg-card/80 p-4 border border-border/50">
            <p className="text-sm text-muted-foreground">Today's Orders</p>
            <p className="text-2xl font-bold text-foreground">{stats.dailyOrders}</p>
          </div>
          <div className="rounded-lg bg-card/80 p-4 border border-border/50">
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
            <p className="text-2xl font-bold text-foreground">
              {stats.dailyOrders > 0 ? formatCurrency(Math.round(stats.dailySales / stats.dailyOrders)) : 'Rs. 0'}
            </p>
          </div>
          <div className="rounded-lg bg-card/80 p-4 border border-border/50">
            <p className="text-sm text-muted-foreground">Active Bookers Today</p>
            <p className="text-2xl font-bold text-foreground">{bookerDailySales.length}</p>
          </div>
        </div>
      </div>

      {/* Booker Daily Sales Breakdown */}
      {isAdmin && bookerDailySales.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="section-title">Order Booker Daily Sales</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookerDailySales.map((booker) => (
              <div
                key={booker.booker_id}
                className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{booker.booker_name}</p>
                    <p className="text-sm text-muted-foreground">{booker.daily_orders} orders</p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-accent">{formatCurrency(booker.daily_sales)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking & Supply Rate */}
      {isAdmin && <BookingSupplyRate />}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sales"
          value={formatCurrency(stats.totalSales)}
          icon={DollarSign}
          trend={{ value: 12.5, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingCart}
          trend={{ value: 8.2, isPositive: true }}
          variant="accent"
        />
        <StatCard
          title="Active Shops"
          value={stats.totalShops}
          icon={Store}
          trend={{ value: 3.1, isPositive: true }}
        />
        <StatCard
          title="Products"
          value={stats.totalProducts}
          icon={Package}
        />
      </div>

      {/* Secondary Stats */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pending Payments"
            value={formatCurrency(stats.pendingPayments)}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Low Stock Items"
            value={stats.lowStockProducts}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            title="Active Routes"
            value={stats.activeRoutes}
            icon={Map}
          />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon={Users}
          />
        </div>
      )}

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title mb-0">Recent Orders</h2>
            <Link
              to="/orders"
              className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <DataTable
            columns={orderColumns}
            data={recentOrders}
            keyExtractor={(item) => item.id}
            emptyMessage={loading ? "Loading..." : "No orders yet"}
          />
        </div>

        {/* Low Stock Alert */}
        {isAdmin && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title mb-0">Low Stock Alert</h2>
              <Link
                to="/products"
                className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <DataTable
              columns={stockColumns}
              data={lowStockProducts}
              keyExtractor={(item) => item.id}
              emptyMessage={loading ? "Loading..." : "No low stock items"}
            />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="section-title">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link
            to="/orders"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <ShoppingCart className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">New Order</span>
          </Link>
          <Link
            to="/shops"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <Store className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">Add Shop</span>
          </Link>
          <Link
            to="/products"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <Package className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">Products</span>
          </Link>
          <Link
            to="/reports"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <TrendingUp className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">Reports</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
