import React, { memo, useMemo, useState } from 'react';
import { X, Printer, Receipt } from 'lucide-react';
import { printContent, formatCurrencyForPrint, getStatusBadgeClass, safeText, COMPANY_INFO } from '@/lib/print';
import { SalesmanSelect } from './SalesmanSelect';

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

interface RouteBillsPrintModalProps {
  routeName: string;
  orders: Order[];
  onClose: () => void;
}

export const RouteBillsPrintModal = memo(({ routeName, orders, onClose }: RouteBillsPrintModalProps) => {
  const [selectedSalesman, setSelectedSalesman] = useState<string>('');
  const totals = useMemo(() => {
    const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalPaid = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    return { totalAmount, totalPaid, pending: totalAmount - totalPaid };
  }, [orders]);

  const printAllBills = () => {
    const today = new Date().toLocaleDateString();
    
    // Generate individual bill for each order
    const billsHtml = orders.map((order, index) => {
      // Calculate total boxes/quantity for this order
      const totalBoxes = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const itemsSubtotal = order.order_items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      const billDiscount = Math.max(0, itemsSubtotal - (order.total_amount || 0));
      
      const itemsHtml = order.order_items?.map(item => {
        const productCode = item.products?.product_code ? `[${item.products.product_code}] ` : '';
        // Calculate effective discount percentage from the original product price
        const originalProductPrice = item.products?.price || item.unit_price;
        const effectiveDiscountPercent = originalProductPrice > 0 && item.unit_price < originalProductPrice
          ? Math.round(((originalProductPrice - item.unit_price) / originalProductPrice) * 100)
          : (item.discount_applied || 0);
        return `
          <tr>
            <td style="text-align: left;">${safeText(productCode)}${safeText(item.products?.name || 'N/A')}</td>
            <td style="text-align: center;">${safeText(item.quantity)}</td>
            <td style="text-align: right;">${formatCurrencyForPrint(item.unit_price)}</td>
            <td style="text-align: center;">${safeText(effectiveDiscountPercent)}%</td>
            <td style="text-align: right;">${formatCurrencyForPrint(item.total_price)}</td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="5">No items</td></tr>';

      const pageBreak = index < orders.length - 1 ? 'page-break-after: always;' : '';

      return `
        <div style="margin-bottom: 20px; ${pageBreak}">
          <div class="header" style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
            <h1 style="margin: 0; font-size: 20px;">${safeText(COMPANY_INFO.name)}</h1>
            <div style="font-size: 11px; color: #666;">${safeText(COMPANY_INFO.address)}</div>
            <div style="font-size: 11px; color: #666;">${safeText(COMPANY_INFO.contactLine)}</div>
            <p style="margin: 8px 0 0 0; font-weight: bold; font-size: 14px;">ORDER INVOICE</p>
          </div>
          
          <table style="width: 100%; margin-bottom: 10px; border: none;">
            <tr style="background: transparent;">
              <td style="border: none; padding: 3px 0; font-size: 12px;"><strong>Order #:</strong> ${safeText(order.order_number)}</td>
              <td style="border: none; padding: 3px 0; font-size: 12px; text-align: right;"><strong>Date:</strong> ${safeText(new Date(order.created_at).toLocaleDateString())}</td>
            </tr>
            <tr style="background: transparent;">
              <td style="border: none; padding: 3px 0; font-size: 12px;"><strong>Shop:</strong> ${safeText(order.shops?.name || 'N/A')}</td>
              <td style="border: none; padding: 3px 0; font-size: 12px; text-align: right;"><strong>Route:</strong> ${safeText(order.shops?.routes?.name || 'N/A')}</td>
            </tr>
            ${order.shops?.address ? `
            <tr style="background: transparent;">
              <td colspan="2" style="border: none; padding: 3px 0; font-size: 11px; color: #666;"><strong>Address:</strong> ${safeText(order.shops.address)}</td>
            </tr>
            ` : ''}
            ${order.shops?.phone ? `
            <tr style="background: transparent;">
              <td colspan="2" style="border: none; padding: 3px 0; font-size: 11px; color: #666;"><strong>Phone:</strong> ${safeText(order.shops.phone)}</td>
            </tr>
            ` : ''}
            <tr style="background: transparent;">
              <td colspan="2" style="border: none; padding: 3px 0; font-size: 12px;"><strong>Salesman:</strong> ${safeText(selectedSalesman || order.booker_name || 'N/A')}</td>
            </tr>
          </table>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Product</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 50px;">Qty</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: right; width: 80px;">Price</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: center; width: 50px;">Disc</th>
                <th style="border: 1px solid #ddd; padding: 6px; text-align: right; width: 90px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">
            <table style="width: 100%; border: none; font-size: 12px;">
              <tr style="background: #e3f2fd;">
                <td style="border: none; padding: 6px 0;"><strong>Total Boxes/Items:</strong></td>
                <td style="border: none; padding: 6px 0; text-align: right; font-weight: bold; font-size: 14px;">${totalBoxes}</td>
              </tr>
              <tr style="background: transparent;">
                <td style="border: none; padding: 3px 0;"><strong>Subtotal:</strong></td>
                <td style="border: none; padding: 3px 0; text-align: right;">${formatCurrencyForPrint(itemsSubtotal)}</td>
              </tr>
              ${billDiscount > 0 ? `
              <tr style="background: transparent; color: #166534;">
                <td style="border: none; padding: 3px 0;"><strong>Discount:</strong></td>
                <td style="border: none; padding: 3px 0; text-align: right;">- ${formatCurrencyForPrint(billDiscount)}</td>
              </tr>
              ` : ''}
              <tr style="background: transparent;">
                <td style="border: none; padding: 3px 0;">Paid Amount:</td>
                <td style="border: none; padding: 3px 0; text-align: right;">${formatCurrencyForPrint(order.paid_amount)}</td>
              </tr>
              <tr style="background: transparent;">
                <td style="border: none; padding: 3px 0;">Credit/Pending:</td>
                <td style="border: none; padding: 3px 0; text-align: right;">${formatCurrencyForPrint(order.total_amount - order.paid_amount)}</td>
              </tr>
              <tr style="background: #f5f5f5; font-weight: bold;">
                <td style="border: none; padding: 6px 0;"><strong>GRAND TOTAL:</strong></td>
                <td style="border: none; padding: 6px 0; text-align: right; font-size: 14px;">${formatCurrencyForPrint(order.total_amount)}</td>
              </tr>
            </table>
          </div>
          
          <div style="margin-top: 20px; font-size: 10px; color: #888; text-align: center; border-top: 1px dashed #ccc; padding-top: 10px;">
            Thank you for your business!
          </div>
        </div>
      `;
    }).join('');

    const content = `
      <style>
        @media print {
          @page { margin: 10mm; }
          body { font-family: Arial, sans-serif; }
        }
        table { border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px; }
      </style>
      ${billsHtml}
    `;

    printContent(content, `All Bills - ${routeName} - ${today}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-elevated p-6 w-full max-w-md mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Print All Bills</h2>
            <p className="text-sm text-muted-foreground mt-1">Route: {routeName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <SalesmanSelect value={selectedSalesman} onChange={setSelectedSalesman} />
          {/* Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Receipt className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold text-lg">{orders.length} Orders</p>
                <p className="text-sm text-muted-foreground">will be printed as individual invoices</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="font-semibold">Rs. {totals.totalAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="font-semibold text-success">Rs. {totals.totalPaid.toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Credit/Pending</p>
                <p className="font-semibold text-warning">Rs. {totals.pending.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Each order will be printed on a separate page with full product details, quantities, and totals.
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button 
              onClick={printAllBills} 
              className="btn-primary flex-1"
              disabled={orders.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print All Bills
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

RouteBillsPrintModal.displayName = 'RouteBillsPrintModal';
