import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Truck, Package, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SupplyStats {
  totalBookings: number;
  deliveredSameDay: number;
  deliveredNextDay: number;
  deliveredLater: number;
  pendingDelivery: number;
  cancelled: number;
  supplyRateNextDay: number;
  overallSupplyRate: number;
}

interface OrderDetail {
  id: string;
  order_number: string;
  shop_name: string;
  booker_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  delivery_days: number | null;
}

const BookingSupplyRate: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stats, setStats] = useState<SupplyStats>({
    totalBookings: 0,
    deliveredSameDay: 0,
    deliveredNextDay: 0,
    deliveredLater: 0,
    pendingDelivery: 0,
    cancelled: 0,
    supplyRateNextDay: 0,
    overallSupplyRate: 0,
  });
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSupplyData = async (date: Date) => {
    setLoading(true);
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

      // Fetch all orders created on the selected date
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          updated_at,
          shops (name),
          booker_id
        `)
        .gte('created_at', startOfDay)
        .lt('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (!orders || orders.length === 0) {
        setStats({
          totalBookings: 0,
          deliveredSameDay: 0,
          deliveredNextDay: 0,
          deliveredLater: 0,
          pendingDelivery: 0,
          cancelled: 0,
          supplyRateNextDay: 0,
          overallSupplyRate: 0,
        });
        setOrderDetails([]);
        setLoading(false);
        return;
      }

      // Fetch booker names
      const bookerIds = [...new Set(orders.map(o => o.booker_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', bookerIds);

      let deliveredSameDay = 0;
      let deliveredNextDay = 0;
      let deliveredLater = 0;
      let pendingDelivery = 0;
      let cancelled = 0;

      const orderDetailsData: OrderDetail[] = orders.map((order: any) => {
        const createdDate = new Date(order.created_at);
        const updatedDate = new Date(order.updated_at);
        const daysDiff = order.status === 'delivered' ? differenceInDays(updatedDate, createdDate) : null;

        if (order.status === 'delivered') {
          if (daysDiff === 0) deliveredSameDay++;
          else if (daysDiff === 1) deliveredNextDay++;
          else deliveredLater++;
        } else if (order.status === 'cancelled') {
          cancelled++;
        } else {
          pendingDelivery++;
        }

        return {
          id: order.id,
          order_number: order.order_number,
          shop_name: order.shops?.name || 'Unknown',
          booker_name: profiles?.find(p => p.user_id === order.booker_id)?.full_name || 'Unknown',
          total_amount: order.total_amount,
          status: order.status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          delivery_days: daysDiff,
        };
      });

      const totalBookings = orders.length;
      const totalDelivered = deliveredSameDay + deliveredNextDay + deliveredLater;
      const supplyRateNextDay = totalBookings > 0 
        ? Math.round(((deliveredSameDay + deliveredNextDay) / totalBookings) * 100) 
        : 0;
      const overallSupplyRate = totalBookings > 0 
        ? Math.round((totalDelivered / totalBookings) * 100) 
        : 0;

      setStats({
        totalBookings,
        deliveredSameDay,
        deliveredNextDay,
        deliveredLater,
        pendingDelivery,
        cancelled,
        supplyRateNextDay,
        overallSupplyRate,
      });
      setOrderDetails(orderDetailsData);
    } catch (error) {
      console.error('Error fetching supply data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplyData(selectedDate);
  }, [selectedDate]);

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const getStatusBadge = (status: string, deliveryDays: number | null) => {
    if (status === 'delivered') {
      if (deliveryDays === 0) return <span className="badge-success">Same Day</span>;
      if (deliveryDays === 1) return <span className="badge-success">Next Day</span>;
      return <span className="badge-info">{deliveryDays} Days</span>;
    }
    if (status === 'cancelled') return <span className="badge-destructive">Cancelled</span>;
    return <span className="badge-pending">Pending</span>;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Booking & Supply Rate</h2>
            <p className="text-sm text-muted-foreground">Track order fulfillment performance</p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <Package className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold text-foreground">{stats.totalBookings}</p>
              <p className="text-xs text-muted-foreground">Total Bookings</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-4 text-center">
              <CheckCircle className="h-5 w-5 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold text-green-500">{stats.deliveredSameDay}</p>
              <p className="text-xs text-muted-foreground">Same Day</p>
            </div>
            <div className="rounded-lg bg-accent/10 p-4 text-center">
              <Truck className="h-5 w-5 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-bold text-accent">{stats.deliveredNextDay}</p>
              <p className="text-xs text-muted-foreground">Next Day</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-blue-500">{stats.deliveredLater}</p>
              <p className="text-xs text-muted-foreground">Later</p>
            </div>
            <div className="rounded-lg bg-yellow-500/10 p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold text-yellow-500">{stats.pendingDelivery}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-4 text-center">
              <Package className="h-5 w-5 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold text-red-500">{stats.cancelled}</p>
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </div>
          </div>

          {/* Supply Rate Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Next Day Supply Rate</p>
                  <p className="text-3xl font-bold text-accent">{stats.supplyRateNextDay}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Orders delivered same day or next day
                  </p>
                </div>
                <div className="relative h-16 w-16">
                  <svg className="h-16 w-16 -rotate-90 transform">
                    <circle
                      className="text-muted/30"
                      strokeWidth="6"
                      stroke="currentColor"
                      fill="transparent"
                      r="28"
                      cx="32"
                      cy="32"
                    />
                    <circle
                      className="text-accent"
                      strokeWidth="6"
                      strokeDasharray={`${stats.supplyRateNextDay * 1.76} 176`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="28"
                      cx="32"
                      cy="32"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Supply Rate</p>
                  <p className="text-3xl font-bold text-primary">{stats.overallSupplyRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All delivered orders
                  </p>
                </div>
                <div className="relative h-16 w-16">
                  <svg className="h-16 w-16 -rotate-90 transform">
                    <circle
                      className="text-muted/30"
                      strokeWidth="6"
                      stroke="currentColor"
                      fill="transparent"
                      r="28"
                      cx="32"
                      cy="32"
                    />
                    <circle
                      className="text-primary"
                      strokeWidth="6"
                      strokeDasharray={`${stats.overallSupplyRate * 1.76} 176`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="28"
                      cx="32"
                      cy="32"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Order Details Table */}
          {orderDetails.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Order Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Order #</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Shop</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Booker</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Amount</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderDetails.slice(0, 10).map((order) => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{order.order_number}</td>
                        <td className="py-2 px-3">{order.shop_name}</td>
                        <td className="py-2 px-3">{order.booker_name}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(order.total_amount)}</td>
                        <td className="py-2 px-3 text-center">{getStatusBadge(order.status, order.delivery_days)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orderDetails.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center mt-3">
                    Showing 10 of {orderDetails.length} orders
                  </p>
                )}
              </div>
            </div>
          )}

          {stats.totalBookings === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No bookings found for {format(selectedDate, 'MMMM d, yyyy')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BookingSupplyRate;
