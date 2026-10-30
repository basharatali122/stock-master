import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Loader2 } from 'lucide-react';
import { calculateProfit, getPeriodStart, type ProfitPeriod } from '@/lib/profit';

const PERIOD_LABELS: Record<ProfitPeriod, string> = {
  daily: 'Daily Profit (Today)',
  weekly: 'Weekly Profit (This Week)',
  monthly: 'Monthly Profit (This Month)',
};

const formatCurrency = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

const ProfitSummary: React.FC = () => {
  const [period, setPeriod] = useState<ProfitPeriod>('daily');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState({ sales: 0, cost: 0, profit: 0, orders: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const start = getPeriodStart(period);
        const [ordersRes, ratesRes] = await Promise.all([
          supabase
            .from('orders')
            .select('total_amount, status, order_items(product_id, quantity)')
            .gte('created_at', start.toISOString())
            .neq('status', 'cancelled')
            .limit(5000),
          supabase.rpc('get_product_purchase_rates'),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        const rates = new Map<string, number>(
          ((ratesRes.data as any[]) || []).map((r) => [r.id, Number(r.purchase_rate) || 0]),
        );
        const orders = (ordersRes.data || []) as any[];
        const calc = calculateProfit(orders, rates);
        if (!cancelled) setResult({ ...calc, orders: orders.length });
      } catch (e) {
        console.error('Profit load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Profit</h2>
            <p className="text-sm text-muted-foreground">Sale amount minus purchase rate</p>
          </div>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as ProfitPeriod)}
          className="input-field w-full sm:w-64"
          aria-label="Profit period"
        >
          <option value="daily">{PERIOD_LABELS.daily}</option>
          <option value="weekly">{PERIOD_LABELS.weekly}</option>
          <option value="monthly">{PERIOD_LABELS.monthly}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Sale Amount</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(result.sales)}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Purchase Cost</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(result.cost)}</p>
          </div>
          <div className="rounded-lg border border-success/40 bg-success/10 p-4">
            <p className="text-sm text-muted-foreground">Total Profit</p>
            <p className={`text-2xl font-bold ${result.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(result.profit)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Orders</p>
            <p className="text-2xl font-bold text-foreground">{result.orders}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitSummary;
