import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Map, Store, Calendar, ArrowRight, ShoppingCart, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Route {
  id: string;
  name: string;
  city_id: string;
  active_days: string[];
  is_active: boolean;
  cities?: { name: string };
  shop_count?: number;
}

const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

const MyRoutes: React.FC = () => {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopCounts, setShopCounts] = useState<Record<string, number>>({});

  const fetchRoutes = async () => {
    if (!user) return;

    try {
      // Fetch routes assigned to this user
      const { data: routesData, error: routesError } = await supabase
        .from('routes')
        .select(`
          *,
          cities(name)
        `)
        .eq('assigned_booker_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (routesError) throw routesError;

      setRoutes(routesData || []);

      // Fetch shop counts for each route
      if (routesData && routesData.length > 0) {
        const routeIds = routesData.map(r => r.id);
        const { data: shopsData, error: shopsError } = await supabase
          .from('shops')
          .select('route_id')
          .in('route_id', routeIds);

        if (shopsError) throw shopsError;

        const counts: Record<string, number> = {};
        routeIds.forEach(id => { counts[id] = 0; });
        shopsData?.forEach(shop => {
          counts[shop.route_id] = (counts[shop.route_id] || 0) + 1;
        });
        setShopCounts(counts);
      }
    } catch (error: any) {
      toast.error('Failed to load routes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, [user]);

  // Real-time subscription for route updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-routes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'routes',
          filter: `assigned_booker_id=eq.${user.id}`,
        },
        () => {
          fetchRoutes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const activeRoutes = routes.filter((route) =>
    route.active_days?.includes(today)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">My Routes</h1>
          <p className="page-subtitle">View and manage your assigned distribution routes</p>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 mb-4">
            <AlertCircle className="h-8 w-8 text-warning" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No Routes Assigned</h2>
          <p className="text-muted-foreground max-w-md">
            You don't have any routes assigned yet. Please contact your admin to get a route assigned to you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">My Routes</h1>
        <p className="page-subtitle">
          View and manage your assigned distribution routes
        </p>
      </div>

      {/* Today's Info */}
      <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20">
          <Calendar className="h-6 w-6 text-accent" />
        </div>
        <div>
          <p className="font-medium text-foreground">Today is {today}</p>
          <p className="text-sm text-muted-foreground">
            You have {activeRoutes.length} active route(s) for today
          </p>
        </div>
      </div>

      {/* Active Routes Today */}
      {activeRoutes.length > 0 && (
        <div>
          <h2 className="section-title">Active Today</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeRoutes.map((route) => (
              <div
                key={route.id}
                className="rounded-xl border-2 border-accent bg-card p-6 shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                      <Map className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{route.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {route.cities?.name}
                      </p>
                    </div>
                  </div>
                  <span className="badge-success">Active</span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {shopCounts[route.id] || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Shops</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">
                      {(route.active_days || []).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Active Days</p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Link
                    to="/shops"
                    className="btn-primary flex-1"
                  >
                    <Store className="mr-2 h-4 w-4" />
                    View Shops
                  </Link>
                  <Link
                    to="/orders"
                    className="btn-accent flex-1"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Take Order
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Assigned Routes */}
      <div>
        <h2 className="section-title">All Assigned Routes</h2>
        <div className="space-y-4">
          {routes.map((route) => {
            const isActiveToday = route.active_days?.includes(today);
            return (
              <div
                key={route.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      isActiveToday
                        ? 'bg-accent/10 text-accent'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Map className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{route.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {route.cities?.name} • {shopCounts[route.id] || 0} shops
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-wrap gap-1">
                    {(route.active_days || []).map((day) => (
                      <span
                        key={day}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          day === today
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                  <Link
                    to="/shops"
                    className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                  >
                    View
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Routes</p>
          <p className="mt-1 text-2xl font-bold">{routes.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Shops</p>
          <p className="mt-1 text-2xl font-bold">
            {Object.values(shopCounts).reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Active Days/Week</p>
          <p className="mt-1 text-2xl font-bold">
            {[...new Set(routes.flatMap((r) => r.active_days || []))].length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MyRoutes;
