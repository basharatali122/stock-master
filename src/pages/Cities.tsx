import React, { useState } from 'react';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Edit, Trash2, MapPin } from 'lucide-react';
import { City } from '@/types';

// Mock cities data
const mockCities: City[] = [
  { id: '1', name: 'Lahore', createdAt: new Date() },
  { id: '2', name: 'Karachi', createdAt: new Date() },
  { id: '3', name: 'Islamabad', createdAt: new Date() },
  { id: '4', name: 'Rawalpindi', createdAt: new Date() },
  { id: '5', name: 'Faisalabad', createdAt: new Date() },
  { id: '6', name: 'Multan', createdAt: new Date() },
];

const routeCountByCity: Record<string, number> = {
  '1': 4,
  '2': 3,
  '3': 2,
  '4': 1,
  '5': 2,
  '6': 1,
};

const Cities: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCityName, setNewCityName] = useState('');

  const filteredCities = mockCities.filter((city) =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          {routeCountByCity[item.id] || 0} routes
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Added On',
      render: (item: City) => new Date(item.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: City) => (
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
  ];

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
          <p className="mt-1 text-2xl font-bold">{mockCities.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Routes</p>
          <p className="mt-1 text-2xl font-bold">
            {Object.values(routeCountByCity).reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Avg Routes/City</p>
          <p className="mt-1 text-2xl font-bold">
            {(Object.values(routeCountByCity).reduce((a, b) => a + b, 0) / mockCities.length).toFixed(1)}
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

            <form className="mt-6 space-y-4">
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
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add City
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
