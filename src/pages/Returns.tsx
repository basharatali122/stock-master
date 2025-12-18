import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Eye, RotateCcw } from 'lucide-react';
import { ProductReturn } from '@/types';

// Mock returns data
const mockReturns: ProductReturn[] = [
  {
    id: 'RET-001',
    shopId: '1',
    shopName: 'Al-Madina General Store',
    routeId: '1',
    bookerId: '2',
    bookerName: 'Ahmed Khan',
    items: [
      { productId: '1', productName: 'Peek Freans Rio', quantity: 5, reason: 'Damaged packaging' },
    ],
    totalValue: 600,
    createdAt: new Date(),
  },
  {
    id: 'RET-002',
    shopId: '3',
    shopName: 'Quick Shop',
    routeId: '3',
    bookerId: '2',
    bookerName: 'Ahmed Khan',
    items: [
      { productId: '3', productName: 'Candyland Eclairs', quantity: 10, reason: 'Expired products' },
    ],
    totalValue: 1500,
    createdAt: new Date(),
  },
  {
    id: 'RET-003',
    shopId: '2',
    shopName: 'City Mart',
    routeId: '2',
    bookerId: '3',
    bookerName: 'Hassan Ali',
    items: [
      { productId: '2', productName: 'LU Prince', quantity: 8, reason: 'Wrong order' },
    ],
    totalValue: 640,
    createdAt: new Date(),
  },
];

const Returns: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredReturns = mockReturns.filter(
    (ret) =>
      ret.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.shopName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const columns = [
    {
      key: 'id',
      header: 'Return ID',
      render: (item: ProductReturn) => (
        <span className="font-mono text-sm font-medium text-accent">{item.id}</span>
      ),
    },
    {
      key: 'shopName',
      header: 'Shop',
      render: (item: ProductReturn) => (
        <div>
          <p className="font-medium">{item.shopName}</p>
        </div>
      ),
    },
    { key: 'bookerName', header: 'Processed By' },
    {
      key: 'items',
      header: 'Items',
      render: (item: ProductReturn) => (
        <span>{item.items.length} product(s)</span>
      ),
    },
    {
      key: 'totalValue',
      header: 'Value',
      render: (item: ProductReturn) => (
        <span className="font-medium text-destructive">
          {formatCurrency(item.totalValue)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (item: ProductReturn) =>
        new Date(item.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: ProductReturn) => (
        <button className="rounded-lg p-2 hover:bg-muted">
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
      ),
    },
  ];

  const totalReturnsValue = mockReturns.reduce((acc, ret) => acc + ret.totalValue, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Product Returns</h1>
            <p className="page-subtitle">
              Track and manage product returns from shops
            </p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            New Return
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search returns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Returns</p>
          <p className="mt-1 text-2xl font-bold">{mockReturns.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Return Value</p>
          <p className="mt-1 text-2xl font-bold text-destructive">
            {formatCurrency(totalReturnsValue)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">This Month</p>
          <p className="mt-1 text-2xl font-bold">{mockReturns.length}</p>
        </div>
      </div>

      {/* Returns Table */}
      <DataTable
        columns={columns}
        data={filteredReturns}
        keyExtractor={(item) => item.id}
        emptyMessage="No returns found"
      />

      {/* Add Return Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Record Product Return</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter return details to update inventory
            </p>

            <form className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Shop</label>
                <select className="input-field">
                  <option value="">Select shop</option>
                  <option value="1">Al-Madina General Store</option>
                  <option value="2">City Mart</option>
                  <option value="3">Quick Shop</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Product</label>
                <select className="input-field">
                  <option value="">Select product</option>
                  <option value="1">Peek Freans Rio</option>
                  <option value="2">LU Prince</option>
                  <option value="3">Candyland Eclairs</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Quantity
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                    min="1"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Return Value
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Rs. 0"
                    disabled
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Return Reason
                </label>
                <select className="input-field">
                  <option value="">Select reason</option>
                  <option value="damaged">Damaged Packaging</option>
                  <option value="expired">Expired Products</option>
                  <option value="wrong">Wrong Order</option>
                  <option value="quality">Quality Issues</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Additional Notes
                </label>
                <textarea
                  className="input-field min-h-[80px]"
                  placeholder="Any additional details..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Record Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;
