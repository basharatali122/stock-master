import React, { memo, useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Shop {
  id: string;
  name: string;
  credit_balance: number;
}

interface OrderBooker {
  id: string;
  full_name: string;
}

interface AddManualCreditModalProps {
  shop: Shop;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddManualCreditModal = memo(({ shop, onClose, onSuccess }: AddManualCreditModalProps) => {
  const { user } = useAuth();
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

    setSubmitting(true);
    try {
      // First get the current manual_credit value
      const { data: currentShop } = await supabase
        .from('shops')
        .select('manual_credit')
        .eq('id', shop.id)
        .single();

      const currentManualCredit = currentShop?.manual_credit || 0;

      // Update shop credit balance and accumulate manual credit
      const newBalance = (shop.credit_balance || 0) + amountNum;
      const newManualCredit = currentManualCredit + amountNum;
      
      const { error: shopError } = await supabase
        .from('shops')
        .update({ 
          credit_balance: newBalance,
          manual_credit: newManualCredit
        })
        .eq('id', shop.id);

      if (shopError) throw shopError;

      // Save to manual_credits table with order booker info
      const { error: creditError } = await supabase
        .from('manual_credits')
        .insert({
          shop_id: shop.id,
          booker_id: selectedBookerId,
          amount: amountNum,
          description: description || null,
          status: 'pending',
          created_by: user?.id
        });

      if (creditError) throw creditError;

      // Update booker financials - add to credit pending
      const { data: existingFinancials } = await supabase
        .from('booker_financials')
        .select('*')
        .eq('booker_id', selectedBookerId)
        .maybeSingle();

      if (existingFinancials) {
        await supabase
          .from('booker_financials')
          .update({
            total_credit_pending: (existingFinancials.total_credit_pending || 0) + amountNum
          })
          .eq('booker_id', selectedBookerId);
      } else {
        await supabase
          .from('booker_financials')
          .insert({
            booker_id: selectedBookerId,
            total_credit_pending: amountNum,
            total_cash_collected: 0
          });
      }

      const selectedBooker = orderBookers.find(b => b.id === selectedBookerId);
      toast.success(`Rs. ${amountNum.toLocaleString()} credit added to ${shop.name} (Booker: ${selectedBooker?.full_name})`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to add credit: ' + error.message);
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
            <h2 className="text-xl font-bold text-foreground">Add Manual Credit</h2>
            <p className="text-sm text-muted-foreground">{shop.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-warning">⬆️ This adds credit to the shop's balance</p>
          <p className="text-xs text-muted-foreground mt-1">The credit will be tracked under the selected order booker</p>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <p className="text-sm text-muted-foreground">Current Balance</p>
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
              This credit will be added to the selected booker's pending credit total
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Credit Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs.</span>
              <input
                type="number"
                className="input-field pl-10"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max="10000000"
                step="1"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Description (Optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Pending from January deliveries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              disabled={submitting}
            />
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="bg-primary/5 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">New Balance After Adding</p>
              <p className="text-xl font-bold text-primary">
                Rs. {((shop.credit_balance || 0) + parseFloat(amount)).toLocaleString()}
              </p>
              {selectedBooker && (
                <p className="text-xs text-muted-foreground mt-1">
                  Will be tracked under {selectedBooker.full_name}'s pending credits
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !amount || !selectedBookerId}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Plus className="h-4 w-4 mr-2" />
              Add Credit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

AddManualCreditModal.displayName = 'AddManualCreditModal';
