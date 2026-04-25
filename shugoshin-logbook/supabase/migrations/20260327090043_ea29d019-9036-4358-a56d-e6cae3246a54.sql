CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  client_name text NOT NULL,
  radius integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_select"
  ON public.facilities
  FOR SELECT
  TO authenticated
  USING (true);