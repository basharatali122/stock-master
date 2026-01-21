import React, { useState, useCallback, memo } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import { X } from 'lucide-react';

// Memoized loading spinner
const LoadingSpinner = memo(function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
});

// Mobile overlay component
const MobileOverlay = memo(function MobileOverlay({ 
  onClick 
}: { 
  onClick: () => void 
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-foreground/50 lg:hidden transition-opacity"
      onClick={onClick}
      aria-hidden="true"
    />
  );
});

// Mobile close button
const MobileCloseButton = memo(function MobileCloseButton({ 
  onClick 
}: { 
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className="absolute right-2 top-2 rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent"
      aria-label="Close menu"
    >
      <X className="h-5 w-5" />
    </button>
  );
});

const DashboardLayout: React.FC = memo(function DashboardLayout() {
  const { user, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const openMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(true);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && <MobileOverlay onClick={closeMobileMenu} />}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
        <MobileCloseButton onClick={closeMobileMenu} />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        <Header onMenuClick={openMobileMenu} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
});

export default DashboardLayout;