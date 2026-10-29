-- Fix for new user role assignment
-- Ensures that ANY user signing up via Google (or email) is assigned the 'customer' role, NEVER 'admin'

BEGIN;

-- 1. Ensure the default column value in profiles is 'customer'
ALTER TABLE public.profiles 
  ALTER COLUMN role SET DEFAULT 'customer';

-- 2. Update the trigger function on auth.users so that it explicitly sets role to 'customer'
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    'customer',  -- Strictly 'customer' for all new signups
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    -- Never change an existing role on re-login
    role = COALESCE(public.profiles.role, 'customer'),
    updated_at = NOW();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
