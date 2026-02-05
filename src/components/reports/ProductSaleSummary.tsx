import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Printer, Calendar, Package } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { printContent, safeText, COMPANY_INFO } from '@/lib/print';
import { toast } from 'sonner';

interface ProductSaleItem {
  product_id: string;
  product_code: string | null;
  product_name: string;
  pack_type: string | null;
  category: string;
  price: number;
  boxes_per_carton: number;
  quantity: number;
  gross_amount: number;
}

interface GroupedProducts {
  groupName: string;
  products: ProductSaleItem[];
  totalQuantity: number;
  totalCartons: number;
  totalBoxes: number;
  totalAmount: number;
}

const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

// Extract pack type price from product name or category (e.g., "Rs.10", "Rs 30", "Rs.5")
const extractPackTypeGroup = (product: ProductSaleItem): string => {
  const name = product.product_name || '';
  const category = product.category || '';
  const packType = product.pack_type || '';
  
  // Try to match price pattern like "Rs.10", "Rs 30", "Rs.5"
  const priceMatch = name.match(/Rs\.?\s*(\d+)/i);
  if (priceMatch) {
    const price = priceMatch[1];
    // Combine with pack type if available
    if (packType) {
      return `${packType} Rs.${price}`;
    }
    // Try to identify pack type from name
    if (name.toLowerCase().includes('half')) return `Half Rs.${price}`;
    if (name.toLowerCase().includes('mini half')) return `Mini Half Rs.${price}`;
    if (name.toLowerCase().includes('snack')) return `Snack Pack Rs.${price}`;
    if (name.toLowerCase().includes('tiki') || name.toLowerCase().includes('tikki')) return `Tiki Pack Rs.${price}`;
    if (name.toLowerCase().includes('family')) return `Family Pack Rs.${price}`;
    if (name.toLowerCase().includes('string')) return `String Rs.${price}`;
    return `Rs.${price}`;
  }
  
  // Fallback to pack_type or category
  if (packType) return packType;
  if (category) return category;
  return 'Other';
};

export const ProductSaleSummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<ProductSaleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const startDateTime = startOfDay(new Date(selectedDate)).toISOString();
      const endDateTime = endOfDay(new Date(endDate)).toISOString();

      // Fetch orders with order items for the date range
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_items (
            product_id,
            quantity,
            total_price,
            products (
              id,
              product_code,
              name,
              pack_type,
              category,
              price,
              boxes_per_carton
            )
          )
        `)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .neq('status', 'cancelled');

      if (ordersError) throw ordersError;

      // Aggregate product sales
      const productMap = new Map<string, ProductSaleItem>();

      orders?.forEach(order => {
        (order.order_items as any[])?.forEach(item => {
          const product = item.products;
          if (!product) return;

          const existing = productMap.get(product.id);
          if (existing) {
            existing.quantity += item.quantity || 0;
            existing.gross_amount += item.total_price || 0;
          } else {
            productMap.set(product.id, {
              product_id: product.id,
              product_code: product.product_code,
              product_name: product.name,
              pack_type: product.pack_type,
              category: product.category,
              price: product.price,
              boxes_per_carton: product.boxes_per_carton || 24,
              quantity: item.quantity || 0,
              gross_amount: item.total_price || 0,
            });
          }
        });
      });

      setSalesData(Array.from(productMap.values()));
    } catch (error: any) {
      toast.error('Failed to load sales data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [selectedDate, endDate]);

  // Group products by pack type
  const groupedData = useMemo(() => {
    const groups = new Map<string, GroupedProducts>();

    salesData.forEach(product => {
      const groupName = extractPackTypeGroup(product);
      
      if (!groups.has(groupName)) {
        groups.set(groupName, {
          groupName,
          products: [],
          totalQuantity: 0,
          totalCartons: 0,
          totalBoxes: 0,
          totalAmount: 0,
        });
      }

      const group = groups.get(groupName)!;
      group.products.push(product);
      group.totalQuantity += product.quantity;
      
      const cartons = Math.floor(product.quantity / product.boxes_per_carton);
      const boxes = product.quantity % product.boxes_per_carton;
      group.totalCartons += cartons;
      group.totalBoxes += boxes;
      group.totalAmount += product.gross_amount;
    });

    // Sort groups by name
    return Array.from(groups.values()).sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [salesData]);

  // Grand totals
  const grandTotals = useMemo(() => {
    return groupedData.reduce(
      (acc, group) => ({
        quantity: acc.quantity + group.totalQuantity,
        cartons: acc.cartons + group.totalCartons,
        boxes: acc.boxes + group.totalBoxes,
        amount: acc.amount + group.totalAmount,
      }),
      { quantity: 0, cartons: 0, boxes: 0, amount: 0 }
    );
  }, [groupedData]);

  const handlePrint = () => {
    const dateFrom = format(new Date(selectedDate), 'dd/MM/yyyy');
    const dateTo = format(new Date(endDate), 'dd/MM/yyyy');

    let tableRows = '';
    
    groupedData.forEach(group => {
      // Add product rows
      group.products.forEach(product => {
        const cartons = Math.floor(product.quantity / product.boxes_per_carton);
        const boxes = product.quantity % product.boxes_per_carton;
        
        tableRows += `
          <tr>
            <td style="text-align:left;">${safeText(product.product_code || '-')}</td>
            <td style="text-align:left;">${safeText(product.product_name)}</td>
            <td style="text-align:center;">Box</td>
            <td style="text-align:center;">${product.quantity}</td>
            <td style="text-align:center;">${cartons}</td>
            <td style="text-align:center;">${boxes}</td>
            <td style="text-align:right;">${product.gross_amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      });
      
      // Add group subtotal row
      tableRows += `
        <tr style="background:#f0f0f0; font-weight:bold;">
          <td colspan="3" style="text-align:right;">Total (${safeText(group.groupName)})</td>
          <td style="text-align:center;">${group.totalQuantity}</td>
          <td style="text-align:center;">${group.totalCartons}</td>
          <td style="text-align:center;">${group.totalBoxes}</td>
          <td style="text-align:right;">${group.totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    // Grand total row
    tableRows += `
      <tr style="background:#333; color:white; font-weight:bold;">
        <td colspan="3" style="text-align:right;">Grand Total</td>
        <td style="text-align:center;">${grandTotals.quantity}</td>
        <td style="text-align:center;">${grandTotals.cartons}</td>
        <td style="text-align:center;">${grandTotals.boxes}</td>
        <td style="text-align:right;">${grandTotals.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;

    const content = `
      <style>
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #333; padding: 4px 6px; }
        th { background: #333; color: white; font-weight: bold; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header p { margin: 2px 0; font-size: 11px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 11px; }
      </style>
      <div class="header">
        <h1>${safeText(COMPANY_INFO.name)}</h1>
        <p style="font-size:14px; font-weight:bold;">Product Sale Summary</p>
      </div>
      <div class="info-row">
        <div>
          <p><strong>Transaction Type:</strong> All</p>
          <p><strong>Customers:</strong> All</p>
        </div>
        <div style="text-align:right;">
          <p><strong>Date From:</strong> ${dateFrom}</p>
          <p><strong>Date To:</strong> ${dateTo}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left;">Product Code</th>
            <th style="text-align:left;">Product Name</th>
            <th style="text-align:center;">Base Unit</th>
            <th style="text-align:center;">Base Qty</th>
            <th style="text-align:center;">Cartons</th>
            <th style="text-align:center;">Boxes</th>
            <th style="text-align:right;">Gross Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <p style="text-align:right; font-size:10px; margin-top:10px;">${format(new Date(), 'dd MMMM yyyy hh:mm a')}</p>
    `;

    printContent(content, 'Product Sale Summary');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Filters and Print */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field text-sm"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field text-sm"
          />
        </div>
        <button onClick={handlePrint} className="btn-primary">
          <Printer className="h-4 w-4 mr-2" />
          Print Summary
        </button>
      </div>

      {/* Summary Table */}
      {groupedData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No sales data for the selected date range</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="border border-border px-3 py-2 text-left">Code</th>
                <th className="border border-border px-3 py-2 text-left">Product Name</th>
                <th className="border border-border px-3 py-2 text-center">Unit</th>
                <th className="border border-border px-3 py-2 text-center">Qty</th>
                <th className="border border-border px-3 py-2 text-center">Cartons</th>
                <th className="border border-border px-3 py-2 text-center">Boxes</th>
                <th className="border border-border px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((group, groupIndex) => (
                <React.Fragment key={group.groupName}>
                  {/* Product rows */}
                  {group.products.map((product, productIndex) => {
                    const cartons = Math.floor(product.quantity / product.boxes_per_carton);
                    const boxes = product.quantity % product.boxes_per_carton;
                    
                    return (
                      <tr key={product.product_id} className="hover:bg-muted/30">
                        <td className="border border-border px-3 py-2 font-mono text-xs">
                          {product.product_code || '-'}
                        </td>
                        <td className="border border-border px-3 py-2">{product.product_name}</td>
                        <td className="border border-border px-3 py-2 text-center">Box</td>
                        <td className="border border-border px-3 py-2 text-center">{product.quantity}</td>
                        <td className="border border-border px-3 py-2 text-center">{cartons}</td>
                        <td className="border border-border px-3 py-2 text-center">{boxes}</td>
                        <td className="border border-border px-3 py-2 text-right">
                          {formatCurrency(product.gross_amount)}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Group Subtotal */}
                  <tr className="bg-muted/50 font-semibold">
                    <td colSpan={3} className="border border-border px-3 py-2 text-right">
                      Total ({group.groupName})
                    </td>
                    <td className="border border-border px-3 py-2 text-center">{group.totalQuantity}</td>
                    <td className="border border-border px-3 py-2 text-center">{group.totalCartons}</td>
                    <td className="border border-border px-3 py-2 text-center">{group.totalBoxes}</td>
                    <td className="border border-border px-3 py-2 text-right">
                      {formatCurrency(group.totalAmount)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              
              {/* Grand Total */}
              <tr className="bg-primary text-primary-foreground font-bold">
                <td colSpan={3} className="border border-border px-3 py-2 text-right">
                  Grand Total
                </td>
                <td className="border border-border px-3 py-2 text-center">{grandTotals.quantity}</td>
                <td className="border border-border px-3 py-2 text-center">{grandTotals.cartons}</td>
                <td className="border border-border px-3 py-2 text-center">{grandTotals.boxes}</td>
                <td className="border border-border px-3 py-2 text-right">
                  {formatCurrency(grandTotals.amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProductSaleSummary;
