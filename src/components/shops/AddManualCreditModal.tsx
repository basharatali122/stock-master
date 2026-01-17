import React, { memo, useState } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Shop {
  id: string;
  name: string;
  credit_balance: number;
}

interface AddManualCreditModalProps {
  shop: Shop;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddManualCreditModal = memo(({ shop, onClose, onSuccess }: AddManualCreditModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      
      const { error } = await supabase
        .from('shops')
        .update({ 
          credit_balance: newBalance,
          manual_credit: newManualCredit
        })
        .eq('id', shop.id);

      if (error) throw error;

      toast.success(`Rs. ${amountNum.toLocaleString()} credit added to ${shop.name}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to add credit: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

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

        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-xl font-bold text-warning">Rs. {(shop.credit_balance || 0).toLocaleString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <p className="text-xs text-muted-foreground mt-1">
              For pending payments from before the system was implemented
            </p>
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
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !amount}>
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
