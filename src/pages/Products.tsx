import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Edit, Trash2, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { productSchema, validateInput } from '@/lib/validation';

interface Product {
  id: string;
  product_code: string | null;
  name: string;
  brand: string | null;
  pack_type: string | null;
  category: string;
  price: number;
  stock_quantity: number;
  discount_percentage: number;
  boxes_per_carton: number;
  is_active: boolean;
  created_at: string;
}

const categories = ['All', 'Biscuits', 'Toffees', 'Candies', 'Snacks', 'Beverages', 'Other'];
const brands = ["Chip n' Dip", 'Friendz', 'More Cookies', 'Peanut Bite', 'Zeera Club', 'Tasteland Nimko', 'Aktive Energy', 'Anytime Waffer', 'Other'];
const packTypes = ['Family Pack', 'Half Pack', 'Mini Half Pack', 'Snack Pack', 'Tikki Pack'];

const Products: React.FC = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    product_code: '',
    name: '',
    brand: '',
    pack_type: '',
    category: '',
    price: '',
    stock_quantity: '',
    discount_percentage: '0',
    boxes_per_carton: '24',
  });

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error('Failed to load products: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validationResult = validateInput(productSchema, {
      product_code: formData.product_code,
      name: formData.name,
      brand: formData.brand,
      pack_type: formData.pack_type,
      category: formData.category,
      price: parseFloat(formData.price) || 0,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      discount_percentage: parseFloat(formData.discount_percentage) || 0,
      boxes_per_carton: parseInt(formData.boxes_per_carton) || 24,
    });
    
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }
    
    const validatedData = validationResult.data;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('products').insert({
        product_code: validatedData.product_code,
        name: validatedData.name,
        brand: validatedData.brand,
        pack_type: validatedData.pack_type,
        category: validatedData.category,
        price: validatedData.price,
        stock_quantity: validatedData.stock_quantity,
        discount_percentage: validatedData.discount_percentage,
        boxes_per_carton: validatedData.boxes_per_carton,
      });

      if (error) throw error;

      toast.success('Product added successfully');
      setShowAddModal(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast.error('Failed to add product: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) {
      toast.error('No product selected for editing');
      return;
    }

    // Validate input
    const validationResult = validateInput(productSchema, {
      product_code: formData.product_code,
      name: formData.name,
      brand: formData.brand,
      pack_type: formData.pack_type,
      category: formData.category,
      price: parseFloat(formData.price) || 0,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      discount_percentage: parseFloat(formData.discount_percentage) || 0,
      boxes_per_carton: parseInt(formData.boxes_per_carton) || 24,
    });
    
    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }
    
    const validatedData = validationResult.data;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          product_code: validatedData.product_code,
          name: validatedData.name,
          brand: validatedData.brand,
          pack_type: validatedData.pack_type,
          category: validatedData.category,
          price: validatedData.price,
          stock_quantity: validatedData.stock_quantity,
          discount_percentage: validatedData.discount_percentage,
          boxes_per_carton: validatedData.boxes_per_carton,
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast.success('Product updated successfully');
      setShowEditModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast.error('Failed to update product: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error: any) {
      toast.error('Failed to delete product: ' + error.message);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      product_code: product.product_code || '',
      name: product.name,
      brand: product.brand || '',
      pack_type: product.pack_type || '',
      category: product.category,
      price: product.price.toString(),
      stock_quantity: product.stock_quantity?.toString() || '0',
      discount_percentage: product.discount_percentage?.toString() || '0',
      boxes_per_carton: product.boxes_per_carton?.toString() || '24',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      product_code: '',
      name: '',
      brand: '',
      pack_type: '',
      category: '',
      price: '',
      stock_quantity: '',
      discount_percentage: '0',
      boxes_per_carton: '24',
    });
  };

  const filteredProducts = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchLower) ||
        (product.product_code && product.product_code.toLowerCase().includes(searchLower)) ||
        (product.brand && product.brand.toLowerCase().includes(searchLower));
      const matchesCategory =
        selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const formatCurrency = useCallback((amount: number) => `Rs. ${amount.toLocaleString()}`, []);
  
  // Memoized stats
  const statsData = useMemo(() => ({
    totalProducts: products.length,
    totalStockValue: products.reduce((acc, p) => acc + p.price * p.stock_quantity, 0),
    lowStockCount: products.filter((p) => p.stock_quantity < 50).length,
    categoryCount: new Set(products.map(p => p.category)).size,
  }), [products]);

  const columns = [
    {
      key: 'product_code',
      header: 'Code',
      render: (item: Product) => (
        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">
          {item.product_code || 'N/A'}
        </span>
      ),
    },
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
            <p className="text-xs text-muted-foreground">
              {item.brand || 'No brand'} • {item.pack_type || 'No pack type'}
            </p>
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
          {item.discount_percentage > 0 && (
            <p className="text-xs text-success">-{item.discount_percentage}% discount</p>
          )}
        </div>
      ),
    },
    {
      key: 'stock_quantity',
      header: 'Stock',
      render: (item: Product) => {
        const cartons = Math.floor((item.stock_quantity || 0) / (item.boxes_per_carton || 24));
        const remainingBoxes = (item.stock_quantity || 0) % (item.boxes_per_carton || 24);
        return (
          <div>
            <span
              className={
                item.stock_quantity < 50
                  ? 'badge-destructive'
                  : item.stock_quantity < 100
                  ? 'badge-pending'
                  : 'badge-success'
              }
            >
              {item.stock_quantity} boxes
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {cartons} cartons {remainingBoxes > 0 && `+ ${remainingBoxes}`}
            </p>
          </div>
        );
      },
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (item: Product) => (
              <div className="flex gap-2">
                <button onClick={() => openEditModal(item)} className="rounded-lg p-2 hover:bg-muted">
                  <Edit className="h-4 w-4 text-muted-foreground" />
                </button>
                <button onClick={() => handleDeleteProduct(item)} className="rounded-lg p-2 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            placeholder="Search by name, code, or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
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
      <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Products</p>
          <p className="mt-1 text-2xl font-bold">{statsData.totalProducts}</p>
        </div>
        {isAdmin && (
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Stock Value</p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(statsData.totalStockValue)}
            </p>
          </div>
        )}
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Low Stock Items</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            {statsData.lowStockCount}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Categories</p>
          <p className="mt-1 text-2xl font-bold">
            {statsData.categoryCount}
          </p>
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
              Fill in the details to add a new product
            </p>

            <form onSubmit={handleAddProduct} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Product Code *</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="e.g., PRD001"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Product Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Friendz Family Pack"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Brand *</label>
                  <select
                    className="input-field"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Pack Type *</label>
                  <select
                    className="input-field"
                    value={formData.pack_type}
                    onChange={(e) => setFormData({ ...formData, pack_type: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Select pack type</option>
                    {packTypes.map((pt) => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Category *</label>
                <select
                  className="input-field"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select category</option>
                  {categories.slice(1).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Price *</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Stock Qty (Boxes)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Boxes per Carton *</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="24"
                    value={formData.boxes_per_carton}
                    onChange={(e) => setFormData({ ...formData, boxes_per_carton: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Discount %</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Edit Product</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update product details
            </p>

            <form onSubmit={handleEditProduct} className="mt-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Product Code *</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Product Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Brand *</label>
                  <select
                    className="input-field"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Pack Type *</label>
                  <select
                    className="input-field"
                    value={formData.pack_type}
                    onChange={(e) => setFormData({ ...formData, pack_type: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Select pack type</option>
                    {packTypes.map((pt) => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Category *</label>
                <select
                  className="input-field"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select category</option>
                  {categories.slice(1).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Price *</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Stock Qty (Boxes)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Boxes per Carton *</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.boxes_per_carton}
                    onChange={(e) => setFormData({ ...formData, boxes_per_carton: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Discount %</label>
                  <input
                    type="number"
                    className="input-field"
                    min="0"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingProduct(null); resetForm(); }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Product
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
