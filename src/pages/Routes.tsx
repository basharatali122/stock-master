import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DataTable from '@/components/ui/DataTable';
import { Plus, Search, Edit, Trash2, Map, User, Calendar } from 'lucide-react';
import { Route } from '@/types';

// Mock routes data
const mockRoutes: Route[] = [
  {
    id: '1',
    name: 'Gulberg Route',
    cityId: '1',
    cityName: 'Lahore',
    assignedBookerId: '2',
    assignedBookerName: 'Ahmed Khan',
    activeDays: ['Monday', 'Wednesday', 'Friday'],
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'Model Town Route',
    cityId: '1',
    cityName: 'Lahore',
    assignedBookerId: '3',
    assignedBookerName: 'Hassan Ali',
    activeDays: ['Tuesday', 'Thursday', 'Saturday'],
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'DHA Route',
    cityId: '1',
    cityName: 'Lahore',
    assignedBookerId: '2',
    assignedBookerName: 'Ahmed Khan',
    activeDays: ['Tuesday', 'Thursday'],
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: '4',
    name: 'Johar Town Route',
    cityId: '1',
    cityName: 'Lahore',
    assignedBookerId: undefined,
    assignedBookerName: undefined,
    activeDays: ['Monday', 'Wednesday', 'Friday'],
    isActive: false,
    createdAt: new Date(),
  },
  {
    id: '5',
    name: 'Saddar Route',
    cityId: '2',
    cityName: 'Karachi',
    assignedBookerId: '4',
    assignedBookerName: 'Bilal Ahmed',
    activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: '6',
    name: 'Clifton Route',
    cityId: '2',
    cityName: 'Karachi',
    assignedBookerId: '4',
    assignedBookerName: 'Bilal Ahmed',
    activeDays: ['Saturday'],
    isActive: true,
    createdAt: new Date(),
  },
];

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Routes: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const filteredRoutes = mockRoutes.filter(
    (route) =>
      route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.cityName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

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
            <p className="text-xs text-muted-foreground">{item.cityName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'assignedBookerName',
      header: 'Assigned To',
      render: (item: Route) =>
        item.assignedBookerName ? (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {item.assignedBookerName.charAt(0)}
            </div>
            <span>{item.assignedBookerName}</span>
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
          {item.activeDays.map((day) => (
            <span
              key={day}
              className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              {day.slice(0, 3)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item: Route) => (
        <span className={item.isActive ? 'badge-success' : 'badge-destructive'}>
          {item.isActive ? 'Active' : 'Inactive'}
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
            <h1 className="page-title">Routes</h1>
            <p className="page-subtitle">
              {isAdmin
                ? 'Manage distribution routes and assignments'
                : 'View your assigned routes'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
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
          <p className="mt-1 text-2xl font-bold">{mockRoutes.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Active Routes</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {mockRoutes.filter((r) => r.isActive).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Assigned Routes</p>
          <p className="mt-1 text-2xl font-bold">
            {mockRoutes.filter((r) => r.assignedBookerId).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Unassigned</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            {mockRoutes.filter((r) => !r.assignedBookerId).length}
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
            <p className="mt-1 text-sm text-muted-foreground">
              Create a new distribution route
            </p>

            <form className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Route Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Gulberg Route"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">City</label>
                <select className="input-field">
                  <option value="">Select city</option>
                  <option value="1">Lahore</option>
                  <option value="2">Karachi</option>
                  <option value="3">Islamabad</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Assign Order Booker
                </label>
                <select className="input-field">
                  <option value="">Select order booker (optional)</option>
                  <option value="2">Ahmed Khan</option>
                  <option value="3">Hassan Ali</option>
                  <option value="4">Bilal Ahmed</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Active Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        selectedDays.includes(day)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
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
                  defaultChecked
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Route is active
                </label>
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
                  Add Route
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
