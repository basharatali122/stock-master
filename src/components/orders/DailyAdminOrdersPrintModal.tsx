import React, { useMemo, useState } from 'react';
import { X, Printer, FileText, Package, Calendar } from 'lucide-react';
import { printContent, formatCurrencyForPrint, safeText, COMPANY_INFO } from '@/lib/print';
import { SalesmanSelect } from './SalesmanSelect';

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

interface DailyAdminOrdersPrintModalProps {
  orders: Order[];
  shops: Shop[];
  products: Product[];
  selectedDate?: string; // Custom date label (e.g., "Today", "Yesterday", or specific date)
  onClose: () => void;
}

export const DailyAdminOrdersPrintModal: React.FC<DailyAdminOrdersPrintModalProps> = ({
  orders,
  shops,
  products,
  selectedDate = 'Selected Period',
  onClose,
}) => {
  const [selectedSalesman, setSelectedSalesman] = useState<string>('');
  const salesmanLine = selectedSalesman
    ? `<div style="margin-top: 5px;"><strong>Salesman:</strong> ${selectedSalesman}</div>`
    : '';
  // Use the pre-filtered orders directly (already filtered by date in parent)
  const todayOrders = orders;

  // Calculate Bills Summary (Shops list with their orders) - grouped by route
  const billsSummary = useMemo(() => {
    const shopOrders = new Map<string, { 
      shop: Shop | undefined; 
      orders: Order[]; 
      totalAmount: number; 
      totalQuantity: { cartons: number; boxes: number };
      shopBalance: number;
      receivedAmount: number;
      totalDiscount: number;
      grossAmount: number;
      routeName: string;
    }>();

    todayOrders.forEach(order => {
      const existing = shopOrders.get(order.shop_id) || {
        shop: shops.find(s => s.id === order.shop_id),
        orders: [],
        totalAmount: 0,
        totalQuantity: { cartons: 0, boxes: 0 },
        shopBalance: 0,
        receivedAmount: 0,
        totalDiscount: 0,
        grossAmount: 0,
        routeName: order.shops?.routes?.name || 'Unknown',
      };

      existing.orders.push(order);
      existing.totalAmount += order.total_amount || 0;
      existing.receivedAmount += order.paid_amount || 0;
      
      // Calculate quantities and discounts
      let orderGross = 0;
      let orderDiscount = 0;
      order.order_items?.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        const boxesPerCarton = product?.boxes_per_carton || 24;
        const cartons = Math.floor(item.quantity / boxesPerCarton);
        const boxes = item.quantity % boxesPerCarton;
        existing.totalQuantity.cartons += cartons;
        existing.totalQuantity.boxes += boxes;
        
        // Calculate gross (before discount) and discount
        const itemGross = item.unit_price * item.quantity;
        orderGross += itemGross;
        orderDiscount += item.discount_applied || 0;
      });
      
      existing.grossAmount += orderGross;
      existing.totalDiscount += orderDiscount;

      if (existing.shop) {
        existing.shopBalance = existing.shop.credit_balance || 0;
      }

      shopOrders.set(order.shop_id, existing);
    });

    // Sort by route name, then shop name
    return Array.from(shopOrders.values()).sort((a, b) => {
      if (a.routeName !== b.routeName) return a.routeName.localeCompare(b.routeName);
      return (a.shop?.name || '').localeCompare(b.shop?.name || '');
    });
  }, [todayOrders, shops, products]);

  // Get unique routes from today's orders
  const routesSummary = useMemo(() => {
    const routeMap = new Map<string, number>();
    todayOrders.forEach(order => {
      const routeName = order.shops?.routes?.name || 'Unknown';
      routeMap.set(routeName, (routeMap.get(routeName) || 0) + 1);
    });
    return Array.from(routeMap.entries());
  }, [todayOrders]);

  // Calculate Load Form (Products list with total quantities)
  const loadForm = useMemo(() => {
    const productTotals = new Map<string, {
      product: Product | undefined;
      productName: string;
      productCode: string;
      totalQuantity: number;
      cartons: number;
      boxes: number;
      grossAmount: number;
    }>();

    todayOrders.forEach(order => {
      order.order_items?.forEach(item => {
        const foundProduct = products.find(p => p.id === item.product_id);
        const existing = productTotals.get(item.product_id) || {
          product: foundProduct,
          // Use product name from products list, or fallback to order_item's products relation
          productName: foundProduct?.name || item.products?.name || 'Unknown Product',
          productCode: foundProduct?.product_code || item.products?.product_code || '',
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
  }, [todayOrders, products]);

  // Totals
  const totals = useMemo(() => {
    const totalInvoice = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalReceived = todayOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    const totalCartons = loadForm.reduce((sum, p) => sum + p.cartons, 0);
    const totalBoxes = loadForm.reduce((sum, p) => sum + p.boxes, 0);
    const grossTotal = loadForm.reduce((sum, p) => sum + p.grossAmount, 0);
    const totalGross = billsSummary.reduce((sum, s) => sum + s.grossAmount, 0);
    const totalDiscount = billsSummary.reduce((sum, s) => sum + s.totalDiscount, 0);
    
    return { totalInvoice, totalReceived, totalCartons, totalBoxes, grossTotal, totalGross, totalDiscount };
  }, [todayOrders, loadForm, billsSummary]);

  const displayDate = selectedDate;

  const printBillsSummary = () => {
    // Get area/location from shop address (last part after comma)
    const getAreaFromAddress = (address: string | undefined) => {
      if (!address) return '';
      const parts = address.split(',');
      return parts[parts.length - 1]?.trim() || address;
    };

    const billsHtml = billsSummary.map((item, idx) => {
      const invoiceNumbers = item.orders.map(o => o.order_number).join(', ');
      const area = getAreaFromAddress(item.shop?.address);
      
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${safeText(item.shop?.shop_code || '-')}</td>
          <td>${safeText(item.shop?.name || 'N/A')}</td>
          <td>${safeText(item.routeName)}</td>
          <td>${safeText(area)}</td>
          <td>${safeText(invoiceNumbers)}</td>
          <td style="text-align: right;">${item.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const routesList = routesSummary.map(([name, count]) => `${name} (${count})`).join(', ');

    const content = `
      <style>
        .bills-table { border-collapse: collapse; width: 100%; font-size: 11px; }
        .bills-table th, .bills-table td { border: 1px solid #000; padding: 6px 8px; }
        .bills-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
        .bills-table td { vertical-align: middle; }
        .total-row td { font-weight: bold; background: #f5f5f5; }
      </style>
      <div class="header" style="border-bottom: none; margin-bottom: 10px; padding-bottom: 5px;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">${safeText(COMPANY_INFO.name)}</h1>
        <h2 style="font-size: 14px; font-weight: normal; margin-bottom: 15px;">Sale Invoices/Credits (By Date)</h2>
        <table style="width: 100%; border: none; font-size: 11px;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left; width: 50%; vertical-align: top;">
              <div>Transaction Type: All</div>
              <div>Date From: ${safeText(displayDate)}</div>
              <div>Date To: ${safeText(displayDate)}</div>
            </td>
            <td style="border: none; text-align: right; width: 50%; vertical-align: top;">
              <div>Customers: All</div>
              <div style="margin-top: 5px;"><small>Routes: ${safeText(routesList)}</small></div>
            </td>
          </tr>
        </table>
      </div>
      
      <table class="bills-table">
        <thead>
          <tr>
            <th style="width: 40px;">Sr.</th>
            <th style="width: 70px;">A/C No.</th>
            <th style="min-width: 180px;">Customer</th>
            <th style="width: 100px;">Route</th>
            <th style="width: 100px;">Area</th>
            <th style="width: 80px;">Inv. No.</th>
            <th style="width: 90px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${billsHtml}
          <tr class="total-row">
            <td colspan="6" style="text-align: left;"><strong>Total</strong></td>
            <td style="text-align: right;">${totals.totalInvoice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
    `;
    printContent(content, `Admin Orders - Bills Summary - ${displayDate}`);
  };

  const printLoadForm = () => {
    const loadHtml = loadForm.map((item, idx) => {
      const packInfo = `${item.product?.boxes_per_carton || 24} x 24`;
      const tradePrice = item.product?.price || 0;
      
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${safeText(item.productName)}${item.productCode ? ` - ${safeText(item.productCode)}` : ''}</td>
          <td>${packInfo}</td>
          <td>${item.cartons} - ${item.boxes}</td>
          <td>${formatCurrencyForPrint(tradePrice)}</td>
          <td>${formatCurrencyForPrint(item.grossAmount)}</td>
        </tr>
      `;
    }).join('');

    const routesList = routesSummary.map(([name, count]) => `${name} (${count})`).join(', ');

    const content = `
      <div class="header">
        <h1>${safeText(COMPANY_INFO.name)}</h1>
        <p class="company-address">${safeText(COMPANY_INFO.address)}</p>
        <p class="company-phones">${safeText(COMPANY_INFO.contactLine)}</p>
        <h2 style="margin-top: 15px; font-size: 18px;">DAILY ADMIN ORDERS - LOAD FORM</h2>
        <table style="width: 100%; margin-top: 10px; border: none;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left;">
              <strong>Type:</strong> Admin Orders<br/>
              <strong>Routes:</strong> ${safeText(routesList)}
            </td>
            <td style="border: none; text-align: right;">
              <strong>Date:</strong> ${safeText(displayDate)}<br/>
              <strong>Invoice Count:</strong> ${todayOrders.length}
            </td>
          </tr>
        </table>
      </div>
      
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
    printContent(content, `Admin Orders - Load Form - ${displayDate}`);
  };

  const printBothSummaries = () => {
    const billsHtml = billsSummary.map((item, idx) => {
      const hasDiscount = item.totalDiscount > 0;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${safeText(item.orders[0]?.order_number || '')}</td>
          <td><strong>${safeText(item.shop?.name || 'N/A')}</strong><br/><small>${safeText(item.shop?.shop_code || '')}</small></td>
          <td>${safeText(item.shop?.address || 'N/A')}</td>
          <td>${safeText(item.routeName)}</td>
          <td>${item.totalQuantity.cartons} - ${item.totalQuantity.boxes}</td>
          <td>${formatCurrencyForPrint(item.grossAmount)}</td>
          <td style="color: ${hasDiscount ? '#166534' : 'inherit'};">${hasDiscount ? formatCurrencyForPrint(item.totalDiscount) : '-'}</td>
          <td><strong>${formatCurrencyForPrint(item.totalAmount)}</strong></td>
          <td>${formatCurrencyForPrint(item.shopBalance)}</td>
          <td>${formatCurrencyForPrint(item.receivedAmount)}</td>
        </tr>
      `;
    }).join('');

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

    const routesList = routesSummary.map(([name, count]) => `${name} (${count})`).join(', ');

    const content = `
      <div class="header">
        <h1>${safeText(COMPANY_INFO.name)}</h1>
        <p class="company-address">${safeText(COMPANY_INFO.address)}</p>
        <p class="company-phones">${safeText(COMPANY_INFO.contactLine)}</p>
        <h2 style="margin-top: 15px; font-size: 18px;">DAILY ADMIN ORDERS - BILLS SUMMARY</h2>
        <table style="width: 100%; margin-top: 10px; border: none;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left;">
              <strong>Type:</strong> Admin Orders<br/>
              <strong>Routes:</strong> ${safeText(routesList)}
            </td>
            <td style="border: none; text-align: right;">
              <strong>Date:</strong> ${safeText(displayDate)}<br/>
              <strong>Invoice Count:</strong> ${todayOrders.length}
            </td>
          </tr>
        </table>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Sr#</th>
            <th>Invoice No.</th>
            <th>Shop Name</th>
            <th>Shop Address</th>
            <th>Route</th>
            <th>Qty<br/>(Ctn-Box)</th>
            <th>Gross Amt</th>
            <th>Discount</th>
            <th>Net Invoice</th>
            <th>Balance</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          ${billsHtml}
          <tr style="font-weight: bold; background: #e5e5e5;">
            <td colspan="5"><strong>TOTAL</strong></td>
            <td>${totals.totalCartons} - ${totals.totalBoxes}</td>
            <td>${formatCurrencyForPrint(totals.totalGross)}</td>
            <td style="color: #166534;">${formatCurrencyForPrint(totals.totalDiscount)}</td>
            <td><strong>${formatCurrencyForPrint(totals.totalInvoice)}</strong></td>
            <td></td>
            <td>${formatCurrencyForPrint(totals.totalReceived)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="page-break-before: always;"></div>
      
      <div class="header">
        <h1>${safeText(COMPANY_INFO.name)}</h1>
        <p class="company-address">${safeText(COMPANY_INFO.address)}</p>
        <p class="company-phones">${safeText(COMPANY_INFO.contactLine)}</p>
        <h2 style="margin-top: 15px; font-size: 18px;">DAILY ADMIN ORDERS - LOAD FORM</h2>
        <table style="width: 100%; margin-top: 10px; border: none;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left;">
              <strong>Type:</strong> Admin Orders<br/>
              <strong>Routes:</strong> ${safeText(routesList)}
            </td>
            <td style="border: none; text-align: right;">
              <strong>Date:</strong> ${safeText(displayDate)}<br/>
              <strong>Invoice Count:</strong> ${todayOrders.length}
            </td>
          </tr>
        </table>
      </div>
      
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

    printContent(content, `Admin Orders Summary - ${displayDate}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-elevated p-6 w-full max-w-lg mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Admin Orders Print
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {displayDate} • {todayOrders.length} orders across {routesSummary.length} routes
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {todayOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No orders created today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Routes breakdown */}
            <div className="p-3 rounded-lg bg-muted/30 mb-4">
              <p className="text-sm font-medium mb-2">Routes Breakdown:</p>
              <div className="flex flex-wrap gap-2">
                {routesSummary.map(([name, count]) => (
                  <span key={name} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {name}: {count} orders
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium">Bills Summary</h3>
                  <p className="text-sm text-muted-foreground">Shop-wise invoice list with amounts and routes</p>
                </div>
              </div>
              <button
                onClick={printBillsSummary}
                className="btn-secondary w-full mt-3"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Bills Summary
              </button>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium">Load Form</h3>
                  <p className="text-sm text-muted-foreground">Product-wise quantity list for loading</p>
                </div>
              </div>
              <button
                onClick={printLoadForm}
                className="btn-secondary w-full mt-3"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Load Form
              </button>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <Printer className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium">Print Both</h3>
                  <p className="text-sm text-muted-foreground">Bills summary + Load form on separate pages</p>
                </div>
              </div>
              <button
                onClick={printBothSummaries}
                className="btn-primary w-full mt-3"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Complete Summary
              </button>
            </div>

            {/* Totals summary */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="font-bold text-lg">Rs. {totals.totalInvoice.toLocaleString()}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Total Qty</p>
                <p className="font-bold text-lg">{totals.totalCartons} Ctn - {totals.totalBoxes} Box</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
