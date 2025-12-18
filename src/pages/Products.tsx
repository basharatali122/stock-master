import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Filter, Edit, Trash2, Package } from 'lucide-react';
import { Product } from '@/types';

// Mock products data
const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Peek Freans Rio',
    category: 'Biscuits',
    price: 120,
    costPrice: 95,
    stockQuantity: 250,
    discount: 0,
    sku: 'PF-RIO-001',
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'LU Prince',
    category: 'Biscuits',
    price: 80,
    costPrice: 65,
    stockQuantity: 180,
    discount: 5,
    sku: 'LU-PRI-002',
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Candyland Eclairs',
    category: 'Toffees',
    price: 150,
    costPrice: 120,
    stockQuantity: 45,
    discount: 0,
    sku: 'CL-ECL-003',
    createdAt: new Date(),
  },
  {
    id: '4',
    name: 'Hilal Ding Dong',
    category: 'Toffees',
    price: 200,
    costPrice: 160,
    stockQuantity: 30,
    discount: 10,
    sku: 'HL-DD-004',
    createdAt: new Date(),
  },
  {
    id: '5',
    name: 'Gala Biscuits',
    category: 'Biscuits',
    price: 50,
    costPrice: 38,
    stockQuantity: 500,
    discount: 0,
    sku: 'GL-BSC-005',
    createdAt: new Date(),
  },
  {
    id: '6',
    name: 'Sooper Cookies',
    category: 'Biscuits',
    price: 100,
    costPrice: 80,
    stockQuantity: 320,
    discount: 0,
    sku: 'SP-COK-006',
    createdAt: new Date(),
  },
  {
    id: '7',
    name: 'Refreshers Candy',
    category: 'Candies',
    price: 180,
    costPrice: 145,
    stockQuantity: 200,
    discount: 5,
    sku: 'RF-CND-007',
    createdAt: new Date(),
  },
  {
    id: '8',
    name: 'Nimko Mix',
    category: 'Snacks',
    price: 60,
    costPrice: 45,
    stockQuantity: 150,
    discount: 0,
    sku: 'NK-MIX-008',
    createdAt: new Date(),
  },
];

const categories = ['All', 'Biscuits', 'Toffees', 'Candies', 'Snacks'];

const Products: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (item: Product) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.sku}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category' },
    {
      key: 'price',
      header: 'Price',
      render: (item: Product) => (
        <div>
          <p className="font-medium">{formatCurrency(item.price)}</p>
          {item.discount > 0 && (
            <p className="text-xs text-success">-{item.discount}% discount</p>
          )}
        </div>
      ),
    },
    {
      key: 'stockQuantity',
      header: 'Stock',
      render: (item: Product) => (
        <span
          className={
            item.stockQuantity < 50
              ? 'badge-destructive'
              : item.stockQuantity < 100
              ? 'badge-pending'
              : 'badge-success'
          }
        >
          {item.stockQuantity} units
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'costPrice',
            header: 'Cost',
            render: (item: Product) => formatCurrency(item.costPrice),
          },
          {
            key: 'profit',
            header: 'Margin',
            render: (item: Product) => {
              const margin = ((item.price - item.costPrice) / item.price) * 100;
              return <span className="text-success">{margin.toFixed(1)}%</span>;
            },
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (item: Product) => (
              <div className="flex gap-2">
                <button className="rounded-lg p-2 hover:bg-muted">
                  <Edit className="h-4 w-4 text-muted-foreground" />
                </button>
                <button className="rounded-lg p-2 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-subtitle">
              {isAdmin
                ? 'Manage your product inventory and pricing'
                : 'View available products and their prices'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Products</p>
          <p className="mt-1 text-2xl font-bold">{mockProducts.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Stock Value</p>
          <p className="mt-1 text-2xl font-bold">
            {formatCurrency(
              mockProducts.reduce(
                (acc, p) => acc + p.price * p.stockQuantity,
                0
              )
            )}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Low Stock Items</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            {mockProducts.filter((p) => p.stockQuantity < 50).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Categories</p>
          <p className="mt-1 text-2xl font-bold">{categories.length - 1}</p>
        </div>
      </div>

      {/* Products Table */}
      <DataTable
        columns={columns}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        emptyMessage="No products found"
      />

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Add New Product</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill in the details to add a new product to inventory
            </p>

            <form className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Product Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Peek Freans Rio"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">SKU</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., PF-RIO-001"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Category</label>
                <select className="input-field">
                  <option value="">Select category</option>
                  {categories.slice(1).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Selling Price
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Discount (%)
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0"
                  min="0"
                  max="100"
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
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
