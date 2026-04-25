ALTER TABLE public.transport_orders
  ADD COLUMN temperature_zone text NOT NULL DEFAULT '常温';