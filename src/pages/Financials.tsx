import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import StatCard from '@/components/ui/StatCard';
import { Search, DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, Users, Loader2, Printer, Edit, Plus, History } from 'lucide-react';
import { toast } from 'sonner';
import { printContent, formatCurrencyForPrint } from '@/lib/print';
import { financialSchema, advanceSchema, validateInput } from '@/lib/validation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BookerFinancials {
  booker_id: string;
  booker_name: string;
  total_orders: number;
  total_cash_collected: number;
  total_credit_given: number;
  pending_amount: number;
  salary: number;
  advance_taken: number;
  financial_record_id?: string;
}

interface BookerProfile {
  user_id: string;
  full_name: string;
}

const Financials: React.FC = () => {
  const [financials, setFinancials] = useState<BookerFinancials[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [allBookers, setAllBookers] = useState<BookerProfile[]>([]);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddAdvanceModalOpen, setIsAddAdvanceModalOpen] = useState(false);
  const [selectedBooker, setSelectedBooker] = useState<BookerFinancials | null>(null);
  const [selectedBookerId, setSelectedBookerId] = useState<string>('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchFinancials = async () => {
    try {
      // Get all approved bookers
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('status', 'approved');

      if (profilesError) throw profilesError;
      
      setAllBookers(profiles || []);

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
          bookerStats[fin.booker_id].financial_record_id = fin.id;
        }
      });

      setFinancials(Object.values(bookerStats));
    } catch (error: any) {
      toast.error('Failed to load financials: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const handleEditFinancials = (booker: BookerFinancials) => {
    setSelectedBooker(booker);
    setSalaryAmount(booker.salary.toString());
    setAdvanceAmount(booker.advance_taken.toString());
    setIsEditModalOpen(true);
  };

  const handleAddAdvance = (booker: BookerFinancials) => {
    setSelectedBooker(booker);
    setAdvanceAmount('');
    setAdvanceNote('');
    setIsAddAdvanceModalOpen(true);
  };

  const handleSaveFinancials = async () => {
    if (!selectedBooker) return;
    
    const salary = parseFloat(salaryAmount) || 0;
    const advance = parseFloat(advanceAmount) || 0;

    // Validate input
    const validationResult = validateInput(financialSchema, { salary, advance });
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }
    
    const validatedData = validationResult.data;

    setIsSaving(true);
    try {
      if (selectedBooker.financial_record_id) {
        // Update existing record
        const { error } = await supabase
          .from('booker_financials')
          .update({
            salary: validatedData.salary,
            advance_taken: validatedData.advance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedBooker.financial_record_id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('booker_financials')
          .insert({
            booker_id: selectedBooker.booker_id,
            salary: validatedData.salary,
            advance_taken: validatedData.advance,
          });

        if (error) throw error;
      }

      toast.success('Financials updated successfully');
      setIsEditModalOpen(false);
      fetchFinancials();
    } catch (error: any) {
      toast.error('Failed to update financials: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAdvanceAmount = async () => {
    if (!selectedBooker) return;
    
    const addAmount = parseFloat(advanceAmount) || 0;
    
    // Validate input
    const validationResult = validateInput(advanceSchema, { amount: addAmount, note: advanceNote });
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }
    
    const validatedData = validationResult.data;
    
    setIsSaving(true);
    try {
      const newAdvance = selectedBooker.advance_taken + validatedData.amount;

      if (selectedBooker.financial_record_id) {
        const { error } = await supabase
          .from('booker_financials')
          .update({
            advance_taken: newAdvance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedBooker.financial_record_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('booker_financials')
          .insert({
            booker_id: selectedBooker.booker_id,
            salary: 0,
            advance_taken: validatedData.amount,
          });

        if (error) throw error;
      }

      toast.success(`Advance of Rs. ${validatedData.amount.toLocaleString()} added for ${selectedBooker.booker_name}`);
      setIsAddAdvanceModalOpen(false);
      fetchFinancials();
    } catch (error: any) {
      toast.error('Failed to add advance: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeductAdvance = async () => {
    if (!selectedBooker) return;
    
    const deductAmount = parseFloat(advanceAmount) || 0;
    
    // Validate input
    const validationResult = validateInput(advanceSchema, { amount: deductAmount });
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }
    
    const validatedData = validationResult.data;

    if (validatedData.amount > selectedBooker.advance_taken) {
      toast.error('Deduction amount cannot exceed current advance balance');
      return;
    }
    
    setIsSaving(true);
    try {
      const newAdvance = selectedBooker.advance_taken - validatedData.amount;

      if (selectedBooker.financial_record_id) {
        const { error } = await supabase
          .from('booker_financials')
          .update({
            advance_taken: newAdvance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedBooker.financial_record_id);

        if (error) throw error;
      }

      toast.success(`Advance of Rs. ${validatedData.amount.toLocaleString()} deducted from ${selectedBooker.booker_name}`);
      setIsAddAdvanceModalOpen(false);
      fetchFinancials();
    } catch (error: any) {
      toast.error('Failed to deduct advance: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredFinancials = financials.filter((booker) =>
    booker.booker_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `Rs. ${amount?.toLocaleString() || 0}`;

  const totalCash = financials.reduce((acc, b) => acc + b.total_cash_collected, 0);
  const totalCredit = financials.reduce((acc, b) => acc + b.total_credit_given, 0);
  const totalPending = financials.reduce((acc, b) => acc + b.pending_amount, 0);
  const totalAdvance = financials.reduce((acc, b) => acc + b.advance_taken, 0);
  const totalSalary = financials.reduce((acc, b) => acc + b.salary, 0);

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
      render: (item: BookerFinancials) => (
        <span className="font-medium">{formatCurrency(item.salary)}</span>
      ),
    },
    {
      key: 'advance_taken',
      header: 'Advance Balance',
      render: (item: BookerFinancials) => (
        <span className={`font-medium ${item.advance_taken > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
          {formatCurrency(item.advance_taken)}
        </span>
      ),
    },
    {
      key: 'net_payable',
      header: 'Net Payable',
      render: (item: BookerFinancials) => {
        const netPayable = item.salary - item.advance_taken;
        return (
          <span className={`font-bold ${netPayable >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(netPayable)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: BookerFinancials) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEditFinancials(item)}
            className="h-8"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAddAdvance(item)}
            className="h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            Advance
          </Button>
        </div>
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
        <td>${formatCurrencyForPrint(b.salary - b.advance_taken)}</td>
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
        <div class="info-item"><span class="info-label">Total Salaries:</span><span class="info-value">${formatCurrencyForPrint(totalSalary)}</span></div>
        <div class="info-item"><span class="info-label">Total Advance:</span><span class="info-value">${formatCurrencyForPrint(totalAdvance)}</span></div>
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
            <th>Net Payable</th>
          </tr>
        </thead>
        <tbody>${bookersHtml}</tbody>
      </table>
      <div class="summary">
        <div class="summary-row"><span>Total Orders:</span><span>${financials.reduce((acc, b) => acc + b.total_orders, 0)}</span></div>
        <div class="summary-row"><span>Total Salaries:</span><span>${formatCurrencyForPrint(totalSalary)}</span></div>
        <div class="summary-row"><span>Total Advance:</span><span>${formatCurrencyForPrint(totalAdvance)}</span></div>
        <div class="summary-row total"><span>Net Payable:</span><span>${formatCurrencyForPrint(totalSalary - totalAdvance)}</span></div>
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
            <p className="page-subtitle">Track cash flow, credits, salaries and advances</p>
          </div>
          <button onClick={printFinancialReport} className="btn-secondary">
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Cash Collected" value={formatCurrency(totalCash)} icon={Wallet} trend={{ value: collectionRate, isPositive: true }} variant="success" />
        <StatCard title="Total Credit Given" value={formatCurrency(totalCredit)} icon={CreditCard} variant="warning" />
        <StatCard title="Pending Payments" value={formatCurrency(totalPending)} icon={TrendingDown} variant="default" />
        <StatCard title="Total Salaries" value={formatCurrency(totalSalary)} icon={Users} variant="default" />
        <StatCard title="Advance Given" value={formatCurrency(totalAdvance)} icon={DollarSign} variant="warning" />
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
          <h3 className="text-lg font-semibold mb-4">Salary & Advance Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Salaries</span>
              <span className="font-medium">{formatCurrency(totalSalary)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Advance Given</span>
              <span className="font-medium text-warning">{formatCurrency(totalAdvance)}</span>
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Net Payable</span>
                <span className={`font-bold ${totalSalary - totalAdvance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(totalSalary - totalAdvance)}
                </span>
              </div>
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
              <span className="text-muted-foreground">Bookers with Advance</span>
              <span className="font-medium">{financials.filter(b => b.advance_taken > 0).length}</span>
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

      {/* Edit Financials Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Financial Details</DialogTitle>
          </DialogHeader>
          {selectedBooker && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  {selectedBooker.booker_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{selectedBooker.booker_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooker.total_orders} orders</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary">Monthly Salary (Rs.)</Label>
                <Input
                  id="salary"
                  type="number"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  placeholder="Enter salary amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="advance">Total Advance Balance (Rs.)</Label>
                <Input
                  id="advance"
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="Enter total advance"
                />
                <p className="text-xs text-muted-foreground">
                  This is the total advance taken that will be deducted from salary
                </p>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Net Payable:</span>
                  <span className={`font-bold ${(parseFloat(salaryAmount) || 0) - (parseFloat(advanceAmount) || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    Rs. {((parseFloat(salaryAmount) || 0) - (parseFloat(advanceAmount) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFinancials} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Deduct Advance Modal */}
      <Dialog open={isAddAdvanceModalOpen} onOpenChange={setIsAddAdvanceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Advance</DialogTitle>
          </DialogHeader>
          {selectedBooker && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                  {selectedBooker.booker_name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{selectedBooker.booker_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Current Advance: <span className="font-medium text-warning">Rs. {selectedBooker.advance_taken.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="advanceAmount">Amount (Rs.)</Label>
                <Input
                  id="advanceAmount"
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="advanceNote">Note (Optional)</Label>
                <Input
                  id="advanceNote"
                  value={advanceNote}
                  onChange={(e) => setAdvanceNote(e.target.value)}
                  placeholder="e.g., Emergency advance, Monthly deduction"
                />
              </div>

              <div className="p-3 bg-muted rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Current Balance:</span>
                  <span>Rs. {selectedBooker.advance_taken.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>After Adding:</span>
                  <span className="text-warning">Rs. {(selectedBooker.advance_taken + (parseFloat(advanceAmount) || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>After Deducting:</span>
                  <span className="text-success">Rs. {Math.max(0, selectedBooker.advance_taken - (parseFloat(advanceAmount) || 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsAddAdvanceModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeductAdvance} 
              disabled={isSaving || !advanceAmount || parseFloat(advanceAmount) <= 0}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Deduct Advance
            </Button>
            <Button 
              onClick={handleAddAdvanceAmount} 
              disabled={isSaving || !advanceAmount || parseFloat(advanceAmount) <= 0}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financials;
