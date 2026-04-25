
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- 既に組織に所属しているユーザーは作成不可（二重作成を防ぐ）
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION '既に組織に所属しています';
  END IF;

  -- 組織名の検証
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RAISE EXCEPTION '組織名を入力してください';
  END IF;

  -- 組織を作成
  INSERT INTO organizations (name)
  VALUES (trim(org_name))
  RETURNING id INTO new_org_id;

  -- 作成者を admin として user_roles に登録（SECURITY DEFINER でRLSをバイパス）
  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), new_org_id, 'admin');

  -- profiles の organization_id も更新
  UPDATE profiles
  SET organization_id = new_org_id
  WHERE user_id = auth.uid();

  RETURN new_org_id;
END;
$$;
