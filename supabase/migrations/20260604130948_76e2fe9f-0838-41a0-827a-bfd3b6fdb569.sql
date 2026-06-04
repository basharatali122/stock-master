UPDATE auth.users
SET email = 'alamtrader@gmail.com',
    encrypted_password = crypt('Alam@12345', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = '02ce9764-2888-4021-85bf-eaca9b450a94';

UPDATE auth.identities
SET identity_data = jsonb_set(
      jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', '"alamtrader@gmail.com"'),
      '{email_verified}', 'true'),
    provider_id = 'alamtrader@gmail.com',
    updated_at = now()
WHERE user_id = '02ce9764-2888-4021-85bf-eaca9b450a94' AND provider = 'email';

UPDATE public.profiles
SET email = 'alamtrader@gmail.com', updated_at = now()
WHERE user_id = '02ce9764-2888-4021-85bf-eaca9b450a94';