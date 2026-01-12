-- Allow order bookers to delete their own orders
CREATE POLICY "Bookers can delete their own orders" 
ON public.orders 
FOR DELETE 
USING (auth.uid() = booker_id);

-- Allow bookers to delete order items for their own orders
CREATE POLICY "Bookers can delete their order items" 
ON public.order_items 
FOR DELETE 
USING (EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_items.order_id) AND (orders.booker_id = auth.uid()))));