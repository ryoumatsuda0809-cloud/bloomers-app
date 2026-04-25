-- organization_members RLSポリシー追加
-- 無限再帰回避のため既存のSECURITY DEFINER関数を使用

-- SELECT: 自分と同じ組織のメンバーのみ閲覧可能
-- get_user_org_id は SECURITY DEFINER なので organization_members を安全に参照できる
CREATE POLICY "Members can view own org members"
  ON public.organization_members FOR SELECT
  USING (
    organization_id = public.get_user_org_id(auth.uid())
  );

-- INSERT: 管理者のみメンバーを追加可能
-- has_role_in_org は SECURITY DEFINER で user_roles テーブルを参照するため安全
CREATE POLICY "Admins can insert members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::public.app_role)
  );

-- UPDATE: 管理者のみロール変更可能
CREATE POLICY "Admins can update members"
  ON public.organization_members FOR UPDATE
  USING (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::public.app_role)
  );

-- DELETE: 管理者のみメンバー削除可能
CREATE POLICY "Admins can delete members"
  ON public.organization_members FOR DELETE
  USING (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::public.app_role)
  );