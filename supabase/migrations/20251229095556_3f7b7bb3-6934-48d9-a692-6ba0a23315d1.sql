-- Add product_code, brand, pack_type, and boxes_per_carton columns to products table
ALTER TABLE public.products ADD COLUMN product_code TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN brand TEXT;
ALTER TABLE public.products ADD COLUMN pack_type TEXT;
ALTER TABLE public.products ADD COLUMN boxes_per_carton INTEGER DEFAULT 24;

-- Create index for faster lookups
CREATE INDEX idx_products_product_code ON public.products(product_code);
CREATE INDEX idx_products_brand ON public.products(brand);
CREATE INDEX idx_products_pack_type ON public.products(pack_type);