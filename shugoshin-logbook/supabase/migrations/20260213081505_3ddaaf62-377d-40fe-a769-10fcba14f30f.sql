
-- Fix: Unrestricted organization creation
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Admins can insert orgs" ON public.organizations;

-- New policy: only allow users who don't already have any role (first-time org creation)
CREATE POLICY "New users can create initial org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );
