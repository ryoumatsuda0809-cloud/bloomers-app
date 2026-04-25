
-- Fix search_path for generate_invite_code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  SELECT upper(substr(md5(gen_random_uuid()::text), 1, 6));
$$;
