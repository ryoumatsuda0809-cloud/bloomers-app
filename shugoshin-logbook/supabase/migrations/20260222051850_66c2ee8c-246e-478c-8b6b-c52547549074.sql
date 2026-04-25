
-- Step 1: Create organization_invite_codes table
CREATE TABLE public.organization_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_invite_codes ENABLE ROW LEVEL SECURITY;

-- Step 2: RLS policies (admin only)
CREATE POLICY "Admins can view invite codes"
  ON public.organization_invite_codes FOR SELECT
  USING (has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can create invite codes"
  ON public.organization_invite_codes FOR INSERT
  WITH CHECK (has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can update invite codes"
  ON public.organization_invite_codes FOR UPDATE
  USING (has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can delete invite codes"
  ON public.organization_invite_codes FOR DELETE
  USING (has_role_in_org(auth.uid(), organization_id, 'admin'));

-- Step 3: Migrate existing data
INSERT INTO public.organization_invite_codes (organization_id, code)
SELECT id, invite_code FROM public.organizations WHERE invite_code IS NOT NULL;

-- Step 4: Rewrite join RPC to use new table
CREATE OR REPLACE FUNCTION public.join_organization_by_invite_code(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  target_org_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION '既に組織に所属しています';
  END IF;

  IF _code IS NULL OR length(trim(_code)) < 4 THEN
    RAISE EXCEPTION '無効な招待コードです';
  END IF;

  SELECT organization_id INTO target_org_id
  FROM organization_invite_codes
  WHERE code = upper(trim(_code)) AND is_active = true;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION '招待コードが見つかりません';
  END IF;

  INSERT INTO organization_members (user_id, organization_id, role)
  VALUES (auth.uid(), target_org_id, 'driver');

  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), target_org_id, 'driver');

  UPDATE profiles
  SET organization_id = target_org_id
  WHERE user_id = auth.uid();

  RETURN target_org_id;
END;
$$;

-- New RPC: create_invite_code
CREATE OR REPLACE FUNCTION public.create_invite_code(_org_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
BEGIN
  IF NOT has_role_in_org(auth.uid(), _org_id, 'admin') THEN
    RAISE EXCEPTION '管理者権限が必要です';
  END IF;

  new_code := generate_invite_code();

  INSERT INTO organization_invite_codes (organization_id, code)
  VALUES (_org_id, new_code);

  RETURN new_code;
END;
$$;

-- New RPC: deactivate_invite_code
CREATE OR REPLACE FUNCTION public.deactivate_invite_code(_code_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM organization_invite_codes
  WHERE id = _code_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION '招待コードが見つかりません';
  END IF;

  IF NOT has_role_in_org(auth.uid(), v_org_id, 'admin') THEN
    RAISE EXCEPTION '管理者権限が必要です';
  END IF;

  UPDATE organization_invite_codes
  SET is_active = false
  WHERE id = _code_id;
END;
$$;

-- Step 5: Drop old column and function
ALTER TABLE public.organizations DROP COLUMN invite_code;
DROP FUNCTION IF EXISTS public.regenerate_invite_code(uuid);
