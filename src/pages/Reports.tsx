import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/ui/StatCard';
import { Calendar, Download, TrendingUp, DollarSign, ShoppingCart, Store, BarChart3, Loader2, RefreshCw, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';

interface DailySales {
  day: string;
  date: string;
  sales: number;
  orders: number;
}

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  units: number;
}

interface RoutePerformance {
  id: string;
  name: string;
  sales: number;
  shops: number;
}

interface ReportStats {
  totalRevenue: number;
  totalOrders: number;
  activeShops: number;
  avgOrderValue: number;
  cashCollected: number;
  creditGiven: number;
  deliveredOrders: number;
  totalReturns: number;
}

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRealtime, setIsRealtime] = useState(true);
  
  const [stats, setStats] = useState<ReportStats>({
    totalRevenue: 0,
    totalOrders: 0,
    activeShops: 0,
    avgOrderValue: 0,
    cashCollected: 0,
    creditGiven: 0,
    deliveredOrders: 0,
    totalReturns: 0,
  });
  
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [routePerformance, setRoutePerformance] = useState<RoutePerformance[]>([]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default:
        startDate = subDays(now, 7);
    }
    
    return {
      start: startDate.toISOString(),
      end: endOfDay(now).toISOString(),
    };
  };

  const fetchReportData = async () => {
    try {
      const { start, end } = getDateRange();

      // Fetch orders with items
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name))')
        .gte('created_at', start)
        .lte('created_at', end);

      if (ordersError) throw ordersError;

      // Fetch shops
      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('id, route_id');

      if (shopsError) throw shopsError;

      // Fetch routes with city info
      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select('id, name, city_id');

      if (routesError) throw routesError;

      // Fetch returns
      const { data: returns, error: returnsError } = await supabase
        .from('returns')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end);

      if (returnsError) throw returnsError;

      // Calculate stats
      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const cashCollected = orders?.reduce((sum, o) => sum + (o.paid_amount || 0), 0) || 0;
      const creditGiven = totalRevenue - cashCollected;
      const deliveredOrders = orders?.filter(o => o.status === 'delivered').length || 0;
      const activeShopIds = new Set(orders?.map(o => o.shop_id) || []);
      const totalReturns = returns?.length || 0;

      setStats({
        totalRevenue,
        totalOrders,
        activeShops: activeShopIds.size,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        cashCollected,
        creditGiven,
        deliveredOrders,
        totalReturns,
      });

      // Calculate daily sales
      const salesByDay: Record<string, { sales: number; orders: number; date: string }> = {};
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      // Initialize days
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayKey = format(date, 'yyyy-MM-dd');
        const dayName = dayNames[date.getDay()];
        salesByDay[dayKey] = { sales: 0, orders: 0, date: dayName };
      }
      
      orders?.forEach(order => {
        const orderDate = format(new Date(order.created_at!), 'yyyy-MM-dd');
        if (salesByDay[orderDate]) {
          salesByDay[orderDate].sales += order.total_amount || 0;
          salesByDay[orderDate].orders += 1;
        }
      });

      setDailySales(
        Object.entries(salesByDay).map(([key, value]) => ({
          day: value.date,
          date: key,
          sales: value.sales,
          orders: value.orders,
        }))
      );

      // Calculate top products
      const productStats: Record<string, { name: string; sales: number; units: number }> = {};
      
      orders?.forEach(order => {
        (order.order_items as any[])?.forEach(item => {
          const productId = item.product_id;
          const productName = item.products?.name || 'Unknown';
          
          if (!productStats[productId]) {
            productStats[productId] = { name: productName, sales: 0, units: 0 };
          }
          
          productStats[productId].sales += item.total_price || 0;
          productStats[productId].units += item.quantity || 0;
        });
      });

      const topProductsList = Object.entries(productStats)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      setTopProducts(topProductsList);

      // Calculate route performance
      const routeStats: Record<string, { name: string; sales: number; shopIds: Set<string> }> = {};
      
      routes?.forEach(route => {
        routeStats[route.id] = { name: route.name, sales: 0, shopIds: new Set() };
      });

      orders?.forEach(order => {
        const shop = shops?.find(s => s.id === order.shop_id);
        if (shop && routeStats[shop.route_id]) {
          routeStats[shop.route_id].sales += order.total_amount || 0;
          routeStats[shop.route_id].shopIds.add(order.shop_id);
        }
      });

      const routePerformanceList = Object.entries(routeStats)
        .map(([id, data]) => ({
          id,
          name: data.name,
          sales: data.sales,
          shops: data.shopIds.size,
        }))
        .filter(r => r.sales > 0)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 4);

      setRoutePerformance(routePerformanceList);
      setLastUpdated(new Date());
    } catch (error: any) {
      toast.error('Failed to load report data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and realtime subscriptions
  useEffect(() => {
    fetchReportData();

    // Set up realtime subscriptions
    const ordersChannel = supabase
      .channel('reports-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchReportData();
        }
      )
      .subscribe();

    const orderItemsChannel = supabase
      .channel('reports-order-items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          fetchReportData();
        }
      )
      .subscribe();

    const returnsChannel = supabase
      .channel('reports-returns')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'returns' },
        () => {
          fetchReportData();
        }
      )
      .subscribe();

    const shopsChannel = supabase
      .channel('reports-shops')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shops' },
        () => {
          fetchReportData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(orderItemsChannel);
      supabase.removeChannel(returnsChannel);
      supabase.removeChannel(shopsChannel);
    };
  }, [dateRange]);

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const collectionRate = stats.totalRevenue > 0 
    ? (stats.cashCollected / stats.totalRevenue) * 100 
    : 0;
    
  const completionRate = stats.totalOrders > 0 
    ? (stats.deliveredOrders / stats.totalOrders) * 100 
    : 0;
    
  const returnRate = stats.totalOrders > 0 
    ? (stats.totalReturns / stats.totalOrders) * 100 
    : 0;

  const maxSales = Math.max(...dailySales.map((d) => d.sales), 1);

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
            <h1 className="page-title">Reports & Analytics</h1>
            <p className="page-subtitle flex items-center gap-2">
              <Wifi className="h-4 w-4 text-success animate-pulse" />
              Live data • Last updated: {format(lastUpdated, 'HH:mm:ss')}
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => fetchReportData()}
              className="btn-ghost"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="flex rounded-lg bg-muted p-1">
              {['week', 'month', 'year'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                    dateRange === range
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <button className="btn-secondary">
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          trend={{ value: collectionRate, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders.toString()}
          icon={ShoppingCart}
          trend={{ value: completionRate, isPositive: true }}
          variant="accent"
        />
        <StatCard
          title="Active Shops"
          value={stats.activeShops.toString()}
          icon={Store}
          variant="default"
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(stats.avgOrderValue)}
          icon={TrendingUp}
          variant="default"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sales Overview (Last 7 Days)</h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            {dailySales.length > 0 ? (
              dailySales.map((data) => (
                <div key={data.date} className="flex items-center gap-4">
                  <span className="w-10 text-sm text-muted-foreground">{data.day}</span>
                  <div className="flex-1">
                    <div className="h-8 rounded-lg bg-muted overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-lg transition-all duration-500"
                        style={{ width: `${(data.sales / maxSales) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <span className="text-sm font-medium">{formatCurrency(data.sales)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({data.orders})</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No sales data for this period</p>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top Selling Products</h3>
            <span className="text-sm text-muted-foreground">By Revenue</span>
          </div>
          <div className="space-y-4">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                        index === 0
                          ? 'bg-warning/20 text-warning'
                          : index === 1
                          ? 'bg-muted-foreground/20 text-muted-foreground'
                          : index === 2
                          ? 'bg-warning/10 text-warning/80'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.units} units sold
                      </p>
                    </div>
                  </div>
                  <span className="font-medium text-success">
                    {formatCurrency(product.sales)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No product data for this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Route Performance */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Route Performance</h3>
          <span className="text-sm text-muted-foreground capitalize">This {dateRange}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {routePerformance.length > 0 ? (
            routePerformance.map((route) => (
              <div
                key={route.id}
                className="rounded-lg border border-border p-4 hover:border-accent/50 transition-colors"
              >
                <p className="font-medium text-foreground">{route.name}</p>
                <p className="mt-2 text-2xl font-bold text-accent">
                  {formatCurrency(route.sales)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {route.shops} active shops
                </p>
              </div>
            ))
          ) : (
            <p className="col-span-4 text-center text-muted-foreground py-8">No route data for this period</p>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Collection Rate</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--success))"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${collectionRate * 2.51} ${100 * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{collectionRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {formatCurrency(stats.cashCollected)} of {formatCurrency(stats.totalRevenue)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Order Completion</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${completionRate * 2.51} ${100 * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{completionRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {stats.deliveredOrders} of {stats.totalOrders} orders delivered
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Return Rate</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--warning))"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${returnRate * 2.51} ${100 * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{returnRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {stats.totalReturns} returns from {stats.totalOrders} orders
          </p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
