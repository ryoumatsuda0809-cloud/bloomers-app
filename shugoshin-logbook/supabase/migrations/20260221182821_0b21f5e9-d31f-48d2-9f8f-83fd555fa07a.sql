
-- Step 1: 既存の RESTRICTIVE ポリシーを削除
DROP POLICY IF EXISTS "Members can view their org" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their org" ON public.organizations;
DROP POLICY IF EXISTS "Admins can delete their org" ON public.organizations;
DROP POLICY IF EXISTS "New users can create initial org" ON public.organizations;

-- Step 2: PERMISSIVE ポリシーとして再作成
CREATE POLICY "Members can view their org"
  ON public.organizations FOR SELECT TO authenticated
  USING (is_member_of_org(auth.uid(), id));

CREATE POLICY "Admins can update their org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (has_role_in_org(auth.uid(), id, 'admin'));

CREATE POLICY "Admins can delete their org"
  ON public.organizations FOR DELETE TO authenticated
  USING (has_role_in_org(auth.uid(), id, 'admin'));

CREATE POLICY "New users can create initial org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid())
  );

-- Step 3: SECURITY DEFINER 関数の作成
CREATE OR REPLACE FUNCTION public.get_order_geofence(_order_id uuid)
RETURNS TABLE (lat double precision, lon double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.latitude AS lat, o.longitude AS lon
  FROM transport_orders t
  JOIN organizations o ON o.id = t.organization_id
  WHERE t.id = _order_id
    AND is_member_of_org(auth.uid(), t.organization_id)
    AND o.latitude IS NOT NULL
    AND o.longitude IS NOT NULL
  LIMIT 1;
$$;
