import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_applied: number;
  total_price: number;
  products?: { name: string; product_code: string | null; price?: number };
}

interface Order {
  id: string;
  order_number: string;
  shop_id: string;
  booker_id: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  shops?: { name: string; address?: string; phone?: string; routes?: { name: string } };
  booker_name?: string;
  order_items?: OrderItem[];
}

interface Shop {
  id: string;
  name: string;
  address?: string;
  shop_code?: string;
  route_id: string;
  credit_balance: number;
  routes?: { name: string };
}

interface Product {
  id: string;
  name: string;
  product_code: string | null;
  price: number;
  discount_percentage: number;
  stock_quantity: number;
  boxes_per_carton: number;
}

// Date range for fetching orders
interface DateRange {
  start?: Date;
  end?: Date;
  pendingCreditsOnly?: boolean;
}

export function useOrders(isAdmin: boolean, userId: string | undefined, dateRange?: DateRange) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [allShops, setAllShops] = useState<Shop[]>([]); // All shops for admin
  const [products, setProducts] = useState<Product[]>([]);
  const [bookers, setBookers] = useState<{ user_id: string; full_name: string }[]>([]); // All bookers for admin
  const [loading, setLoading] = useState(true);
  const bookerCacheRef = useRef<Map<string, string>>(new Map());

  const fetchData = useCallback(async () => {
    try {
      // Get current day of week (e.g., "Monday", "Tuesday", etc.)
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = days[new Date().getDay()];

      // Get today's date range for order bookers (they only see today's orders)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Build orders query with optimized field selection
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id, order_number, shop_id, booker_id, total_amount, paid_amount, status, payment_status, created_at,
          shops!inner(name, address, phone, routes(name)),
          order_items(id, product_id, quantity, unit_price, discount_applied, total_price, products(name, product_code, price))
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin && userId) {
        // Order bookers can only see today's orders
        ordersQuery = ordersQuery
          .eq('booker_id', userId)
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString())
          .limit(100);
      } else if (isAdmin) {
        // Admin: handle different filter modes
        if (dateRange?.pendingCreditsOnly) {
          // Pending credits: fetch all orders with unpaid balance (no date limit)
          ordersQuery = ordersQuery
            .in('payment_status', ['credit', 'partial'])
            .neq('status', 'cancelled');
        } else if (dateRange?.start && dateRange?.end) {
          ordersQuery = ordersQuery
            .gte('created_at', dateRange.start.toISOString())
            .lte('created_at', dateRange.end.toISOString());
        } else if (dateRange?.start) {
          // Single date - entire day
          const dayEnd = new Date(dateRange.start);
          dayEnd.setHours(23, 59, 59, 999);
          ordersQuery = ordersQuery
            .gte('created_at', dateRange.start.toISOString())
            .lte('created_at', dayEnd.toISOString());
        } else {
          // All time - no date filter, but limit for performance
          ordersQuery = ordersQuery.limit(2000);
        }
      }

      // Core queries - run in parallel for maximum performance
      const [ordersResult, shopsResult, productsResult] = await Promise.all([
        ordersQuery,
        // Fetch shops from active routes that have today as an active day
        supabase
          .from('shops')
          .select('id, name, address, shop_code, route_id, credit_balance, routes!inner(name, is_active, active_days)')
          .eq('routes.is_active', true)
          .contains('routes.active_days', [today])
          .order('name')
          .limit(500),
        // Fetch only active products with needed fields
        supabase
          .from('products')
          .select('id, name, product_code, price, discount_percentage, stock_quantity, boxes_per_carton')
          .eq('is_active', true)
          .gt('stock_quantity', 0) // Only products in stock
          .order('name')
          .limit(500)
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (shopsResult.error) throw shopsResult.error;
      if (productsResult.error) throw productsResult.error;

      // For admin, also fetch all shops and all bookers
      if (isAdmin) {
        const [allShopsResult, bookersResult] = await Promise.all([
          supabase
            .from('shops')
            .select('id, name, address, shop_code, route_id, credit_balance, routes(name)')
            .order('name'),
          supabase
            .from('profiles')
            .select('user_id, full_name')
            .eq('status', 'approved')
            .order('full_name')
        ]);

        if (!allShopsResult.error && allShopsResult.data) {
          setAllShops(allShopsResult.data);
        }
        if (!bookersResult.error && bookersResult.data) {
          setBookers(bookersResult.data);
        }
      }

      const ordersData = ordersResult.data || [];
      
      // Get unique booker IDs that we don't have cached
      const uniqueBookerIds = [...new Set(ordersData.map(o => o.booker_id))] as string[];
      const uncachedIds = uniqueBookerIds.filter(id => !bookerCacheRef.current.has(id));

      // Batch fetch booker profiles (single query instead of N queries)
      if (uncachedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uncachedIds);

        profiles?.forEach(profile => {
          bookerCacheRef.current.set(profile.user_id, profile.full_name);
        });
      }

      // Map booker names from cache
      const ordersWithBookers = ordersData.map(order => ({
        ...order,
        booker_name: bookerCacheRef.current.get(order.booker_id) || 'N/A'
      }));

      setOrders(ordersWithBookers);
      setShops(shopsResult.data || []);
      setProducts(productsResult.data || []);
    } catch (error: any) {
      toast.error('Failed to load orders: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userId, dateRange?.start?.getTime(), dateRange?.end?.getTime(), dateRange?.pendingCreditsOnly]);

  // Smart update for realtime changes - orders
  const handleRealtimeUpdate = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      // Fetch the full order with relations
      fetchSingleOrder(newRecord.id).then(order => {
        if (order) {
          setOrders(prev => [order, ...prev]);
        }
      });
    } else if (eventType === 'UPDATE') {
      setOrders(prev => prev.map(order => 
        order.id === newRecord.id 
          ? { ...order, ...newRecord }
          : order
      ));
    } else if (eventType === 'DELETE') {
      setOrders(prev => prev.filter(order => order.id !== oldRecord.id));
    }
  }, []);

  // Smart update for realtime changes - shops (for credit balance updates)
  const handleShopRealtimeUpdate = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'UPDATE') {
      // Update shops list with all relevant fields
      setShops(prev => prev.map(shop => 
        shop.id === newRecord.id 
          ? { 
              ...shop, 
              credit_balance: newRecord.credit_balance,
              name: newRecord.name,
              address: newRecord.address,
              shop_code: newRecord.shop_code
            }
          : shop
      ));
      // Update allShops list for admin with all relevant fields
      setAllShops(prev => prev.map(shop => 
        shop.id === newRecord.id 
          ? { 
              ...shop, 
              credit_balance: newRecord.credit_balance,
              name: newRecord.name,
              address: newRecord.address,
              shop_code: newRecord.shop_code
            }
          : shop
      ));
    } else if (eventType === 'INSERT') {
      // Refetch to get full shop data with relations
      fetchData();
    } else if (eventType === 'DELETE') {
      setShops(prev => prev.filter(shop => shop.id !== oldRecord.id));
      setAllShops(prev => prev.filter(shop => shop.id !== oldRecord.id));
    }
  }, [fetchData]);

  const fetchSingleOrder = async (orderId: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        shops(name, address, phone, routes(name)),
        order_items(*, products(name, product_code, price))
      `)
      .eq('id', orderId)
      .single();

    if (error || !data) return null;

    // Get booker name
    let bookerName = bookerCacheRef.current.get(data.booker_id);
    if (!bookerName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', data.booker_id)
        .single();
      bookerName = profile?.full_name || 'N/A';
      bookerCacheRef.current.set(data.booker_id, bookerName);
    }

    return { ...data, booker_name: bookerName };
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Optimized realtime subscription for orders
  useEffect(() => {
    const ordersChannel = supabase
      .channel('orders-optimized')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        handleRealtimeUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [handleRealtimeUpdate]);

  // Realtime subscription for shops (credit balance updates)
  useEffect(() => {
    const shopsChannel = supabase
      .channel('shops-credit-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shops'
        },
        handleShopRealtimeUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shopsChannel);
    };
  }, [handleShopRealtimeUpdate]);

  return {
    orders,
    shops,
    allShops,
    products,
    bookers,
    loading,
    refetch: fetchData,
    setOrders
  };
}

export function useOrderFilters(orders: Order[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');

  // Memoize search lowercase to avoid recalculating
  const searchLower = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

  const filteredOrders = useMemo(() => {
    // Early return if no filters
    if (!searchQuery && paymentFilter === 'All') {
      return orders;
    }

    return orders.filter((order) => {
      // Payment filter check first (faster)
      if (paymentFilter !== 'All' && order.payment_status?.toLowerCase() !== paymentFilter.toLowerCase()) {
        return false;
      }
      
      // Search filter (more expensive)
      if (searchQuery) {
        const matchesSearch = 
          order.order_number.toLowerCase().includes(searchLower) ||
          order.shops?.name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [orders, searchLower, paymentFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalSales = orders.reduce((acc, order) => acc + (order.total_amount || 0), 0);
    const totalPaid = orders.reduce((acc, order) => acc + (order.paid_amount || 0), 0);
    const totalCredit = totalSales - totalPaid;
    return { totalSales, totalPaid, totalCredit, totalOrders: orders.length };
  }, [orders]);

  return {
    searchQuery,
    setSearchQuery,
    paymentFilter,
    setPaymentFilter,
    filteredOrders,
    stats
  };
}
