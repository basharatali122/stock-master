-- Add purchase_rate column to products table for cost/invoice price tracking
ALTER TABLE public.products
ADD COLUMN purchase_rate numeric NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.products.purchase_rate IS 'Purchase/invoice/cost rate for internal tracking, separate from sale/TP rate';