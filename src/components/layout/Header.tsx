import React, { memo, useMemo } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = memo(function Header({ onMenuClick }) {
  const { profile, isAdmin } = useAuth();

  // Memoize user initial
  const userInitial = useMemo(() => 
    profile?.full_name?.charAt(0)?.toUpperCase() || 'U', 
    [profile?.full_name]
  );

  const roleLabel = useMemo(() => 
    isAdmin ? 'Administrator' : 'Order Booker',
    [isAdmin]
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-muted lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
        
        <div className="hidden md:block">
          <h2 className="text-lg font-semibold text-foreground">ALAM TRADER</h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          className="relative rounded-lg p-2 hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="hidden items-center gap-3 border-l border-border pl-4 sm:flex">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {userInitial}
          </div>
        </div>
      </div>
    </header>
  );
});

export default Header;