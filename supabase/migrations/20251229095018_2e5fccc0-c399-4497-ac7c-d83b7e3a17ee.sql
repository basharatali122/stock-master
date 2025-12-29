-- Add shop_code column to shops table
ALTER TABLE public.shops ADD COLUMN shop_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_shops_shop_code ON public.shops(shop_code);