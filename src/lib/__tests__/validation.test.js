import { describe, expect, test } from 'bun:test';
import {
  loginSchema,
  registerSchema,
  productSchema,
  shopSchema,
  orderSchema,
  orderItemSchema,
  financialSchema,
  advanceSchema,
  validateInput,
} from '../validation';

const uuid = '123e4567-e89b-12d3-a456-426614174000';

describe('login & register validation', () => {
  test('accepts a valid login', () => {
    expect(loginSchema.safeParse({ email: 'admin@example.com', password: 'secret1' }).success).toBe(true);
  });
  test('rejects a bad email and a short password', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret1' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123' }).success).toBe(false);
  });
  test('register requires a name and a valid phone format', () => {
    const ok = { name: 'Ali', email: 'ali@example.com', phone: '0300-1234567', password: 'secret1' };
    expect(registerSchema.safeParse(ok).success).toBe(true);
    expect(registerSchema.safeParse({ ...ok, name: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, phone: 'call-me!' }).success).toBe(false);
  });
});

describe('product validation', () => {
  const ok = {
    name: 'Tea Partner', brand: 'COUNTY', pack_type: '1×96', category: 'Biscuits',
    price: 55, purchase_rate: 48.95, stock_quantity: 0, discount_percentage: 0, boxes_per_carton: 96,
  };
  test('accepts a valid product with zero stock', () => {
    expect(productSchema.safeParse(ok).success).toBe(true);
  });
  test('rejects negative stock, fractional boxes and discount over 100', () => {
    expect(productSchema.safeParse({ ...ok, stock_quantity: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, boxes_per_carton: 1.5 }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, discount_percentage: 101 }).success).toBe(false);
  });
  test('rejects a zero price but allows a zero purchase rate', () => {
    expect(productSchema.safeParse({ ...ok, price: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, purchase_rate: 0 }).success).toBe(true);
  });
});

describe('shop & order validation', () => {
  test('shop requires a valid route uuid, phone is optional', () => {
    expect(shopSchema.safeParse({ name: 'Shop', owner_name: 'Owner', route_id: uuid }).success).toBe(true);
    expect(shopSchema.safeParse({ name: 'Shop', owner_name: 'Owner', route_id: 'x' }).success).toBe(false);
  });
  test('order item quantity must be a positive whole number, discount capped at 100', () => {
    const item = { productId: uuid, quantity: 2, price: 200, discount: 3 };
    expect(orderItemSchema.safeParse(item).success).toBe(true);
    expect(orderItemSchema.safeParse({ ...item, quantity: 0 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ ...item, quantity: 2.5 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ ...item, discount: 101 }).success).toBe(false);
  });
  test('order needs at least one item and a known payment type', () => {
    const item = { productId: uuid, quantity: 1, price: 100, discount: 0 };
    expect(orderSchema.safeParse({ shop_id: uuid, items: [item], payment_type: 'partial', paid_amount: 50 }).success).toBe(true);
    expect(orderSchema.safeParse({ shop_id: uuid, items: [], payment_type: 'paid' }).success).toBe(false);
    expect(orderSchema.safeParse({ shop_id: uuid, items: [item], payment_type: 'later' }).success).toBe(false);
  });
});

describe('financial validation & validateInput helper', () => {
  test('financial amounts cannot be negative; advance must be positive', () => {
    expect(financialSchema.safeParse({ salary: 50000, advance: 0 }).success).toBe(true);
    expect(financialSchema.safeParse({ salary: -1, advance: 0 }).success).toBe(false);
    expect(advanceSchema.safeParse({ amount: 1000 }).success).toBe(true);
    expect(advanceSchema.safeParse({ amount: 0 }).success).toBe(false);
  });
  test('validateInput returns data on success and the first error message on failure', () => {
    const good = validateInput(loginSchema, { email: 'a@b.com', password: 'secret1' });
    expect(good.success).toBe(true);
    const bad = validateInput(loginSchema, { email: 'nope', password: 'secret1' });
    expect(bad.success).toBe(false);
    expect(bad.error).toBe('Invalid email address');
  });
});
