import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Eye, Loader2, Printer, Edit2, MapPin, FileText, Receipt, DollarSign, Trash2, Calendar, User, FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import { printContent, formatCurrencyForPrint, getStatusBadgeClass, safeText, COMPANY_INFO } from '@/lib/print';
import { useOrders, useOrderFilters } from '@/hooks/useOrders';
import { ViewOrderModal, EditOrderModal, NewOrderModal } from '@/components/orders/OrderModals';
import { PrintOrderModal } from '@/components/orders/PrintOrderModal';
import { RouteDeliveryPrintModal } from '@/components/orders/RouteDeliveryPrintModal';
import { RouteBillsPrintModal } from '@/components/orders/RouteBillsPrintModal';
import { BulkCashUpdateModal } from '@/components/orders/BulkCashUpdateModal';
import { DailyAdminOrdersPrintModal } from '@/components/orders/DailyAdminOrdersPrintModal';
import { EditBillModal } from '@/components/orders/EditBillModal';
import { z } from 'zod';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

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

const paymentFilters = ['All', 'Paid', 'Credit', 'Partial'];
const datePresets = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Custom', value: 'custom' },
];

const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

const getPaymentBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'paid': return 'badge-success';
    case 'credit': return 'badge-pending';
    case 'partial': return 'badge-info';
    default: return 'badge-info';
  }
};

// Memoized filter button component
const FilterButton = memo(({ 
  label, 
  isActive, 
  onClick 
}: { 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
      isActive 
        ? 'bg-primary text-primary-foreground' 
        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
    }`}
  >
    {label}
  </button>
));

FilterButton.displayName = 'FilterButton';

// Memoized action buttons
const OrderActions = memo(({ 
  order, 
  isAdmin,
  canDelete,
  onView, 
  onEdit, 
  onEditBill,
  onPrint,
  onDelete
}: { 
  order: Order; 
  isAdmin: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onEditBill: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) => (
  <div className="flex gap-1">
    <button onClick={onView} className="rounded-lg p-2 hover:bg-muted" title="View">
      <Eye className="h-4 w-4 text-muted-foreground" />
    </button>
    {isAdmin && (
      <>
        <button onClick={onEdit} className="rounded-lg p-2 hover:bg-muted" title="Edit Status/Payment">
          <Edit2 className="h-4 w-4 text-muted-foreground" />
        </button>
        <button onClick={onEditBill} className="rounded-lg p-2 hover:bg-muted" title="Edit Bill Items">
          <FileEdit className="h-4 w-4 text-accent" />
        </button>
        <button onClick={onPrint} className="rounded-lg p-2 hover:bg-muted" title="Print">
          <Printer className="h-4 w-4 text-muted-foreground" />
        </button>
      </>
    )}
    {canDelete && (
      <button onClick={onDelete} className="rounded-lg p-2 hover:bg-muted hover:bg-destructive/10" title="Delete Order">
        <Trash2 className="h-4 w-4 text-destructive" />
      </button>
    )}
  </div>
));

OrderActions.displayName = 'OrderActions';

const Orders: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const { orders, shops, allShops, products, bookers, loading, refetch } = useOrders(isAdmin, user?.id);
  const {
    searchQuery,
    setSearchQuery,
    paymentFilter,
    setPaymentFilter,
    filteredOrders,
    stats
  } = useOrderFilters(orders);

  // Selected booker for admin order creation
  const [selectedBooker, setSelectedBooker] = useState('');

  // Route filter state
  const [routeFilter, setRouteFilter] = useState('All');
  const [bookerFilter, setBookerFilter] = useState('All');
  const [datePreset, setDatePreset] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [routes, setRoutes] = useState<{ id: string; name: string; assigned_booker_id: string | null }[]>([]);
  const [showRoutePrintModal, setShowRoutePrintModal] = useState(false);
  const [showRouteBillsModal, setShowRouteBillsModal] = useState(false);
  const [showBulkCashModal, setShowBulkCashModal] = useState(false);
  const [showDailyAdminPrintModal, setShowDailyAdminPrintModal] = useState(false);

  // Fetch routes for admin
  useEffect(() => {
    if (isAdmin) {
      supabase
        .from('routes')
        .select('id, name, assigned_booker_id')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          if (data) setRoutes(data);
        });
    }
  }, [isAdmin]);

  // Filter orders by route, booker, and date
  const routeFilteredOrders = useMemo(() => {
    let filtered = filteredOrders;
    
    // Route filter
    if (routeFilter !== 'All') {
      filtered = filtered.filter(order => order.shops?.routes?.name === routeFilter);
    }
    
    // Booker filter (admin only)
    if (isAdmin && bookerFilter !== 'All') {
      filtered = filtered.filter(order => order.booker_name === bookerFilter);
    }
    
    // Date filter
    if (datePreset !== 'all') {
      let targetDate: Date;
      
      if (datePreset === 'today') {
        targetDate = new Date();
      } else if (datePreset === 'yesterday') {
        targetDate = subDays(new Date(), 1);
      } else if (datePreset === 'custom' && customDate) {
        targetDate = new Date(customDate);
      } else {
        return filtered;
      }
      
      const dayStart = startOfDay(targetDate);
      const dayEnd = endOfDay(targetDate);
      
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });
    }
    
    return filtered;
  }, [filteredOrders, routeFilter, bookerFilter, datePreset, customDate, isAdmin]);

  // Route-specific stats (for admin only)
  const routeStats = useMemo(() => {
    if (!isAdmin) return { totalSales: 0, totalPaid: 0, totalCredit: 0, totalOrders: 0 };
    const totalSales = routeFilteredOrders.reduce((acc, order) => acc + (order.total_amount || 0), 0);
    const totalPaid = routeFilteredOrders.reduce((acc, order) => acc + (order.paid_amount || 0), 0);
    const totalCredit = totalSales - totalPaid;
    return { totalSales, totalPaid, totalCredit, totalOrders: routeFilteredOrders.length };
  }, [routeFilteredOrders, isAdmin]);

  // Daily sales for order bookers (only today's orders)
  const dailySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = routeFilteredOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    const totalSales = todayOrders.reduce((acc, order) => acc + (order.total_amount || 0), 0);
    return { totalSales, totalOrders: todayOrders.length };
  }, [routeFilteredOrders]);

  // Get booker name for selected route
  const selectedRouteBooker = useMemo(() => {
    if (routeFilter === 'All') return undefined;
    const route = routes.find(r => r.name === routeFilter);
    if (!route?.assigned_booker_id) return undefined;
    const firstOrder = routeFilteredOrders.find(o => o.booker_name);
    return firstOrder?.booker_name;
  }, [routeFilter, routes, routeFilteredOrders]);

  // Get unique booker names for filter dropdown
  const uniqueBookers = useMemo(() => {
    const names = new Set<string>();
    orders.forEach(order => {
      if (order.booker_name) names.add(order.booker_name);
    });
    return Array.from(names).sort();
  }, [orders]);

  // Modal states
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showEditBillModal, setShowEditBillModal] = useState(false);
  const [editBillOrder, setEditBillOrder] = useState<Order | null>(null);

  // New order form states
  const [selectedShop, setSelectedShop] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number; price: number; discount: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentType, setPaymentType] = useState('paid');
  const [paidAmount, setPaidAmount] = useState('');

  const addItemToOrder = useCallback(() => {
    const quantityNum = parseInt(quantity) || 0;
    
    // Validate quantity
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }
    
    if (quantityNum < 1 || quantityNum > 10000) {
      toast.error('Quantity must be between 1 and 10,000');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    // Calculate total quantity already in order for this product
    const existingOrderQty = orderItems
      .filter(item => item.productId === selectedProduct)
      .reduce((sum, item) => sum + item.quantity, 0);

    // Check stock availability
    const totalRequested = existingOrderQty + quantityNum;
    if (totalRequested > product.stock_quantity) {
      toast.error(`Insufficient stock! Available: ${product.stock_quantity} boxes, Requested: ${totalRequested} boxes`);
      return;
    }

    setOrderItems(prev => {
      const existingIndex = prev.findIndex(i => i.productId === selectedProduct);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQuantity = updated[existingIndex].quantity + quantityNum;
        if (newQuantity > 10000) {
          toast.error('Total quantity for this product exceeds 10,000');
          return prev;
        }
        updated[existingIndex].quantity = newQuantity;
        return updated;
      }
      return [...prev, {
        productId: selectedProduct,
        quantity: quantityNum,
        price: product.price,
        discount: product.discount_percentage || 0
      }];
    });

    setSelectedProduct('');
    setQuantity('1');
  }, [selectedProduct, quantity, products, orderItems]);

  const removeItem = useCallback((index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const calculateTotal = useCallback(() => {
    return orderItems.reduce((sum, item) => {
      const discountedPrice = item.price * (1 - item.discount / 100);
      return sum + discountedPrice * item.quantity;
    }, 0);
  }, [orderItems]);

  const handleCreateOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate shop selection
    if (!selectedShop) {
      toast.error('Please select a shop');
      return;
    }
    
    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const shopValidation = uuidSchema.safeParse(selectedShop);
    if (!shopValidation.success) {
      toast.error('Invalid shop selected');
      return;
    }
    
    if (orderItems.length === 0) {
      toast.error('Please add at least one item to the order');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    // For admin, validate booker selection
    const bookerId = isAdmin && selectedBooker ? selectedBooker : user.id;
    if (isAdmin && !selectedBooker) {
      toast.error('Please select an order booker to assign this order');
      return;
    }

    setSubmitting(true);
    try {
      // For order bookers, default to pending payment - admin will update later
      const total = calculateTotal();

      const orderNumber = `ORD-${Date.now()}`;
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          shop_id: selectedShop,
          booker_id: bookerId,
          total_amount: total,
          paid_amount: 0,
          payment_status: 'credit',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const itemsToInsert = orderItems.map(item => ({
        order_id: orderData.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        discount_applied: item.discount,
        total_price: item.price * item.quantity * (1 - item.discount / 100),
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update shop credit balance with full order amount (admin will collect payment)
      // Use allShops for admin to find shop from any route
      const shopList = isAdmin ? allShops : shops;
      const shop = shopList.find(s => s.id === selectedShop);
      if (shop) {
        await supabase
          .from('shops')
          .update({ credit_balance: (shop.credit_balance || 0) + total })
          .eq('id', selectedShop);
      }

      toast.success('Order created successfully');
      setShowNewOrderModal(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error('Failed to create order: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  }, [selectedShop, orderItems, user, calculateTotal, shops, allShops, isAdmin, selectedBooker, refetch]);

  const resetForm = useCallback(() => {
    setSelectedShop('');
    setOrderItems([]);
    setSelectedProduct('');
    setQuantity('1');
    setPaymentType('paid');
    setPaidAmount('');
    setSelectedBooker('');
  }, []);

  const viewOrder = useCallback((order: Order) => {
    setViewingOrder(order);
    setShowViewModal(true);
  }, []);

  const openEditModal = useCallback((order: Order) => {
    setEditingOrder(order);
    setEditStatus(order.status);
    setEditPaymentStatus(order.payment_status);
    setEditPaidAmount(order.paid_amount?.toString() || '0');
    setEditPaymentMethod('');
    setShowEditModal(true);
  }, []);

  const openEditBillModal = useCallback((order: Order) => {
    setEditBillOrder(order);
    setShowEditBillModal(true);
  }, []);

  // Delete order handler for order bookers
  const handleDeleteOrder = useCallback(async (order: Order) => {
    if (!confirm(`Are you sure you want to delete order ${order.order_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      // First, get total discounts given on this order from discount_history
      const { data: discountRecords } = await supabase
        .from('discount_history')
        .select('discount_value')
        .eq('order_id', order.id);

      const totalDiscountOnOrder = discountRecords?.reduce((sum, record) => sum + (record.discount_value || 0), 0) || 0;

      // Deduct discount from booker's total discounts if any discount was given
      if (totalDiscountOnOrder > 0) {
        const { data: bookerFinancials } = await supabase
          .from('booker_financials')
          .select('id, total_discounts_given')
          .eq('booker_id', order.booker_id)
          .maybeSingle();

        if (bookerFinancials) {
          await supabase
            .from('booker_financials')
            .update({
              total_discounts_given: Math.max(0, (bookerFinancials.total_discounts_given || 0) - totalDiscountOnOrder),
            })
            .eq('id', bookerFinancials.id);
        }

        // Delete discount history records for this order
        await supabase
          .from('discount_history')
          .delete()
          .eq('order_id', order.id);
      }

      // Restore stock for all order items
      for (const item of order.order_items || []) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity + item.quantity })
            .eq('id', item.product_id);
        }
      }

      // Delete order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      // Then delete the order
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Update shop credit balance (reduce by order amount since order is deleted)
      const shopList = isAdmin ? allShops : shops;
      const shop = shopList.find(s => s.id === order.shop_id);
      if (shop) {
        await supabase
          .from('shops')
          .update({ credit_balance: Math.max(0, (shop.credit_balance || 0) - order.total_amount) })
          .eq('id', order.shop_id);
      }

      toast.success('Order deleted successfully. Stock restored and discounts deducted.');
      refetch();
    } catch (error: any) {
      toast.error('Failed to delete order: ' + error.message);
    }
  }, [isAdmin, allShops, shops, products, refetch]);

  const handleUpdateOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    setSubmitting(true);
    try {
      const paid = parseFloat(editPaidAmount) || 0;
      const previousPaid = editingOrder.paid_amount || 0;
      const pendingAmount = editingOrder.total_amount - paid;
      
      // If pending amount is less than 1 PKR, consider it as fully paid
      const isFullyPaid = paid >= editingOrder.total_amount || pendingAmount < 1;
      const finalPaidAmount = isFullyPaid && pendingAmount < 1 && pendingAmount > 0 ? editingOrder.total_amount : paid;
      
      // Determine payment status
      let paymentStatus = editPaymentStatus;
      if (editPaymentStatus !== 'credit') {
        paymentStatus = isFullyPaid ? 'paid' : paid > 0 ? 'partial' : 'credit';
      }
      
      // Build update object
      const updateData: any = {
        payment_status: paymentStatus,
        paid_amount: finalPaidAmount,
      };

      // If payment is being received, record the date and method
      if (finalPaidAmount > previousPaid) {
        updateData.payment_received_at = new Date().toISOString();
        if (editPaymentMethod) {
          updateData.payment_method = editPaymentMethod;
        }
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', editingOrder.id);

      if (error) throw error;

      // Update shop credit balance when payment is made
      const creditChange = finalPaidAmount - previousPaid;
      if (creditChange !== 0) {
        const shopList = isAdmin ? allShops : shops;
        const shop = shopList.find(s => s.id === editingOrder.shop_id);
        if (shop) {
          const newCreditBalance = Math.max(0, (shop.credit_balance || 0) - creditChange);
          await supabase
            .from('shops')
            .update({ credit_balance: newCreditBalance })
            .eq('id', editingOrder.shop_id);
        }
      }

      toast.success('Order updated successfully');
      setShowEditModal(false);
      setEditingOrder(null);
      refetch();
    } catch (error: any) {
      toast.error('Failed to update order: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  }, [editingOrder, editStatus, editPaymentStatus, editPaidAmount, refetch]);

  const printOrder = useCallback((order: Order) => {
    // For admin, show print modal with discount option
    if (isAdmin) {
      setPrintingOrder(order);
      setShowPrintModal(true);
    } else {
      // For non-admin, print directly without discount option
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
          <div class="summary-row"><span>Paid Amount:</span><span>${formatCurrencyForPrint(order.paid_amount)}</span></div>
          <div class="summary-row"><span>Credit/Pending:</span><span>${formatCurrencyForPrint(order.total_amount - order.paid_amount)}</span></div>
          <div class="summary-row total"><span>Grand Total:</span><span>${formatCurrencyForPrint(order.total_amount)}</span></div>
        </div>
      `;
      printContent(content, `Order ${order.order_number}`);
    }
  }, [isAdmin]);

  const printAllOrders = useCallback(() => {
    const ordersToprint = routeFilteredOrders;
    const ordersHtml = ordersToprint.map(order => `
      <tr>
        <td>${safeText(order.order_number)}</td>
        <td>${safeText(order.shops?.name || 'N/A')}</td>
        <td>${safeText(order.booker_name || 'N/A')}</td>
        <td>${formatCurrencyForPrint(order.total_amount)}</td>
        <td>${formatCurrencyForPrint(order.paid_amount)}</td>
        <td><span class="badge ${getStatusBadgeClass(order.status)}">${safeText(order.status)}</span></td>
        <td><span class="badge ${getStatusBadgeClass(order.payment_status)}">${safeText(order.payment_status)}</span></td>
      </tr>
    `).join('');

    const routeTitle = routeFilter !== 'All' ? ` - Route: ${routeFilter}` : '';
    const content = `
      <div class="header">
        <h1>${safeText(COMPANY_INFO.name)}</h1>
        <div class="company-address">${safeText(COMPANY_INFO.address)}</div>
        <div class="company-phones">Ph: ${safeText(COMPANY_INFO.phone1)} | Ph: ${safeText(COMPANY_INFO.phone2)}</div>
        <p class="subtitle">Orders Report${routeTitle}</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Total Orders:</span><span class="info-value">${safeText(ordersToprint.length)}</span></div>
        <div class="info-item"><span class="info-label">Total Sales:</span><span class="info-value">${formatCurrencyForPrint(routeStats.totalSales)}</span></div>
        <div class="info-item"><span class="info-label">Cash Received:</span><span class="info-value">${formatCurrencyForPrint(routeStats.totalPaid)}</span></div>
        <div class="info-item"><span class="info-label">Credit/Pending:</span><span class="info-value">${formatCurrencyForPrint(routeStats.totalCredit)}</span></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Shop</th>
            <th>Booker</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Status</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>${ordersHtml}</tbody>
      </table>
    `;
    printContent(content, `Orders Report${routeTitle}`);
  }, [routeFilteredOrders, routeStats, routeFilter]);

  // Memoized columns configuration
  const columns = useMemo(() => [
    {
      key: 'order_number',
      header: 'Order ID',
      render: (item: Order) => (
        <span className="font-mono text-sm font-medium text-accent">{item.order_number}</span>
      ),
    },
    {
      key: 'shop',
      header: 'Shop',
      render: (item: Order) => (
        <div>
          <p className="font-medium">{item.shops?.name}</p>
          <p className="text-xs text-muted-foreground">{item.shops?.routes?.name}</p>
        </div>
      ),
    },
    { 
      key: 'booker', 
      header: 'Booker', 
      render: (item: Order) => item.booker_name || 'N/A' 
    },
    {
      key: 'total_amount',
      header: 'Amount',
      render: (item: Order) => <span className="font-medium">{formatCurrency(item.total_amount)}</span>,
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: (item: Order) => (
        <span className={getPaymentBadge(item.payment_status)}>
          {item.payment_status?.charAt(0).toUpperCase() + item.payment_status?.slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Order) => {
        // Order bookers can delete their own orders (not delivered/cancelled)
        const canDelete = !isAdmin && 
          item.booker_id === user?.id && 
          !['delivered', 'cancelled'].includes(item.status?.toLowerCase());
        
        return (
          <OrderActions
            order={item}
            isAdmin={isAdmin}
            canDelete={canDelete}
            onView={() => viewOrder(item)}
            onEdit={() => openEditModal(item)}
            onEditBill={() => openEditBillModal(item)}
            onPrint={() => printOrder(item)}
            onDelete={() => handleDeleteOrder(item)}
          />
        );
      },
    },
  ], [isAdmin, user?.id, viewOrder, openEditModal, openEditBillModal, printOrder, handleDeleteOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Orders</h1>
            <p className="page-subtitle">{isAdmin ? 'View and manage all orders' : 'Create and track your orders'}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <>
                <button 
                  onClick={() => setShowDailyAdminPrintModal(true)} 
                  className="btn-secondary"
                  title="Print daily load and bill summary for all admin orders"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Daily Summary
                </button>
                <button 
                  onClick={() => setShowBulkCashModal(true)} 
                  className="btn-secondary"
                  title="Bulk update cash status for multiple orders"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Bulk Cash Update
                </button>
              </>
            )}
            {isAdmin && routeFilter !== 'All' && (
              <>
                <button 
                  onClick={() => setShowRouteBillsModal(true)} 
                  className="btn-secondary"
                  title="Print all order bills for selected route"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Print All Bills
                </button>
                <button 
                  onClick={() => setShowRoutePrintModal(true)} 
                  className="btn-secondary"
                  title="Print delivery summary for selected route"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Print Route Delivery
                </button>
              </>
            )}
            <button onClick={printAllOrders} className="btn-secondary">
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </button>
            <button onClick={() => setShowNewOrderModal(true)} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by Order ID (e.g., ORD-...) or shop name..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="input-field pl-10"
          />
        </div>
        
        {/* Route Filter for Admin */}
        {isAdmin && routes.length > 0 && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="input-field min-w-[150px]"
            >
              <option value="All">All Routes</option>
              {routes.map((route) => (
                <option key={route.id} value={route.name}>
                  {route.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Booker Filter for Admin */}
        {isAdmin && uniqueBookers.length > 0 && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <select
              value={bookerFilter}
              onChange={(e) => setBookerFilter(e.target.value)}
              className="input-field min-w-[150px]"
            >
              <option value="All">All Bookers</option>
              {uniqueBookers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Filter for Admin */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                if (e.target.value !== 'custom') setCustomDate('');
              }}
              className="input-field min-w-[120px]"
            >
              {datePresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
            {datePreset === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="input-field"
              />
            )}
          </div>
        )}
      </div>


      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground self-center">Payment:</span>
        {paymentFilters.map((status) => (
          <FilterButton
            key={status}
            label={status}
            isActive={paymentFilter === status}
            onClick={() => setPaymentFilter(status)}
          />
        ))}
      </div>

      {/* Stats - Admin sees all stats, Order Bookers see only daily sales */}
      {isAdmin ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="mt-1 text-2xl font-bold">{routeStats.totalOrders}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(routeStats.totalSales)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Cash Received</p>
            <p className="mt-1 text-2xl font-bold text-success">{formatCurrency(routeStats.totalPaid)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Credit/Pending</p>
            <p className="mt-1 text-2xl font-bold text-warning">{formatCurrency(routeStats.totalCredit)}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Today's Orders</p>
            <p className="mt-1 text-2xl font-bold">{dailySales.totalOrders}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Today's Sales</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(dailySales.totalSales)}</p>
          </div>
        </div>
      )}

      <DataTable 
        columns={columns} 
        data={routeFilteredOrders} 
        keyExtractor={(item) => item.id} 
        emptyMessage="No orders found" 
      />

      {/* Modals */}
      {showNewOrderModal && (
        <NewOrderModal
          shops={isAdmin ? allShops : shops}
          products={products}
          orderItems={orderItems}
          selectedShop={selectedShop}
          selectedProduct={selectedProduct}
          quantity={quantity}
          paymentType={paymentType}
          paidAmount={paidAmount}
          submitting={submitting}
          isAdmin={isAdmin}
          bookers={bookers}
          selectedBooker={selectedBooker}
          onShopChange={setSelectedShop}
          onProductChange={setSelectedProduct}
          onQuantityChange={setQuantity}
          onPaymentTypeChange={setPaymentType}
          onPaidAmountChange={setPaidAmount}
          onBookerChange={setSelectedBooker}
          onAddItem={addItemToOrder}
          onRemoveItem={removeItem}
          onSubmit={handleCreateOrder}
          onClose={() => { setShowNewOrderModal(false); resetForm(); }}
          calculateTotal={calculateTotal}
        />
      )}

      {showViewModal && viewingOrder && (
        <ViewOrderModal
          order={viewingOrder}
          onClose={() => setShowViewModal(false)}
        />
      )}

      {showEditModal && editingOrder && isAdmin && (
        <EditOrderModal
          order={editingOrder}
          editStatus={editStatus}
          editPaymentStatus={editPaymentStatus}
          editPaidAmount={editPaidAmount}
          editPaymentMethod={editPaymentMethod}
          submitting={submitting}
          onStatusChange={setEditStatus}
          onPaymentStatusChange={setEditPaymentStatus}
          onPaidAmountChange={setEditPaidAmount}
          onPaymentMethodChange={setEditPaymentMethod}
          onSubmit={handleUpdateOrder}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showPrintModal && printingOrder && (
        <PrintOrderModal
          order={printingOrder}
          onClose={() => {
            setShowPrintModal(false);
            setPrintingOrder(null);
          }}
          onOrderUpdated={refetch}
        />
      )}

      {showRoutePrintModal && routeFilter !== 'All' && (
        <RouteDeliveryPrintModal
          routeName={routeFilter}
          orders={routeFilteredOrders}
          shops={isAdmin ? allShops : shops}
          products={products}
          bookerName={selectedRouteBooker}
          onClose={() => setShowRoutePrintModal(false)}
        />
      )}

      {showRouteBillsModal && routeFilter !== 'All' && (
        <RouteBillsPrintModal
          routeName={routeFilter}
          orders={routeFilteredOrders}
          onClose={() => setShowRouteBillsModal(false)}
        />
      )}

      {showBulkCashModal && isAdmin && (
        <BulkCashUpdateModal
          orders={routeFilteredOrders}
          onClose={() => setShowBulkCashModal(false)}
          onSuccess={refetch}
        />
      )}

      {showDailyAdminPrintModal && isAdmin && (
        <DailyAdminOrdersPrintModal
          orders={routeFilteredOrders}
          shops={allShops}
          products={products}
          selectedDate={datePreset === 'today' ? 'Today' : datePreset === 'yesterday' ? 'Yesterday' : datePreset === 'custom' && customDate ? customDate : 'All Time'}
          onClose={() => setShowDailyAdminPrintModal(false)}
        />
      )}

      {showEditBillModal && editBillOrder && isAdmin && (
        <EditBillModal
          order={editBillOrder}
          products={products}
          onClose={() => {
            setShowEditBillModal(false);
            setEditBillOrder(null);
          }}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};

export default Orders;
