import React, { memo, useState, useEffect } from 'react';
import { X, Loader2, Calendar, DollarSign, Plus, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentRecord {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
}

interface PaymentHistoryModalProps {
  orderId: string;
  orderNumber: string;
  shopId: string;
  bookerId: string;
  shopName: string;
  totalAmount: number;
  paidAmount: number;
  onClose: () => void;
  onPaymentAdded?: () => void;
}

const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'previous_credit', label: 'Previous Credit' },
  { value: 'by_hand', label: 'By Hand' },
];

const getPaymentMethodLabel = (method: string | null) => {
  const found = paymentMethods.find(m => m.value === method?.toLowerCase());
  return found?.label || method || 'Unknown';
};

export const PaymentHistoryModal = memo(({ 
  orderId, 
  orderNumber,
  shopId,
  bookerId, 
  shopName, 
  totalAmount, 
  paidAmount: initialPaidAmount,
  onClose,
  onPaymentAdded
}: PaymentHistoryModalProps) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paidAmount, setPaidAmount] = useState(initialPaidAmount);
  
  // Add payment form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentNotes, setPaymentNotes] = useState('');

  const fetchPaymentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('order_id', orderId)
        .order('paid_at', { ascending: true });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      console.error('Failed to fetch payment history:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, [orderId]);

  const pendingAmount = totalAmount - paidAmount;
  const totalRecorded = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    
    if (amount > pendingAmount + 1) {
      toast.error(`Payment amount cannot exceed pending balance of ${formatCurrency(pendingAmount)}`);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert payment record
      const { error: historyError } = await supabase
        .from('payment_history')
        .insert({
          order_id: orderId,
          shop_id: shopId,
          booker_id: bookerId,
          amount: amount,
          payment_method: paymentMethod,
          paid_at: new Date(paymentDate).toISOString(),
          notes: paymentNotes || null,
          created_by: user?.id
        });

      if (historyError) throw historyError;

      // 2. Update order paid_amount and payment_status
      const newPaidAmount = paidAmount + amount;
      const newPendingAmount = totalAmount - newPaidAmount;
      
      // If pending < 1 PKR, consider fully paid
      const isFullyPaid = newPaidAmount >= totalAmount || newPendingAmount < 1;
      const finalPaidAmount = isFullyPaid && newPendingAmount < 1 && newPendingAmount > 0 
        ? totalAmount 
        : newPaidAmount;
      
      const paymentStatus = isFullyPaid ? 'paid' : 'partial';

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          paid_amount: finalPaidAmount,
          payment_status: paymentStatus,
          payment_received_at: new Date(paymentDate).toISOString(),
          payment_method: paymentMethod,
          status: isFullyPaid ? 'delivered' : undefined
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // 3. Update shop credit balance (reduce by payment amount)
      const { data: shop } = await supabase
        .from('shops')
        .select('credit_balance')
        .eq('id', shopId)
        .single();

      if (shop) {
        await supabase
          .from('shops')
          .update({ 
            credit_balance: Math.max(0, (shop.credit_balance || 0) - amount) 
          })
          .eq('id', shopId);
      }

      // 4. Update booker financials (increase cash collected, decrease credit pending)
      const { data: bookerFinancials } = await supabase
        .from('booker_financials')
        .select('id, total_cash_collected, total_credit_pending')
        .eq('booker_id', bookerId)
        .maybeSingle();

      if (bookerFinancials) {
        await supabase
          .from('booker_financials')
          .update({
            total_cash_collected: (bookerFinancials.total_cash_collected || 0) + amount,
            total_credit_pending: Math.max(0, (bookerFinancials.total_credit_pending || 0) - amount)
          })
          .eq('id', bookerFinancials.id);
      }

      toast.success(`Payment of ${formatCurrency(amount)} recorded successfully`);
      
      // Update local state
      setPaidAmount(finalPaidAmount);
      setShowAddForm(false);
      setPaymentAmount('');
      setPaymentNotes('');
      
      // Refresh payment history
      await fetchPaymentHistory();
      
      // Notify parent to refresh orders
      onPaymentAdded?.();
    } catch (error: any) {
      toast.error('Failed to record payment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5" />
              Payment History
            </h2>
            <p className="text-sm text-muted-foreground">{orderNumber} • {shopName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-muted/30 p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Total Bill</p>
            <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="bg-success/10 p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-success">{formatCurrency(paidAmount)}</p>
          </div>
          <div className="bg-warning/10 p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-warning">{formatCurrency(Math.max(0, pendingAmount))}</p>
          </div>
        </div>

        {/* Add Payment Button/Form */}
        {pendingAmount > 0 && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary mb-4 flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Payment
          </button>
        )}

        {/* Add Payment Form */}
        {showAddForm && (
          <form onSubmit={handleAddPayment} className="bg-muted/30 p-4 rounded-lg mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount (Rs.)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Max: ${pendingAmount.toLocaleString()}`}
                  className="input-field mt-1"
                  step="0.01"
                  min="0"
                  max={pendingAmount}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field mt-1"
                >
                  {paymentMethods.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="input-field mt-1"
                required
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g., Collected by delivery man"
                className="input-field mt-1"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex-1"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  'Save Payment'
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Payment History List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No payment records found</p>
              <p className="text-xs mt-1">Payment history will appear here when payments are recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div 
                  key={payment.id} 
                  className="p-3 bg-muted/30 rounded-lg border border-border relative"
                >
                  {/* Payment number indicator */}
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  
                  <div className="ml-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-success">
                        +{formatCurrency(payment.amount)}
                      </span>
                      <span className="text-xs px-2 py-1 bg-secondary rounded-full">
                        {getPaymentMethodLabel(payment.payment_method)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(payment.paid_at), 'dd MMM yyyy, hh:mm a')}
                      </span>
                    </div>
                    
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        "{payment.notes}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Running total */}
              <div className="pt-3 border-t border-border mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Recorded Payments:</span>
                  <span className="font-bold">{formatCurrency(totalRecorded)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-border mt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

PaymentHistoryModal.displayName = 'PaymentHistoryModal';
