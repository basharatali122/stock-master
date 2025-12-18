import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import StatCard from '@/components/ui/StatCard';
import DataTable from '@/components/ui/DataTable';
import {
  DollarSign,
  ShoppingCart,
  Store,
  Package,
  AlertTriangle,
  Users,
  Map,
  Clock,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Mock data
const mockStats = {
  totalSales: 2450000,
  totalOrders: 1234,
  totalShops: 567,
  totalProducts: 89,
  pendingPayments: 345000,
  lowStockProducts: 12,
  activeRoutes: 25,
  pendingApprovals: 5,
};

const mockRecentOrders = [
  {
    id: '1',
    shopName: 'Al-Madina General Store',
    routeName: 'Gulberg Route',
    bookerName: 'Ahmed Khan',
    totalAmount: 15000,
    paymentStatus: 'paid' as const,
    createdAt: new Date(),
  },
  {
    id: '2',
    shopName: 'City Mart',
    routeName: 'Model Town Route',
    bookerName: 'Hassan Ali',
    totalAmount: 28500,
    paymentStatus: 'credit' as const,
    createdAt: new Date(),
  },
  {
    id: '3',
    shopName: 'Quick Shop',
    routeName: 'DHA Route',
    bookerName: 'Ahmed Khan',
    totalAmount: 12000,
    paymentStatus: 'partial' as const,
    createdAt: new Date(),
  },
  {
    id: '4',
    shopName: 'Family Store',
    routeName: 'Johar Town Route',
    bookerName: 'Bilal Ahmed',
    totalAmount: 35000,
    paymentStatus: 'paid' as const,
    createdAt: new Date(),
  },
  {
    id: '5',
    shopName: 'Corner Shop',
    routeName: 'Gulberg Route',
    bookerName: 'Ahmed Khan',
    totalAmount: 8500,
    paymentStatus: 'credit' as const,
    createdAt: new Date(),
  },
];

const mockLowStockProducts = [
  { id: '1', name: 'Peek Freans Rio', category: 'Biscuits', stockQuantity: 15 },
  { id: '2', name: 'Candyland Eclairs', category: 'Toffees', stockQuantity: 8 },
  { id: '3', name: 'LU Prince', category: 'Biscuits', stockQuantity: 20 },
  { id: '4', name: 'Hilal Ding Dong', category: 'Toffees', stockQuantity: 12 },
];

const Dashboard: React.FC = () => {
  const { isAdmin, user } = useAuth();

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString()}`;
  };

  const orderColumns = [
    { key: 'shopName', header: 'Shop' },
    { key: 'routeName', header: 'Route' },
    { key: 'bookerName', header: 'Booker' },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (item: typeof mockRecentOrders[0]) => formatCurrency(item.totalAmount),
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      render: (item: typeof mockRecentOrders[0]) => (
        <span
          className={
            item.paymentStatus === 'paid'
              ? 'badge-success'
              : item.paymentStatus === 'credit'
              ? 'badge-pending'
              : 'badge-info'
          }
        >
          {item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
        </span>
      ),
    },
  ];

  const stockColumns = [
    { key: 'name', header: 'Product' },
    { key: 'category', header: 'Category' },
    {
      key: 'stockQuantity',
      header: 'Stock',
      render: (item: typeof mockLowStockProducts[0]) => (
        <span className="badge-destructive">{item.stockQuantity} units</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">
              {isAdmin ? 'Admin Dashboard' : 'Order Booker Dashboard'}
            </h1>
            <p className="page-subtitle">
              Welcome back, {user?.name}! Here's what's happening today.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/orders" className="btn-primary">
              <ShoppingCart className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sales"
          value={formatCurrency(mockStats.totalSales)}
          icon={DollarSign}
          trend={{ value: 12.5, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Total Orders"
          value={mockStats.totalOrders}
          icon={ShoppingCart}
          trend={{ value: 8.2, isPositive: true }}
          variant="accent"
        />
        <StatCard
          title="Active Shops"
          value={mockStats.totalShops}
          icon={Store}
          trend={{ value: 3.1, isPositive: true }}
        />
        <StatCard
          title="Products"
          value={mockStats.totalProducts}
          icon={Package}
        />
      </div>

      {/* Secondary Stats */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pending Payments"
            value={formatCurrency(mockStats.pendingPayments)}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Low Stock Items"
            value={mockStats.lowStockProducts}
            icon={AlertTriangle}
            variant="warning"
          />
          <StatCard
            title="Active Routes"
            value={mockStats.activeRoutes}
            icon={Map}
          />
          <StatCard
            title="Pending Approvals"
            value={mockStats.pendingApprovals}
            icon={Users}
          />
        </div>
      )}

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title mb-0">Recent Orders</h2>
            <Link
              to="/orders"
              className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <DataTable
            columns={orderColumns}
            data={mockRecentOrders}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => console.log('Order clicked:', item)}
          />
        </div>

        {/* Low Stock Alert */}
        {isAdmin && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title mb-0">Low Stock Alert</h2>
              <Link
                to="/products"
                className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <DataTable
              columns={stockColumns}
              data={mockLowStockProducts}
              keyExtractor={(item) => item.id}
            />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="section-title">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Link
            to="/orders"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <ShoppingCart className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">New Order</span>
          </Link>
          <Link
            to="/shops"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <Store className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">Add Shop</span>
          </Link>
          <Link
            to="/products"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <Package className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">Products</span>
          </Link>
          <Link
            to="/reports"
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-all hover:border-accent hover:bg-accent/5"
          >
            <TrendingUp className="h-8 w-8 text-accent" />
            <span className="text-sm font-medium">Reports</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
