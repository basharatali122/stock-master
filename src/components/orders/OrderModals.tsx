import React, { memo, useEffect, useState, useMemo, useRef } from 'react';
import { X, Loader2, ShoppingCart, AlertTriangle, Calendar, Package, Box, Search, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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
  product_code: string | null;
  price: number;
  discount_percentage: number;
  stock_quantity: number;
  boxes_per_carton: number;
}

interface NewOrderItem {
  productId: string;
  quantity: number;
  price: number;
  discount: number;
}

interface PendingCredit {
  id: string;
  order_number: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  created_at: string;
}

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

// View Order Modal
interface ViewModalProps {
  order: Order;
  onClose: () => void;
}

export const ViewOrderModal = memo(({ order, onClose }: ViewModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
    <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-foreground">Order {order.order_number}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Shop:</span> <span className="font-medium">{order.shops?.name}</span></div>
          <div><span className="text-muted-foreground">Booker:</span> <span className="font-medium">{order.booker_name || 'N/A'}</span></div>
          <div><span className="text-muted-foreground">Status:</span> <span className={getStatusBadge(order.status)}>{order.status}</span></div>
          <div><span className="text-muted-foreground">Payment:</span> <span className={getPaymentBadge(order.payment_status)}>{order.payment_status}</span></div>
          <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{new Date(order.created_at).toLocaleDateString()}</span></div>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="font-medium mb-2">Items</h3>
          <div className="space-y-2">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                <span>
                  {item.products?.product_code && (
                    <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded mr-2">{item.products.product_code}</span>
                  )}
                  {item.products?.name} x {item.quantity}
                </span>
                <span className="font-medium">{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span>Total Amount:</span><span className="font-medium">{formatCurrency(order.total_amount)}</span></div>
          <div className="flex justify-between"><span>Paid:</span><span className="text-success font-medium">{formatCurrency(order.paid_amount)}</span></div>
          <div className="flex justify-between"><span>Credit:</span><span className="text-warning font-medium">{formatCurrency(order.total_amount - order.paid_amount)}</span></div>
        </div>
      </div>
    </div>
  </div>
));

ViewOrderModal.displayName = 'ViewOrderModal';

// Edit Order Modal
interface EditModalProps {
  order: Order;
  editStatus: string;
  editPaymentStatus: string;
  editPaidAmount: string;
  submitting: boolean;
  onStatusChange: (value: string) => void;
  onPaymentStatusChange: (value: string) => void;
  onPaidAmountChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const EditOrderModal = memo(({
  order,
  editStatus,
  editPaymentStatus,
  editPaidAmount,
  submitting,
  onStatusChange,
  onPaymentStatusChange,
  onPaidAmountChange,
  onSubmit,
  onClose
}: EditModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
    <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-foreground">Update Order {order.order_number}</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Order Status</label>
          <select className="input-field" value={editStatus} onChange={(e) => onStatusChange(e.target.value)} disabled={submitting}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Payment Status</label>
          <select className="input-field" value={editPaymentStatus} onChange={(e) => onPaymentStatusChange(e.target.value)} disabled={submitting}>
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
            onChange={(e) => onPaidAmountChange(e.target.value)} 
            disabled={submitting}
            max={order.total_amount}
          />
          <p className="text-xs text-muted-foreground mt-1">Total: Rs. {order.total_amount.toLocaleString()}</p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Update Order
          </button>
        </div>
      </form>
    </div>
  </div>
));

EditOrderModal.displayName = 'EditOrderModal';

// New Order Modal
interface NewOrderModalProps {
  shops: Shop[];
  products: Product[];
  orderItems: NewOrderItem[];
  selectedShop: string;
  selectedProduct: string;
  quantity: string;
  paymentType: string;
  paidAmount: string;
  submitting: boolean;
  onShopChange: (value: string) => void;
  onProductChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onPaymentTypeChange: (value: string) => void;
  onPaidAmountChange: (value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  calculateTotal: () => number;
}

export const NewOrderModal = memo(({
  shops,
  products,
  orderItems,
  selectedShop,
  selectedProduct,
  quantity,
  paymentType,
  paidAmount,
  submitting,
  onShopChange,
  onProductChange,
  onQuantityChange,
  onPaymentTypeChange,
  onPaidAmountChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
  onClose,
  calculateTotal
}: NewOrderModalProps) => {
  const selectedShopData = shops.find(s => s.id === selectedShop);
  const [pendingCredits, setPendingCredits] = useState<PendingCredit[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [totalPendingDues, setTotalPendingDues] = useState(0);
  const [liveProducts, setLiveProducts] = useState<Product[]>(products);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return liveProducts;
    const searchLower = productSearch.toLowerCase();
    return liveProducts.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      (p.product_code && p.product_code.toLowerCase().includes(searchLower))
    );
  }, [liveProducts, productSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get selected product info
  const selectedProductData = useMemo(() => {
    return liveProducts.find(p => p.id === selectedProduct);
  }, [liveProducts, selectedProduct]);

  // Calculate already ordered quantity for the selected product
  const orderedQty = useMemo(() => {
    return orderItems
      .filter(item => item.productId === selectedProduct)
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [orderItems, selectedProduct]);

  // Initialize live products from props
  useEffect(() => {
    setLiveProducts(products);
  }, [products]);

  // Set up real-time subscription for product stock updates
  useEffect(() => {
    const channel = supabase
      .channel('order-products-stock')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          // Update the product in our local state
          setLiveProducts(prev => 
            prev.map(p => 
              p.id === payload.new.id 
                ? { ...p, stock_quantity: payload.new.stock_quantity as number }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch all pending credits when shop is selected
  useEffect(() => {
    const fetchPendingCredits = async () => {
      if (!selectedShop) {
        setPendingCredits([]);
        setTotalPendingDues(0);
        return;
      }

      setLoadingCredits(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, paid_amount, created_at, payment_status')
          .eq('shop_id', selectedShop)
          .in('payment_status', ['credit', 'partial', 'pending'])
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const credits: PendingCredit[] = (data || [])
          .map(order => ({
            id: order.id,
            order_number: order.order_number,
            total_amount: order.total_amount,
            paid_amount: order.paid_amount || 0,
            pending_amount: order.total_amount - (order.paid_amount || 0),
            created_at: order.created_at,
          }))
          .filter(order => order.pending_amount > 0);

        setPendingCredits(credits);
        setTotalPendingDues(credits.reduce((sum, c) => sum + c.pending_amount, 0));
      } catch (error) {
        console.error('Error fetching pending credits:', error);
      } finally {
        setLoadingCredits(false);
      }
    };

    fetchPendingCredits();
  }, [selectedShop]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-foreground">Create New Order</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select shop and add products</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Shop *</label>
            <select className="input-field" value={selectedShop} onChange={(e) => onShopChange(e.target.value)} disabled={submitting}>
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name} ({shop.routes?.name})</option>
              ))}
            </select>
          </div>

          {/* Outstanding Credits Section */}
          {selectedShop && loadingCredits && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading credit history...</span>
            </div>
          )}

          {selectedShop && !loadingCredits && pendingCredits.length > 0 && (
            <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-warning">Outstanding Credits/Dues</h4>
                  <p className="text-sm text-warning/80 mt-1">
                    Total pending dues: <span className="font-bold text-lg">{formatCurrency(totalPendingDues)}</span>
                  </p>
                </div>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b border-warning/30">
                  <span>Order #</span>
                  <span>Date</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Pending</span>
                </div>
                {pendingCredits.map((credit) => (
                  <div key={credit.id} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-warning/20 last:border-0">
                    <span className="font-mono text-xs font-medium text-foreground truncate" title={credit.order_number}>
                      {credit.order_number}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(credit.created_at), 'dd MMM yy')}
                    </span>
                    <span className="text-right text-muted-foreground">
                      {formatCurrency(credit.total_amount)}
                    </span>
                    <span className="text-right font-semibold text-warning">
                      {formatCurrency(credit.pending_amount)}
                    </span>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-warning/30">
                Please consider collecting previous dues before processing new credit orders.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Add Products</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1" ref={productSearchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="input-field pl-10 pr-8 text-sm sm:text-base"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                      if (!e.target.value) onProductChange('');
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    disabled={submitting}
                  />
                  {(selectedProduct || productSearch) && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      onClick={() => {
                        setProductSearch('');
                        onProductChange('');
                        setShowProductDropdown(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-[100] mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                    {filteredProducts.slice(0, 50).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`w-full px-3 py-2 text-left hover:bg-accent/50 flex items-center justify-between transition-colors border-b border-border/50 last:border-b-0 ${
                          selectedProduct === p.id ? 'bg-primary/10' : ''
                        } ${p.stock_quantity === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                        onClick={() => {
                          if (p.stock_quantity > 0) {
                            onProductChange(p.id);
                            setProductSearch(p.product_code ? `[${p.product_code}] ${p.name}` : p.name);
                            setShowProductDropdown(false);
                          }
                        }}
                        disabled={submitting || p.stock_quantity === 0}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.product_code && (
                              <span className="font-mono text-[10px] sm:text-xs bg-muted px-1 py-0.5 rounded shrink-0">
                                {p.product_code}
                              </span>
                            )}
                            <span className="text-xs sm:text-sm font-medium leading-tight">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Rs. {p.price.toLocaleString()}</span>
                            <span className={`${p.stock_quantity === 0 ? 'text-destructive font-medium' : p.stock_quantity < 10 ? 'text-destructive' : p.stock_quantity < 50 ? 'text-warning' : 'text-success'}`}>
                              {p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} available`}
                            </span>
                          </div>
                        </div>
                        {selectedProduct === p.id && (
                          <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                    {filteredProducts.length > 50 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground text-center bg-muted/30">
                        Showing first 50 of {filteredProducts.length} results. Type more to narrow down.
                      </div>
                    )}
                  </div>
                )}
                {showProductDropdown && productSearch && filteredProducts.length === 0 && (
                  <div className="absolute z-[100] mt-1 w-full rounded-lg border border-border bg-card shadow-lg px-3 py-4 text-center">
                    <p className="text-sm text-muted-foreground">No products found for "{productSearch}"</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Qty" 
                  className="input-field w-20 text-sm sm:text-base" 
                  min="1" 
                  value={quantity} 
                  onChange={(e) => onQuantityChange(e.target.value)} 
                  disabled={submitting} 
                />
                <button 
                  type="button" 
                  onClick={() => {
                    onAddItem();
                    setProductSearch('');
                    setShowProductDropdown(false);
                  }} 
                  className="btn-accent whitespace-nowrap" 
                  disabled={submitting || !selectedProduct}
                >
                  Add
                </button>
              </div>
            </div>
            {selectedProduct && (
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <Check className="h-3 w-3" /> Product selected - enter quantity and click Add
              </p>
            )}
          </div>

          {/* Real-time Stock Info for Selected Product */}
          {selectedProductData && (
            <div className={`rounded-lg border p-3 ${
              selectedProductData.stock_quantity < parseInt(quantity || '0') + orderedQty
                ? 'border-destructive/50 bg-destructive/10'
                : selectedProductData.stock_quantity < 50
                ? 'border-warning/50 bg-warning/10'
                : 'border-success/50 bg-success/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    selectedProductData.stock_quantity < parseInt(quantity || '0') + orderedQty
                      ? 'bg-destructive/20'
                      : selectedProductData.stock_quantity < 50
                      ? 'bg-warning/20'
                      : 'bg-success/20'
                  }`}>
                    <Package className={`h-5 w-5 ${
                      selectedProductData.stock_quantity < parseInt(quantity || '0') + orderedQty
                        ? 'text-destructive'
                        : selectedProductData.stock_quantity < 50
                        ? 'text-warning'
                        : 'text-success'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedProductData.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedProductData.product_code && (
                        <span className="font-mono bg-muted px-1 py-0.5 rounded mr-2">{selectedProductData.product_code}</span>
                      )}
                      {selectedProductData.boxes_per_carton || 24} boxes/carton
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    <span className={`text-lg font-bold ${
                      selectedProductData.stock_quantity < parseInt(quantity || '0') + orderedQty
                        ? 'text-destructive'
                        : selectedProductData.stock_quantity < 50
                        ? 'text-warning'
                        : 'text-success'
                    }`}>
                      {selectedProductData.stock_quantity.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">boxes available</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {Math.floor(selectedProductData.stock_quantity / (selectedProductData.boxes_per_carton || 24))} cartons
                  </p>
                </div>
              </div>
              
              {selectedProductData.stock_quantity < parseInt(quantity || '0') + orderedQty && (
                <div className="mt-2 pt-2 border-t border-destructive/30">
                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Insufficient stock! Requested: {parseInt(quantity || '0') + orderedQty}, Available: {selectedProductData.stock_quantity}
                  </p>
                </div>
              )}
              
              {orderedQty > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Already in order: <span className="font-medium">{orderedQty} boxes</span>
                  </p>
                </div>
              )}
            </div>
          )}

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
                      <button type="button" onClick={() => onRemoveItem(idx)} className="text-destructive hover:text-destructive/80">
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
              <select className="input-field" value={paymentType} onChange={(e) => onPaymentTypeChange(e.target.value)} disabled={submitting}>
                <option value="paid">Cash (Full Payment)</option>
                <option value="credit">Credit</option>
                <option value="partial">Partial Payment</option>
              </select>
            </div>
            {paymentType !== 'paid' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Amount Paid</label>
                <input type="number" className="input-field" placeholder="0" value={paidAmount} onChange={(e) => onPaidAmountChange(e.target.value)} disabled={submitting} />
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
            <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-success" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              Create Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

NewOrderModal.displayName = 'NewOrderModal';
