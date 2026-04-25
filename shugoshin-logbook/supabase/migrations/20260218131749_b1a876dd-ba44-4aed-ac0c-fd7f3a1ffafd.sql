
-- 作成者本人が draft 状態の発注のみ UPDATE できるポリシーを追加
CREATE POLICY "Creators can update own draft orders"
  ON public.transport_orders
  FOR UPDATE
  USING (
    created_by = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'draft'
  );

-- 組織メンバー全員が発注を INSERT できるポリシーを追加（既存の管理者専用ポリシーに追加）
CREATE POLICY "Members can create orders in their org"
  ON public.transport_orders
  FOR INSERT
  WITH CHECK (
    is_member_of_org(auth.uid(), organization_id)
  );
