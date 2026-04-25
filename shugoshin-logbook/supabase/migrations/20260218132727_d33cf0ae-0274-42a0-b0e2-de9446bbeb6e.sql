
-- Step 1-A: approved_at / approved_by カラムを追加
ALTER TABLE public.transport_orders
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID        DEFAULT NULL;

-- Step 1-B: 既存の無制限管理者 UPDATE ポリシーを削除し、2段階ポリシーに分割
DROP POLICY IF EXISTS "Admins can update orders" ON public.transport_orders;

-- 管理者は draft を承認（approved）に変更できる（承認操作専用）
CREATE POLICY "Admins can approve draft orders"
  ON public.transport_orders
  FOR UPDATE
  USING (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    AND status = 'draft'
  )
  WITH CHECK (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
  );

-- 管理者は approved を delivered に変更できる（配送完了マーク）
CREATE POLICY "Admins can mark orders delivered"
  ON public.transport_orders
  FOR UPDATE
  USING (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    AND status = 'approved'
  )
  WITH CHECK (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    AND status = 'delivered'
  );
