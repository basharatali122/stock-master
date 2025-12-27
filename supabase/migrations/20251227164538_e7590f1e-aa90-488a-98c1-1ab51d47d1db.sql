-- Enhanced stock management functions with validation

-- Drop existing triggers first (with correct names)
DROP TRIGGER IF EXISTS deduct_stock_on_order_item ON public.order_items;
DROP TRIGGER IF EXISTS restore_stock_on_return ON public.returns;

-- Drop and recreate functions with CASCADE
DROP FUNCTION IF EXISTS public.deduct_stock_on_order() CASCADE;
DROP FUNCTION IF EXISTS public.restore_stock_on_return_approved() CASCADE;

-- Create enhanced deduct_stock_on_order function with validation
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_stock INTEGER;
  v_is_active BOOLEAN;
BEGIN
  -- Validate quantity is positive and reasonable
  IF NEW.quantity <= 0 OR NEW.quantity > 10000 THEN
    RAISE EXCEPTION 'Invalid order quantity: %. Must be between 1 and 10000', NEW.quantity;
  END IF;
  
  -- Check product exists and is active
  SELECT stock_quantity, is_active INTO v_stock, v_is_active
  FROM public.products
  WHERE id = NEW.product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', NEW.product_id;
  END IF;
  
  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Cannot order inactive product';
  END IF;
  
  -- Check sufficient stock
  IF v_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % available, % requested', v_stock, NEW.quantity;
  END IF;
  
  -- Deduct stock
  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create enhanced restore_stock_on_return_approved function with validation
CREATE OR REPLACE FUNCTION public.restore_stock_on_return_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Validate quantity is positive and reasonable
    IF NEW.quantity <= 0 OR NEW.quantity > 10000 THEN
      RAISE EXCEPTION 'Invalid return quantity: %. Must be between 1 and 10000', NEW.quantity;
    END IF;
    
    -- Check product exists
    SELECT EXISTS(SELECT 1 FROM public.products WHERE id = NEW.product_id) INTO v_exists;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'Product not found: %', NEW.product_id;
    END IF;
    
    -- Restore stock
    UPDATE public.products
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate triggers with original names
CREATE TRIGGER deduct_stock_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.deduct_stock_on_order();

CREATE TRIGGER restore_stock_on_return
AFTER UPDATE ON public.returns
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_return_approved();