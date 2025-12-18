import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  MapPin,
  Store,
  Package,
  ShoppingCart,
  RotateCcw,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Map,
  TrendingUp,
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const adminLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/cities', icon: MapPin, label: 'Cities' },
    { to: '/routes', icon: Map, label: 'Routes' },
    { to: '/shops', icon: Store, label: 'Shops' },
    { to: '/products', icon: Package, label: 'Products' },
    { to: '/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/returns', icon: RotateCcw, label: 'Returns' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/financials', icon: DollarSign, label: 'Financials' },
    { to: '/reports', icon: TrendingUp, label: 'Reports' },
  ];

  const bookerLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/my-routes', icon: Map, label: 'My Routes' },
    { to: '/shops', icon: Store, label: 'Shops' },
    { to: '/products', icon: Package, label: 'Products' },
    { to: '/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/returns', icon: RotateCcw, label: 'Returns' },
  ];

  const links = isAdmin ? adminLinks : bookerLinks;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Package className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">ARTRADERS</h1>
            <p className="text-xs text-sidebar-muted">Distribution System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-thin">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <link.icon className="h-5 w-5" />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 px-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.name}
              </p>
              <p className="truncate text-xs text-sidebar-muted">
                {user?.role === 'admin' ? 'Administrator' : 'Order Booker'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <NavLink
              to="/settings"
              className="nav-link flex-1 justify-center"
            >
              <Settings className="h-4 w-4" />
              <span className="text-sm">Settings</span>
            </NavLink>
            <button
              onClick={handleLogout}
              className="nav-link flex-1 justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
