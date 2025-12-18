import React from 'react';
import { Link } from 'react-router-dom';
import { Map, Store, Calendar, ArrowRight, ShoppingCart } from 'lucide-react';

// Mock data for order booker's assigned routes
const myRoutes = [
  {
    id: '1',
    name: 'Gulberg Route',
    cityName: 'Lahore',
    activeDays: ['Monday', 'Wednesday', 'Friday'],
    isActiveToday: true,
    totalShops: 15,
    visitedToday: 8,
    pendingOrders: 3,
  },
  {
    id: '3',
    name: 'DHA Route',
    cityName: 'Lahore',
    activeDays: ['Tuesday', 'Thursday'],
    isActiveToday: false,
    totalShops: 12,
    visitedToday: 0,
    pendingOrders: 0,
  },
];

const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

const MyRoutes: React.FC = () => {
  const activeRoutes = myRoutes.filter((route) =>
    route.activeDays.includes(today)
  );

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
                        {route.cityName}
                      </p>
                    </div>
                  </div>
                  <span className="badge-success">Active</span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {route.totalShops}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Shops</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">
                      {route.visitedToday}
                    </p>
                    <p className="text-xs text-muted-foreground">Visited</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">
                      {route.pendingOrders}
                    </p>
                    <p className="text-xs text-muted-foreground">Pending</p>
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
          {myRoutes.map((route) => (
            <div
              key={route.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    route.isActiveToday
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Map className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{route.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {route.cityName} • {route.totalShops} shops
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-wrap gap-1">
                  {route.activeDays.map((day) => (
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
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Routes</p>
          <p className="mt-1 text-2xl font-bold">{myRoutes.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Shops</p>
          <p className="mt-1 text-2xl font-bold">
            {myRoutes.reduce((acc, r) => acc + r.totalShops, 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Active Days/Week</p>
          <p className="mt-1 text-2xl font-bold">
            {[...new Set(myRoutes.flatMap((r) => r.activeDays))].length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MyRoutes;
