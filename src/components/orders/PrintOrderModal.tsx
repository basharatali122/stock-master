import React, { memo, useState, useMemo, useEffect } from 'react';
import { X, Printer, Percent, Edit2, Save } from 'lucide-react';
import { printContent, formatCurrencyForPrint, getStatusBadgeClass, safeText, COMPANY_INFO } from '@/lib/print';
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

interface PrintOrderModalProps {
  order: Order;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

interface AdjustedItem {
  id: string;
  adjustedPrice: number;
  adjustedTotal: number;
}

export const PrintOrderModal = memo(({ order, onClose, onOrderUpdated }: PrintOrderModalProps) => {
  const [customDiscount, setCustomDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [adjustedItems, setAdjustedItems] = useState<Record<string, AdjustedItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize adjusted items
  // If the order has already been adjusted (unit_price differs from catalog price), use saved price
  // Otherwise, use original catalog price for new orders
  useEffect(() => {
    if (order.order_items) {
      const initialAdjustments: Record<string, AdjustedItem> = {};
      order.order_items.forEach(item => {
        const catalogPrice = item.products?.price || item.unit_price;
        const savedPrice = item.unit_price;
        
        // Check if this order was previously adjusted
        // If saved unit_price differs from catalog price, use saved (already adjusted)
        // Otherwise use catalog price (fresh order)
        const priceWasAdjusted = savedPrice !== catalogPrice;
        const displayPrice = priceWasAdjusted ? savedPrice : catalogPrice;
        
        initialAdjustments[item.id] = {
          id: item.id,
          adjustedPrice: displayPrice,
          // Calculate total WITHOUT applying discount_applied again - just price * quantity
          adjustedTotal: item.quantity * displayPrice,
        };
      });
      setAdjustedItems(initialAdjustments);
    }
  }, [order.order_items]);

  // When user changes price, calculate total as simple price * quantity
  // Do NOT apply discount_applied percentage - the user is directly setting the final price
  const handlePriceChange = (itemId: string, newPrice: number, quantity: number) => {
    const adjustedTotal = quantity * newPrice;
    setAdjustedItems(prev => ({
      ...prev,
      [itemId]: {
        id: itemId,
        adjustedPrice: newPrice,
        adjustedTotal,
      },
    }));
  };

  const adjustedSubtotal = useMemo(() => {
    return Object.values(adjustedItems).reduce((sum, item) => sum + item.adjustedTotal, 0);
  }, [adjustedItems]);

  const discountValue = parseFloat(customDiscount) || 0;

  const { discountAmount, finalTotal } = useMemo(() => {
    let discount = 0;
    if (discountType === 'percentage') {
      discount = (adjustedSubtotal * discountValue) / 100;
    } else {
      discount = discountValue;
    }
    // Ensure discount doesn't exceed total
    discount = Math.min(discount, adjustedSubtotal);
    return {
      discountAmount: discount,
      finalTotal: adjustedSubtotal - discount,
    };
  }, [adjustedSubtotal, discountValue, discountType]);

  // Calculate total discount given (price reductions + special discount)
  const totalDiscountGiven = useMemo(() => {
    let priceReduction = 0;
    for (const item of order.order_items || []) {
      const originalTotal = item.quantity * item.unit_price * (1 - (item.discount_applied || 0) / 100);
      const adjustedTotal = adjustedItems[item.id]?.adjustedTotal || originalTotal;
      priceReduction += originalTotal - adjustedTotal;
    }
    return priceReduction + discountAmount;
  }, [order.order_items, adjustedItems, discountAmount]);

  // Save adjusted prices and discount history to database
  const saveAdjustedPrices = async () => {
    setIsSaving(true);
    try {
      // Get current user (admin)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if any prices have changed
      const priceChanges: { id: string; product_id: string; unit_price: number; total_price: number; discount_applied: number }[] = [];
      
      for (const item of order.order_items || []) {
        const adjustment = adjustedItems[item.id];
        if (adjustment && adjustment.adjustedPrice !== item.unit_price) {
          // Calculate discount percentage based on original product price
          const originalProductPrice = item.products?.price || item.unit_price;
          const discountPercent = originalProductPrice > 0 
            ? Math.round(((originalProductPrice - adjustment.adjustedPrice) / originalProductPrice) * 100)
            : 0;
          
          priceChanges.push({
            id: item.id,
            product_id: item.product_id,
            unit_price: adjustment.adjustedPrice,
            total_price: adjustment.adjustedTotal,
            discount_applied: Math.max(0, discountPercent), // Ensure non-negative
          });
        }
      }

      // Update each order item with new prices and discount percentage
      for (const change of priceChanges) {
        const { error } = await supabase
          .from('order_items')
          .update({
            unit_price: change.unit_price,
            total_price: change.total_price,
            discount_applied: change.discount_applied,
          })
          .eq('id', change.id);

        if (error) throw error;
      }

      // Update order total if any discount was given
      const hasDiscount = totalDiscountGiven > 0;
      if (priceChanges.length > 0 || hasDiscount) {
        // Calculate the credit balance reduction (discount amount)
        const creditReduction = order.total_amount - finalTotal;

        const { error: orderError } = await supabase
          .from('orders')
          .update({
            total_amount: finalTotal,
          })
          .eq('id', order.id);

        if (orderError) throw orderError;

        // IMPORTANT: Also reduce shop's credit balance by the discount amount
        // This ensures the shop only owes the discounted amount, not the original
        if (creditReduction > 0) {
          const { data: shop } = await supabase
            .from('shops')
            .select('credit_balance')
            .eq('id', order.shop_id)
            .single();

          if (shop) {
            const newCreditBalance = Math.max(0, (shop.credit_balance || 0) - creditReduction);
            await supabase
              .from('shops')
              .update({ credit_balance: newCreditBalance })
              .eq('id', order.shop_id);
          }
        }
      }

      // Save discount history if any discount was given
      if (totalDiscountGiven > 0) {
        const { error: discountError } = await supabase
          .from('discount_history')
          .insert({
            order_id: order.id,
            booker_id: order.booker_id,
            shop_id: order.shop_id,
            original_amount: order.total_amount,
            discounted_amount: finalTotal,
            discount_value: totalDiscountGiven,
            given_by: user.id,
          });

        if (discountError) throw discountError;

        // Update booker financials - add to total discounts given
        const { data: existingFinancials } = await supabase
          .from('booker_financials')
          .select('id, total_discounts_given')
          .eq('booker_id', order.booker_id)
          .maybeSingle();

        if (existingFinancials) {
          // Update existing record
          const { error: financialError } = await supabase
            .from('booker_financials')
            .update({
              total_discounts_given: (existingFinancials.total_discounts_given || 0) + totalDiscountGiven,
            })
            .eq('id', existingFinancials.id);

          if (financialError) throw financialError;
        } else {
          // Create new record
          const { error: financialError } = await supabase
            .from('booker_financials')
            .insert({
              booker_id: order.booker_id,
              total_discounts_given: totalDiscountGiven,
            });

          if (financialError) throw financialError;
        }
      }

      return true;
    } catch (error) {
      console.error('Error saving adjusted prices:', error);
      toast.error('Failed to save adjusted prices');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    // Save adjusted prices first
    const saved = await saveAdjustedPrices();
    if (!saved) return;

    // Calculate total boxes/quantity
    const totalBoxes = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    // Use the ADJUSTED prices for printing (these are now saved to DB)
    const itemsHtml = order.order_items?.map(item => {
      const adjustment = adjustedItems[item.id];
      // Always use the adjusted/discounted price - this is what was saved to DB
      const displayPrice = adjustment?.adjustedPrice ?? item.unit_price;
      const displayTotal = adjustment?.adjustedTotal ?? item.total_price;
      const productCode = item.products?.product_code ? `[${item.products.product_code}] ` : '';
      
      // Calculate effective discount percentage from price difference
      // Use the original PRODUCT price (from products table), not the stored unit_price
      const originalProductPrice = item.products?.price || item.unit_price;
      const effectiveDiscountPercent = originalProductPrice > 0 && displayPrice < originalProductPrice
        ? Math.round(((originalProductPrice - displayPrice) / originalProductPrice) * 100)
        : (item.discount_applied || 0);
      
      // Show the original price in Unit Price column, discounted total in Total column
      const discountedTotal = item.quantity * displayPrice;
      
      return `
      <tr>
        <td>${safeText(productCode)}${safeText(item.products?.name || 'N/A')}</td>
        <td>${safeText(item.quantity)}</td>
        <td>${formatCurrencyForPrint(originalProductPrice)}</td>
        <td>${safeText(effectiveDiscountPercent)}%</td>
        <td>${formatCurrencyForPrint(discountedTotal)}</td>
      </tr>
    `;}).join('') || '<tr><td colspan="5">No items</td></tr>';

    // Calculate total item-level discounts to show on bill
    const totalItemDiscounts = (order.order_items || []).reduce((sum, item) => {
      const adjustment = adjustedItems[item.id];
      const displayPrice = adjustment?.adjustedPrice ?? item.unit_price;
      const originalProductPrice = item.products?.price || item.unit_price;
      const effectiveDiscountPercent = originalProductPrice > 0 && displayPrice < originalProductPrice
        ? ((originalProductPrice - displayPrice) / originalProductPrice) * 100
        : (item.discount_applied || 0);
      return sum + (item.quantity * originalProductPrice * effectiveDiscountPercent / 100);
    }, 0);

    const discountHtml = discountAmount > 0 ? `
      <div class="summary-row discount">
        <span>Special Discount${discountType === 'percentage' ? ` (${discountValue}%)` : ''}:</span>
        <span>- ${formatCurrencyForPrint(discountAmount)}</span>
      </div>
    ` : '';

    const totalDiscountsHtml = totalItemDiscounts > 0 ? `
      <div class="summary-row discount">
        <span>Total Discounts:</span>
        <span>- ${formatCurrencyForPrint(totalItemDiscounts)}</span>
      </div>
    ` : '';

    const content = `
      <div class="header">
        <h1>${safeText(COMPANY_INFO.name)}</h1>
        <div class="company-address">${safeText(COMPANY_INFO.address)}</div>
        <div class="company-phones">${safeText(COMPANY_INFO.contactLine)}</div>
        <p class="subtitle">Order Invoice</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Order Number:</span><span class="info-value">${safeText(order.order_number)}</span></div>
        <div class="info-item"><span class="info-label">Date:</span><span class="info-value">${safeText(new Date(order.created_at).toLocaleDateString())}</span></div>
        <div class="info-item"><span class="info-label">Shop:</span><span class="info-value">${safeText(order.shops?.name || 'N/A')}</span></div>
        ${order.shops?.address ? `<div class="info-item"><span class="info-label">Address:</span><span class="info-value">${safeText(order.shops.address)}</span></div>` : ''}
        ${order.shops?.phone ? `<div class="info-item"><span class="info-label">Phone:</span><span class="info-value">${safeText(order.shops.phone)}</span></div>` : ''}
        <div class="info-item"><span class="info-label">Route:</span><span class="info-value">${safeText(order.shops?.routes?.name || 'N/A')}</span></div>
        <div class="info-item"><span class="info-label">Order Booker:</span><span class="info-value">${safeText(order.booker_name || 'N/A')}</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Discount</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="summary">
        <div class="summary-row" style="background: #e3f2fd; font-weight: bold;"><span>Total Boxes/Items:</span><span>${totalBoxes}</span></div>
        <div class="summary-row"><span>Subtotal:</span><span>${formatCurrencyForPrint(adjustedSubtotal)}</span></div>
        ${discountHtml}
        <div class="summary-row"><span>Paid Amount:</span><span>${formatCurrencyForPrint(order.paid_amount)}</span></div>
        <div class="summary-row"><span>Credit/Pending:</span><span>${formatCurrencyForPrint(Math.max(0, finalTotal - order.paid_amount))}</span></div>
        <div class="summary-row total"><span>Grand Total:</span><span>${formatCurrencyForPrint(finalTotal)}</span></div>
      </div>
    `;
    printContent(content, `Order ${order.order_number}`);
    
    toast.success('Prices saved and invoice printed');
    onOrderUpdated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-foreground">Print Invoice</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order:</span>
              <span className="font-mono font-medium">{order.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shop:</span>
              <span className="font-medium">{order.shops?.name}</span>
            </div>
          </div>

          {/* Product Price Adjustments */}
          <div className="space-y-3">
            <label className="block text-sm font-medium flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              Adjust Product Prices (Optional)
            </label>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Product</th>
                    <th className="text-center p-2 font-medium w-16">Qty</th>
                    <th className="text-center p-2 font-medium w-28">Price</th>
                    <th className="text-right p-2 font-medium w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.order_items?.map(item => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="p-2">
                        <span className="text-xs text-muted-foreground">
                          {item.products?.product_code && `[${item.products.product_code}] `}
                        </span>
                        {item.products?.name || 'N/A'}
                      </td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="input-field w-full text-center text-sm py-1"
                          value={adjustedItems[item.id]?.adjustedPrice || item.unit_price}
                          min="0"
                          onChange={(e) => handlePriceChange(
                            item.id,
                            parseFloat(e.target.value) || 0,
                            item.quantity
                          )}
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        Rs. {(adjustedItems[item.id]?.adjustedTotal || item.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between text-sm font-medium bg-muted/50 p-3 rounded-lg">
              <span>Adjusted Subtotal:</span>
              <span>Rs. {adjustedSubtotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Custom Discount Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              <Percent className="inline h-4 w-4 mr-1" />
              Special Discount (Optional)
            </label>
            <div className="flex gap-2">
              <select
                className="input-field w-32"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'amount')}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="amount">Amount (Rs.)</option>
              </select>
              <input
                type="number"
                placeholder={discountType === 'percentage' ? 'e.g. 5' : 'e.g. 500'}
                className="input-field flex-1"
                min="0"
                max={discountType === 'percentage' ? '100' : adjustedSubtotal}
                value={customDiscount}
                onChange={(e) => setCustomDiscount(e.target.value)}
              />
            </div>
            {discountAmount > 0 && (
              <p className="text-xs text-success">
                Discount: Rs. {discountAmount.toLocaleString()} will be applied
              </p>
            )}
          </div>

          {/* Final Amount Preview */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Final Bill Amount:</span>
              <span className="text-xl font-bold text-primary">
                Rs. {finalTotal.toLocaleString()}
              </span>
            </div>
            {(discountAmount > 0 || adjustedSubtotal !== order.total_amount) && (
              <p className="text-xs text-muted-foreground mt-1">
                Original: Rs. {order.total_amount.toLocaleString()}
                {adjustedSubtotal !== order.total_amount && ` → Adjusted: Rs. ${adjustedSubtotal.toLocaleString()}`}
                {discountAmount > 0 && ` - Discount: Rs. ${discountAmount.toLocaleString()}`}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={onClose} className="btn-secondary" disabled={isSaving}>
              Cancel
            </button>
            <button onClick={handlePrint} className="btn-primary" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Save & Print Invoice
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

PrintOrderModal.displayName = 'PrintOrderModal';