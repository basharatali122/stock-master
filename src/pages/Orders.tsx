import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Eye, ShoppingCart, Loader2, X, Printer, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { printContent, formatCurrencyForPrint, getStatusBadgeClass } from '@/lib/print';

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
  booker_profile?: { full_name: string } | null;
  order_items?: OrderItem[];
}

interface Shop {
  id: string;
  name: string;
  route_id: string;
  credit_balance: number;
  routes?: { name: string };
}

interface Product {
  id: string;
  name: string;
  price: number;
  discount_percentage: number;
}

const statusFilters = ['All', 'Pending', 'Confirmed', 'Delivered', 'Cancelled'];
const paymentFilters = ['All', 'Paid', 'Credit', 'Partial', 'Pending'];

const Orders: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');

  const [selectedShop, setSelectedShop] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number; price: number; discount: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentType, setPaymentType] = useState('paid');
  const [paidAmount, setPaidAmount] = useState('');

  const fetchData = async () => {
    try {
      // Fetch orders with relations
      let query = supabase
        .from('orders')
        .select(`
          *,
          shops(name, routes(name)),
          order_items(*, products(name))
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin && user) {
        query = query.eq('booker_id', user.id);
      }

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      // Fetch booker profiles
      const ordersWithBookers = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', order.booker_id)
            .maybeSingle();
          return { ...order, booker_profile: profile };
        })
      );

      setOrders(ordersWithBookers);

      // Fetch shops with credit balance
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select('id, name, route_id, credit_balance, routes(name)')
        .order('name');
      if (shopsError) throw shopsError;
      setShops(shopsData || []);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, discount_percentage, stock_quantity')
        .eq('is_active', true)
        .order('name');
      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (error: any) {
      toast.error('Failed to load orders: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin, user]);

  // Real-time subscription for orders
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, user]);

  const addItemToOrder = () => {
    if (!selectedProduct || !quantity || parseInt(quantity) < 1) {
      toast.error('Please select a product and quantity');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingIndex = orderItems.findIndex(i => i.productId === selectedProduct);
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += parseInt(quantity);
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        productId: selectedProduct,
        quantity: parseInt(quantity),
        price: product.price,
        discount: product.discount_percentage || 0
      }]);
    }

    setSelectedProduct('');
    setQuantity('1');
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      const discountedPrice = item.price * (1 - item.discount / 100);
      return sum + discountedPrice * item.quantity;
    }, 0);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || orderItems.length === 0) {
      toast.error('Please select a shop and add items');
      return;
    }

    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setSubmitting(true);
    try {
      const total = calculateTotal();
      const paid = paymentType === 'paid' ? total : (parseFloat(paidAmount) || 0);
      const paymentStatus = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending';

      // Create order - order_number is auto-generated by trigger
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

      // Create order items
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

      // Update shop credit balance if credit given
      if (paid < total) {
        const creditAmount = total - paid;
        const shop = shops.find(s => s.id === selectedShop);
        if (shop) {
          const { error: shopError } = await supabase
            .from('shops')
            .update({ credit_balance: creditAmount })
            .eq('id', selectedShop);
          if (shopError) console.error('Failed to update shop credit:', shopError);
        }
      }

      toast.success('Order created successfully');
      setShowNewOrderModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create order: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedShop('');
    setOrderItems([]);
    setSelectedProduct('');
    setQuantity('1');
    setPaymentType('paid');
    setPaidAmount('');
  };

  const viewOrder = (order: Order) => {
    setViewingOrder(order);
    setShowViewModal(true);
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setEditStatus(order.status);
    setEditPaymentStatus(order.payment_status);
    setEditPaidAmount(order.paid_amount?.toString() || '0');
    setShowEditModal(true);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
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
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update order: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const printOrder = (order: Order) => {
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
        <div class="info-item"><span class="info-label">Order Booker:</span><span class="info-value">${order.booker_profile?.full_name || 'N/A'}</span></div>
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
  };

  const printAllOrders = () => {
    const ordersHtml = filteredOrders.map(order => `
      <tr>
        <td>${order.order_number}</td>
        <td>${order.shops?.name || 'N/A'}</td>
        <td>${order.booker_profile?.full_name || 'N/A'}</td>
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
        <div class="info-item"><span class="info-label">Total Sales:</span><span class="info-value">${formatCurrencyForPrint(totalSales)}</span></div>
        <div class="info-item"><span class="info-label">Cash Received:</span><span class="info-value">${formatCurrencyForPrint(totalPaid)}</span></div>
        <div class="info-item"><span class="info-label">Credit/Pending:</span><span class="info-value">${formatCurrencyForPrint(totalCredit)}</span></div>
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
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shops?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' || order.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesPayment =
      paymentFilter === 'All' || order.payment_status?.toLowerCase() === paymentFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesPayment;
  });

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

  const columns = [
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
    { key: 'booker', header: 'Booker', render: (item: Order) => item.booker_profile?.full_name || 'N/A' },
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
        <div className="flex gap-1">
          <button onClick={() => viewOrder(item)} className="rounded-lg p-2 hover:bg-muted" title="View">
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
          {isAdmin && (
            <button onClick={() => openEditModal(item)} className="rounded-lg p-2 hover:bg-muted" title="Edit">
              <Edit2 className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <button onClick={() => printOrder(item)} className="rounded-lg p-2 hover:bg-muted" title="Print">
            <Printer className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ),
    },
  ];

  const totalSales = orders.reduce((acc, order) => acc + (order.total_amount || 0), 0);
  const totalPaid = orders.reduce((acc, order) => acc + (order.paid_amount || 0), 0);
  const totalCredit = totalSales - totalPaid;

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
          <input type="text" placeholder="Search by order ID or shop..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Status:</span>
          {statusFilters.map((status) => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${statusFilter === status ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground self-center">Payment:</span>
        {paymentFilters.map((status) => (
          <button key={status} onClick={() => setPaymentFilter(status)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${paymentFilter === status ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
            {status}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card"><p className="text-sm text-muted-foreground">Total Orders</p><p className="mt-1 text-2xl font-bold">{orders.length}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Total Sales</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalSales)}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Cash Received</p><p className="mt-1 text-2xl font-bold text-success">{formatCurrency(totalPaid)}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">Credit/Pending</p><p className="mt-1 text-2xl font-bold text-warning">{formatCurrency(totalCredit)}</p></div>
      </div>

      <DataTable columns={columns} data={filteredOrders} keyExtractor={(item) => item.id} emptyMessage="No orders found" />

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground">Create New Order</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select shop and add products</p>

            <form onSubmit={handleCreateOrder} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Shop *</label>
                <select className="input-field" value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)} disabled={submitting}>
                  <option value="">Select shop</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>{shop.name} ({shop.routes?.name})</option>
                  ))}
                </select>
              </div>

              {/* Credit/Dues Warning */}
              {selectedShop && (() => {
                const shop = shops.find(s => s.id === selectedShop);
                const creditBalance = shop?.credit_balance || 0;
                if (creditBalance > 0) {
                  return (
                    <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-warning">Outstanding Credit</h4>
                          <p className="text-sm text-warning/80 mt-1">
                            This shop has pending dues of <span className="font-bold">{formatCurrency(creditBalance)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Please consider collecting previous dues before processing new credit orders.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="mb-1.5 block text-sm font-medium">Add Products</label>
                <div className="flex items-center gap-2">
                  <select className="input-field flex-1" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} disabled={submitting}>
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} - Rs. {p.price}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="Qty" className="input-field w-20" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={submitting} />
                  <button type="button" onClick={addItemToOrder} className="btn-accent" disabled={submitting}>Add</button>
                </div>
              </div>

              {orderItems.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  {orderItems.map((item, idx) => {
                    const product = products.find(p => p.id === item.productId);
                    const itemTotal = item.price * item.quantity * (1 - item.discount / 100);
                    return (
                      <div key={idx} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                        <span>{product?.name} x {item.quantity}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(itemTotal)}</span>
                          <button type="button" onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive/80">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Payment Type</label>
                  <select className="input-field" value={paymentType} onChange={(e) => setPaymentType(e.target.value)} disabled={submitting}>
                    <option value="paid">Cash (Full Payment)</option>
                    <option value="credit">Credit</option>
                    <option value="partial">Partial Payment</option>
                  </select>
                </div>
                {paymentType !== 'paid' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Amount Paid</label>
                    <input type="number" className="input-field" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} disabled={submitting} />
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-primary/5 p-4">
                <h3 className="font-medium mb-2">Order Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span>{orderItems.length}</span></div>
                  <div className="flex justify-between font-medium text-base pt-2 border-t border-border"><span>Total</span><span>{formatCurrency(calculateTotal())}</span></div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => { setShowNewOrderModal(false); resetForm(); }} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-success" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {showViewModal && viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Order {viewingOrder.order_number}</h2>
              <button onClick={() => setShowViewModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Shop:</span> <span className="font-medium">{viewingOrder.shops?.name}</span></div>
                <div><span className="text-muted-foreground">Booker:</span> <span className="font-medium">{viewingOrder.booker_profile?.full_name}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className={getStatusBadge(viewingOrder.status)}>{viewingOrder.status}</span></div>
                <div><span className="text-muted-foreground">Payment:</span> <span className={getPaymentBadge(viewingOrder.payment_status)}>{viewingOrder.payment_status}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{new Date(viewingOrder.created_at).toLocaleDateString()}</span></div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="font-medium mb-2">Items</h3>
                <div className="space-y-2">
                  {viewingOrder.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                      <span>{item.products?.name} x {item.quantity}</span>
                      <span className="font-medium">{formatCurrency(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Total Amount:</span><span className="font-medium">{formatCurrency(viewingOrder.total_amount)}</span></div>
                <div className="flex justify-between"><span>Paid:</span><span className="text-success font-medium">{formatCurrency(viewingOrder.paid_amount)}</span></div>
                <div className="flex justify-between"><span>Credit:</span><span className="text-warning font-medium">{formatCurrency(viewingOrder.total_amount - viewingOrder.paid_amount)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal (Admin Only) */}
      {showEditModal && editingOrder && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Update Order {editingOrder.order_number}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleUpdateOrder} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Order Status</label>
                <select className="input-field" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} disabled={submitting}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Payment Status</label>
                <select className="input-field" value={editPaymentStatus} onChange={(e) => setEditPaymentStatus(e.target.value)} disabled={submitting}>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Paid Amount</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={editPaidAmount} 
                  onChange={(e) => setEditPaidAmount(e.target.value)} 
                  disabled={submitting}
                  max={editingOrder.total_amount}
                />
                <p className="text-xs text-muted-foreground mt-1">Total: Rs. {editingOrder.total_amount.toLocaleString()}</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Update Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
