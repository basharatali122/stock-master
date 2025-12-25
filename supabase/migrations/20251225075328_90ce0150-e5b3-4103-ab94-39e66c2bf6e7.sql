-- Create function to deduct stock when order items are inserted
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for order items insert
CREATE TRIGGER deduct_stock_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.deduct_stock_on_order();

-- Create function to restore stock when return is approved
CREATE OR REPLACE FUNCTION public.restore_stock_on_return_approved()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restore stock when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.products
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for returns status update
CREATE TRIGGER restore_stock_on_return_approved
AFTER UPDATE ON public.returns
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_return_approved();

-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Enable realtime for order_items table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;