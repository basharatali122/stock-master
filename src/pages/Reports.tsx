import React, { useState } from 'react';
import StatCard from '@/components/ui/StatCard';
import { Calendar, Download, TrendingUp, DollarSign, ShoppingCart, Store, BarChart3 } from 'lucide-react';

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState('week');

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  // Mock data for reports
  const weeklyData = [
    { day: 'Mon', sales: 125000, orders: 45 },
    { day: 'Tue', sales: 98000, orders: 38 },
    { day: 'Wed', sales: 145000, orders: 52 },
    { day: 'Thu', sales: 112000, orders: 41 },
    { day: 'Fri', sales: 178000, orders: 63 },
    { day: 'Sat', sales: 89000, orders: 32 },
    { day: 'Sun', sales: 0, orders: 0 },
  ];

  const topProducts = [
    { name: 'Peek Freans Rio', sales: 45000, units: 375 },
    { name: 'LU Prince', sales: 38000, units: 475 },
    { name: 'Candyland Eclairs', sales: 32000, units: 213 },
    { name: 'Gala Biscuits', sales: 28000, units: 560 },
    { name: 'Sooper Cookies', sales: 25000, units: 250 },
  ];

  const topRoutes = [
    { name: 'Gulberg Route', sales: 185000, shops: 45 },
    { name: 'DHA Route', sales: 156000, shops: 38 },
    { name: 'Model Town Route', sales: 142000, shops: 42 },
    { name: 'Saddar Route', sales: 128000, shops: 35 },
  ];

  const maxSales = Math.max(...weeklyData.map((d) => d.sales));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Reports & Analytics</h1>
            <p className="page-subtitle">
              View sales reports and performance analytics
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex rounded-lg bg-muted p-1">
              {['week', 'month', 'year'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                    dateRange === range
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <button className="btn-secondary">
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(747000)}
          icon={DollarSign}
          trend={{ value: 12.5, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Total Orders"
          value="271"
          icon={ShoppingCart}
          trend={{ value: 8.2, isPositive: true }}
          variant="accent"
        />
        <StatCard
          title="Active Shops"
          value="156"
          icon={Store}
          trend={{ value: 5.1, isPositive: true }}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(2756)}
          icon={TrendingUp}
          trend={{ value: 3.8, isPositive: true }}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales Chart */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sales Overview</h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            {weeklyData.map((data) => (
              <div key={data.day} className="flex items-center gap-4">
                <span className="w-10 text-sm text-muted-foreground">{data.day}</span>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-muted overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-lg transition-all duration-500"
                      style={{ width: `${(data.sales / maxSales) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-24 text-right text-sm font-medium">
                  {formatCurrency(data.sales)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top Selling Products</h3>
            <span className="text-sm text-muted-foreground">By Revenue</span>
          </div>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                      index === 0
                        ? 'bg-warning/20 text-warning'
                        : index === 1
                        ? 'bg-muted-foreground/20 text-muted-foreground'
                        : index === 2
                        ? 'bg-warning/10 text-warning/80'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.units} units sold
                    </p>
                  </div>
                </div>
                <span className="font-medium text-success">
                  {formatCurrency(product.sales)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Route Performance */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Route Performance</h3>
          <span className="text-sm text-muted-foreground">This Week</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topRoutes.map((route) => (
            <div
              key={route.name}
              className="rounded-lg border border-border p-4 hover:border-accent/50 transition-colors"
            >
              <p className="font-medium text-foreground">{route.name}</p>
              <p className="mt-2 text-2xl font-bold text-accent">
                {formatCurrency(route.sales)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {route.shops} active shops
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Collection Rate</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--success))"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${75 * 2.51} ${100 * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">75%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Cash collected vs total sales
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Order Completion</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${92 * 2.51} ${100 * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">92%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Orders delivered successfully
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Return Rate</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="hsl(var(--warning))"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${3 * 2.51} ${100 * 2.51}`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">3%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Products returned this week
          </p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
