import React, { memo, useState, useEffect } from 'react';
import { X, Loader2, CreditCard, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Shop {
  id: string;
  name: string;
  credit_balance: number;
}

interface PendingOrder {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  booker_id: string;
  booker_name?: string;
}

interface RecordPreviousCreditModalProps {
  shop: Shop;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPreviousCreditModal = memo(({ shop, onClose, onSuccess }: RecordPreviousCreditModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPendingOrders();
  }, [shop.id]);

  const fetchPendingOrders = async () => {
    try {
      // Fetch orders with pending payment for this shop
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          total_amount,
          paid_amount,
          booker_id
        `)
        .eq('shop_id', shop.id)
        .in('payment_status', ['credit', 'partial'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get booker names for the orders
      const bookerIds = [...new Set(orders?.map(o => o.booker_id) || [])];
      
      let bookerMap: Record<string, string> = {};
      if (bookerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', bookerIds);
        
        profiles?.forEach(p => {
          bookerMap[p.user_id] = p.full_name;
        });
      }

      const ordersWithBookers = orders?.map(order => ({
        ...order,
        booker_name: bookerMap[order.booker_id] || 'Unknown'
      })) || [];

      setPendingOrders(ordersWithBookers);
    } catch (error: any) {
      toast.error('Failed to load pending orders: ' + error.message);
    } finally {
      setLoadingOrders(false);
    }
  };

  const selectedOrder = pendingOrders.find(o => o.id === selectedOrderId);
  const remainingBalance = selectedOrder 
    ? (selectedOrder.total_amount || 0) - (selectedOrder.paid_amount || 0) 
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amountNum > 10000000) {
      toast.error('Amount cannot exceed Rs. 10,000,000');
      return;
    }

    if (!selectedOrderId) {
      toast.error('Please select an order to link this payment');
      return;
    }

    if (amountNum > remainingBalance) {
      toast.error(`Amount cannot exceed remaining balance of Rs. ${remainingBalance.toLocaleString()}`);
      return;
    }

    setSubmitting(true);
    try {
      // Get the selected order details
      const order = pendingOrders.find(o => o.id === selectedOrderId);
      if (!order) throw new Error('Order not found');

      const newPaidAmount = (order.paid_amount || 0) + amountNum;
      const newPaymentStatus = newPaidAmount >= order.total_amount ? 'cash' : 'partial';

      // Update order with new payment
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
          payment_received_at: new Date().toISOString(),
          payment_method: 'previous_credit'
        })
        .eq('id', selectedOrderId);

      if (orderError) throw orderError;

      // Update shop credit balance (reduce it since payment is being recorded)
      const newBalance = Math.max(0, (shop.credit_balance || 0) - amountNum);
      
      const { error: shopError } = await supabase
        .from('shops')
        .update({ credit_balance: newBalance })
        .eq('id', shop.id);

      if (shopError) throw shopError;

      // Update booker financials - add to cash collected
      const { data: existingFinancials } = await supabase
        .from('booker_financials')
        .select('*')
        .eq('booker_id', order.booker_id)
        .maybeSingle();

      if (existingFinancials) {
        await supabase
          .from('booker_financials')
          .update({
            total_cash_collected: (existingFinancials.total_cash_collected || 0) + amountNum,
            total_credit_pending: Math.max(0, (existingFinancials.total_credit_pending || 0) - amountNum)
          })
          .eq('booker_id', order.booker_id);
      } else {
        await supabase
          .from('booker_financials')
          .insert({
            booker_id: order.booker_id,
            total_cash_collected: amountNum,
            total_credit_pending: 0
          });
      }

      toast.success(`Rs. ${amountNum.toLocaleString()} payment recorded for ${shop.name}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to record payment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = pendingOrders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    return order.order_number.toLowerCase().includes(searchLower) ||
           order.booker_name?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Record Previous Credit</h2>
            <p className="text-sm text-muted-foreground">{shop.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <p className="text-sm text-muted-foreground">Current Credit Balance</p>
          <p className="text-xl font-bold text-warning">Rs. {(shop.credit_balance || 0).toLocaleString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Selection */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Select Order to Link Payment *</label>
            
            {loadingOrders ? (
              <div className="flex items-center gap-2 text-muted-foreground p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading pending orders...
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="bg-muted/50 rounded-lg p-4 text-center text-muted-foreground">
                <p>No pending orders found for this shop</p>
                <p className="text-xs mt-1">All orders are already paid</p>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by order number or booker..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-10 text-sm"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                  {filteredOrders.map((order) => {
                    const remaining = (order.total_amount || 0) - (order.paid_amount || 0);
                    const isSelected = selectedOrderId === order.id;
                    
                    return (
                      <label
                        key={order.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b border-border last:border-b-0 ${
                          isSelected ? 'bg-primary/10' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="order"
                          value={order.id}
                          checked={isSelected}
                          onChange={() => setSelectedOrderId(order.id)}
                          className="h-4 w-4 text-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-medium">{order.order_number}</span>
                            <span className="text-sm font-bold text-warning">
                              Rs. {remaining.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                            <span className="truncate">Booker: {order.booker_name}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Selected Order Info */}
          {selectedOrder && (
            <div className="bg-primary/5 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Selected Order Details</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Order:</span>{' '}
                  <span className="font-medium">{selectedOrder.order_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Booker:</span>{' '}
                  <span className="font-medium">{selectedOrder.booker_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>{' '}
                  <span className="font-medium">Rs. {selectedOrder.total_amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Remaining:</span>{' '}
                  <span className="font-medium text-warning">Rs. {remainingBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Payment Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs.</span>
              <input
                type="number"
                className="input-field pl-10"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max={remainingBalance || 10000000}
                step="1"
                disabled={submitting || !selectedOrderId}
              />
            </div>
            {selectedOrder && (
              <p className="text-xs text-muted-foreground mt-1">
                Maximum: Rs. {remainingBalance.toLocaleString()}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description (Optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Cash collected on delivery"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              disabled={submitting}
            />
          </div>

          {/* New Balance Preview */}
          {amount && parseFloat(amount) > 0 && selectedOrder && (
            <div className="bg-success/10 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">After Recording Payment</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <p className="text-xs text-muted-foreground">New Shop Balance</p>
                  <p className="text-lg font-bold text-success">
                    Rs. {Math.max(0, (shop.credit_balance || 0) - parseFloat(amount)).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Remaining</p>
                  <p className="text-lg font-bold text-primary">
                    Rs. {Math.max(0, remainingBalance - parseFloat(amount)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting || !amount || !selectedOrderId || pendingOrders.length === 0}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

RecordPreviousCreditModal.displayName = 'RecordPreviousCreditModal';
