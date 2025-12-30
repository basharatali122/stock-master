import React, { memo, useState, useMemo } from 'react';
import { X, Printer, Percent } from 'lucide-react';
import { printContent, formatCurrencyForPrint, getStatusBadgeClass, safeText, COMPANY_INFO } from '@/lib/print';

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

interface PrintOrderModalProps {
  order: Order;
  onClose: () => void;
}

export const PrintOrderModal = memo(({ order, onClose }: PrintOrderModalProps) => {
  const [customDiscount, setCustomDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');

  const discountValue = parseFloat(customDiscount) || 0;

  const { discountAmount, finalTotal } = useMemo(() => {
    let discount = 0;
    if (discountType === 'percentage') {
      discount = (order.total_amount * discountValue) / 100;
    } else {
      discount = discountValue;
    }
    // Ensure discount doesn't exceed total
    discount = Math.min(discount, order.total_amount);
    return {
      discountAmount: discount,
      finalTotal: order.total_amount - discount,
    };
  }, [order.total_amount, discountValue, discountType]);

  const handlePrint = () => {
    const itemsHtml = order.order_items?.map(item => {
      const productCode = item.products?.product_code ? `[${item.products.product_code}] ` : '';
      return `
      <tr>
        <td>${safeText(productCode)}${safeText(item.products?.name || 'N/A')}</td>
        <td>${safeText(item.quantity)}</td>
        <td>${formatCurrencyForPrint(item.unit_price)}</td>
        <td>${safeText(item.discount_applied || 0)}%</td>
        <td>${formatCurrencyForPrint(item.total_price)}</td>
      </tr>
    `;}).join('') || '<tr><td colspan="5">No items</td></tr>';

    const discountHtml = discountAmount > 0 ? `
      <div class="summary-row discount">
        <span>Special Discount${discountType === 'percentage' ? ` (${discountValue}%)` : ''}:</span>
        <span>- ${formatCurrencyForPrint(discountAmount)}</span>
      </div>
    ` : '';

    const content = `
      <div class="header">
        <h1>${safeText(COMPANY_INFO.name)}</h1>
        <div class="company-address">${safeText(COMPANY_INFO.address)}</div>
        <div class="company-phones">Ph: ${safeText(COMPANY_INFO.phone1)} | Ph: ${safeText(COMPANY_INFO.phone2)}</div>
        <p class="subtitle">Order Invoice</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Order Number:</span><span class="info-value">${safeText(order.order_number)}</span></div>
        <div class="info-item"><span class="info-label">Date:</span><span class="info-value">${safeText(new Date(order.created_at).toLocaleDateString())}</span></div>
        <div class="info-item"><span class="info-label">Shop:</span><span class="info-value">${safeText(order.shops?.name || 'N/A')}</span></div>
        <div class="info-item"><span class="info-label">Route:</span><span class="info-value">${safeText(order.shops?.routes?.name || 'N/A')}</span></div>
        <div class="info-item"><span class="info-label">Order Booker:</span><span class="info-value">${safeText(order.booker_name || 'N/A')}</span></div>
        <div class="info-item"><span class="info-label">Status:</span><span class="badge ${getStatusBadgeClass(order.status)}">${safeText(order.status)}</span></div>
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
        <div class="summary-row"><span>Subtotal:</span><span>${formatCurrencyForPrint(order.total_amount)}</span></div>
        ${discountHtml}
        <div class="summary-row"><span>Paid Amount:</span><span>${formatCurrencyForPrint(order.paid_amount)}</span></div>
        <div class="summary-row"><span>Credit/Pending:</span><span>${formatCurrencyForPrint(Math.max(0, finalTotal - order.paid_amount))}</span></div>
        <div class="summary-row total"><span>Grand Total:</span><span>${formatCurrencyForPrint(finalTotal)}</span></div>
      </div>
    `;
    printContent(content, `Order ${order.order_number}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
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
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Total:</span>
              <span className="font-medium">Rs. {order.total_amount.toLocaleString()}</span>
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
                max={discountType === 'percentage' ? '100' : order.total_amount}
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
            {discountAmount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Original: Rs. {order.total_amount.toLocaleString()} - Discount: Rs. {discountAmount.toLocaleString()}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handlePrint} className="btn-primary">
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

PrintOrderModal.displayName = 'PrintOrderModal';
