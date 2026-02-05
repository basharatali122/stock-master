-- Create a sequence for shop codes
CREATE SEQUENCE IF NOT EXISTS shop_code_seq START WITH 1;

-- Function to generate next shop code with proper padding
CREATE OR REPLACE FUNCTION public.generate_shop_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_code INTEGER;
  existing_max INTEGER;
BEGIN
  -- Get the maximum numeric shop code currently in use
  SELECT COALESCE(MAX(
    CASE 
      WHEN shop_code ~ '^[0-9]+$' THEN CAST(shop_code AS INTEGER)
      ELSE 0
    END
  ), 0) INTO existing_max FROM shops;
  
  -- Get next value from sequence
  next_code := nextval('shop_code_seq');
  
  -- Use the higher of sequence or existing max + 1
  IF existing_max >= next_code THEN
    next_code := existing_max + 1;
    -- Update sequence to stay in sync
    PERFORM setval('shop_code_seq', next_code);
  END IF;
  
  -- Return 6-digit padded code (e.g., 000001, 000002, etc.)
  RETURN LPAD(next_code::TEXT, 6, '0');
END;
$$;

-- Create trigger to auto-generate shop code if not provided
CREATE OR REPLACE FUNCTION public.auto_generate_shop_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only generate if shop_code is null or empty
  IF NEW.shop_code IS NULL OR TRIM(NEW.shop_code) = '' THEN
    NEW.shop_code := generate_shop_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on shops table
DROP TRIGGER IF EXISTS trigger_auto_generate_shop_code ON shops;
CREATE TRIGGER trigger_auto_generate_shop_code
  BEFORE INSERT ON shops
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_shop_code();