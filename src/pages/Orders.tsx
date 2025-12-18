import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Eye, Filter, ShoppingCart, Calendar } from 'lucide-react';
import { Order } from '@/types';

// Mock orders data
const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    shopId: '1',
    shopName: 'Al-Madina General Store',
    routeId: '1',
    routeName: 'Gulberg Route',
    bookerId: '2',
    bookerName: 'Ahmed Khan',
    items: [
      { productId: '1', productName: 'Peek Freans Rio', quantity: 10, price: 120, discount: 0, total: 1200 },
      { productId: '2', productName: 'LU Prince', quantity: 15, price: 80, discount: 5, total: 1140 },
    ],
    totalAmount: 15000,
    paidAmount: 15000,
    creditAmount: 0,
    orderStatus: 'delivered',
    paymentStatus: 'paid',
    createdAt: new Date(),
  },
  {
    id: 'ORD-002',
    shopId: '2',
    shopName: 'City Mart',
    routeId: '2',
    routeName: 'Model Town Route',
    bookerId: '3',
    bookerName: 'Hassan Ali',
    items: [
      { productId: '3', productName: 'Candyland Eclairs', quantity: 20, price: 150, discount: 0, total: 3000 },
    ],
    totalAmount: 28500,
    paidAmount: 20000,
    creditAmount: 8500,
    orderStatus: 'delivered',
    paymentStatus: 'credit',
    createdAt: new Date(),
  },
  {
    id: 'ORD-003',
    shopId: '3',
    shopName: 'Quick Shop',
    routeId: '3',
    routeName: 'DHA Route',
    bookerId: '2',
    bookerName: 'Ahmed Khan',
    items: [
      { productId: '4', productName: 'Hilal Ding Dong', quantity: 30, price: 200, discount: 10, total: 5400 },
    ],
    totalAmount: 12000,
    paidAmount: 6000,
    creditAmount: 6000,
    orderStatus: 'confirmed',
    paymentStatus: 'partial',
    createdAt: new Date(),
  },
  {
    id: 'ORD-004',
    shopId: '4',
    shopName: 'Family Store',
    routeId: '4',
    routeName: 'Johar Town Route',
    bookerId: '4',
    bookerName: 'Bilal Ahmed',
    items: [],
    totalAmount: 35000,
    paidAmount: 35000,
    creditAmount: 0,
    orderStatus: 'pending',
    paymentStatus: 'paid',
    createdAt: new Date(),
  },
  {
    id: 'ORD-005',
    shopId: '5',
    shopName: 'Corner Shop',
    routeId: '1',
    routeName: 'Gulberg Route',
    bookerId: '2',
    bookerName: 'Ahmed Khan',
    items: [],
    totalAmount: 8500,
    paidAmount: 0,
    creditAmount: 8500,
    orderStatus: 'delivered',
    paymentStatus: 'credit',
    createdAt: new Date(),
  },
];

const statusFilters = ['All', 'Pending', 'Confirmed', 'Delivered', 'Cancelled'];
const paymentFilters = ['All', 'Paid', 'Credit', 'Partial'];

const Orders: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shopName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' ||
      order.orderStatus.toLowerCase() === statusFilter.toLowerCase();
    const matchesPayment =
      paymentFilter === 'All' ||
      order.paymentStatus.toLowerCase() === paymentFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'badge-success';
      case 'confirmed':
        return 'badge-info';
      case 'pending':
        return 'badge-pending';
      case 'cancelled':
        return 'badge-destructive';
      default:
        return 'badge-info';
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return 'badge-success';
      case 'credit':
        return 'badge-pending';
      case 'partial':
        return 'badge-info';
      default:
        return 'badge-info';
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'Order ID',
      render: (item: Order) => (
        <span className="font-mono text-sm font-medium text-accent">{item.id}</span>
      ),
    },
    {
      key: 'shopName',
      header: 'Shop',
      render: (item: Order) => (
        <div>
          <p className="font-medium">{item.shopName}</p>
          <p className="text-xs text-muted-foreground">{item.routeName}</p>
        </div>
      ),
    },
    { key: 'bookerName', header: 'Booker' },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (item: Order) => (
        <span className="font-medium">{formatCurrency(item.totalAmount)}</span>
      ),
    },
    {
      key: 'orderStatus',
      header: 'Status',
      render: (item: Order) => (
        <span className={getStatusBadge(item.orderStatus)}>
          {item.orderStatus.charAt(0).toUpperCase() + item.orderStatus.slice(1)}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (item: Order) => (
        <span className={getPaymentBadge(item.paymentStatus)}>
          {item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Order) => (
        <button className="rounded-lg p-2 hover:bg-muted">
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
      ),
    },
  ];

  const totalSales = mockOrders.reduce((acc, order) => acc + order.totalAmount, 0);
  const totalPaid = mockOrders.reduce((acc, order) => acc + order.paidAmount, 0);
  const totalCredit = mockOrders.reduce((acc, order) => acc + order.creditAmount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Orders</h1>
            <p className="page-subtitle">
              {isAdmin ? 'View and manage all orders' : 'Create and track your orders'}
            </p>
          </div>
          <button
            onClick={() => setShowNewOrderModal(true)}
            className="btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID or shop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">Payment:</span>
        {paymentFilters.map((status) => (
          <button
            key={status}
            onClick={() => setPaymentFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              paymentFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="mt-1 text-2xl font-bold">{mockOrders.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Sales</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(totalSales)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Cash Received</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Credit/Pending</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            {formatCurrency(totalCredit)}
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        emptyMessage="No orders found"
      />

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground">Create New Order</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select shop and add products to create an order
            </p>

            <form className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Route</label>
                  <select className="input-field">
                    <option value="">Select route</option>
                    <option value="1">Gulberg Route</option>
                    <option value="2">Model Town Route</option>
                    <option value="3">DHA Route</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Shop</label>
                  <select className="input-field">
                    <option value="">Select shop</option>
                    <option value="1">Al-Madina General Store</option>
                    <option value="2">City Mart</option>
                    <option value="3">Quick Shop</option>
                  </select>
                </div>
              </div>

              {/* Products Selection */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Add Products
                </label>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <select className="input-field flex-1">
                      <option value="">Select product</option>
                      <option value="1">Peek Freans Rio - Rs. 120</option>
                      <option value="2">LU Prince - Rs. 80</option>
                      <option value="3">Candyland Eclairs - Rs. 150</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      className="input-field w-24"
                      min="1"
                    />
                    <button type="button" className="btn-accent">
                      Add
                    </button>
                  </div>

                  {/* Sample added items */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Peek Freans Rio x 10</span>
                      <span className="font-medium">Rs. 1,200</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Payment Type
                  </label>
                  <select className="input-field">
                    <option value="paid">Cash (Full Payment)</option>
                    <option value="credit">Credit</option>
                    <option value="partial">Partial Payment</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="rounded-lg bg-primary/5 p-4">
                <h3 className="font-medium mb-2">Order Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>Rs. 1,200</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-success">-Rs. 0</span>
                  </div>
                  <div className="flex justify-between font-medium text-base pt-2 border-t border-border">
                    <span>Total</span>
                    <span>Rs. 1,200</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-success">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
