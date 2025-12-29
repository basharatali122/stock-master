import { z } from 'zod';

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }).max(255, { message: 'Email must be less than 255 characters' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).max(100, { message: 'Password must be less than 100 characters' }),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required' }).max(100, { message: 'Name must be less than 100 characters' }),
  email: z.string().trim().email({ message: 'Invalid email address' }).max(255, { message: 'Email must be less than 255 characters' }),
  phone: z.string().trim().min(1, { message: 'Phone is required' }).max(20, { message: 'Phone must be less than 20 characters' }).regex(/^[\d\s\+\-\(\)]+$/, { message: 'Invalid phone format' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }).max(100, { message: 'Password must be less than 100 characters' }),
});

// Product validation schemas
export const productSchema = z.object({
  name: z.string().trim().min(1, { message: 'Product name is required' }).max(100, { message: 'Name must be less than 100 characters' }),
  category: z.string().trim().min(1, { message: 'Category is required' }).max(50, { message: 'Category must be less than 50 characters' }),
  price: z.number().positive({ message: 'Price must be greater than 0' }).max(10000000, { message: 'Price exceeds maximum limit' }),
  stock_quantity: z.number().int({ message: 'Stock must be a whole number' }).min(0, { message: 'Stock cannot be negative' }).max(1000000, { message: 'Stock exceeds maximum limit' }),
  discount_percentage: z.number().min(0, { message: 'Discount cannot be negative' }).max(100, { message: 'Discount cannot exceed 100%' }),
});

// Shop validation schemas
export const shopSchema = z.object({
  name: z.string().trim().min(1, { message: 'Shop name is required' }).max(100, { message: 'Name must be less than 100 characters' }),
  owner_name: z.string().trim().min(1, { message: 'Owner name is required' }).max(100, { message: 'Owner name must be less than 100 characters' }),
  phone: z.string().trim().max(20, { message: 'Phone must be less than 20 characters' }).regex(/^[\d\s\+\-\(\)]*$/, { message: 'Invalid phone format' }).optional().or(z.literal('')),
  address: z.string().trim().max(500, { message: 'Address must be less than 500 characters' }).optional().or(z.literal('')),
  route_id: z.string().uuid({ message: 'Invalid route selected' }),
  shop_code: z.string().trim().min(1, { message: 'Shop code is required' }).max(50, { message: 'Shop code must be less than 50 characters' }),
});

// Order validation schemas
export const orderItemSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid product' }),
  quantity: z.number().int({ message: 'Quantity must be a whole number' }).positive({ message: 'Quantity must be at least 1' }).max(10000, { message: 'Quantity exceeds maximum limit' }),
  price: z.number().min(0, { message: 'Price cannot be negative' }),
  discount: z.number().min(0, { message: 'Discount cannot be negative' }).max(100, { message: 'Discount cannot exceed 100%' }),
});

export const orderSchema = z.object({
  shop_id: z.string().uuid({ message: 'Invalid shop selected' }),
  items: z.array(orderItemSchema).min(1, { message: 'Order must have at least one item' }),
  payment_type: z.enum(['paid', 'credit', 'partial'], { message: 'Invalid payment type' }),
  paid_amount: z.number().min(0, { message: 'Paid amount cannot be negative' }).optional(),
});

// Financial validation schemas
export const financialSchema = z.object({
  salary: z.number().min(0, { message: 'Salary cannot be negative' }).max(10000000, { message: 'Salary exceeds maximum limit' }),
  advance: z.number().min(0, { message: 'Advance cannot be negative' }).max(10000000, { message: 'Advance exceeds maximum limit' }),
});

export const advanceSchema = z.object({
  amount: z.number().positive({ message: 'Amount must be greater than 0' }).max(10000000, { message: 'Amount exceeds maximum limit' }),
  note: z.string().max(500, { message: 'Note must be less than 500 characters' }).optional(),
});

// Helper function to validate and return result
export type ValidationResult<T> = 
  | { success: true; data: T; error?: undefined }
  | { success: false; error: string; data?: undefined };

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Validation failed' };
}
