-- Change default payment_status from 'pending' to 'credit'
ALTER TABLE public.orders ALTER COLUMN payment_status SET DEFAULT 'credit';

-- Update any existing orders with 'pending' payment_status to 'credit'
UPDATE public.orders SET payment_status = 'credit' WHERE payment_status = 'pending';