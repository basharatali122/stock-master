import React, { memo, useState, useEffect } from 'react';
import { X, Loader2, Calendar, DollarSign, User, CreditCard, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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
  shopName: string;
  totalAmount: number;
  paidAmount: number;
  onClose: () => void;
}

const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

const getPaymentMethodLabel = (method: string | null) => {
  switch (method?.toLowerCase()) {
    case 'cash': return 'Cash';
    case 'jazzcash': return 'JazzCash';
    case 'bank': return 'Bank Transfer';
    case 'previous_credit': return 'Previous Credit';
    case 'by_hand': return 'By Hand';
    default: return method || 'Unknown';
  }
};

export const PaymentHistoryModal = memo(({ 
  orderId, 
  orderNumber, 
  shopName, 
  totalAmount, 
  paidAmount,
  onClose 
}: PaymentHistoryModalProps) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchPaymentHistory();
  }, [orderId]);

  const pendingAmount = totalAmount - paidAmount;
  const totalRecorded = payments.reduce((sum, p) => sum + Number(p.amount), 0);

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
