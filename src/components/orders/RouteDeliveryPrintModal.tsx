import React, { useMemo, useState } from 'react';
import { X, Printer, FileText, Package } from 'lucide-react';
import { printContent, formatCurrencyForPrint, safeText, COMPANY_INFO, formatCartonDecimal } from '@/lib/print';
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
  brand?: string | null;
  pack_type?: string | null;
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
  const [selectedSalesman, setSelectedSalesman] = useState<string>('');
  const displaySalesman = selectedSalesman || bookerName || 'N/A';
  // Calculate Bills Summary (Shops list with their orders)
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
    }>();

    orders.forEach(order => {
      const existing = shopOrders.get(order.shop_id) || {
        shop: shops.find(s => s.id === order.shop_id),
        orders: [],
        totalAmount: 0,
        totalQuantity: { cartons: 0, boxes: 0 },
        shopBalance: 0,
        receivedAmount: 0,
        totalDiscount: 0,
        grossAmount: 0,
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

    return Array.from(shopOrders.values());
  }, [orders, shops, products]);

  // Calculate Load Form (Products list with total quantities) - Grouped by Brand + Pack Type + Price
  const loadForm = useMemo(() => {
    const productTotals = new Map<string, {
      product: Product | undefined;
      productName: string;
      productCode: string;
      brand: string;
      packType: string;
      price: number;
      boxesPerCarton: number;
      totalQuantity: number;
      cartons: number;
      boxes: number;
      grossAmount: number;
    }>();

    orders.forEach(order => {
      order.order_items?.forEach(item => {
        const foundProduct = products.find(p => p.id === item.product_id);
        const existing = productTotals.get(item.product_id) || {
          product: foundProduct,
          productName: foundProduct?.name || item.products?.name || 'Unknown Product',
          productCode: foundProduct?.product_code || item.products?.product_code || '',
          brand: foundProduct?.brand || 'Other',
          packType: foundProduct?.pack_type || 'Other',
          price: foundProduct?.price || item.unit_price || 0,
          boxesPerCarton: foundProduct?.boxes_per_carton || 24,
          totalQuantity: 0,
          cartons: 0,
          boxes: 0,
          grossAmount: 0,
        };

        existing.totalQuantity += item.quantity;
        existing.grossAmount += item.total_price || 0;

        existing.cartons = Math.floor(existing.totalQuantity / existing.boxesPerCarton);
        existing.boxes = existing.totalQuantity % existing.boxesPerCarton;

        productTotals.set(item.product_id, existing);
      });
    });

    // Group by Brand + Pack Type + Price
    const grouped = new Map<string, typeof productTotals extends Map<string, infer V> ? V[] : never>();
    
    Array.from(productTotals.values()).forEach(item => {
      const groupKey = `${item.brand}|${item.packType}|${item.price}|${item.boxesPerCarton}`;
      const existing = grouped.get(groupKey) || [];
      existing.push(item);
      grouped.set(groupKey, existing);
    });

    // Sort groups and items within groups
    const sortedGroups: { 
      groupKey: string; 
      brand: string; 
      packType: string; 
      price: number; 
      boxesPerCarton: number;
      items: typeof productTotals extends Map<string, infer V> ? V[] : never;
      groupTotal: { quantity: number; cartons: number; boxes: number; amount: number };
    }[] = [];

    grouped.forEach((items, key) => {
      const [brand, packType, priceStr, boxesPerCartonStr] = key.split('|');
      const price = parseFloat(priceStr);
      const boxesPerCarton = parseInt(boxesPerCartonStr) || 24;
      
      // Sort items by product code
      items.sort((a, b) => (a.productCode || '').localeCompare(b.productCode || ''));
      
      // Calculate group totals
      const groupTotal = items.reduce((acc, item) => ({
        quantity: acc.quantity + item.totalQuantity,
        cartons: acc.cartons + item.cartons,
        boxes: acc.boxes + item.boxes,
        amount: acc.amount + item.grossAmount,
      }), { quantity: 0, cartons: 0, boxes: 0, amount: 0 });

      sortedGroups.push({ groupKey: key, brand, packType, price, boxesPerCarton, items, groupTotal });
    });

    // Sort groups by brand, then pack type, then price
    sortedGroups.sort((a, b) => {
      if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
      if (a.packType !== b.packType) return a.packType.localeCompare(b.packType);
      return a.price - b.price;
    });

    return sortedGroups;
  }, [orders, products]);

  // Totals
  const totals = useMemo(() => {
    const totalInvoice = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalReceived = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    const totalCartons = loadForm.reduce((sum, g) => sum + g.groupTotal.cartons, 0);
    const totalBoxes = loadForm.reduce((sum, g) => sum + g.groupTotal.boxes, 0);
    const grossTotal = loadForm.reduce((sum, g) => sum + g.groupTotal.amount, 0);
    const totalQuantity = loadForm.reduce((sum, g) => sum + g.groupTotal.quantity, 0);
    const totalGross = billsSummary.reduce((sum, s) => sum + s.grossAmount, 0);
    const totalDiscount = billsSummary.reduce((sum, s) => sum + s.totalDiscount, 0);
    
    return { totalInvoice, totalReceived, totalCartons, totalBoxes, grossTotal, totalQuantity, totalGross, totalDiscount };
  }, [orders, loadForm, billsSummary]);

  // Booker-wise box/carton breakdown with % share
  const bookerBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; totalBoxes: number; cartonDecimal: number }>();
    let grandTotalBoxes = 0;
    let grandCartonDecimal = 0;
    orders.forEach(order => {
      const bookerId = order.booker_id || 'unknown';
      const name = order.booker_name || selectedSalesman || 'Unknown';
      const existing = map.get(bookerId) || { name, totalBoxes: 0, cartonDecimal: 0 };
      order.order_items?.forEach(item => {
        const qty = item.quantity || 0;
        const product = products.find(p => p.id === item.product_id);
        const bpc = product?.boxes_per_carton && product.boxes_per_carton > 0 ? product.boxes_per_carton : 24;
        existing.totalBoxes += qty;
        existing.cartonDecimal += qty / bpc;
        grandTotalBoxes += qty;
        grandCartonDecimal += qty / bpc;
      });
      map.set(bookerId, existing);
    });
    const fmt = (v: number) => {
      const c = Math.floor(v);
      const f = Math.floor((v - c) * 100);
      return `${c}.${String(f).padStart(2, '0')}`;
    };
    const rows = Array.from(map.values()).map(b => ({
      ...b,
      cartonsLabel: fmt(b.cartonDecimal),
      percent: grandTotalBoxes > 0 ? (b.totalBoxes / grandTotalBoxes) * 100 : 0,
    })).sort((a, b) => b.totalBoxes - a.totalBoxes);
    return { rows, grandTotalBoxes, grandCartonsLabel: fmt(grandCartonDecimal) };
  }, [orders, products, selectedSalesman]);


  const bookerBreakdownHtml = () => {
    if (bookerBreakdown.rows.length === 0) return '';
    const rowsHtml = bookerBreakdown.rows.map((b, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${safeText(b.name)}</td>
        <td style="text-align:center;">${b.cartonsLabel}</td>
        <td style="text-align:center;">${b.totalBoxes}</td>
        <td style="text-align:right;">${b.percent.toFixed(2)}%</td>
      </tr>
    `).join('');
    return `
      <div style="margin-top: 18px;">
        <h3 style="font-size: 13px; margin-bottom: 6px;">Booker-wise Box / Carton Share</h3>
        <table class="load-table" style="font-size: 11px;">
          <thead>
            <tr>
              <th style="width: 40px;">Sr.</th>
              <th>Order Booker</th>
              <th style="width: 100px;">Cartons (Ctn.Box)</th>
              <th style="width: 90px;">Total Boxes</th>
              <th style="width: 80px; text-align:right;">% Share</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="font-weight:bold; background:#e5e5e5;">
              <td colspan="2" style="text-align:left;">Grand Total</td>
              <td style="text-align:center;">${bookerBreakdown.grandCartonsLabel}</td>
              <td style="text-align:center;">${bookerBreakdown.grandTotalBoxes}</td>
              <td style="text-align:right;">100.00%</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:10px; color:#666; margin-top:4px;">
          * Cartons shown in decimal form (e.g. 1.27 = 1 full carton + 27% of a carton). Each product uses its own boxes-per-carton.
        </div>
      </div>
    `;
  };

  const printBillsSummary = () => {
    const today = new Date().toLocaleDateString();
    
    // Get area/location from shop address (first part before comma or full address)
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
          <td>${safeText(routeName)}</td>
          <td>${safeText(area)}</td>
          <td>${safeText(invoiceNumbers)}</td>
          <td style="text-align: right;">${item.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

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
              <div>Date From: ${safeText(today)}</div>
              <div>Date To: ${safeText(today)}</div>
            </td>
            <td style="border: none; text-align: right; width: 50%; vertical-align: top;">
              <div>Customers: All</div>
              <div style="margin-top: 10px;"><strong>Salesman:</strong> ${safeText(displaySalesman)}</div>
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

    printContent(content, `Bills Summary - ${routeName}`);
  };

  const printLoadForm = () => {
    const today = new Date().toLocaleDateString();
    
    // Generate grouped HTML matching the PDF format
    let loadHtml = '';
    let globalIndex = 0;
    
    loadForm.forEach((group) => {
      // Group header: "Brand : Pack Type Rs Price 01xBoxesPerCarton"
      const groupHeader = `${group.brand} : ${group.packType} Rs ${group.price} 01x${group.boxesPerCarton}x24`;
      
      loadHtml += `
        <tr class="group-header">
          <td colspan="6" style="background: #f0f0f0; font-weight: bold; padding: 8px; border-top: 2px solid #333;">
            ${safeText(groupHeader)}
          </td>
        </tr>
      `;
      
      // Items within the group
      group.items.forEach((item) => {
        globalIndex++;
        const productDesc = `${item.productName}${item.productCode ? ` Rs.${item.price}(1*${item.boxesPerCarton}*24)-${item.brand}` : ''}`;
        
        loadHtml += `
          <tr>
            <td style="text-align: center;">${item.productCode || globalIndex}</td>
            <td>${safeText(productDesc)}</td>
            <td style="text-align: center;">Box</td>
            <td style="text-align: center;">${item.totalQuantity} <span style="color:#555;">(${formatCartonDecimal(item.totalQuantity, item.boxesPerCarton)})</span></td>
            <td style="text-align: center;">${item.cartons}</td>
            <td style="text-align: center;">${item.boxes}</td>
            <td style="text-align: right;">${item.grossAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      });
      
      // Group total
      loadHtml += `
        <tr class="group-total" style="font-weight: bold; background: #f9f9f9;">
          <td colspan="3" style="text-align: left;">Total</td>
          <td style="text-align: center;">${group.groupTotal.quantity} <span style="color:#555;">(${formatCartonDecimal(group.groupTotal.quantity, group.boxesPerCarton)})</span></td>
          <td style="text-align: center;">${group.groupTotal.cartons}</td>
          <td style="text-align: center;">${group.groupTotal.boxes}</td>
          <td style="text-align: right;">${group.groupTotal.amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    const content = `
      <style>
        .load-table { border-collapse: collapse; width: 100%; font-size: 11px; }
        .load-table th, .load-table td { border: 1px solid #000; padding: 5px 8px; }
        .load-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
        .load-table td { vertical-align: middle; }
        .group-header td { border-left: none; border-right: none; }
      </style>
      <div class="header" style="border-bottom: none; margin-bottom: 10px; padding-bottom: 5px;">
        <h1 style="font-size: 22px; margin-bottom: 8px; text-align: center;">${safeText(COMPANY_INFO.name)}</h1>
        <h2 style="font-size: 14px; font-weight: normal; margin-bottom: 15px; text-align: center;">Product Sale Summary</h2>
        <table style="width: 100%; border: none; font-size: 11px;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left; width: 50%; vertical-align: top;">
              <div>Transaction Type: All</div>
              <div>Date From: ${safeText(today)}</div>
              <div>Date To: ${safeText(today)}</div>
            </td>
            <td style="border: none; text-align: right; width: 50%; vertical-align: top;">
              <div>Customers: All</div>
              <div style="margin-top: 5px;"><strong>Route:</strong> ${safeText(routeName)}</div>
              <div><strong>Salesman:</strong> ${safeText(displaySalesman)}</div>
            </td>
          </tr>
        </table>
      </div>
      
      <table class="load-table">
        <thead>
          <tr>
            <th style="width: 70px;">Product Code</th>
            <th>Product Name</th>
            <th style="width: 60px;">Base Unit</th>
            <th style="width: 80px;">Base Quantity</th>
            <th style="width: 70px;">Large Pack</th>
            <th style="width: 70px;">Small Pack</th>
            <th style="width: 100px; text-align: right;">Gross Amount</th>
          </tr>
        </thead>
        <tbody>
          ${loadHtml}
          <tr style="font-weight: bold; background: #e5e5e5; border-top: 2px solid #000;">
            <td colspan="3"><strong>Grand Total</strong></td>
            <td style="text-align: center;">${totals.totalQuantity}</td>
            <td style="text-align: center;">${totals.totalCartons}</td>
            <td style="text-align: center;">${totals.totalBoxes}</td>
            <td style="text-align: right;">${totals.grossTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
      
      ${bookerBreakdownHtml()}

      <div style="margin-top: 20px; font-size: 10px; text-align: left;">
        ${new Date().toLocaleString()}
      </div>
    `;

    printContent(content, `Product Sale Summary - ${routeName}`);
  };

  const printBothSummaries = () => {
    const today = new Date().toLocaleDateString();
    
    // Get area/location from shop address (first part before comma or full address)
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
          <td>${safeText(routeName)}</td>
          <td>${safeText(area)}</td>
          <td>${safeText(invoiceNumbers)}</td>
          <td style="text-align: right;">${item.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    // Generate grouped load form HTML
    let loadHtml = '';
    let globalIndex = 0;
    
    loadForm.forEach((group) => {
      const groupHeader = `${group.brand} : ${group.packType} Rs ${group.price} 01x${group.boxesPerCarton}x24`;
      
      loadHtml += `
        <tr class="group-header">
          <td colspan="7" style="background: #f0f0f0; font-weight: bold; padding: 8px; border-top: 2px solid #333;">
            ${safeText(groupHeader)}
          </td>
        </tr>
      `;
      
      group.items.forEach((item) => {
        globalIndex++;
        const productDesc = `${item.productName} Rs.${item.price}(1*${item.boxesPerCarton}*24)-${item.brand}`;
        
        loadHtml += `
          <tr>
            <td style="text-align: center;">${item.productCode || globalIndex}</td>
            <td>${safeText(productDesc)}</td>
            <td style="text-align: center;">Box</td>
            <td style="text-align: center;">${item.totalQuantity} <span style="color:#555;">(${formatCartonDecimal(item.totalQuantity, item.boxesPerCarton)})</span></td>
            <td style="text-align: center;">${item.cartons}</td>
            <td style="text-align: center;">${item.boxes}</td>
            <td style="text-align: right;">${item.grossAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      });
      
      loadHtml += `
        <tr class="group-total" style="font-weight: bold; background: #f9f9f9;">
          <td colspan="3" style="text-align: left;">Total</td>
          <td style="text-align: center;">${group.groupTotal.quantity} <span style="color:#555;">(${formatCartonDecimal(group.groupTotal.quantity, group.boxesPerCarton)})</span></td>
          <td style="text-align: center;">${group.groupTotal.cartons}</td>
          <td style="text-align: center;">${group.groupTotal.boxes}</td>
          <td style="text-align: right;">${group.groupTotal.amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    const content = `
      <style>
        .bills-table { border-collapse: collapse; width: 100%; font-size: 11px; }
        .bills-table th, .bills-table td { border: 1px solid #000; padding: 6px 8px; }
        .bills-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
        .bills-table td { vertical-align: middle; }
        .total-row td { font-weight: bold; background: #f5f5f5; }
        .load-table { border-collapse: collapse; width: 100%; font-size: 11px; }
        .load-table th, .load-table td { border: 1px solid #000; padding: 5px 8px; }
        .load-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
      </style>
      <div class="header" style="border-bottom: none; margin-bottom: 10px; padding-bottom: 5px;">
        <h1 style="font-size: 22px; margin-bottom: 8px;">${safeText(COMPANY_INFO.name)}</h1>
        <h2 style="font-size: 14px; font-weight: normal; margin-bottom: 15px;">Sale Invoices/Credits (By Date)</h2>
        <table style="width: 100%; border: none; font-size: 11px;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left; width: 50%; vertical-align: top;">
              <div>Transaction Type: All</div>
              <div>Date From: ${safeText(today)}</div>
              <div>Date To: ${safeText(today)}</div>
            </td>
            <td style="border: none; text-align: right; width: 50%; vertical-align: top;">
              <div>Customers: All</div>
              <div style="margin-top: 10px;"><strong>Salesman:</strong> ${safeText(displaySalesman)}</div>
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
      
      <div style="page-break-before: always;"></div>
      
      <div class="header" style="border-bottom: none; margin-bottom: 10px; padding-bottom: 5px;">
        <h1 style="font-size: 22px; margin-bottom: 8px; text-align: center;">${safeText(COMPANY_INFO.name)}</h1>
        <h2 style="font-size: 14px; font-weight: normal; margin-bottom: 15px; text-align: center;">Product Sale Summary</h2>
        <table style="width: 100%; border: none; font-size: 11px;">
          <tr style="background: transparent;">
            <td style="border: none; text-align: left; width: 50%; vertical-align: top;">
              <div>Transaction Type: All</div>
              <div>Date From: ${safeText(today)}</div>
              <div>Date To: ${safeText(today)}</div>
            </td>
            <td style="border: none; text-align: right; width: 50%; vertical-align: top;">
              <div>Customers: All</div>
              <div style="margin-top: 5px;"><strong>Route:</strong> ${safeText(routeName)}</div>
              <div><strong>Salesman:</strong> ${safeText(displaySalesman)}</div>
            </td>
          </tr>
        </table>
      </div>
      
      <table class="load-table">
        <thead>
          <tr>
            <th style="width: 70px;">Product Code</th>
            <th>Product Name</th>
            <th style="width: 60px;">Base Unit</th>
            <th style="width: 80px;">Base Quantity</th>
            <th style="width: 70px;">Large Pack</th>
            <th style="width: 70px;">Small Pack</th>
            <th style="width: 100px; text-align: right;">Gross Amount</th>
          </tr>
        </thead>
        <tbody>
          ${loadHtml}
          <tr style="font-weight: bold; background: #e5e5e5; border-top: 2px solid #000;">
            <td colspan="3"><strong>Grand Total</strong></td>
            <td style="text-align: center;">${totals.totalQuantity}</td>
            <td style="text-align: center;">${totals.totalCartons}</td>
            <td style="text-align: center;">${totals.totalBoxes}</td>
            <td style="text-align: right;">${totals.grossTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>
      
      ${bookerBreakdownHtml()}

      <div style="margin-top: 20px; font-size: 10px; text-align: left;">
        ${new Date().toLocaleString()}
      </div>
    `;

    printContent(content, `Delivery Summary - ${routeName}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-elevated p-6 w-full max-w-lg mx-4 animate-scale-in">
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
          <SalesmanSelect value={selectedSalesman} onChange={setSelectedSalesman} />
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
              <span className="ml-2 font-medium">{totals.totalCartons} Ctn - {totals.totalBoxes} Box ({formatCartonDecimal((totals.totalCartons * (bookerBreakdown.defaultBpc || 24)) + totals.totalBoxes, bookerBreakdown.defaultBpc || 24)})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
