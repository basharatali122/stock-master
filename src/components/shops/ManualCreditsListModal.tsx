import React, { memo, useState, useEffect } from 'react';
import { X, Loader2, Edit, Trash2, CheckCircle, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManualCredit {
  id: string;
  shop_id: string;
  booker_id: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  shops?: { name: string };
  booker_name?: string;
}

interface ManualCreditsListModalProps {
  bookerId?: string;
  bookerName?: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const ManualCreditsListModal = memo(({ bookerId, bookerName, onClose, onRefresh }: ManualCreditsListModalProps) => {
  const [credits, setCredits] = useState<ManualCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredit, setEditingCredit] = useState<ManualCredit | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCredits();
  }, [bookerId]);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('manual_credits')
        .select(`
          *,
          shops(name)
        `)
        .order('created_at', { ascending: false });

      if (bookerId) {
        query = query.eq('booker_id', bookerId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch booker names
      const bookerIds = [...new Set((data || []).map(c => c.booker_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', bookerIds);

      const bookerMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      setCredits((data || []).map(c => ({
        ...c,
        booker_name: bookerMap.get(c.booker_id) || 'Unknown'
      })));
    } catch (error: any) {
      toast.error('Failed to load credits: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (credit: ManualCredit) => {
    if (!confirm(`Are you sure you want to delete this credit of Rs. ${credit.amount.toLocaleString()}?`)) return;

    try {
      // Delete the credit record
      const { error: deleteError } = await supabase
        .from('manual_credits')
        .delete()
        .eq('id', credit.id);

      if (deleteError) throw deleteError;

      // Update shop's credit balance and manual_credit
      const { data: shop } = await supabase
        .from('shops')
        .select('credit_balance, manual_credit')
        .eq('id', credit.shop_id)
        .single();

      if (shop && credit.status === 'pending') {
        await supabase
          .from('shops')
          .update({
            credit_balance: Math.max(0, (shop.credit_balance || 0) - credit.amount),
            manual_credit: Math.max(0, (shop.manual_credit || 0) - credit.amount)
          })
          .eq('id', credit.shop_id);

        // Update booker financials
        const { data: financials } = await supabase
          .from('booker_financials')
          .select('*')
          .eq('booker_id', credit.booker_id)
          .maybeSingle();

        if (financials) {
          await supabase
            .from('booker_financials')
            .update({
              total_credit_pending: Math.max(0, (financials.total_credit_pending || 0) - credit.amount)
            })
            .eq('booker_id', credit.booker_id);
        }
      }

      toast.success('Credit deleted successfully');
      fetchCredits();
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to delete credit: ' + error.message);
    }
  };

  const handleMarkAsPaid = async (credit: ManualCredit) => {
    if (credit.status === 'paid') {
      toast.info('This credit is already marked as paid');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('manual_credits')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', credit.id);

      if (updateError) throw updateError;

      // Update shop's credit balance
      const { data: shop } = await supabase
        .from('shops')
        .select('credit_balance, manual_credit')
        .eq('id', credit.shop_id)
        .single();

      if (shop) {
        await supabase
          .from('shops')
          .update({
            credit_balance: Math.max(0, (shop.credit_balance || 0) - credit.amount),
            manual_credit: Math.max(0, (shop.manual_credit || 0) - credit.amount)
          })
          .eq('id', credit.shop_id);
      }

      // Update booker financials
      const { data: financials } = await supabase
        .from('booker_financials')
        .select('*')
        .eq('booker_id', credit.booker_id)
        .maybeSingle();

      if (financials) {
        await supabase
          .from('booker_financials')
          .update({
            total_credit_pending: Math.max(0, (financials.total_credit_pending || 0) - credit.amount),
            total_cash_collected: (financials.total_cash_collected || 0) + credit.amount
          })
          .eq('booker_id', credit.booker_id);
      }

      toast.success('Credit marked as paid');
      fetchCredits();
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to mark as paid: ' + error.message);
    }
  };

  const openEditModal = (credit: ManualCredit) => {
    setEditingCredit(credit);
    setEditAmount(credit.amount.toString());
    setEditDescription(credit.description || '');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredit) return;

    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const amountDiff = newAmount - editingCredit.amount;

      // Update the credit record
      const { error: updateError } = await supabase
        .from('manual_credits')
        .update({
          amount: newAmount,
          description: editDescription || null
        })
        .eq('id', editingCredit.id);

      if (updateError) throw updateError;

      // Update shop's balances if still pending
      if (editingCredit.status === 'pending') {
        const { data: shop } = await supabase
          .from('shops')
          .select('credit_balance, manual_credit')
          .eq('id', editingCredit.shop_id)
          .single();

        if (shop) {
          await supabase
            .from('shops')
            .update({
              credit_balance: Math.max(0, (shop.credit_balance || 0) + amountDiff),
              manual_credit: Math.max(0, (shop.manual_credit || 0) + amountDiff)
            })
            .eq('id', editingCredit.shop_id);
        }

        // Update booker financials
        const { data: financials } = await supabase
          .from('booker_financials')
          .select('*')
          .eq('booker_id', editingCredit.booker_id)
          .maybeSingle();

        if (financials) {
          await supabase
            .from('booker_financials')
            .update({
              total_credit_pending: Math.max(0, (financials.total_credit_pending || 0) + amountDiff)
            })
            .eq('booker_id', editingCredit.booker_id);
        }
      }

      toast.success('Credit updated successfully');
      setEditingCredit(null);
      fetchCredits();
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to update credit: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCredits = credits.filter(c => c.status === 'pending');
  const paidCredits = credits.filter(c => c.status === 'paid');
  const totalPending = pendingCredits.reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = paidCredits.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-xl bg-card p-4 sm:p-6 shadow-elevated animate-scale-in overflow-hidden flex flex-col">
        <div className="flex justify-between items-start gap-2 mb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">Manual Credits</h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {bookerName ? `For: ${bookerName}` : 'All manual credits'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary Stats - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="bg-warning/10 rounded-lg p-2 sm:p-3 flex sm:block items-center justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Pending</p>
            <p className="text-base sm:text-xl font-bold text-warning">Rs. {totalPending.toLocaleString()}</p>
          </div>
          <div className="bg-success/10 rounded-lg p-2 sm:p-3 flex sm:block items-center justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Paid</p>
            <p className="text-base sm:text-xl font-bold text-success">Rs. {totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-2 sm:p-3 flex sm:block items-center justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Credits</p>
            <p className="text-base sm:text-xl font-bold text-primary">{credits.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : credits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No manual credits found
          </div>
        ) : (
          <div className="overflow-auto flex-1 -mx-4 sm:mx-0">
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3 px-4">
              {credits.map((credit) => (
                <div key={credit.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{credit.shops?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(credit.created_at).toLocaleDateString()}
                        {!bookerId && ` • ${credit.booker_name}`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                      credit.status === 'paid' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {credit.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  {credit.description && (
                    <p className="text-xs text-muted-foreground">{credit.description}</p>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="font-bold text-sm">Rs. {credit.amount.toLocaleString()}</span>
                    <div className="flex gap-1">
                      {credit.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleMarkAsPaid(credit)}
                            className="rounded-lg p-2 hover:bg-success/10"
                            title="Mark as Paid"
                          >
                            <CheckCircle className="h-4 w-4 text-success" />
                          </button>
                          <button
                            onClick={() => openEditModal(credit)}
                            className="rounded-lg p-2 hover:bg-muted"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(credit)}
                        className="rounded-lg p-2 hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <table className="w-full hidden sm:table">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Shop</th>
                  {!bookerId && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Booker</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {credits.map((credit) => (
                  <tr key={credit.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">
                      {new Date(credit.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {credit.shops?.name || 'Unknown'}
                    </td>
                    {!bookerId && (
                      <td className="px-4 py-3 text-sm">
                        {credit.booker_name}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {credit.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      Rs. {credit.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        credit.status === 'paid' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {credit.status === 'paid' ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Paid
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-3 w-3" />
                            Pending
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        {credit.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleMarkAsPaid(credit)}
                              className="rounded-lg p-2 hover:bg-success/10"
                              title="Mark as Paid"
                            >
                              <CheckCircle className="h-4 w-4 text-success" />
                            </button>
                            <button
                              onClick={() => openEditModal(credit)}
                              className="rounded-lg p-2 hover:bg-muted"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(credit)}
                          className="rounded-lg p-2 hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t mt-4">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingCredit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">Edit Credit</h3>
              <button onClick={() => setEditingCredit(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rs.</span>
                  <input
                    type="number"
                    className="input-field pl-10"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    min="1"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Description</label>
                <input
                  type="text"
                  className="input-field"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={200}
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditingCredit(null)} className="btn-secondary" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting || !editAmount}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

ManualCreditsListModal.displayName = 'ManualCreditsListModal';
