-- Fix: Drop overly broad shops visibility policy and create restrictive one
-- This addresses the PUBLIC_DATA_EXPOSURE security issue

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view shops" ON public.shops;

-- Create restrictive policy: Only admins and bookers assigned to the route can view shops
CREATE POLICY "Bookers can view shops on their routes" 
ON public.shops FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = shops.route_id 
    AND routes.assigned_booker_id = auth.uid()
  )
);