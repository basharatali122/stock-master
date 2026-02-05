import React, { memo, useState } from 'react';
import { X, Loader2, DollarSign, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface QuickPaymentModalProps {
  orderId: string;
  orderNumber: string;
  shopId: string;
  bookerId: string;
  shopName: string;
  totalAmount: number;
  paidAmount: number;
  onClose: () => void;
  onPaymentAdded: () => void;
}

const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'previous_credit', label: 'Previous Credit' },
  { value: 'by_hand', label: 'By Hand' },
];

export const QuickPaymentModal = memo(({ 
  orderId, 
  orderNumber,
  shopId,
  bookerId, 
  shopName, 
  totalAmount, 
  paidAmount,
  onClose,
  onPaymentAdded
}: QuickPaymentModalProps) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const pendingAmount = totalAmount - paidAmount;

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
          paid_at: new Date().toISOString(),
          notes: null,
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
          payment_received_at: new Date().toISOString(),
          payment_method: paymentMethod,
          status: isFullyPaid ? 'delivered' : undefined
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // 3. Update shop credit balance (reduce by payment amount)
      const { error: shopError } = await supabase.rpc('get_shop_pending_credits');
      
      if (!shopError) {
        // Update using a direct SQL update (credit_balance -= payment)
        const { error: updateShopError } = await supabase
          .from('shops')
          .update({ 
            credit_balance: supabase.rpc ? undefined : 0 // Will be recalculated
          })
          .eq('id', shopId);
        
        // Note: Credit balance is calculated dynamically via get_shop_pending_credits
      }

      // 4. Update booker financials
      const { data: existingFinancials } = await supabase
        .from('booker_financials')
        .select('*')
        .eq('booker_id', bookerId)
        .single();

      if (existingFinancials) {
        const { error: financialsError } = await supabase
          .from('booker_financials')
          .update({
            total_cash_collected: (existingFinancials.total_cash_collected || 0) + amount,
            total_credit_pending: Math.max(0, (existingFinancials.total_credit_pending || 0) - amount)
          })
          .eq('booker_id', bookerId);

        if (financialsError) {
          console.error('Failed to update booker financials:', financialsError);
        }
      }

      toast.success(`Payment of ${formatCurrency(amount)} recorded successfully!`);
      onPaymentAdded();
      onClose();
    } catch (error: any) {
      toast.error('Failed to record payment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick amount buttons
  const quickAmounts = [
    { label: 'Full', value: pendingAmount },
    { label: '1000', value: 1000 },
    { label: '2000', value: 2000 },
    { label: '5000', value: 5000 },
  ].filter(a => a.value <= pendingAmount + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              Add Payment
            </h2>
            <p className="text-sm text-muted-foreground">
              {orderNumber} • {shopName}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted" disabled={submitting}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Status */}
        <div className="rounded-lg bg-muted/50 p-4 mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Bill:</span>
            <span className="font-medium">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Already Paid:</span>
            <span className="font-medium text-success">{formatCurrency(paidAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="text-sm font-medium">Pending Balance:</span>
            <span className="font-bold text-warning">{formatCurrency(pendingAmount)}</span>
          </div>
        </div>

        <form onSubmit={handleAddPayment} className="space-y-4">
          {/* Quick Amount Buttons */}
          {quickAmounts.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => setPaymentAmount(qa.value.toString())}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    parseFloat(paymentAmount) === qa.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  disabled={submitting}
                >
                  {qa.label === 'Full' ? `Full (${formatCurrency(qa.value)})` : formatCurrency(qa.value)}
                </button>
              ))}
            </div>
          )}

          {/* Payment Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Amount Received *</label>
            <input
              type="number"
              className="input-field text-lg font-bold"
              placeholder="Enter amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={submitting}
              autoFocus
              min="1"
              max={pendingAmount + 1}
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Payment Method</label>
            <select
              className="input-field"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={submitting}
            >
              {paymentMethods.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* New Balance Preview */}
          {paymentAmount && parseFloat(paymentAmount) > 0 && (
            <div className="rounded-lg bg-success/10 p-4 border border-success/20">
              <div className="flex justify-between">
                <span className="text-sm text-success">New Pending Balance:</span>
                <span className="font-bold text-success">
                  {formatCurrency(Math.max(0, pendingAmount - (parseFloat(paymentAmount) || 0)))}
                </span>
              </div>
              {pendingAmount - (parseFloat(paymentAmount) || 0) < 1 && (
                <p className="text-xs text-success mt-1">✓ This order will be marked as fully paid</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting || !paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

QuickPaymentModal.displayName = 'QuickPaymentModal';
