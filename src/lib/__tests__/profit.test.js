import { describe, expect, test } from 'bun:test';
import { calculateProfit, getPeriodStart } from '../profit';

describe('profit', () => {
  test('profit is sale amount minus purchase rate × boxes', () => {
    const rates = new Map([['a', 150], ['b', 800]]);
    const result = calculateProfit(
      [
        { total_amount: 2000, order_items: [{ product_id: 'a', quantity: 10 }] }, // cost 1500
        { total_amount: 1000, order_items: [{ product_id: 'b', quantity: 1 }] }, // cost 800
      ],
      rates,
    );
    expect(result.sales).toBe(3000);
    expect(result.cost).toBe(2300);
    expect(result.profit).toBe(700);
  });

  test('weekly period starts on Monday, monthly on the 1st', () => {
    const thu = new Date(2026, 9, 29, 15, 0); // Thu 29 Oct 2026
    expect(getPeriodStart('daily', thu).getDate()).toBe(29);
    expect(getPeriodStart('weekly', thu).getDate()).toBe(26);
    expect(getPeriodStart('monthly', thu).getDate()).toBe(1);
  });
});
