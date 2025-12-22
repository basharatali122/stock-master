-- Fix handle_new_user to cast status to approval_status enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing profiles
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  INSERT INTO public.profiles (user_id, full_name, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Admin User'),
    NEW.email,
    CASE WHEN user_count = 0 THEN 'approved'::approval_status ELSE 'pending'::approval_status END
  );
  
  -- First user gets admin role, others get order_booker
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN user_count = 0 THEN 'admin'::app_role ELSE 'order_booker'::app_role END);
  
  RETURN NEW;
END;
$function$;