
-- ランダム6桁英数字を生成するヘルパー関数
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT upper(substr(md5(gen_random_uuid()::text), 1, 6));
$$;

-- カラム追加
ALTER TABLE public.organizations
  ADD COLUMN invite_code text UNIQUE;

-- 既存レコードにコードを付与
UPDATE public.organizations
  SET invite_code = generate_invite_code()
  WHERE invite_code IS NULL;

-- NOT NULL 制約を追加
ALTER TABLE public.organizations
  ALTER COLUMN invite_code SET NOT NULL;

-- デフォルト値を設定
ALTER TABLE public.organizations
  ALTER COLUMN invite_code SET DEFAULT generate_invite_code();

-- 招待コードで組織に参加する RPC
CREATE OR REPLACE FUNCTION public.join_organization_by_invite_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT id INTO target_org_id
  FROM organizations
  WHERE invite_code = upper(trim(_code));

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

-- 招待コード再発行 RPC（管理者のみ）
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  IF NOT has_role_in_org(auth.uid(), _org_id, 'admin') THEN
    RAISE EXCEPTION '管理者権限が必要です';
  END IF;

  new_code := generate_invite_code();
  UPDATE organizations SET invite_code = new_code WHERE id = _org_id;
  RETURN new_code;
END;
$$;
