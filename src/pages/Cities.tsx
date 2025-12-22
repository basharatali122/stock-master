import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Edit, Trash2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface City {
  id: string;
  name: string;
  created_at: string;
  route_count?: number;
}

const Cities: React.FC = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCities = async () => {
    try {
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .order('created_at', { ascending: false });

      if (citiesError) throw citiesError;

      // Get route counts for each city
      const { data: routesData, error: routesError } = await supabase
        .from('routes')
        .select('city_id');

      if (routesError) throw routesError;

      const routeCounts = routesData?.reduce((acc, route) => {
        acc[route.city_id] = (acc[route.city_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const citiesWithCounts = citiesData?.map(city => ({
        ...city,
        route_count: routeCounts[city.id] || 0
      })) || [];

      setCities(citiesWithCounts);
    } catch (error: any) {
      toast.error('Failed to load cities: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) {
      toast.error('Please enter a city name');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('cities')
        .insert({ name: newCityName.trim() });

      if (error) throw error;

      toast.success('City added successfully');
      setShowAddModal(false);
      setNewCityName('');
      fetchCities();
    } catch (error: any) {
      toast.error('Failed to add city: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity || !newCityName.trim()) {
      toast.error('Please enter a city name');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('cities')
        .update({ name: newCityName.trim() })
        .eq('id', editingCity.id);

      if (error) throw error;

      toast.success('City updated successfully');
      setShowEditModal(false);
      setEditingCity(null);
      setNewCityName('');
      fetchCities();
    } catch (error: any) {
      toast.error('Failed to update city: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCity = async (city: City) => {
    if (!confirm(`Are you sure you want to delete "${city.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('cities')
        .delete()
        .eq('id', city.id);

      if (error) throw error;

      toast.success('City deleted successfully');
      fetchCities();
    } catch (error: any) {
      toast.error('Failed to delete city: ' + error.message);
    }
  };

  const openEditModal = (city: City) => {
    setEditingCity(city);
    setNewCityName(city.name);
    setShowEditModal(true);
  };

  const filteredCities = cities.filter((city) =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRoutes = cities.reduce((acc, city) => acc + (city.route_count || 0), 0);

  const columns = [
    {
      key: 'name',
      header: 'City Name',
      render: (item: City) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <MapPin className="h-5 w-5 text-accent" />
          </div>
          <span className="font-medium">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'routes',
      header: 'Routes',
      render: (item: City) => (
        <span className="rounded bg-secondary px-2 py-1 text-sm font-medium">
          {item.route_count || 0} routes
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Added On',
      render: (item: City) => new Date(item.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: City) => (
        <div className="flex gap-2">
          <button 
            onClick={() => openEditModal(item)}
            className="rounded-lg p-2 hover:bg-muted"
          >
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>
          <button 
            onClick={() => handleDeleteCity(item)}
            className="rounded-lg p-2 hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
      ),
    },
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
            <h1 className="page-title">Cities</h1>
            <p className="page-subtitle">Manage cities for distribution routes</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Add City
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search cities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Cities</p>
          <p className="mt-1 text-2xl font-bold">{cities.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Routes</p>
          <p className="mt-1 text-2xl font-bold">{totalRoutes}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Avg Routes/City</p>
          <p className="mt-1 text-2xl font-bold">
            {cities.length > 0 ? (totalRoutes / cities.length).toFixed(1) : '0'}
          </p>
        </div>
      </div>

      {/* Cities Table */}
      <DataTable
        columns={columns}
        data={filteredCities}
        keyExtractor={(item) => item.id}
        emptyMessage="No cities found"
      />

      {/* Add City Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Add New City</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a new city for distribution routes
            </p>

            <form onSubmit={handleAddCity} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  City Name
                </label>
                <input
                  type="text"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Lahore"
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewCityName('');
                  }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add City
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit City Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-elevated animate-scale-in">
            <h2 className="text-xl font-bold text-foreground">Edit City</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update the city name
            </p>

            <form onSubmit={handleEditCity} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  City Name
                </label>
                <input
                  type="text"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Lahore"
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCity(null);
                    setNewCityName('');
                  }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update City
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cities;
