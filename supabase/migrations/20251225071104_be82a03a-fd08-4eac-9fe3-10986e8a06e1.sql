-- Add DELETE policy for admins on profiles table
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also add DELETE policy for user_roles so cascade cleanup works
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));