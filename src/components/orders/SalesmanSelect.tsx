import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SalesmanSelectProps {
  value: string;
  onChange: (name: string) => void;
  label?: string;
}

interface UserOpt { user_id: string; full_name: string; }

export const SalesmanSelect: React.FC<SalesmanSelectProps> = ({ value, onChange, label = 'Salesman / Delivery Boy' }) => {
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name', { ascending: true });
      if (!cancelled && data) setUsers(data as UserOpt[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-3 rounded-lg bg-muted/40 border border-border">
      <label className="flex items-center gap-2 text-sm font-medium mb-2">
        <Users className="h-4 w-4 text-primary" />
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{loading ? 'Loading...' : '— Select salesman —'}</option>
        {users.map(u => (
          <option key={u.user_id} value={u.full_name}>{u.full_name}</option>
        ))}
      </select>
    </div>
  );
};
