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
  products?: { name: string };
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
  shops?: { name: string; routes?: { name: string } };
  booker_name?: string;
  order_items?: OrderItem[];
}

interface Shop {
  id: string;
  name: string;
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

export function useOrders(isAdmin: boolean, userId: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const bookerCacheRef = useRef<Map<string, string>>(new Map());

  const fetchData = useCallback(async () => {
    try {
      // Batch all queries in parallel
      const [ordersResult, shopsResult, productsResult] = await Promise.all([
        // Fetch orders with relations
        (async () => {
          let query = supabase
            .from('orders')
            .select(`
              *,
              shops(name, routes(name)),
              order_items(*, products(name))
            `)
            .order('created_at', { ascending: false });

          if (!isAdmin && userId) {
            query = query.eq('booker_id', userId);
          }

          return query;
        })(),
        // Fetch shops
        supabase
          .from('shops')
          .select('id, name, route_id, credit_balance, routes(name)')
          .order('name'),
        // Fetch products
        supabase
          .from('products')
          .select('id, name, product_code, price, discount_percentage, stock_quantity, boxes_per_carton')
          .eq('is_active', true)
          .order('name')
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (shopsResult.error) throw shopsResult.error;
      if (productsResult.error) throw productsResult.error;

      const ordersData = ordersResult.data || [];
      
      // Get unique booker IDs that we don't have cached
      const uniqueBookerIds = [...new Set(ordersData.map(o => o.booker_id))];
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
  }, [isAdmin, userId]);

  // Smart update for realtime changes
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

  const fetchSingleOrder = async (orderId: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        shops(name, routes(name)),
        order_items(*, products(name))
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

  // Optimized realtime subscription
  useEffect(() => {
    const channel = supabase
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
      supabase.removeChannel(channel);
    };
  }, [handleRealtimeUpdate]);

  return {
    orders,
    shops,
    products,
    loading,
    refetch: fetchData,
    setOrders
  };
}

export function useOrderFilters(orders: Order[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');

  const filteredOrders = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !searchQuery ||
        order.order_number.toLowerCase().includes(searchLower) ||
        order.shops?.name?.toLowerCase().includes(searchLower);
      const matchesStatus =
        statusFilter === 'All' || order.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesPayment =
        paymentFilter === 'All' || order.payment_status?.toLowerCase() === paymentFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter]);

  const stats = useMemo(() => {
    const totalSales = orders.reduce((acc, order) => acc + (order.total_amount || 0), 0);
    const totalPaid = orders.reduce((acc, order) => acc + (order.paid_amount || 0), 0);
    const totalCredit = totalSales - totalPaid;
    return { totalSales, totalPaid, totalCredit, totalOrders: orders.length };
  }, [orders]);

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    filteredOrders,
    stats
  };
}
