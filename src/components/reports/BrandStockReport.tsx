import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package, Box, Boxes, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  product_code: string | null;
  name: string;
  brand: string | null;
  pack_type: string | null;
  stock_quantity: number;
  price: number;
  boxes_per_carton: number;
}

interface BrandGroup {
  brand: string;
  packTypes: {
    packType: string;
    products: Product[];
    totalBoxes: number;
    totalCartons: number;
    totalValue: number;
  }[];
  totalBoxes: number;
  totalCartons: number;
  totalValue: number;
}

const PACK_TYPES = ['Family Pack', 'Half Pack', 'Mini Half Pack', 'Snack Pack', 'Tikki Pack'];

const BrandStockReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [brandGroups, setBrandGroups] = useState<BrandGroup[]>([]);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [grandTotals, setGrandTotals] = useState({
    totalBoxes: 0,
    totalCartons: 0,
    totalValue: 0,
  });

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_code, name, brand, pack_type, stock_quantity, price, boxes_per_carton')
        .eq('is_active', true)
        .order('brand')
        .order('pack_type')
        .order('name');

      if (error) throw error;

      // Group products by brand and pack type
      const groupedData = groupProductsByBrand(data || []);
      setBrandGroups(groupedData);

      // Calculate grand totals
      const totals = groupedData.reduce(
        (acc, group) => ({
          totalBoxes: acc.totalBoxes + group.totalBoxes,
          totalCartons: acc.totalCartons + group.totalCartons,
          totalValue: acc.totalValue + group.totalValue,
        }),
        { totalBoxes: 0, totalCartons: 0, totalValue: 0 }
      );
      setGrandTotals(totals);
    } catch (error: any) {
      toast.error('Failed to load stock data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const groupProductsByBrand = (products: Product[]): BrandGroup[] => {
    const brandMap = new Map<string, Map<string, Product[]>>();

    products.forEach((product) => {
      const brand = product.brand || 'Uncategorized';
      const packType = product.pack_type || 'Other';

      if (!brandMap.has(brand)) {
        brandMap.set(brand, new Map());
      }

      const packMap = brandMap.get(brand)!;
      if (!packMap.has(packType)) {
        packMap.set(packType, []);
      }

      packMap.get(packType)!.push(product);
    });

    const brandGroups: BrandGroup[] = [];

    brandMap.forEach((packMap, brand) => {
      const packTypes: BrandGroup['packTypes'] = [];
      let brandTotalBoxes = 0;
      let brandTotalCartons = 0;
      let brandTotalValue = 0;

      packMap.forEach((products, packType) => {
        const totalBoxes = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
        const totalCartons = products.reduce((sum, p) => {
          const boxesPerCarton = p.boxes_per_carton || 24;
          return sum + Math.floor((p.stock_quantity || 0) / boxesPerCarton);
        }, 0);
        const totalValue = products.reduce(
          (sum, p) => sum + (p.stock_quantity || 0) * (p.price || 0),
          0
        );

        brandTotalBoxes += totalBoxes;
        brandTotalCartons += totalCartons;
        brandTotalValue += totalValue;

        packTypes.push({
          packType,
          products,
          totalBoxes,
          totalCartons,
          totalValue,
        });
      });

      // Sort pack types by the predefined order
      packTypes.sort((a, b) => {
        const indexA = PACK_TYPES.indexOf(a.packType);
        const indexB = PACK_TYPES.indexOf(b.packType);
        if (indexA === -1 && indexB === -1) return a.packType.localeCompare(b.packType);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      brandGroups.push({
        brand,
        packTypes,
        totalBoxes: brandTotalBoxes,
        totalCartons: brandTotalCartons,
        totalValue: brandTotalValue,
      });
    });

    // Sort brands alphabetically
    brandGroups.sort((a, b) => a.brand.localeCompare(b.brand));

    return brandGroups;
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grand Totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Boxes</p>
              <p className="text-2xl font-bold text-foreground">
                {grandTotals.totalBoxes.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-gradient-to-br from-accent/5 to-accent/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
              <Boxes className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cartons</p>
              <p className="text-2xl font-bold text-foreground">
                {grandTotals.totalCartons.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-gradient-to-br from-success/5 to-success/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
              <Package className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Stock Value</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(grandTotals.totalValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Groups */}
      <div className="space-y-4">
        {brandGroups.length > 0 ? (
          brandGroups.map((brandGroup) => (
            <div
              key={brandGroup.brand}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Brand Header */}
              <button
                onClick={() => toggleBrand(brandGroup.brand)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-foreground">{brandGroup.brand}</h3>
                    <p className="text-sm text-muted-foreground">
                      {brandGroup.packTypes.length} pack types •{' '}
                      {brandGroup.packTypes.reduce((sum, p) => sum + p.products.length, 0)} SKUs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Boxes</p>
                    <p className="font-semibold">{brandGroup.totalBoxes.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Cartons</p>
                    <p className="font-semibold">{brandGroup.totalCartons.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Value</p>
                    <p className="font-semibold text-success">{formatCurrency(brandGroup.totalValue)}</p>
                  </div>
                  <svg
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedBrands.has(brandGroup.brand) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Pack Types Details */}
              {expandedBrands.has(brandGroup.brand) && (
                <div className="border-t border-border">
                  {brandGroup.packTypes.map((packType) => (
                    <div key={packType.packType} className="border-b border-border last:border-b-0">
                      {/* Pack Type Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                        <span className="font-medium text-foreground">{packType.packType}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {packType.totalBoxes.toLocaleString()} boxes
                          </span>
                          <span className="text-muted-foreground">
                            {packType.totalCartons.toLocaleString()} cartons
                          </span>
                          <span className="font-medium text-success">
                            {formatCurrency(packType.totalValue)}
                          </span>
                        </div>
                      </div>

                      {/* Products Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/20">
                              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                Code
                              </th>
                              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                Product Name
                              </th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                                Price
                              </th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                                Boxes
                              </th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                                Cartons
                              </th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                                Boxes/Carton
                              </th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {packType.products.map((product) => {
                              const cartons = Math.floor(
                                (product.stock_quantity || 0) / (product.boxes_per_carton || 24)
                              );
                              const remainingBoxes =
                                (product.stock_quantity || 0) % (product.boxes_per_carton || 24);
                              const value = (product.stock_quantity || 0) * (product.price || 0);

                              return (
                                <tr
                                  key={product.id}
                                  className="border-t border-border hover:bg-muted/20"
                                >
                                  <td className="px-4 py-2">
                                    <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                      {product.product_code || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 font-medium">{product.name}</td>
                                  <td className="px-4 py-2 text-right">
                                    {formatCurrency(product.price)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    {product.stock_quantity.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <span className="font-medium">{cartons}</span>
                                    {remainingBoxes > 0 && (
                                      <span className="text-muted-foreground text-xs ml-1">
                                        +{remainingBoxes}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right text-muted-foreground">
                                    {product.boxes_per_carton || 24}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium text-success">
                                    {formatCurrency(value)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No products found. Add products with brand and pack type information to see the report.
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandStockReport;
