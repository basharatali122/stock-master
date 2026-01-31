
-- Create a function to calculate actual pending credit for a shop
-- This runs with SECURITY DEFINER to bypass RLS and see all orders
CREATE OR REPLACE FUNCTION public.get_shop_pending_credits()
RETURNS TABLE(shop_id uuid, pending_credit numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.shop_id,
    COALESCE(SUM(o.total_amount - COALESCE(o.paid_amount, 0)), 0) as pending_credit
  FROM orders o
  WHERE o.payment_status IN ('credit', 'partial', 'pending')
    AND o.status != 'cancelled'
    AND (o.total_amount - COALESCE(o.paid_amount, 0)) > 0
  GROUP BY o.shop_id
  
  UNION ALL
  
  -- Also include pending manual credits
  SELECT 
    mc.shop_id,
    COALESCE(SUM(mc.amount), 0) as pending_credit
  FROM manual_credits mc
  WHERE mc.status = 'pending'
  GROUP BY mc.shop_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_shop_pending_credits() TO authenticated;
