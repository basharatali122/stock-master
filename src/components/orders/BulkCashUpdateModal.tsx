import React, { memo, useState, useMemo, useCallback } from 'react';
import { X, Loader2, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Order {
  id: string;
  order_number: string;
  shop_id: string;
  booker_id: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_status: string;
  shops?: { name: string };
}

interface BulkCashUpdateModalProps {
  orders: Order[];
  onClose: () => void;
  onSuccess: () => void;
}

const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

export const BulkCashUpdateModal = memo(({ orders, onClose, onSuccess }: BulkCashUpdateModalProps) => {
  // Filter orders that are not fully paid yet
  const unpaidOrders = useMemo(() => 
    orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled'),
    [orders]
  );

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set(unpaidOrders.map(o => o.id)));
  const [submitting, setSubmitting] = useState(false);

  // Selection state: all, none, or some
  const selectionState = useMemo(() => {
    if (selectedOrders.size === 0) return 'none';
    if (selectedOrders.size === unpaidOrders.length) return 'all';
    return 'some';
  }, [selectedOrders.size, unpaidOrders.length]);

  const toggleSelectAll = useCallback(() => {
    if (selectionState === 'all') {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(unpaidOrders.map(o => o.id)));
    }
  }, [selectionState, unpaidOrders]);

  const toggleOrder = useCallback((orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  // Calculate totals for selected orders
  const selectedStats = useMemo(() => {
    const selected = unpaidOrders.filter(o => selectedOrders.has(o.id));
    const totalAmount = selected.reduce((sum, o) => sum + o.total_amount, 0);
    const totalPaid = selected.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    const totalPending = totalAmount - totalPaid;
    return { count: selected.length, totalAmount, totalPaid, totalPending };
  }, [unpaidOrders, selectedOrders]);

  const handleBulkUpdate = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Please select at least one order');
      return;
    }

    setSubmitting(true);
    try {
      const selectedOrdersList = unpaidOrders.filter(o => selectedOrders.has(o.id));
      
      // Group orders by shop to batch credit balance updates
      const shopCreditUpdates = new Map<string, number>();
      
      // Get current user for payment history tracking
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update each order - set as fully paid and delivered
      for (const order of selectedOrdersList) {
        const previousPaid = order.paid_amount || 0;
        const pendingAmount = order.total_amount - previousPaid;
        
        // If pending amount is less than 1 PKR, ignore it (consider fully paid)
        // Otherwise, set paid_amount to total_amount
        const finalPaidAmount = pendingAmount < 1 ? previousPaid : order.total_amount;
        const creditChange = finalPaidAmount - previousPaid;
        
        const { error } = await supabase
          .from('orders')
          .update({
            paid_amount: finalPaidAmount,
            payment_status: 'paid',
            status: 'delivered', // Auto-set to delivered when cash paid
            payment_received_at: new Date().toISOString(), // Add payment date
            payment_method: 'cash'
          })
          .eq('id', order.id);

        if (error) throw error;

        // Record payment in payment_history table if there was actual payment
        if (creditChange > 0) {
          const { error: historyError } = await supabase
            .from('payment_history')
            .insert({
              order_id: order.id,
              shop_id: order.shop_id,
              booker_id: order.booker_id || user?.id,
              amount: creditChange,
              payment_method: 'cash',
              paid_at: new Date().toISOString(),
              created_by: user?.id
            });

          if (historyError) {
            console.error('Failed to record payment history:', historyError);
            // Don't throw - payment history is supplementary
          }
        }

        // Track credit changes per shop
        if (creditChange > 0) {
          const currentChange = shopCreditUpdates.get(order.shop_id) || 0;
          shopCreditUpdates.set(order.shop_id, currentChange + creditChange);
        }
      }

      // Update shop credit balances
      for (const [shopId, creditChange] of shopCreditUpdates.entries()) {
        const { data: shop } = await supabase
          .from('shops')
          .select('credit_balance')
          .eq('id', shopId)
          .single();

        if (shop) {
          const newCreditBalance = Math.max(0, (shop.credit_balance || 0) - creditChange);
          await supabase
            .from('shops')
            .update({ credit_balance: newCreditBalance })
            .eq('id', shopId);
        }
      }

      toast.success(`${selectedOrdersList.length} orders marked as paid and delivered`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to update orders: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Bulk Cash Update</h2>
            <p className="text-sm text-muted-foreground">Mark multiple orders as paid and delivered</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {unpaidOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No unpaid orders found</p>
          </div>
        ) : (
          <>
            {/* Select All Header */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {selectionState === 'all' ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : selectionState === 'some' ? (
                  <MinusSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
                {selectionState === 'all' ? 'Deselect All' : 'Select All'}
              </button>
              <div className="text-sm text-muted-foreground">
                {selectedOrders.size} of {unpaidOrders.length} selected
              </div>
            </div>

            {/* Selected Stats */}
            {selectedOrders.size > 0 && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-muted/30 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Selected Orders</p>
                  <p className="text-lg font-bold">{selectedStats.count}</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedStats.totalAmount)}</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">To Collect</p>
                  <p className="text-lg font-bold text-warning">{formatCurrency(selectedStats.totalPending)}</p>
                </div>
              </div>
            )}

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[40vh]">
              {unpaidOrders.map((order) => {
                const pending = order.total_amount - (order.paid_amount || 0);
                const isSelected = selectedOrders.has(order.id);
                const ignoredAmount = pending < 1 && pending > 0;
                
                return (
                  <div
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-medium">{order.order_number}</span>
                          <span className="text-sm font-medium">{formatCurrency(order.total_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                          <span className="truncate">{order.shops?.name}</span>
                          <span className={`font-medium ${ignoredAmount ? 'text-success' : 'text-warning'}`}>
                            {ignoredAmount ? (
                              <span title="Amount less than Rs. 1 will be ignored">
                                Pending: {formatCurrency(pending)} (ignored)
                              </span>
                            ) : (
                              `Pending: ${formatCurrency(pending)}`
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info Note */}
            <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Orders will be marked as <span className="text-success font-medium">Paid</span> and 
                <span className="text-success font-medium"> Delivered</span>. 
                Pending amounts less than Rs. 1 will be ignored.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleBulkUpdate} 
                className="btn-primary" 
                disabled={submitting || selectedOrders.size === 0}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Update {selectedOrders.size} Order{selectedOrders.size !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

BulkCashUpdateModal.displayName = 'BulkCashUpdateModal';
