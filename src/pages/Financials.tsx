import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import StatCard from '@/components/ui/StatCard';
import { Search, DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, Users, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { printContent, formatCurrencyForPrint } from '@/lib/print';

interface BookerFinancials {
  booker_id: string;
  booker_name: string;
  total_orders: number;
  total_cash_collected: number;
  total_credit_given: number;
  pending_amount: number;
  salary: number;
  advance_taken: number;
}

const Financials: React.FC = () => {
  const [financials, setFinancials] = useState<BookerFinancials[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFinancials = async () => {
    try {
      // Get all approved bookers
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('status', 'approved');

      if (profilesError) throw profilesError;

      // Get orders grouped by booker
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('booker_id, total_amount, paid_amount');

      if (ordersError) throw ordersError;

      // Get booker financials from dedicated table
      const { data: bookerFinData, error: finError } = await supabase
        .from('booker_financials')
        .select('*');

      if (finError) throw finError;

      // Aggregate data
      const bookerStats: Record<string, BookerFinancials> = {};

      profiles?.forEach(profile => {
        bookerStats[profile.user_id] = {
          booker_id: profile.user_id,
          booker_name: profile.full_name,
          total_orders: 0,
          total_cash_collected: 0,
          total_credit_given: 0,
          pending_amount: 0,
          salary: 0,
          advance_taken: 0,
        };
      });

      orders?.forEach(order => {
        if (bookerStats[order.booker_id]) {
          bookerStats[order.booker_id].total_orders += 1;
          bookerStats[order.booker_id].total_cash_collected += order.paid_amount || 0;
          bookerStats[order.booker_id].total_credit_given += (order.total_amount - (order.paid_amount || 0));
          bookerStats[order.booker_id].pending_amount += (order.total_amount - (order.paid_amount || 0));
        }
      });

      // Merge with booker_financials table data
      bookerFinData?.forEach(fin => {
        if (bookerStats[fin.booker_id]) {
          bookerStats[fin.booker_id].salary = fin.salary || 0;
          bookerStats[fin.booker_id].advance_taken = fin.advance_taken || 0;
        }
      });

      setFinancials(Object.values(bookerStats).filter(b => b.total_orders > 0 || b.salary > 0 || b.advance_taken > 0));
    } catch (error: any) {
      toast.error('Failed to load financials: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const filteredFinancials = financials.filter((booker) =>
    booker.booker_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

  const totalCash = financials.reduce((acc, b) => acc + b.total_cash_collected, 0);
  const totalCredit = financials.reduce((acc, b) => acc + b.total_credit_given, 0);
  const totalPending = financials.reduce((acc, b) => acc + b.pending_amount, 0);
  const totalAdvance = financials.reduce((acc, b) => acc + b.advance_taken, 0);

  const columns = [
    {
      key: 'booker_name',
      header: 'Order Booker',
      render: (item: BookerFinancials) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
            {item.booker_name.charAt(0)}
          </div>
          <span className="font-medium">{item.booker_name}</span>
        </div>
      ),
    },
    {
      key: 'total_orders',
      header: 'Total Orders',
      render: (item: BookerFinancials) => <span className="font-medium">{item.total_orders}</span>,
    },
    {
      key: 'total_cash_collected',
      header: 'Cash Collected',
      render: (item: BookerFinancials) => (
        <span className="text-success font-medium">{formatCurrency(item.total_cash_collected)}</span>
      ),
    },
    {
      key: 'total_credit_given',
      header: 'Credit Given',
      render: (item: BookerFinancials) => (
        <span className="text-warning font-medium">{formatCurrency(item.total_credit_given)}</span>
      ),
    },
    {
      key: 'pending_amount',
      header: 'Pending',
      render: (item: BookerFinancials) => (
        <span className="text-destructive font-medium">{formatCurrency(item.pending_amount)}</span>
      ),
    },
    {
      key: 'salary',
      header: 'Salary',
      render: (item: BookerFinancials) => formatCurrency(item.salary),
    },
    {
      key: 'advance_taken',
      header: 'Advance',
      render: (item: BookerFinancials) => (
        <span className={item.advance_taken > 0 ? 'text-warning' : ''}>
          {formatCurrency(item.advance_taken)}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const collectionRate = totalCash + totalCredit > 0 ? (totalCash / (totalCash + totalCredit)) * 100 : 0;

  const printFinancialReport = () => {
    const bookersHtml = filteredFinancials.map(b => `
      <tr>
        <td>${b.booker_name}</td>
        <td>${b.total_orders}</td>
        <td>${formatCurrencyForPrint(b.total_cash_collected)}</td>
        <td>${formatCurrencyForPrint(b.total_credit_given)}</td>
        <td>${formatCurrencyForPrint(b.pending_amount)}</td>
        <td>${formatCurrencyForPrint(b.salary)}</td>
        <td>${formatCurrencyForPrint(b.advance_taken)}</td>
      </tr>
    `).join('');

    const content = `
      <div class="header">
        <h1>AR Traders</h1>
        <p>Financial Report</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Total Cash Collected:</span><span class="info-value">${formatCurrencyForPrint(totalCash)}</span></div>
        <div class="info-item"><span class="info-label">Total Credit Given:</span><span class="info-value">${formatCurrencyForPrint(totalCredit)}</span></div>
        <div class="info-item"><span class="info-label">Pending Payments:</span><span class="info-value">${formatCurrencyForPrint(totalPending)}</span></div>
        <div class="info-item"><span class="info-label">Advance Given:</span><span class="info-value">${formatCurrencyForPrint(totalAdvance)}</span></div>
        <div class="info-item"><span class="info-label">Total Sales:</span><span class="info-value">${formatCurrencyForPrint(totalCash + totalCredit)}</span></div>
        <div class="info-item"><span class="info-label">Collection Rate:</span><span class="info-value">${collectionRate.toFixed(1)}%</span></div>
      </div>
      <h3 style="margin: 20px 0 10px; font-size: 14px;">Order Booker Financials</h3>
      <table>
        <thead>
          <tr>
            <th>Booker</th>
            <th>Orders</th>
            <th>Cash</th>
            <th>Credit</th>
            <th>Pending</th>
            <th>Salary</th>
            <th>Advance</th>
          </tr>
        </thead>
        <tbody>${bookersHtml}</tbody>
      </table>
      <div class="summary">
        <div class="summary-row"><span>Total Orders:</span><span>${financials.reduce((acc, b) => acc + b.total_orders, 0)}</span></div>
        <div class="summary-row"><span>Total Salaries:</span><span>${formatCurrencyForPrint(financials.reduce((acc, b) => acc + b.salary, 0))}</span></div>
        <div class="summary-row total"><span>Net Collection:</span><span>${formatCurrencyForPrint(totalCash)}</span></div>
      </div>
    `;
    printContent(content, 'Financial Report');
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Financial Overview</h1>
            <p className="page-subtitle">Track cash flow, credits, and order booker financials</p>
          </div>
          <button onClick={printFinancialReport} className="btn-secondary">
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Cash Collected" value={formatCurrency(totalCash)} icon={Wallet} trend={{ value: collectionRate, isPositive: true }} variant="success" />
        <StatCard title="Total Credit Given" value={formatCurrency(totalCredit)} icon={CreditCard} variant="warning" />
        <StatCard title="Pending Payments" value={formatCurrency(totalPending)} icon={TrendingDown} variant="default" />
        <StatCard title="Advance Given" value={formatCurrency(totalAdvance)} icon={DollarSign} variant="default" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Collection Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Sales</span>
              <span className="font-medium">{formatCurrency(totalCash + totalCredit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cash Received</span>
              <span className="font-medium text-success">{formatCurrency(totalCash)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Credit Outstanding</span>
              <span className="font-medium text-warning">{formatCurrency(totalCredit)}</span>
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Collection Rate</span>
                <span className="text-success font-bold">{collectionRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Payment Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success" />
                <span className="text-sm">Paid</span>
              </div>
              <span className="font-medium">{collectionRate.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${collectionRate}%` }} />
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-warning" />
                <span className="text-sm">Credit</span>
              </div>
              <span className="font-medium">{(100 - collectionRate).toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-warning rounded-full" style={{ width: `${100 - collectionRate}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Bookers</span>
              <span className="font-medium">{financials.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Orders</span>
              <span className="font-medium">{financials.reduce((acc, b) => acc + b.total_orders, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Order Value</span>
              <span className="font-medium">
                {formatCurrency(financials.reduce((acc, b) => acc + b.total_orders, 0) > 0
                  ? (totalCash + totalCredit) / financials.reduce((acc, b) => acc + b.total_orders, 0)
                  : 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Salaries</span>
              <span className="font-medium">{formatCurrency(financials.reduce((acc, b) => acc + b.salary, 0))}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Search order bookers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-field pl-10" />
      </div>

      <div>
        <h2 className="section-title">Order Booker Financials</h2>
        <DataTable columns={columns} data={filteredFinancials} keyExtractor={(item) => item.booker_id} emptyMessage="No financial data found" />
      </div>
    </div>
  );
};

export default Financials;
