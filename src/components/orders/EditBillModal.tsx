import React, { memo, useState, useEffect, useMemo } from 'react';
import { X, Loader2, Plus, Minus, Trash2, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_applied: number;
  total_price: number;
  products?: { name: string; product_code: string | null };
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

interface Product {
  id: string;
  name: string;
  product_code: string | null;
  price: number;
  discount_percentage: number;
  stock_quantity: number;
}

interface EditBillModalProps {
  order: Order;
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

export const EditBillModal = memo(({ order, products, onClose, onSuccess }: EditBillModalProps) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (order.order_items) {
      setItems([...order.order_items]);
      setOriginalItems([...order.order_items]);
    }
  }, [order]);

  const updateQuantity = (itemId: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        const newTotal = item.unit_price * newQty * (1 - (item.discount_applied || 0) / 100);
        return { ...item, quantity: newQty, total_price: newTotal };
      }
      return item;
    }));
  };

  const setQuantity = (itemId: string, qty: number) => {
    const newQty = Math.max(0, qty);
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newTotal = item.unit_price * newQty * (1 - (item.discount_applied || 0) / 100);
        return { ...item, quantity: newQty, total_price: newTotal };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const newTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  }, [items]);

  const hasChanges = useMemo(() => {
    if (items.length !== originalItems.length) return true;
    return items.some(item => {
      const orig = originalItems.find(o => o.id === item.id);
      return !orig || orig.quantity !== item.quantity;
    });
  }, [items, originalItems]);

  const getStockChange = (itemId: string) => {
    const current = items.find(i => i.id === itemId);
    const original = originalItems.find(i => i.id === itemId);
    if (!current || !original) return 0;
    return original.quantity - current.quantity; // positive = stock restored, negative = stock reduced
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      // Calculate stock changes and update items
      const stockUpdates: { productId: string; delta: number }[] = [];
      
      // Calculate the reduction in order total (for discount adjustment)
      const originalTotal = order.total_amount;
      
      // Process each item
      for (const item of items) {
        const original = originalItems.find(o => o.id === item.id);
        
        if (item.quantity === 0) {
          // Item removed - restore stock
          if (original) {
            stockUpdates.push({ productId: item.product_id, delta: original.quantity });
          }
          // Delete the order item
          const { error } = await supabase
            .from('order_items')
            .delete()
            .eq('id', item.id);
          if (error) throw error;
        } else if (original && original.quantity !== item.quantity) {
          // Quantity changed - update stock
          const delta = original.quantity - item.quantity;
          stockUpdates.push({ productId: item.product_id, delta });
          
          // Update the order item
          const { error } = await supabase
            .from('order_items')
            .update({
              quantity: item.quantity,
              total_price: item.total_price
            })
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      // Handle removed items (items in original but not in current)
      for (const origItem of originalItems) {
        const stillExists = items.find(i => i.id === origItem.id);
        if (!stillExists) {
          stockUpdates.push({ productId: origItem.product_id, delta: origItem.quantity });
          const { error } = await supabase
            .from('order_items')
            .delete()
            .eq('id', origItem.id);
          if (error) throw error;
        }
      }

      // Update stock quantities
      for (const update of stockUpdates) {
        const product = products.find(p => p.id === update.productId);
        if (product) {
          const { error } = await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity + update.delta })
            .eq('id', update.productId);
          if (error) {
            console.error('Failed to update stock:', error);
          }
        }
      }

      // Calculate credit balance change
      const oldTotal = order.total_amount;
      const creditDelta = oldTotal - newTotal;

      // If order total decreased, adjust booker's discount proportionally
      if (creditDelta > 0) {
        // Get total discounts given on this order
        const { data: discountRecords } = await supabase
          .from('discount_history')
          .select('id, discount_value, original_amount')
          .eq('order_id', order.id);

        if (discountRecords && discountRecords.length > 0) {
          // Calculate proportion of reduction
          const reductionRatio = creditDelta / originalTotal;
          const discountToDeduct = discountRecords.reduce((sum, record) => {
            return sum + (record.discount_value * reductionRatio);
          }, 0);

          if (discountToDeduct > 0) {
            // Update booker financials - deduct proportional discount
            const { data: bookerFinancials } = await supabase
              .from('booker_financials')
              .select('id, total_discounts_given')
              .eq('booker_id', order.booker_id)
              .maybeSingle();

            if (bookerFinancials) {
              await supabase
                .from('booker_financials')
                .update({
                  total_discounts_given: Math.max(0, (bookerFinancials.total_discounts_given || 0) - discountToDeduct),
                })
                .eq('id', bookerFinancials.id);
            }

            // Update discount history records to reflect reduced discount
            for (const record of discountRecords) {
              const newDiscountValue = Math.max(0, record.discount_value - (record.discount_value * reductionRatio));
              await supabase
                .from('discount_history')
                .update({
                  discount_value: newDiscountValue,
                  discounted_amount: newTotal,
                })
                .eq('id', record.id);
            }
          }
        }
      }

      // Update order total
      const { error: orderError } = await supabase
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', order.id);
      if (orderError) throw orderError;

      // Update shop credit balance
      if (creditDelta !== 0) {
        const { data: shop } = await supabase
          .from('shops')
          .select('credit_balance')
          .eq('id', order.shop_id)
          .single();
        
        if (shop) {
          await supabase
            .from('shops')
            .update({ credit_balance: Math.max(0, (shop.credit_balance || 0) - creditDelta) })
            .eq('id', order.shop_id);
        }
      }

      toast.success('Bill updated successfully. Stock and discounts adjusted.');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to update bill: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Edit Bill - {order.order_number}</h2>
            <p className="text-sm text-muted-foreground">{order.shops?.name} • {order.shops?.routes?.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">Stock will be adjusted automatically</p>
              <p className="text-xs text-warning/80">Decreasing quantity will restore stock. Increasing will deduct from stock.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {items.filter(item => item.quantity > 0 || originalItems.find(o => o.id === item.id)).map((item) => {
            const product = products.find(p => p.id === item.product_id);
            const stockChange = getStockChange(item.id);
            
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.products?.product_code && (
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.products.product_code}
                      </span>
                    )}
                    <span className="font-medium text-sm truncate">{item.products?.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Rs. {item.unit_price.toLocaleString()} each • {item.discount_applied || 0}% discount
                  </div>
                  {product && (
                    <div className="flex items-center gap-1 mt-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Stock: {product.stock_quantity}
                        {stockChange !== 0 && (
                          <span className={stockChange > 0 ? 'text-success ml-1' : 'text-destructive ml-1'}>
                            ({stockChange > 0 ? '+' : ''}{stockChange})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="h-8 w-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center"
                    disabled={submitting}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                    className="w-16 text-center input-field py-1"
                    min="0"
                    disabled={submitting}
                  />
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="h-8 w-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center"
                    disabled={submitting}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-right min-w-[80px]">
                  <span className="font-medium">{formatCurrency(item.total_price)}</span>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Original Total:</span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
          <div className="flex justify-between font-medium text-lg">
            <span>New Total:</span>
            <span className={newTotal !== order.total_amount ? 'text-warning' : ''}>
              {formatCurrency(newTotal)}
            </span>
          </div>
          {newTotal !== order.total_amount && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Difference:</span>
              <span className={order.total_amount - newTotal > 0 ? 'text-success' : 'text-destructive'}>
                {order.total_amount - newTotal > 0 ? '-' : '+'}{formatCurrency(Math.abs(order.total_amount - newTotal))}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="btn-primary" 
            disabled={submitting || !hasChanges}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
});

EditBillModal.displayName = 'EditBillModal';
