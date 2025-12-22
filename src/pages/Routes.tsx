import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Edit, Trash2, Map, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Route {
  id: string;
  name: string;
  city_id: string;
  assigned_booker_id: string | null;
  active_days: string[];
  is_active: boolean;
  created_at: string;
  cities?: { name: string };
  booker_profile?: { full_name: string } | null;
}

interface City {
  id: string;
  name: string;
}

interface Booker {
  user_id: string;
  full_name: string;
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Routes: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [bookers, setBookers] = useState<Booker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    city_id: '',
    assigned_booker_id: '',
    active_days: [] as string[],
    is_active: true,
  });

  const fetchData = async () => {
    try {
      // Fetch routes with city names
      const { data: routesData, error: routesError } = await supabase
        .from('routes')
        .select(`
          *,
          cities(name)
        `)
        .order('created_at', { ascending: false });

      if (routesError) throw routesError;

      // Fetch booker profiles separately for assigned routes
      const routesWithBookers = await Promise.all(
        (routesData || []).map(async (route) => {
          if (route.assigned_booker_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', route.assigned_booker_id)
              .maybeSingle();
            return { ...route, booker_profile: profile };
          }
          return { ...route, booker_profile: null };
        })
      );

      // For non-admin, filter to only their routes
      if (!isAdmin && user) {
        const userRoutes = routesWithBookers.filter(r => r.assigned_booker_id === user.id);
        setRoutes(userRoutes);
      } else {
        setRoutes(routesWithBookers);
      }

      // Fetch cities
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .order('name');

      if (citiesError) throw citiesError;
      setCities(citiesData || []);

      // Fetch bookers (approved order bookers)
      if (isAdmin) {
        const { data: bookersData, error: bookersError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('status', 'approved');

        if (bookersError) throw bookersError;
        setBookers(bookersData || []);
      }
    } catch (error: any) {
      toast.error('Failed to load routes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin, user]);

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.city_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('routes').insert({
        name: formData.name.trim(),
        city_id: formData.city_id,
        assigned_booker_id: formData.assigned_booker_id || null,
        active_days: formData.active_days,
        is_active: formData.is_active,
      });

      if (error) throw error;

      toast.success('Route added successfully');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Failed to add route: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute || !formData.name || !formData.city_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('routes')
        .update({
          name: formData.name.trim(),
          city_id: formData.city_id,
          assigned_booker_id: formData.assigned_booker_id || null,
          active_days: formData.active_days,
          is_active: formData.is_active,
        })
        .eq('id', editingRoute.id);

      if (error) throw error;

      toast.success('Route updated successfully');
      setShowEditModal(false);
      setEditingRoute(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update route: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!confirm(`Are you sure you want to delete "${route.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', route.id);

      if (error) throw error;

      toast.success('Route deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete route: ' + error.message);
    }
  };

  const openEditModal = (route: Route) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      city_id: route.city_id,
      assigned_booker_id: route.assigned_booker_id || '',
      active_days: route.active_days || [],
      is_active: route.is_active,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      city_id: '',
      assigned_booker_id: '',
      active_days: [],
      is_active: true,
    });
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      active_days: prev.active_days.includes(day)
        ? prev.active_days.filter((d) => d !== day)
        : [...prev.active_days, day],
    }));
  };

  const filteredRoutes = routes.filter(
    (route) =>
      route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.cities?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: 'name',
      header: 'Route',
      render: (item: Route) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Map className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.cities?.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'assignedBooker',
      header: 'Assigned To',
      render: (item: Route) =>
        item.booker_profile ? (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {item.booker_profile.full_name.charAt(0)}
            </div>
            <span>{item.booker_profile.full_name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    {
      key: 'activeDays',
      header: 'Active Days',
      render: (item: Route) => (
        <div className="flex flex-wrap gap-1">
          {(item.active_days || []).map((day) => (
            <span
              key={day}
              className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              {day.slice(0, 3)}
            </span>
          ))}
          {(!item.active_days || item.active_days.length === 0) && (
            <span className="text-muted-foreground text-xs">No days set</span>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item: Route) => (
        <span className={item.is_active ? 'badge-success' : 'badge-destructive'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (item: Route) => (
              <div className="flex gap-2">
                <button onClick={() => openEditModal(item)} className="rounded-lg p-2 hover:bg-muted">
                  <Edit className="h-4 w-4 text-muted-foreground" />
                </button>
                <button onClick={() => handleDeleteRoute(item)} className="rounded-lg p-2 hover:bg-destructive/10">
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
            <h1 className="page-title">Routes</h1>
            <p className="page-subtitle">
              {isAdmin ? 'Manage distribution routes and assignments' : 'View your assigned routes'}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              Add Route
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Routes</p>
          <p className="mt-1 text-2xl font-bold">{routes.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Active Routes</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {routes.filter((r) => r.is_active).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Assigned Routes</p>
          <p className="mt-1 text-2xl font-bold">
            {routes.filter((r) => r.assigned_booker_id).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Unassigned</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            {routes.filter((r) => !r.assigned_booker_id).length}
          </p>
        </div>
      </div>

      {/* Routes Table */}
      <DataTable
        columns={columns}
        data={filteredRoutes}
        keyExtractor={(item) => item.id}
        emptyMessage="No routes found"
      />

      {/* Add Route Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Add New Route</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create a new distribution route</p>

            <form onSubmit={handleAddRoute} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Route Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Gulberg Route"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">City *</label>
                <select
                  className="input-field"
                  value={formData.city_id}
                  onChange={(e) => setFormData({ ...formData, city_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select city</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Assign Order Booker</label>
                <select
                  className="input-field"
                  value={formData.assigned_booker_id}
                  onChange={(e) => setFormData({ ...formData, assigned_booker_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select order booker (optional)</option>
                  {bookers.map((booker) => (
                    <option key={booker.user_id} value={booker.user_id}>{booker.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Active Days</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        formData.active_days.includes(day)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                      disabled={submitting}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="h-4 w-4 rounded border-border"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  disabled={submitting}
                />
                <label htmlFor="isActive" className="text-sm font-medium">Route is active</label>
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
                  Add Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Edit Route</h2>
            <p className="mt-1 text-sm text-muted-foreground">Update route details</p>

            <form onSubmit={handleEditRoute} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Route Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">City *</label>
                <select
                  className="input-field"
                  value={formData.city_id}
                  onChange={(e) => setFormData({ ...formData, city_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select city</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Assign Order Booker</label>
                <select
                  className="input-field"
                  value={formData.assigned_booker_id}
                  onChange={(e) => setFormData({ ...formData, assigned_booker_id: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">Select order booker (optional)</option>
                  {bookers.map((booker) => (
                    <option key={booker.user_id} value={booker.user_id}>{booker.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Active Days</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        formData.active_days.includes(day)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                      disabled={submitting}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  className="h-4 w-4 rounded border-border"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  disabled={submitting}
                />
                <label htmlFor="isActiveEdit" className="text-sm font-medium">Route is active</label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingRoute(null); resetForm(); }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Routes;
