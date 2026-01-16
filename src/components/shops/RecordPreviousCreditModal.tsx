import React, { memo, useState, useEffect } from 'react';
import { X, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Shop {
  id: string;
  name: string;
  credit_balance: number;
}

interface OrderBooker {
  id: string;
  full_name: string;
}

interface RecordPreviousCreditModalProps {
  shop: Shop;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPreviousCreditModal = memo(({ shop, onClose, onSuccess }: RecordPreviousCreditModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loadingBookers, setLoadingBookers] = useState(true);
  const [selectedBookerId, setSelectedBookerId] = useState<string>('');

  useEffect(() => {
    fetchOrderBookers();
  }, []);

  const fetchOrderBookers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('status', 'approved')
        .order('full_name');

      if (error) throw error;

      setOrderBookers((data || []).map(p => ({ id: p.user_id, full_name: p.full_name })));
    } catch (error: any) {
      toast.error('Failed to load order bookers: ' + error.message);
    } finally {
      setLoadingBookers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amountNum > 10000000) {
      toast.error('Amount cannot exceed Rs. 10,000,000');
      return;
    }

    if (!selectedBookerId) {
      toast.error('Please select an order booker');
      return;
    }

    if (amountNum > (shop.credit_balance || 0)) {
      toast.error(`Amount cannot exceed current credit balance of Rs. ${(shop.credit_balance || 0).toLocaleString()}`);
      return;
    }

    setSubmitting(true);
    try {
      // Update shop credit balance (reduce it since payment is being recorded)
      const newBalance = Math.max(0, (shop.credit_balance || 0) - amountNum);
      
      const { error: shopError } = await supabase
        .from('shops')
        .update({ credit_balance: newBalance })
        .eq('id', shop.id);

      if (shopError) throw shopError;

      // Update booker financials - add to cash collected
      const { data: existingFinancials } = await supabase
        .from('booker_financials')
        .select('*')
        .eq('booker_id', selectedBookerId)
        .maybeSingle();

      if (existingFinancials) {
        await supabase
          .from('booker_financials')
          .update({
            total_cash_collected: (existingFinancials.total_cash_collected || 0) + amountNum,
            total_credit_pending: Math.max(0, (existingFinancials.total_credit_pending || 0) - amountNum)
          })
          .eq('booker_id', selectedBookerId);
      } else {
        await supabase
          .from('booker_financials')
          .insert({
            booker_id: selectedBookerId,
            total_cash_collected: amountNum,
            total_credit_pending: 0
          });
      }

      const selectedBooker = orderBookers.find(b => b.id === selectedBookerId);
      toast.success(`Rs. ${amountNum.toLocaleString()} payment recorded for ${shop.name} (Booker: ${selectedBooker?.full_name})`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to record payment: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBooker = orderBookers.find(b => b.id === selectedBookerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Record Previous Credit</h2>
            <p className="text-sm text-muted-foreground">{shop.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <p className="text-sm text-muted-foreground">Current Credit Balance</p>
          <p className="text-xl font-bold text-warning">Rs. {(shop.credit_balance || 0).toLocaleString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Booker Selection */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Select Order Booker *</label>
            {loadingBookers ? (
              <div className="flex items-center gap-2 text-muted-foreground p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading order bookers...
              </div>
            ) : (
              <select
                value={selectedBookerId}
                onChange={(e) => setSelectedBookerId(e.target.value)}
                className="input-field w-full"
                disabled={submitting}
              >
                <option value="">Select order booker</option>
                {orderBookers.map((booker) => (
                  <option key={booker.id} value={booker.id}>
                    {booker.full_name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              This payment will be added to the selected booker's cash collection history
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Payment Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs.</span>
              <input
                type="number"
                className="input-field pl-10"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max={shop.credit_balance || 10000000}
                step="1"
                disabled={submitting}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum: Rs. {(shop.credit_balance || 0).toLocaleString()}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description (Optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Cash collected on delivery"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              disabled={submitting}
            />
          </div>

          {/* New Balance Preview */}
          {amount && parseFloat(amount) > 0 && parseFloat(amount) <= (shop.credit_balance || 0) && (
            <div className="bg-success/10 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">After Recording Payment</p>
              <p className="text-xl font-bold text-success">
                Rs. {Math.max(0, (shop.credit_balance || 0) - parseFloat(amount)).toLocaleString()}
              </p>
              {selectedBooker && (
                <p className="text-xs text-muted-foreground mt-1">
                  Will be added to {selectedBooker.full_name}'s cash collection
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={submitting || !amount || !selectedBookerId}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

RecordPreviousCreditModal.displayName = 'RecordPreviousCreditModal';
