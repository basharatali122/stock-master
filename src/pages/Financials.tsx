import React, { useState } from 'react';
import DataTable from '@/components/ui/DataTable';
import StatCard from '@/components/ui/StatCard';
import { Search, DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, Users } from 'lucide-react';
import { BookerFinancials } from '@/types';

// Mock financials data
const mockBookerFinancials: BookerFinancials[] = [
  {
    bookerId: '2',
    bookerName: 'Ahmed Khan',
    totalOrders: 156,
    totalCashCollected: 450000,
    totalCreditGiven: 85000,
    pendingAmount: 35000,
    salary: 45000,
    advanceTaken: 10000,
    remainingBalance: 0,
  },
  {
    bookerId: '3',
    bookerName: 'Hassan Ali',
    totalOrders: 134,
    totalCashCollected: 380000,
    totalCreditGiven: 65000,
    pendingAmount: 28000,
    salary: 45000,
    advanceTaken: 5000,
    remainingBalance: 0,
  },
  {
    bookerId: '4',
    bookerName: 'Bilal Ahmed',
    totalOrders: 98,
    totalCashCollected: 290000,
    totalCreditGiven: 45000,
    pendingAmount: 18000,
    salary: 40000,
    advanceTaken: 15000,
    remainingBalance: 5000,
  },
];

const Financials: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFinancials = mockBookerFinancials.filter((booker) =>
    booker.bookerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const totalCash = mockBookerFinancials.reduce((acc, b) => acc + b.totalCashCollected, 0);
  const totalCredit = mockBookerFinancials.reduce((acc, b) => acc + b.totalCreditGiven, 0);
  const totalPending = mockBookerFinancials.reduce((acc, b) => acc + b.pendingAmount, 0);
  const totalAdvance = mockBookerFinancials.reduce((acc, b) => acc + b.advanceTaken, 0);

  const columns = [
    {
      key: 'bookerName',
      header: 'Order Booker',
      render: (item: BookerFinancials) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
            {item.bookerName.charAt(0)}
          </div>
          <span className="font-medium">{item.bookerName}</span>
        </div>
      ),
    },
    {
      key: 'totalOrders',
      header: 'Total Orders',
      render: (item: BookerFinancials) => (
        <span className="font-medium">{item.totalOrders}</span>
      ),
    },
    {
      key: 'totalCashCollected',
      header: 'Cash Collected',
      render: (item: BookerFinancials) => (
        <span className="text-success font-medium">
          {formatCurrency(item.totalCashCollected)}
        </span>
      ),
    },
    {
      key: 'totalCreditGiven',
      header: 'Credit Given',
      render: (item: BookerFinancials) => (
        <span className="text-warning font-medium">
          {formatCurrency(item.totalCreditGiven)}
        </span>
      ),
    },
    {
      key: 'pendingAmount',
      header: 'Pending',
      render: (item: BookerFinancials) => (
        <span className="text-destructive font-medium">
          {formatCurrency(item.pendingAmount)}
        </span>
      ),
    },
    {
      key: 'salary',
      header: 'Salary',
      render: (item: BookerFinancials) => formatCurrency(item.salary),
    },
    {
      key: 'advanceTaken',
      header: 'Advance',
      render: (item: BookerFinancials) => (
        <span className={item.advanceTaken > 0 ? 'text-warning' : ''}>
          {formatCurrency(item.advanceTaken)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Financial Overview</h1>
        <p className="page-subtitle">
          Track cash flow, credits, and order booker financials
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Cash Collected"
          value={formatCurrency(totalCash)}
          icon={Wallet}
          trend={{ value: 15.2, isPositive: true }}
          variant="success"
        />
        <StatCard
          title="Total Credit Given"
          value={formatCurrency(totalCredit)}
          icon={CreditCard}
          trend={{ value: 8.5, isPositive: false }}
          variant="warning"
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(totalPending)}
          icon={TrendingDown}
          variant="default"
        />
        <StatCard
          title="Advance Given"
          value={formatCurrency(totalAdvance)}
          icon={DollarSign}
          variant="default"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Collection Summary */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Collection Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Sales</span>
              <span className="font-medium">
                {formatCurrency(totalCash + totalCredit)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cash Received</span>
              <span className="font-medium text-success">
                {formatCurrency(totalCash)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Credit Outstanding</span>
              <span className="font-medium text-warning">
                {formatCurrency(totalCredit)}
              </span>
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Collection Rate</span>
                <span className="text-success font-bold">
                  {((totalCash / (totalCash + totalCredit)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Payment Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success" />
                <span className="text-sm">Paid</span>
              </div>
              <span className="font-medium">65%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[65%] bg-success rounded-full" />
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-warning" />
                <span className="text-sm">Credit</span>
              </div>
              <span className="font-medium">25%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[25%] bg-warning rounded-full" />
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <span className="text-sm">Overdue</span>
              </div>
              <span className="font-medium">10%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-[10%] bg-destructive rounded-full" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full btn-primary justify-start">
              <DollarSign className="mr-2 h-4 w-4" />
              Record Payment
            </button>
            <button className="w-full btn-secondary justify-start">
              <CreditCard className="mr-2 h-4 w-4" />
              Update Credit
            </button>
            <button className="w-full btn-secondary justify-start">
              <Users className="mr-2 h-4 w-4" />
              Give Advance
            </button>
            <button className="w-full btn-ghost justify-start border border-border">
              <TrendingUp className="mr-2 h-4 w-4" />
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search order bookers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Booker Financials Table */}
      <div>
        <h2 className="section-title">Order Booker Financials</h2>
        <DataTable
          columns={columns}
          data={filteredFinancials}
          keyExtractor={(item) => item.bookerId}
          emptyMessage="No data found"
        />
      </div>
    </div>
  );
};

export default Financials;
