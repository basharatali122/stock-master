
-- Fix 1: Privilege escalation on user_roles - add RESTRICTIVE policies blocking non-admins from INSERT/UPDATE
CREATE POLICY "Only admins can insert user roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update user roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Shops - prevent bookers from re-assigning shops to routes outside their assignment
DROP POLICY IF EXISTS "Order bookers can manage shops on their routes" ON public.shops;

CREATE POLICY "Order bookers can insert shops on their routes"
ON public.shops
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.routes
  WHERE routes.id = shops.route_id AND routes.assigned_booker_id = auth.uid()
));

CREATE POLICY "Order bookers can update shops on their routes"
ON public.shops
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.routes
  WHERE routes.id = shops.route_id AND routes.assigned_booker_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.routes
  WHERE routes.id = shops.route_id AND routes.assigned_booker_id = auth.uid()
));

CREATE POLICY "Order bookers can delete shops on their routes"
ON public.shops
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.routes
  WHERE routes.id = shops.route_id AND routes.assigned_booker_id = auth.uid()
));

-- Fix 3: Restrict Realtime subscriptions to admins only.
-- Bookers fetch via standard queries (which are RLS-scoped); they don't rely on realtime.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can receive realtime messages" ON realtime.messages;
CREATE POLICY "Admins can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 4: Hide products.purchase_rate from non-admins via column-level GRANT.
-- Admins still read it because they're authenticated; we add a SECURITY DEFINER RPC for admin reads
-- and revoke direct column access from non-admins.
REVOKE SELECT (purchase_rate) ON public.products FROM authenticated, anon;

-- Provide an admin-only function to fetch purchase rates (returns NULL for non-admins, errors otherwise)
CREATE OR REPLACE FUNCTION public.get_product_purchase_rates()
RETURNS TABLE(id uuid, purchase_rate numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  RETURN QUERY SELECT p.id, p.purchase_rate FROM public.products p;
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_purchase_rates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_purchase_rates() TO authenticated;
