CREATE OR REPLACE FUNCTION public.get_nearest_facility(
  user_lat double precision,
  user_lng double precision
)
RETURNS TABLE(
  id uuid, name text, client_name text,
  lat double precision, lng double precision,
  radius integer, distance_m double precision
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id, f.name, f.client_name, f.lat, f.lng, f.radius,
    6371000 * 2 * asin(sqrt(
      sin(radians(f.lat - user_lat) / 2) ^ 2 +
      cos(radians(user_lat)) * cos(radians(f.lat)) *
      sin(radians(f.lng - user_lng) / 2) ^ 2
    )) AS distance_m
  FROM facilities f
  WHERE 6371000 * 2 * asin(sqrt(
      sin(radians(f.lat - user_lat) / 2) ^ 2 +
      cos(radians(user_lat)) * cos(radians(f.lat)) *
      sin(radians(f.lng - user_lng) / 2) ^ 2
    )) <= f.radius
  ORDER BY distance_m ASC
  LIMIT 1;
$$;