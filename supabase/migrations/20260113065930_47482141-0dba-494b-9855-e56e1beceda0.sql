-- Add payment tracking fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Add manual_credit column to shops for tracking pre-website credits
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS manual_credit NUMERIC DEFAULT 0;

-- Update existing orders with 'paid' status to have payment_received_at set to updated_at
UPDATE public.orders 
SET payment_received_at = updated_at 
WHERE payment_status = 'paid' AND payment_received_at IS NULL;