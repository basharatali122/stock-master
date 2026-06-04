import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/ui/StatCard';
import BrandStockReport from '@/components/reports/BrandStockReport';
import ProductSaleSummary from '@/components/reports/ProductSaleSummary';
import { Calendar, Download, TrendingUp, DollarSign, ShoppingCart, Store, BarChart3, Loader2, RefreshCw, Wifi, Package, Percent, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';
import { formatCartonDecimal } from '@/lib/print';

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

interface BookerDiscount {
  booker_id: string;
  booker_name: string;
  total_discount: number;
  discount_count: number;
}

interface BookerCartonStat {
  booker_id: string;
  booker_name: string;
  total_boxes: number;
  cartons: number;
  remainder_boxes: number;
  avg_bpc: number;
  orders: number;
  percent: number;
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
  const [bookerDiscounts, setBookerDiscounts] = useState<BookerDiscount[]>([]);
  const [bookerCartons, setBookerCartons] = useState<BookerCartonStat[]>([]);

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

      // Fetch discount history for bookers (current month)
      const monthStart = startOfMonth(new Date()).toISOString();
      const { data: discountData, error: discountError } = await supabase
        .from('discount_history')
        .select('booker_id, discount_value')
        .gte('created_at', monthStart);

      if (!discountError && discountData) {
        // Get unique booker IDs
        const bookerIds = [...new Set(discountData.map(d => d.booker_id))];
        
        // Fetch booker names
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', bookerIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        // Aggregate discounts by booker
        const discountsByBooker = new Map<string, { total: number; count: number }>();
        discountData.forEach(d => {
          const existing = discountsByBooker.get(d.booker_id) || { total: 0, count: 0 };
          existing.total += d.discount_value || 0;
          existing.count += 1;
          discountsByBooker.set(d.booker_id, existing);
        });

        const bookerDiscountList: BookerDiscount[] = Array.from(discountsByBooker.entries())
          .map(([id, data]) => ({
            booker_id: id,
            booker_name: profileMap.get(id) || 'Unknown',
            total_discount: data.total,
            discount_count: data.count,
          }))
          .sort((a, b) => b.total_discount - a.total_discount);

        setBookerDiscounts(bookerDiscountList);
      }

      // Monthly Booker Cartons/Boxes Sold (current month, regardless of selected range)
      try {
        const monthStart2 = startOfMonth(new Date()).toISOString();
        const { data: monthOrders } = await supabase
          .from('orders')
          .select('id, booker_id, order_items(quantity, product_id, products(boxes_per_carton))')
          .gte('created_at', monthStart2)
          .neq('status', 'cancelled');

        if (monthOrders && monthOrders.length) {
          const bookerIds2 = [...new Set(monthOrders.map((o: any) => o.booker_id).filter(Boolean))];
          const { data: bookerProfiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', bookerIds2);
          const nameMap = new Map(bookerProfiles?.map(p => [p.user_id, p.full_name]) || []);

          const agg = new Map<string, { boxes: number; orders: number; bpcSum: number; bpcCount: number }>();
          let grandBoxes = 0;
          monthOrders.forEach((o: any) => {
            const bid = o.booker_id || 'unknown';
            const existing = agg.get(bid) || { boxes: 0, orders: 0, bpcSum: 0, bpcCount: 0 };
            existing.orders += 1;
            (o.order_items || []).forEach((it: any) => {
              const qty = it.quantity || 0;
              existing.boxes += qty;
              grandBoxes += qty;
              const bpc = it.products?.boxes_per_carton || 24;
              existing.bpcSum += bpc;
              existing.bpcCount += 1;
            });
            agg.set(bid, existing);
          });

          const list: BookerCartonStat[] = Array.from(agg.entries()).map(([id, d]) => {
            const avgBpc = d.bpcCount > 0 ? Math.round(d.bpcSum / d.bpcCount) : 24;
            return {
              booker_id: id,
              booker_name: nameMap.get(id) || 'Unknown',
              total_boxes: d.boxes,
              cartons: Math.floor(d.boxes / avgBpc),
              remainder_boxes: d.boxes % avgBpc,
              avg_bpc: avgBpc,
              orders: d.orders,
              percent: grandBoxes > 0 ? (d.boxes / grandBoxes) * 100 : 0,
            };
          }).sort((a, b) => b.total_boxes - a.total_boxes);

          setBookerCartons(list);
        } else {
          setBookerCartons([]);
        }
      } catch (e) {
        // non-fatal
      }

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

      {/* Monthly Discount Report by Booker */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Percent className="h-5 w-5 text-warning" />
            <h3 className="text-lg font-semibold">Monthly Discounts by Booker</h3>
          </div>
          <span className="text-sm text-muted-foreground">Current Month</span>
        </div>
        
        {bookerDiscounts.length > 0 ? (
          <div className="space-y-3">
            {bookerDiscounts.map((booker, index) => (
              <div
                key={booker.booker_id}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
                    <User className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">{booker.booker_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {booker.discount_count} discount{booker.discount_count !== 1 ? 's' : ''} given
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-warning">
                    {formatCurrency(booker.total_discount)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total discounts</p>
                </div>
              </div>
            ))}
            
            <div className="border-t border-border pt-3 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Monthly Discounts</span>
                <span className="font-bold text-lg text-warning">
                  {formatCurrency(bookerDiscounts.reduce((sum, b) => sum + b.total_discount, 0))}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No discounts recorded this month</p>
        )}
      </div>

      {/* Monthly Booker Cartons / Boxes Sold */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Monthly Cartons / Boxes Sold by Booker</h3>
          </div>
          <span className="text-sm text-muted-foreground">Current Month</span>
        </div>

        {bookerCartons.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Order Booker</th>
                  <th className="py-2 pr-4 text-center">Orders</th>
                  <th className="py-2 pr-4 text-center">Cartons (Ctn.Box)</th>
                  <th className="py-2 pr-4 text-center">Boxes</th>
                  <th className="py-2 pr-4 text-center">Total Boxes</th>
                  <th className="py-2 pr-4 text-right">% Share</th>
                </tr>
              </thead>
              <tbody>
                {bookerCartons.map(b => (
                  <tr key={b.booker_id} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">{b.booker_name}</td>
                    <td className="py-3 pr-4 text-center">{b.orders}</td>
                    <td className="py-3 pr-4 text-center font-semibold text-primary">{formatCartonDecimal(b.total_boxes, b.avg_bpc)}</td>
                    <td className="py-3 pr-4 text-center">{b.remainder_boxes}</td>
                    <td className="py-3 pr-4 text-center">{b.total_boxes}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{b.percent.toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="font-bold bg-muted/50">
                  <td className="py-3 pr-4">Grand Total</td>
                  <td className="py-3 pr-4 text-center">{bookerCartons.reduce((s, b) => s + b.orders, 0)}</td>
                  <td className="py-3 pr-4 text-center">{(() => {
                    const totalBoxes = bookerCartons.reduce((s, b) => s + b.total_boxes, 0);
                    const avgBpc = bookerCartons.length > 0 ? Math.round(bookerCartons.reduce((s, b) => s + b.avg_bpc, 0) / bookerCartons.length) : 24;
                    return formatCartonDecimal(totalBoxes, avgBpc);
                  })()}</td>
                  <td className="py-3 pr-4 text-center">{bookerCartons.reduce((s, b) => s + b.remainder_boxes, 0)}</td>
                  <td className="py-3 pr-4 text-center">{bookerCartons.reduce((s, b) => s + b.total_boxes, 0)}</td>
                  <td className="py-3 pr-4 text-right">100.00%</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3">
              * Cartons shown in decimal form (e.g. 1.27 = 1 full carton + ~5 boxes if pack is 18). Calculated using each product's own boxes-per-carton (averaged where products differ).
            </p>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No orders recorded this month</p>
        )}
      </div>



      {/* Product Sale Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold">Product Sale Summary</h3>
          </div>
          <span className="text-sm text-muted-foreground">By Pack Type & Price</span>
        </div>
        <ProductSaleSummary />
      </div>

      {/* Brand-wise Stock Report */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Brand-wise Stock Report</h3>
          </div>
          <span className="text-sm text-muted-foreground">With Value</span>
        </div>
        <BrandStockReport />
      </div>
    </div>
  );
};

export default Reports;
