import React, { useMemo } from 'react';
import { X, Printer, FileText, Package } from 'lucide-react';
import { printContent, formatCurrencyForPrint, safeText, COMPANY_INFO } from '@/lib/print';

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
  shops?: { name: string; address?: string; routes?: { name: string } };
  booker_name?: string;
  order_items?: OrderItem[];
}

interface Shop {
  id: string;
  name: string;
  address?: string;
  shop_code?: string;
  credit_balance: number;
  routes?: { name: string };
}

interface Product {
  id: string;
  name: string;
  product_code: string | null;
  price: number;
  boxes_per_carton: number;
}

interface RouteDeliveryPrintModalProps {
  routeName: string;
  orders: Order[];
  shops: Shop[];
  products: Product[];
  bookerName?: string;
  onClose: () => void;
}

export const RouteDeliveryPrintModal: React.FC<RouteDeliveryPrintModalProps> = ({
  routeName,
  orders,
  shops,
  products,
  bookerName,
  onClose,
}) => {
  // Calculate Bills Summary (Shops list with their orders)
  const billsSummary = useMemo(() => {
    const shopOrders = new Map<string, { 
      shop: Shop | undefined; 
      orders: Order[]; 
      totalAmount: number; 
      totalQuantity: { cartons: number; boxes: number };
      shopBalance: number;
      receivedAmount: number;
    }>();

    orders.forEach(order => {
      const existing = shopOrders.get(order.shop_id) || {
        shop: shops.find(s => s.id === order.shop_id),
        orders: [],
        totalAmount: 0,
        totalQuantity: { cartons: 0, boxes: 0 },
        shopBalance: 0,
        receivedAmount: 0,
      };

      existing.orders.push(order);
      existing.totalAmount += order.total_amount || 0;
      existing.receivedAmount += order.paid_amount || 0;
      
      // Calculate quantities
      order.order_items?.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        const boxesPerCarton = product?.boxes_per_carton || 24;
        const cartons = Math.floor(item.quantity / boxesPerCarton);
        const boxes = item.quantity % boxesPerCarton;
        existing.totalQuantity.cartons += cartons;
        existing.totalQuantity.boxes += boxes;
      });

      if (existing.shop) {
        existing.shopBalance = existing.shop.credit_balance || 0;
      }

      shopOrders.set(order.shop_id, existing);
    });

    return Array.from(shopOrders.values());
  }, [orders, shops, products]);

  // Calculate Load Form (Products list with total quantities)
  const loadForm = useMemo(() => {
    const productTotals = new Map<string, {
      product: Product | undefined;
      totalQuantity: number;
      cartons: number;
      boxes: number;
      grossAmount: number;
    }>();

    orders.forEach(order => {
      order.order_items?.forEach(item => {
        const existing = productTotals.get(item.product_id) || {
          product: products.find(p => p.id === item.product_id),
          totalQuantity: 0,
          cartons: 0,
          boxes: 0,
          grossAmount: 0,
        };

        existing.totalQuantity += item.quantity;
        existing.grossAmount += item.total_price || 0;

        const boxesPerCarton = existing.product?.boxes_per_carton || 24;
        existing.cartons = Math.floor(existing.totalQuantity / boxesPerCarton);
        existing.boxes = existing.totalQuantity % boxesPerCarton;

        productTotals.set(item.product_id, existing);
      });
    });

    return Array.from(productTotals.values());
  }, [orders, products]);

  // Totals
  const totals = useMemo(() => {
    const totalInvoice = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalReceived = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    const totalCartons = loadForm.reduce((sum, p) => sum + p.cartons, 0);
    const totalBoxes = loadForm.reduce((sum, p) => sum + p.boxes, 0);
    const grossTotal = loadForm.reduce((sum, p) => sum + p.grossAmount, 0);
    
    return { totalInvoice, totalReceived, totalCartons, totalBoxes, grossTotal };
  }, [orders, loadForm]);

  const printBillsSummary = () => {
    const today = new Date().toLocaleDateString();
    
    const billsHtml = billsSummary.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${safeText(item.orders[0]?.order_number || '')}</td>
        <td><strong>${safeText(item.shop?.name || 'N/A')}</strong><br/><small>(${safeText(item.shop?.shop_code || '')})</small></td>
        <td>${safeText(item.shop?.address || 'N/A')}</td>
        <td>${item.totalQuantity.cartons} - ${item.totalQuantity.boxes}</td>
        <td>${formatCurrencyForPrint(item.totalAmount)}</td>
        <td>${formatCurrencyForPrint(item.shopBalance)}</td>
        <td>${formatCurrencyForPrint(item.receivedAmount)}</td>
      </tr>
    `).join('');

    const content = `
      <div class="header">
        <h1>LOAD FORM & BILLS SUMMARY</h1>
        <table style="width: 100%; margin-top: 10px; border: none;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left;">
              <strong>Distribution:</strong> ${safeText(COMPANY_INFO.name)}<br/>
              <strong>OrderBooker:</strong> ${safeText(bookerName || 'N/A')}<br/>
              <strong>DeliveryMan:</strong> ${safeText(bookerName || 'N/A')}
            </td>
            <td style="border: none; text-align: right;">
              <strong>Route:</strong> ${safeText(routeName)}<br/>
              <strong>Date:</strong> ${safeText(today)}<br/>
              <strong>Invoice Count:</strong> ${orders.length}
            </td>
          </tr>
        </table>
      </div>
      
      <h3 style="margin: 20px 0 10px 0;">BILLS SUMMARY</h3>
      <table>
        <thead>
          <tr>
            <th>Sr#</th>
            <th>Invoice No.</th>
            <th>Shop Name</th>
            <th>Shop Address</th>
            <th>Quantity<br/>Ctn-Box</th>
            <th>Net Invoice</th>
            <th>Shop Balance</th>
            <th>Received Amount</th>
          </tr>
        </thead>
        <tbody>
          ${billsHtml}
          <tr style="font-weight: bold; background: #e5e5e5;">
            <td colspan="4"><strong>TOTAL</strong></td>
            <td>${totals.totalCartons} - ${totals.totalBoxes}</td>
            <td>${formatCurrencyForPrint(totals.totalInvoice)}</td>
            <td></td>
            <td>${formatCurrencyForPrint(totals.totalReceived)}</td>
          </tr>
        </tbody>
      </table>
    `;

    printContent(content, `Bills Summary - ${routeName}`);
  };

  const printLoadForm = () => {
    const today = new Date().toLocaleDateString();
    
    const loadHtml = loadForm.map((item, idx) => {
      const product = item.product;
      const packInfo = `${product?.boxes_per_carton || 24} x 24`;
      const tradePrice = product?.price || 0;
      
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${safeText(product?.name || 'N/A')} - ${safeText(product?.product_code || '')}</td>
          <td>${packInfo}</td>
          <td>${item.cartons} - ${item.boxes}</td>
          <td>${formatCurrencyForPrint(tradePrice)}</td>
          <td>${formatCurrencyForPrint(item.grossAmount)}</td>
        </tr>
      `;
    }).join('');

    const content = `
      <div class="header">
        <h1>LOAD FORM & BILLS SUMMARY</h1>
        <table style="width: 100%; margin-top: 10px; border: none;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left;">
              <strong>Distribution:</strong> ${safeText(COMPANY_INFO.name)}<br/>
              <strong>OrderBooker:</strong> ${safeText(bookerName || 'N/A')}<br/>
              <strong>DeliveryMan:</strong> ${safeText(bookerName || 'N/A')}
            </td>
            <td style="border: none; text-align: right;">
              <strong>Route:</strong> ${safeText(routeName)}<br/>
              <strong>Date:</strong> ${safeText(today)}<br/>
              <strong>Invoice Count:</strong> ${orders.length}
            </td>
          </tr>
        </table>
      </div>
      
      <h3 style="margin: 20px 0 10px 0;">LOAD FORM</h3>
      <table>
        <thead>
          <tr>
            <th>Sr#</th>
            <th>Product Description (ID)</th>
            <th>Packing<br/>(Pack x Box)</th>
            <th>Load Qty<br/>(Carton - Box)</th>
            <th>Trade Price<br/>(Per Box)</th>
            <th>Gross Amount</th>
          </tr>
        </thead>
        <tbody>
          ${loadHtml}
          <tr style="font-weight: bold; background: #e5e5e5;">
            <td colspan="3"><strong>TOTAL</strong></td>
            <td>${totals.totalCartons} - ${totals.totalBoxes}</td>
            <td></td>
            <td>${formatCurrencyForPrint(totals.grossTotal)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="margin-top: 50px; display: flex; justify-content: space-between;">
        <div><strong>Issued By</strong>: _________________</div>
        <div><strong>Received By</strong>: _________________</div>
      </div>
    `;

    printContent(content, `Load Form - ${routeName}`);
  };

  const printBothSummaries = () => {
    const today = new Date().toLocaleDateString();
    
    const billsHtml = billsSummary.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${safeText(item.orders[0]?.order_number || '')}</td>
        <td><strong>${safeText(item.shop?.name || 'N/A')}</strong><br/><small>(${safeText(item.shop?.shop_code || '')})</small></td>
        <td>${safeText(item.shop?.address || 'N/A')}</td>
        <td>${item.totalQuantity.cartons} - ${item.totalQuantity.boxes}</td>
        <td>${formatCurrencyForPrint(item.totalAmount)}</td>
        <td>${formatCurrencyForPrint(item.shopBalance)}</td>
        <td>${formatCurrencyForPrint(item.receivedAmount)}</td>
      </tr>
    `).join('');

    const loadHtml = loadForm.map((item, idx) => {
      const product = item.product;
      const packInfo = `${product?.boxes_per_carton || 24} x 24`;
      const tradePrice = product?.price || 0;
      
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${safeText(product?.name || 'N/A')} - ${safeText(product?.product_code || '')}</td>
          <td>${packInfo}</td>
          <td>${item.cartons} - ${item.boxes}</td>
          <td>${formatCurrencyForPrint(tradePrice)}</td>
          <td>${formatCurrencyForPrint(item.grossAmount)}</td>
        </tr>
      `;
    }).join('');

    const content = `
      <div class="header">
        <h1>LOAD FORM & BILLS SUMMARY</h1>
        <table style="width: 100%; margin-top: 10px; border: none;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left;">
              <strong>Distribution:</strong> ${safeText(COMPANY_INFO.name)}<br/>
              <strong>OrderBooker:</strong> ${safeText(bookerName || 'N/A')}<br/>
              <strong>DeliveryMan:</strong> ${safeText(bookerName || 'N/A')}
            </td>
            <td style="border: none; text-align: right;">
              <strong>Route:</strong> ${safeText(routeName)}<br/>
              <strong>Date:</strong> ${safeText(today)}<br/>
              <strong>Invoice Count:</strong> ${orders.length}
            </td>
          </tr>
        </table>
      </div>
      
      <h3 style="margin: 20px 0 10px 0;">BILLS SUMMARY</h3>
      <table>
        <thead>
          <tr>
            <th>Sr#</th>
            <th>Invoice No.</th>
            <th>Shop Name</th>
            <th>Shop Address</th>
            <th>Qty (Ctn-Box)</th>
            <th>Net Invoice</th>
            <th>Shop Balance</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          ${billsHtml}
          <tr style="font-weight: bold; background: #e5e5e5;">
            <td colspan="4"><strong>TOTAL</strong></td>
            <td>${totals.totalCartons} - ${totals.totalBoxes}</td>
            <td>${formatCurrencyForPrint(totals.totalInvoice)}</td>
            <td></td>
            <td>${formatCurrencyForPrint(totals.totalReceived)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="page-break-before: always;"></div>
      
      <div class="header">
        <h1>LOAD FORM & BILLS SUMMARY</h1>
        <table style="width: 100%; margin-top: 10px; border: none;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left;">
              <strong>Distribution:</strong> ${safeText(COMPANY_INFO.name)}<br/>
              <strong>OrderBooker:</strong> ${safeText(bookerName || 'N/A')}<br/>
              <strong>DeliveryMan:</strong> ${safeText(bookerName || 'N/A')}
            </td>
            <td style="border: none; text-align: right;">
              <strong>Route:</strong> ${safeText(routeName)}<br/>
              <strong>Date:</strong> ${safeText(today)}<br/>
              <strong>Invoice Count:</strong> ${orders.length}
            </td>
          </tr>
        </table>
      </div>
      
      <h3 style="margin: 20px 0 10px 0;">LOAD FORM</h3>
      <table>
        <thead>
          <tr>
            <th>Sr#</th>
            <th>Product Description (ID)</th>
            <th>Packing<br/>(Pack x Box)</th>
            <th>Load Qty<br/>(Carton - Box)</th>
            <th>Trade Price<br/>(Per Box)</th>
            <th>Gross Amount</th>
          </tr>
        </thead>
        <tbody>
          ${loadHtml}
          <tr style="font-weight: bold; background: #e5e5e5;">
            <td colspan="3"><strong>TOTAL</strong></td>
            <td>${totals.totalCartons} - ${totals.totalBoxes}</td>
            <td></td>
            <td>${formatCurrencyForPrint(totals.grossTotal)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="margin-top: 50px; display: flex; justify-content: space-between;">
        <div><strong>Issued By</strong>: _________________</div>
        <div><strong>Received By</strong>: _________________</div>
      </div>
    `;

    printContent(content, `Delivery Summary - ${routeName}`);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Print Route Delivery Summary</h2>
            <p className="text-sm text-muted-foreground mt-1">Route: {routeName} • {orders.length} orders</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <h3 className="font-medium">Bills Summary</h3>
                <p className="text-sm text-muted-foreground">Shop list with order details for delivery</p>
              </div>
              <button onClick={printBillsSummary} className="btn-secondary py-2 px-4">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <h3 className="font-medium">Load Form</h3>
                <p className="text-sm text-muted-foreground">Products list with quantities for loading</p>
              </div>
              <button onClick={printLoadForm} className="btn-secondary py-2 px-4">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </button>
            </div>
          </div>

          <div className="pt-3 border-t">
            <button onClick={printBothSummaries} className="btn-primary w-full">
              <Printer className="h-4 w-4 mr-2" />
              Print Both (Bills + Load Form)
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Shops:</span>
              <span className="ml-2 font-medium">{billsSummary.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Products:</span>
              <span className="ml-2 font-medium">{loadForm.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Invoice:</span>
              <span className="ml-2 font-medium">Rs. {totals.totalInvoice.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Qty:</span>
              <span className="ml-2 font-medium">{totals.totalCartons} Ctn - {totals.totalBoxes} Box</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
