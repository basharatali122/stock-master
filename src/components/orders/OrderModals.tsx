import React, { memo } from 'react';
import { X, Loader2, ShoppingCart } from 'lucide-react';

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

interface NewOrderItem {
  productId: string;
  quantity: number;
  price: number;
  discount: number;
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
                <span>{item.products?.name} x {item.quantity}</span>
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
  const creditBalance = selectedShopData?.credit_balance || 0;

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

          {selectedShop && creditBalance > 0 && (
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
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Add Products</label>
            <div className="flex items-center gap-2">
              <select className="input-field flex-1" value={selectedProduct} onChange={(e) => onProductChange(e.target.value)} disabled={submitting}>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} - Rs. {p.price}</option>
                ))}
              </select>
              <input type="number" placeholder="Qty" className="input-field w-20" min="1" value={quantity} onChange={(e) => onQuantityChange(e.target.value)} disabled={submitting} />
              <button type="button" onClick={onAddItem} className="btn-accent" disabled={submitting}>Add</button>
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
