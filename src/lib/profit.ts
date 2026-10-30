export type ProfitPeriod = 'daily' | 'weekly' | 'monthly';

export interface ProfitOrder {
  total_amount: number;
  order_items: { product_id: string; quantity: number }[];
}

/** Start of the selected period: today, current week (Monday), or current month. */
export function getPeriodStart(period: ProfitPeriod, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === 'weekly') {
    const diff = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - diff);
  } else if (period === 'monthly') {
    d.setDate(1);
  }
  return d;
}

/**
 * Profit = what shops are billed (sale, after discounts) minus what the goods
 * cost at the purchase rate (per box × boxes sold).
 */
export function calculateProfit(orders: ProfitOrder[], purchaseRates: Map<string, number>) {
  let sales = 0;
  let cost = 0;
  for (const order of orders) {
    sales += Number(order.total_amount) || 0;
    for (const item of order.order_items || []) {
      cost += (Number(item.quantity) || 0) * (purchaseRates.get(item.product_id) || 0);
    }
  }
  return { sales, cost, profit: sales - cost };
}
