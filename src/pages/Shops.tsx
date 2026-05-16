import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DataTable from "@/components/ui/DataTable";
import ShopHistory from "@/components/ShopHistory";
import { Plus, Search, Edit, Trash2, Store, Phone, Loader2, Eye, Printer, DollarSign, CreditCard, List } from "lucide-react";
import { toast } from "sonner";
import { printContent, formatCurrencyForPrint } from "@/lib/print";
import { shopSchema, validateInput } from "@/lib/validation";
import { AddManualCreditModal } from "@/components/shops/AddManualCreditModal";
import { RecordPreviousCreditModal } from "@/components/shops/RecordPreviousCreditModal";
import { ManualCreditsListModal } from "@/components/shops/ManualCreditsListModal";
interface Shop {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  address: string | null;
  route_id: string;
  credit_balance: number;
  created_at: string;
  shop_code: string | null;
  routes?: { name: string; city_id: string };
}

interface Route {
  id: string;
  name: string;
  cities?: { name: string };
}

interface OrderBooker {
  id: string;
  full_name: string;
}

const Shops: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedShopForHistory, setSelectedShopForHistory] = useState<Shop | null>(null);
  const [showPrintCreditsModal, setShowPrintCreditsModal] = useState(false);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [selectedBookerId, setSelectedBookerId] = useState<string>("all");
  const [loadingBookers, setLoadingBookers] = useState(false);
  const [creditDateFilter, setCreditDateFilter] = useState("");
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [selectedShopForCredit, setSelectedShopForCredit] = useState<Shop | null>(null);
  const [showRecordCreditModal, setShowRecordCreditModal] = useState(false);
  const [selectedShopForRecordCredit, setSelectedShopForRecordCredit] = useState<Shop | null>(null);
  const [showManualCreditsModal, setShowManualCreditsModal] = useState(false);
  const [manualCreditsBookerId, setManualCreditsBookerId] = useState<string | undefined>(undefined);
  const [manualCreditsBookerName, setManualCreditsBookerName] = useState<string | undefined>(undefined);
  // Real-time pending credits calculated from orders and manual_credits
  const [shopPendingCredits, setShopPendingCredits] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    name: "",
    owner_name: "",
    phone: "",
    address: "",
    route_id: "",
    shop_code: "",
  });

  const fetchData = useCallback(async () => {
    try {
      // For order bookers, first get their assigned route IDs
      let assignedRouteIds: string[] = [];

      if (!isAdmin && user) {
        const { data: userRoutes, error: userRoutesError } = await supabase
          .from("routes")
          .select("id")
          .eq("assigned_booker_id", user.id)
          .eq("is_active", true);

        if (userRoutesError) throw userRoutesError;
        assignedRouteIds = userRoutes?.map((r) => r.id) || [];
      }

      // For order bookers with no routes, exit early
      if (!isAdmin && assignedRouteIds.length === 0) {
        setShops([]);
        setRoutes([]);
        setLoading(false);
        return;
      }

      // Build queries
      let shopsQuery = supabase
        .from("shops")
        .select("*, routes(name, city_id)")
        .order("created_at", { ascending: false })
        .limit(1000);

      let routesQuery = supabase.from("routes").select("id, name, cities(name)").eq("is_active", true).order("name");

      if (!isAdmin && assignedRouteIds.length > 0) {
        shopsQuery = shopsQuery.in("route_id", assignedRouteIds);
        routesQuery = routesQuery.in("id", assignedRouteIds);
      }

      // Batch both queries in parallel
      const [shopsResult, routesResult] = await Promise.all([shopsQuery, routesQuery]);

      if (shopsResult.error) throw shopsResult.error;
      if (routesResult.error) throw routesResult.error;

      setShops(shopsResult.data || []);
      setRoutes(routesResult.data || []);
    } catch (error: any) {
      toast.error("Failed to load shops: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch real-time pending credits using database function
  const fetchPendingCredits = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_shop_pending_credits');
      if (error) throw error;

      // Aggregate results (function returns separate rows for orders and manual credits)
      const creditsByShop: Record<string, number> = {};
      (data || []).forEach((row: { shop_id: string; pending_credit: number }) => {
        creditsByShop[row.shop_id] = (creditsByShop[row.shop_id] || 0) + Number(row.pending_credit);
      });

      setShopPendingCredits(creditsByShop);
    } catch (error: any) {
      console.error("Failed to fetch pending credits:", error.message);
    }
  }, []);

  // Fetch pending credits on mount and when shops change
  useEffect(() => {
    if (shops.length > 0) {
      fetchPendingCredits();
    }
  }, [shops.length, fetchPendingCredits]);

  // Realtime subscription for shops (credit balance updates)
  useEffect(() => {
    const shopsChannel = supabase
      .channel('shops-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shops'
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          if (eventType === 'UPDATE') {
            setShops(prev => prev.map(shop => 
              shop.id === newRecord.id 
                ? { ...shop, ...newRecord }
                : shop
            ));
          } else if (eventType === 'INSERT' || eventType === 'DELETE') {
            // Refetch for insert/delete to get full data with relations
            fetchData();
          }
        }
      )
      .subscribe();

    // Also subscribe to orders changes to update pending credits in real-time
    const ordersChannel = supabase
      .channel('orders-realtime-credits')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          // Refetch pending credits when orders change
          fetchPendingCredits();
        }
      )
      .subscribe();

    // Subscribe to manual_credits changes too
    const manualCreditsChannel = supabase
      .channel('manual-credits-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'manual_credits'
        },
        () => {
          fetchPendingCredits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shopsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(manualCreditsChannel);
    };
  }, [fetchData, fetchPendingCredits]);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const validationResult = validateInput(shopSchema, {
      name: formData.name,
      owner_name: formData.owner_name,
      phone: formData.phone || "",
      address: formData.address || "",
      route_id: formData.route_id,
    });

    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    const validatedData = validationResult.data;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("shops").insert({
        name: validatedData.name,
        owner_name: validatedData.owner_name,
        phone: validatedData.phone || null,
        address: validatedData.address || null,
        route_id: validatedData.route_id,
      });

      if (error) throw error;

      toast.success("Shop added successfully");
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Failed to add shop: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) {
      toast.error("No shop selected for editing");
      return;
    }

    // Validate input
    const validationResult = validateInput(shopSchema, {
      name: formData.name,
      owner_name: formData.owner_name,
      phone: formData.phone || "",
      address: formData.address || "",
      route_id: formData.route_id,
      
    });

    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    const validatedData = validationResult.data;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("shops")
        .update({
          name: validatedData.name,
          owner_name: validatedData.owner_name,
          phone: validatedData.phone || null,
          address: validatedData.address || null,
          route_id: validatedData.route_id,
          
        })
        .eq("id", editingShop.id);

      if (error) throw error;

      toast.success("Shop updated successfully");
      setShowEditModal(false);
      setEditingShop(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error("Failed to update shop: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShop = async (shop: Shop) => {
    if (!confirm(`Are you sure you want to delete "${shop.name}"?`)) return;

    try {
      const { error } = await supabase.from("shops").delete().eq("id", shop.id);

      if (error) throw error;

      toast.success("Shop deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to delete shop: " + error.message);
    }
  };

  const openEditModal = (shop: Shop) => {
    setEditingShop(shop);
    setFormData({
      name: shop.name,
      owner_name: shop.owner_name,
      phone: shop.phone || "",
      address: shop.address || "",
      route_id: shop.route_id,
      shop_code: shop.shop_code || "",
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      owner_name: "",
      phone: "",
      address: "",
      route_id: "",
      shop_code: "",
    });
  };

  const filteredShops = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(searchLower) ||
        shop.owner_name.toLowerCase().includes(searchLower) ||
        shop.routes?.name?.toLowerCase().includes(searchLower) ||
        
    );
  }, [shops, searchQuery]);

  const formatCurrency = useCallback((amount: number) => `Rs. ${amount.toLocaleString()}`, []);

  const { totalCredit, shopsWithCredit, shopsWithZeroCredit } = useMemo(() => {
    let total = 0;
    let withCredit = 0;
    let zeroCredit = 0;

    shops.forEach((shop) => {
      // Use real-time pending credits from database function, not stale credit_balance
      const balance = shopPendingCredits[shop.id] || 0;
      total += balance;
      if (balance > 0) withCredit++;
      else zeroCredit++;
    });

    return { totalCredit: total, shopsWithCredit: withCredit, shopsWithZeroCredit: zeroCredit };
  }, [shops, shopPendingCredits]);

  const fetchOrderBookers = async () => {
    setLoadingBookers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .eq("status", "approved")
        .order("full_name");

      if (error) throw error;

      // Map to use user_id as the id since orders use booker_id which is user_id
      setOrderBookers((data || []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
    } catch (error: any) {
      toast.error("Failed to load order bookers: " + error.message);
    } finally {
      setLoadingBookers(false);
    }
  };

  const openPrintCreditsModal = () => {
    setSelectedBookerId("all");
    setCreditDateFilter("");
    fetchOrderBookers();
    setShowPrintCreditsModal(true);
  };

  const openAddCreditModal = (shop: Shop) => {
    setSelectedShopForCredit(shop);
    setShowAddCreditModal(true);
  };

  const openRecordCreditModal = (shop: Shop) => {
    setSelectedShopForRecordCredit(shop);
    setShowRecordCreditModal(true);
  };

  const handlePrintPendingCredits = async () => {
    try {
      // Build query for orders with pending payment
      let query = supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          created_at,
          total_amount,
          paid_amount,
          payment_status,
          booker_id,
          payment_received_at,
          payment_method,
          shops!inner(
            id,
            name,
            phone,
            routes!inner(name)
          )
        `,
        )
        .in("payment_status", ["credit", "partial"])
        .order("created_at", { ascending: false });

      // Filter by booker if selected
      if (selectedBookerId !== "all") {
        query = query.eq("booker_id", selectedBookerId);
      }

      // Filter by date if selected - show all credits UP TO and including selected date
      if (creditDateFilter) {
        const endDate = new Date(creditDateFilter);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data: ordersWithDues, error } = await query;

      if (error) throw error;

      // Fetch manual credits from the new table with booker info
      let manualCreditsQuery = supabase
        .from("manual_credits")
        .select(`
          id,
          shop_id,
          booker_id,
          amount,
          description,
          status,
          created_at,
          shops(name, phone, routes(name))
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      // Filter by booker if selected
      if (selectedBookerId !== "all") {
        manualCreditsQuery = manualCreditsQuery.eq("booker_id", selectedBookerId);
      }

      // Filter by date if selected
      if (creditDateFilter) {
        const endDate = new Date(creditDateFilter);
        endDate.setHours(23, 59, 59, 999);
        manualCreditsQuery = manualCreditsQuery.lte("created_at", endDate.toISOString());
      }

      const { data: manualCredits, error: manualCreditsError } = await manualCreditsQuery;

      if (manualCreditsError) throw manualCreditsError;

      // Fetch booker names for manual credits
      const bookerIds = [...new Set((manualCredits || []).map(c => c.booker_id))];
      let bookerMap = new Map<string, string>();
      if (bookerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", bookerIds);
        bookerMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      }

      const hasOrderCredits = ordersWithDues && ordersWithDues.length > 0;
      const hasManualCredits = manualCredits && manualCredits.length > 0;

      if (!hasOrderCredits && !hasManualCredits) {
        toast.info("No pending credits found");
        return;
      }

      // Get booker name for the report title
      const selectedBooker = orderBookers.find((b) => b.id === selectedBookerId);
      const bookerName = selectedBookerId === "all" ? "All Order Bookers" : selectedBooker?.full_name || "Unknown";

      const now = new Date();
      let tableRows = "";
      let totalPending = 0;
      let orderIndex = 0;

      // Add order-based credits
      if (ordersWithDues) {
        ordersWithDues.forEach((order: any) => {
          orderIndex++;
          const remainingBalance = (order.total_amount || 0) - (order.paid_amount || 0);
          totalPending += remainingBalance;

          const orderDate = new Date(order.created_at);
          const pendingDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

          tableRows += `
            <tr>
              <td style="text-align: center;">${orderIndex}</td>
              <td>${orderDate.toLocaleDateString()}</td>
              <td>${order.order_number}</td>
              <td>${order.shops?.name || "N/A"}</td>
              <td>${order.shops?.routes?.name || "N/A"}</td>
              <td style="text-align: right;">${formatCurrencyForPrint(order.total_amount)}</td>
              <td style="text-align: right; font-weight: bold; color: #dc2626;">${formatCurrencyForPrint(remainingBalance)}</td>
              <td style="text-align: center;">${pendingDays} days</td>
              <td>${order.shops?.phone || "N/A"}</td>
            </tr>
          `;
        });
      }

      // Add manual credits section with booker info
      let manualCreditRows = "";
      let totalManualCredit = 0;
      let manualIndex = 0;

      if (manualCredits) {
        manualCredits.forEach((credit: any) => {
          manualIndex++;
          const amount = credit.amount || 0;
          totalManualCredit += amount;
          const creditDate = new Date(credit.created_at);
          const pendingDays = Math.floor((now.getTime() - creditDate.getTime()) / (1000 * 60 * 60 * 24));
          const creditBookerName = bookerMap.get(credit.booker_id) || "Unknown";

          manualCreditRows += `
            <tr>
              <td style="text-align: center;">${manualIndex}</td>
              <td>${creditDate.toLocaleDateString()}</td>
              <td>${credit.shops?.name || "N/A"}</td>
              <td>${credit.shops?.routes?.name || "N/A"}</td>
              <td>${creditBookerName}</td>
              <td style="text-align: right; font-weight: bold; color: #dc2626;">${formatCurrencyForPrint(amount)}</td>
              <td style="text-align: center;">${pendingDays} days</td>
              <td>${credit.description || "-"}</td>
              <td>${credit.shops?.phone || "N/A"}</td>
            </tr>
          `;
        });
      }

      const grandTotal = totalPending + totalManualCredit;
      const dateLabel = creditDateFilter ? `Up to ${new Date(creditDateFilter).toLocaleDateString()}` : "All Time";
      
      const content = `
        <div class="header">
          <h1>Pending Credits Report</h1>
          <p>Order Booker: ${bookerName} | ${dateLabel}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Total Orders with Dues:</span>
            <span class="info-value">${ordersWithDues?.length || 0}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Manual Credits:</span>
            <span class="info-value">${manualCredits?.length || 0}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Grand Total Pending:</span>
            <span class="info-value" style="color: #dc2626;">${formatCurrencyForPrint(grandTotal)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Report Date:</span>
            <span class="info-value">${now.toLocaleDateString()} ${now.toLocaleTimeString()}</span>
          </div>
        </div>

        ${hasOrderCredits ? `
        <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Order-Based Credits (${formatCurrencyForPrint(totalPending)})</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align: center;">Sr. No.</th>
              <th>Delivery Date</th>
              <th>Order ID</th>
              <th>Shop/Client Name</th>
              <th>Route Name</th>
              <th style="text-align: right;">Total Amount</th>
              <th style="text-align: right;">Remaining Balance</th>
              <th style="text-align: center;">Pending Days</th>
              <th>Contact No.</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        ` : ''}

        ${hasManualCredits ? `
        <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Previous/Manual Credits (${formatCurrencyForPrint(totalManualCredit)})</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align: center;">Sr. No.</th>
              <th>Date Added</th>
              <th>Shop/Client Name</th>
              <th>Route Name</th>
              <th>Order Booker</th>
              <th style="text-align: right;">Credit Amount</th>
              <th style="text-align: center;">Pending Days</th>
              <th>Description</th>
              <th>Contact No.</th>
            </tr>
          </thead>
          <tbody>
            ${manualCreditRows}
          </tbody>
        </table>
        ` : ''}

        <div class="summary">
          ${hasOrderCredits ? `<div class="summary-row">
            <span>Order Credits Subtotal:</span>
            <span>${formatCurrencyForPrint(totalPending)}</span>
          </div>` : ''}
          ${hasManualCredits ? `<div class="summary-row">
            <span>Manual Credits Subtotal:</span>
            <span>${formatCurrencyForPrint(totalManualCredit)}</span>
          </div>` : ''}
          <div class="summary-row total">
            <span>Grand Total Pending:</span>
            <span style="color: #dc2626;">${formatCurrencyForPrint(grandTotal)}</span>
          </div>
        </div>
      `;

      printContent(content, `Pending Credits Report - ${bookerName}`);
      setShowPrintCreditsModal(false);
    } catch (error: any) {
      toast.error("Failed to generate report: " + error.message);
    }
  };

  const openManualCreditsForBooker = (bookerId: string, bookerName: string) => {
    setManualCreditsBookerId(bookerId);
    setManualCreditsBookerName(bookerName);
    setShowManualCreditsModal(true);
  };

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Shop",
        render: (item: Shop) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Store className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.owner_name}</p>
            </div>
          </div>
        ),
      },
      {
        key: "contact",
        header: "Contact",
        render: (item: Shop) => (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{item.phone || "N/A"}</span>
          </div>
        ),
      },
      {
        key: "route",
        header: "Route",
        render: (item: Shop) => (
          <span className="rounded bg-secondary px-2 py-1 text-xs font-medium">{item.routes?.name || "N/A"}</span>
        ),
      },
      {
        key: "credit_balance",
        header: "Credit Balance",
        render: (item: Shop) => {
          // Use real-time pending credits from database function
          const pendingCredit = shopPendingCredits[item.id] || 0;
          return (
            <span className={pendingCredit > 0 ? "text-warning font-medium" : ""}>
              {formatCurrency(pendingCredit)}
            </span>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        render: (item: Shop) => (
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => setSelectedShopForHistory(item)}
                className="rounded-lg p-2 hover:bg-primary/10"
                title="View History"
              >
                <Eye className="h-4 w-4 text-primary" />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => openAddCreditModal(item)}
                className="rounded-lg p-2 hover:bg-warning/10"
                title="Add Manual Credit (increases balance)"
              >
                <DollarSign className="h-4 w-4 text-warning" />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => openRecordCreditModal(item)}
                className="rounded-lg p-2 hover:bg-success/10"
                title="Record Payment (reduces balance)"
              >
                <CreditCard className="h-4 w-4 text-success" />
              </button>
            )}
            <button onClick={() => openEditModal(item)} className="rounded-lg p-2 hover:bg-muted">
              <Edit className="h-4 w-4 text-muted-foreground" />
            </button>
            {isAdmin && (
              <button onClick={() => handleDeleteShop(item)} className="rounded-lg p-2 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, formatCurrency, shopPendingCredits],
  );

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
            <h1 className="page-title">Shops</h1>
            <p className="page-subtitle">Manage registered shops and their payment status</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Add Shop
          </button>
          {isAdmin && (
            <button onClick={openPrintCreditsModal} className="btn-secondary">
              <Printer className="mr-2 h-4 w-4" />
              Print Pending Credits
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search shops, owners, or routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Shops</p>
          <p className="mt-1 text-2xl font-bold">{shops.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Credit</p>
          <p className="mt-1 text-2xl font-bold text-warning">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Shops with Credit</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{shopsWithCredit}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Clear Balance</p>
          <p className="mt-1 text-2xl font-bold text-success">{shopsWithZeroCredit}</p>
        </div>
      </div>

      {/* Shops Table */}
      <DataTable
        columns={columns}
        data={filteredShops}
        keyExtractor={(item) => item.id}
        emptyMessage="No shops found"
      />

      {/* Add Shop Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Add New Shop</h2>
            <p className="mt-1 text-sm text-muted-foreground">Register a new shop</p>

            <form onSubmit={handleAddShop} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Shop Code *</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="e.g., SH001"
                    value={formData.shop_code}
                    onChange={(e) => setFormData({ ...formData, shop_code: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Shop Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Al-Madina General Store"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Owner Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Muhammad Iqbal"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone Number</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Address</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Shop address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Route *</label>
                <select
                  className="input-field"
                  value={formData.route_id}
                  onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} {route.cities ? `(${route.cities.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shop Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Edit Shop</h2>
            <p className="mt-1 text-sm text-muted-foreground">Update shop details</p>

            <form onSubmit={handleEditShop} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Shop Code *</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    value={formData.shop_code}
                    onChange={(e) => setFormData({ ...formData, shop_code: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Shop Name *</label>
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
                  <label className="mb-1.5 block text-sm font-medium">Owner Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone Number</label>
                  <input
                    type="tel"
                    className="input-field"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Address</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Route *</label>
                <select
                  className="input-field"
                  value={formData.route_id}
                  onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select route</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} {route.cities ? `(${route.cities.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingShop(null);
                    resetForm();
                  }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Credits Modal */}
      {showPrintCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-elevated p-6 w-full max-w-md mx-4 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Print Pending Credits</h2>
                <p className="text-sm text-muted-foreground">Select an order booker to filter</p>
              </div>
              <button onClick={() => setShowPrintCreditsModal(false)} className="rounded-lg p-2 hover:bg-muted">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Order Booker</label>
                {loadingBookers ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading bookers...
                  </div>
                ) : (
                  <select
                    value={selectedBookerId}
                    onChange={(e) => setSelectedBookerId(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="all">All Order Bookers</option>
                    {orderBookers.map((booker) => (
                      <option key={booker.id} value={booker.id}>
                        {booker.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Show Credits Up To Date (Optional)</label>
                <input
                  type="date"
                  value={creditDateFilter}
                  onChange={(e) => setCreditDateFilter(e.target.value)}
                  className="input-field w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">Shows all credit records up to and including this date</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowPrintCreditsModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const selectedBooker = orderBookers.find(b => b.id === selectedBookerId);
                    openManualCreditsForBooker(
                      selectedBookerId === "all" ? "" : selectedBookerId,
                      selectedBookerId === "all" ? "All Bookers" : selectedBooker?.full_name || ""
                    );
                    setShowPrintCreditsModal(false);
                  }} 
                  className="btn-secondary flex-1"
                >
                  <List className="mr-2 h-4 w-4" />
                  View Credits
                </button>
                <button onClick={handlePrintPendingCredits} className="btn-primary flex-1" disabled={loadingBookers}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shop History Modal */}
      {selectedShopForHistory && (
        <ShopHistory
          shopId={selectedShopForHistory.id}
          shopName={selectedShopForHistory.name}
          onClose={() => setSelectedShopForHistory(null)}
        />
      )}

      {/* Add Manual Credit Modal */}
      {showAddCreditModal && selectedShopForCredit && (
        <AddManualCreditModal
          shop={selectedShopForCredit}
          onClose={() => {
            setShowAddCreditModal(false);
            setSelectedShopForCredit(null);
          }}
          onSuccess={fetchData}
        />
      )}

      {/* Manual Credits List Modal */}
      {showManualCreditsModal && (
        <ManualCreditsListModal
          bookerId={manualCreditsBookerId}
          bookerName={manualCreditsBookerName}
          onClose={() => {
            setShowManualCreditsModal(false);
            setManualCreditsBookerId(undefined);
            setManualCreditsBookerName(undefined);
          }}
          onRefresh={fetchData}
        />
      )}

      {/* Record Previous Credit Modal */}
      {showRecordCreditModal && selectedShopForRecordCredit && (
        <RecordPreviousCreditModal
          shop={selectedShopForRecordCredit}
          onClose={() => {
            setShowRecordCreditModal(false);
            setSelectedShopForRecordCredit(null);
          }}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default Shops;
