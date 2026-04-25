-- 既存 SELECT ポリシーを削除
DROP POLICY IF EXISTS "Members can view logs for their org orders" ON public.compliance_logs;
DROP POLICY IF EXISTS "Drivers can view own logs" ON public.compliance_logs;
DROP POLICY IF EXISTS "Admins can view org logs" ON public.compliance_logs;

-- ドライバー: 自分が作成したログのみ (PERMISSIVE)
CREATE POLICY "Drivers can view own logs"
  ON public.compliance_logs FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- 管理者: 組織全体のログを閲覧 (PERMISSIVE)
CREATE POLICY "Admins can view org logs"
  ON public.compliance_logs FOR SELECT TO authenticated
  USING (has_role_in_org(auth.uid(), organization_id, 'admin'));