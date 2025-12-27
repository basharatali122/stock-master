import React, { useState, useCallback, useMemo, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Eye, Loader2, Printer, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { printContent, formatCurrencyForPrint, getStatusBadgeClass } from '@/lib/print';
import { useOrders, useOrderFilters } from '@/hooks/useOrders';
import { ViewOrderModal, EditOrderModal, NewOrderModal } from '@/components/orders/OrderModals';
import { z } from 'zod';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_applied: number;
  total_price: number;
  products?: { name: string };
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

const statusFilters = ['All', 'Pending', 'Confirmed', 'Delivered', 'Cancelled'];
const paymentFilters = ['All', 'Paid', 'Credit', 'Partial', 'Pending'];

const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

const getStatusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'delivered': return 'badge-success';
    case 'confirmed': return 'badge-info';
    case 'pending': return 'badge-pending';
    case 'cancelled': return 'badge-destructive';
    default: return 'badge-info';
  }
};

const getPaymentBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'paid': return 'badge-success';
    case 'credit': case 'pending': return 'badge-pending';
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
  onView, 
  onEdit, 
  onPrint 
}: { 
  order: Order; 
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onPrint: () => void;
}) => (
  <div className="flex gap-1">
    <button onClick={onView} className="rounded-lg p-2 hover:bg-muted" title="View">
      <Eye className="h-4 w-4 text-muted-foreground" />
    </button>
    {isAdmin && (
      <button onClick={onEdit} className="rounded-lg p-2 hover:bg-muted" title="Edit">
        <Edit2 className="h-4 w-4 text-muted-foreground" />
      </button>
    )}
    <button onClick={onPrint} className="rounded-lg p-2 hover:bg-muted" title="Print">
      <Printer className="h-4 w-4 text-muted-foreground" />
    </button>
  </div>
));

OrderActions.displayName = 'OrderActions';

const Orders: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const { orders, shops, products, loading, refetch } = useOrders(isAdmin, user?.id);
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    filteredOrders,
    stats
  } = useOrderFilters(orders);

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
  }, [selectedProduct, quantity, products]);

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

    // Validate paid amount
    const total = calculateTotal();
    const paid = paymentType === 'paid' ? total : (parseFloat(paidAmount) || 0);
    
    if (paid < 0) {
      toast.error('Paid amount cannot be negative');
      return;
    }
    
    if (paid > total * 2) {
      toast.error('Paid amount seems too high');
      return;
    }

    setSubmitting(true);
    try {
      const paymentStatus = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending';

      const orderNumber = `ORD-${Date.now()}`;
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          shop_id: selectedShop,
          booker_id: user.id,
          total_amount: total,
          paid_amount: paid,
          status: 'pending',
          payment_status: paymentStatus,
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

      if (paid < total) {
        const creditAmount = total - paid;
        const shop = shops.find(s => s.id === selectedShop);
        if (shop) {
          await supabase
            .from('shops')
            .update({ credit_balance: creditAmount })
            .eq('id', selectedShop);
        }
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
  }, [selectedShop, orderItems, user, paymentType, paidAmount, calculateTotal, shops, refetch]);

  const resetForm = useCallback(() => {
    setSelectedShop('');
    setOrderItems([]);
    setSelectedProduct('');
    setQuantity('1');
    setPaymentType('paid');
    setPaidAmount('');
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
    setShowEditModal(true);
  }, []);

  const handleUpdateOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    setSubmitting(true);
    try {
      const paid = parseFloat(editPaidAmount) || 0;
      const paymentStatus = paid >= editingOrder.total_amount ? 'paid' : paid > 0 ? 'partial' : 'pending';

      const { error } = await supabase
        .from('orders')
        .update({
          status: editStatus,
          payment_status: editPaymentStatus === 'credit' ? 'credit' : paymentStatus,
          paid_amount: paid,
        })
        .eq('id', editingOrder.id);

      if (error) throw error;

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
    const itemsHtml = order.order_items?.map(item => `
      <tr>
        <td>${item.products?.name || 'N/A'}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrencyForPrint(item.unit_price)}</td>
        <td>${item.discount_applied || 0}%</td>
        <td>${formatCurrencyForPrint(item.total_price)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">No items</td></tr>';

    const content = `
      <div class="header">
        <h1>AR Traders</h1>
        <p>Order Invoice</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Order Number:</span><span class="info-value">${order.order_number}</span></div>
        <div class="info-item"><span class="info-label">Date:</span><span class="info-value">${new Date(order.created_at).toLocaleDateString()}</span></div>
        <div class="info-item"><span class="info-label">Shop:</span><span class="info-value">${order.shops?.name || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Route:</span><span class="info-value">${order.shops?.routes?.name || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Order Booker:</span><span class="info-value">${order.booker_name || 'N/A'}</span></div>
        <div class="info-item"><span class="info-label">Status:</span><span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span></div>
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
        <div class="summary-row total"><span>Total:</span><span>${formatCurrencyForPrint(order.total_amount)}</span></div>
      </div>
    `;
    printContent(content, `Order ${order.order_number}`);
  }, []);

  const printAllOrders = useCallback(() => {
    const ordersHtml = filteredOrders.map(order => `
      <tr>
        <td>${order.order_number}</td>
        <td>${order.shops?.name || 'N/A'}</td>
        <td>${order.booker_name || 'N/A'}</td>
        <td>${formatCurrencyForPrint(order.total_amount)}</td>
        <td>${formatCurrencyForPrint(order.paid_amount)}</td>
        <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span></td>
        <td><span class="badge ${getStatusBadgeClass(order.payment_status)}">${order.payment_status}</span></td>
      </tr>
    `).join('');

    const content = `
      <div class="header">
        <h1>AR Traders</h1>
        <p>Orders Report</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Total Orders:</span><span class="info-value">${filteredOrders.length}</span></div>
        <div class="info-item"><span class="info-label">Total Sales:</span><span class="info-value">${formatCurrencyForPrint(stats.totalSales)}</span></div>
        <div class="info-item"><span class="info-label">Cash Received:</span><span class="info-value">${formatCurrencyForPrint(stats.totalPaid)}</span></div>
        <div class="info-item"><span class="info-label">Credit/Pending:</span><span class="info-value">${formatCurrencyForPrint(stats.totalCredit)}</span></div>
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
    printContent(content, 'Orders Report');
  }, [filteredOrders, stats]);

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
      key: 'status',
      header: 'Status',
      render: (item: Order) => (
        <span className={getStatusBadge(item.status)}>
          {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
        </span>
      ),
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
      render: (item: Order) => (
        <OrderActions
          order={item}
          isAdmin={isAdmin}
          onView={() => viewOrder(item)}
          onEdit={() => openEditModal(item)}
          onPrint={() => printOrder(item)}
        />
      ),
    },
  ], [isAdmin, viewOrder, openEditModal, printOrder]);

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
          <div className="flex gap-2">
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

      <div className="flex flex-col gap-4 lg:flex-row">
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
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Status:</span>
          {statusFilters.map((status) => (
            <FilterButton
              key={status}
              label={status}
              isActive={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            />
          ))}
        </div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalOrders}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Sales</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(stats.totalSales)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Cash Received</p>
          <p className="mt-1 text-2xl font-bold text-success">{formatCurrency(stats.totalPaid)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Credit/Pending</p>
          <p className="mt-1 text-2xl font-bold text-warning">{formatCurrency(stats.totalCredit)}</p>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredOrders} 
        keyExtractor={(item) => item.id} 
        emptyMessage="No orders found" 
      />

      {/* Modals */}
      {showNewOrderModal && (
        <NewOrderModal
          shops={shops}
          products={products}
          orderItems={orderItems}
          selectedShop={selectedShop}
          selectedProduct={selectedProduct}
          quantity={quantity}
          paymentType={paymentType}
          paidAmount={paidAmount}
          submitting={submitting}
          onShopChange={setSelectedShop}
          onProductChange={setSelectedProduct}
          onQuantityChange={setQuantity}
          onPaymentTypeChange={setPaymentType}
          onPaidAmountChange={setPaidAmount}
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
          submitting={submitting}
          onStatusChange={setEditStatus}
          onPaymentStatusChange={setEditPaymentStatus}
          onPaidAmountChange={setEditPaidAmount}
          onSubmit={handleUpdateOrder}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};

export default Orders;
