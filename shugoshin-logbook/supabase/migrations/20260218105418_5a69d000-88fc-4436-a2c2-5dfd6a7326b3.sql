
-- Step 1: 既存の organization_members ベースのポリシーを削除
DROP POLICY IF EXISTS "Admins can view/edit financials" ON public.organization_financials;

-- Step 2: SELECT ポリシー（組織メンバー全員が閲覧可能、user_roles テーブル経由）
CREATE POLICY "Members can view financials"
  ON public.organization_financials
  FOR SELECT
  USING (
    public.is_member_of_org(auth.uid(), organization_id)
  );

-- Step 3: INSERT / UPDATE / DELETE ポリシー（管理者のみ変更可能）
CREATE POLICY "Admins can edit financials"
  ON public.organization_financials
  FOR ALL
  USING (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::public.app_role)
  );
