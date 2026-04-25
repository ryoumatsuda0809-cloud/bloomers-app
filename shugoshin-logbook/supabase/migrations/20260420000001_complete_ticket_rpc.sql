-- =============================================================================
-- complete_ticket: 作業完了処理・待機時間自動計算・水産物情報記録
--
-- 【法的要件】
--   水産流通適正化法: 漁獲番号・品目・重量などの水産物特定情報を不変記録する。
--   取適法: 作業完了時刻をDBサーバー時刻で確定し、待機時間を自動計算する。
--
-- 【設計方針】
--   - issue_ticket / get_nearest_facility は一切変更しない。
--   - 完了処理は1トランザクションで departure エビデンス記録・ステータス遷移を行う。
--   - 時刻はすべてDBサーバーの CURRENT_TIMESTAMP で記録し、クライアント入力を排除。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: waiting_evidence へのカラム追加
--   completed_at : 作業完了時刻（complete_ticket RPC がサーバー時刻で設定）
--   fishery_data : 水産流通適正化法対応の水産物情報（JSONB）
-- ---------------------------------------------------------------------------
ALTER TABLE public.waiting_evidence
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.waiting_evidence
  ADD COLUMN IF NOT EXISTS fishery_data JSONB;

COMMENT ON COLUMN public.waiting_evidence.completed_at IS
  '法的証拠要件: 作業完了時刻。complete_ticket RPCがDBサーバー時刻で設定する。クライアント送信値は無効。';

COMMENT ON COLUMN public.waiting_evidence.fishery_data IS
  '水産流通適正化法: 漁獲番号・品目・重量などの水産物特定情報をJSONB形式で保存。例: {"catch_number":"SH-2026-00123","species":"マグロ","weight_kg":450.5}';

-- ---------------------------------------------------------------------------
-- STEP 2: wait_logs への待機時間集計カラム追加
--   waiting_minutes: arrival_time〜work_end_time の差分をDBが自動計算（GENERATED列）
-- ---------------------------------------------------------------------------
ALTER TABLE public.wait_logs
  ADD COLUMN IF NOT EXISTS waiting_minutes NUMERIC
    GENERATED ALWAYS AS (
      CASE
        WHEN work_end_time IS NOT NULL AND arrival_time IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (work_end_time - arrival_time)) / 60, 1)
        ELSE NULL
      END
    ) STORED;

COMMENT ON COLUMN public.wait_logs.waiting_minutes IS
  '取適法: 待機時間（分）。arrival_timeとwork_end_timeからDBが自動計算する。クライアント入力不可（GENERATED ALWAYS）。';

-- ---------------------------------------------------------------------------
-- STEP 3: fishery_data への直接書き込みを禁止（Column Privilege）
--   authenticated ロールは complete_ticket (SECURITY DEFINER) 経由のみ書き込み可能。
-- ---------------------------------------------------------------------------
REVOKE UPDATE (fishery_data) ON public.waiting_evidence FROM authenticated;

-- ---------------------------------------------------------------------------
-- STEP 4: complete_ticket RPC
--
-- 【シグネチャ】
--   Args   : p_log_id      UUID   – 完了する wait_log の ID
--            p_fishery_data JSONB  – 水産物情報（任意、NULL可）
--   Returns: TABLE(log_id UUID, completed_at TIMESTAMPTZ, waiting_minutes NUMERIC)
--
-- 【内部処理】
--   1. wait_log を SELECT FOR UPDATE（本人確認・ステータス検証）
--   2. advance_wait_status で status → 'completed'、work_end_time をサーバー時刻で記録
--   3. waiting_evidence に departure エビデンスを INSERT
--      - completed_at / recorded_at はサーバー時刻
--      - fishery_data は引数をそのまま保存
--   4. 更新後の waiting_minutes を返却
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_ticket(
  p_log_id       UUID,
  p_fishery_data JSONB DEFAULT NULL
)
RETURNS TABLE (
  log_id          UUID,
  completed_at    TIMESTAMPTZ,
  waiting_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status  TEXT;
  v_arrival_time    TIMESTAMPTZ;
  v_latitude        DOUBLE PRECISION;
  v_longitude       DOUBLE PRECISION;
  v_org_id          UUID;
  v_completed_at    TIMESTAMPTZ;
  v_waiting_minutes NUMERIC;
BEGIN
  -- ① 対象レコードを SELECT FOR UPDATE（同時更新防止・本人確認）
  --    wait_logs に organization_id がないため profiles から別途取得する
  SELECT
    wl.status,
    wl.arrival_time,
    wl.latitude,
    wl.longitude
  INTO
    v_current_status,
    v_arrival_time,
    v_latitude,
    v_longitude
  FROM public.wait_logs wl
  WHERE wl.id = p_log_id
    AND wl.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '待機ログが見つからないか、操作権限がありません。 (log_id: %)', p_log_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- organization_id はドライバーのプロファイルから取得（wait_logs にカラムなし）
  SELECT p.organization_id
  INTO v_org_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  -- ② ステータス検証（既に completed / cancelled の場合は拒否）
  IF v_current_status NOT IN ('waiting', 'called', 'working') THEN
    RAISE EXCEPTION '打刻完了エラー: ステータス "%" の待機ログは完了処理できません。 (log_id: %)',
      v_current_status, p_log_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- ③ advance_wait_status で status → 'completed'、work_end_time をサーバー時刻で記録
  PERFORM public.advance_wait_status(p_log_id, 'completed');

  v_completed_at := CURRENT_TIMESTAMP;

  -- ④ departure エビデンスを INSERT
  --    GPS座標は wait_logs の到着時点の座標を再利用（出発時の位置として記録）
  INSERT INTO public.waiting_evidence (
    user_id,
    organization_id,
    wait_log_id,
    evidence_type,
    latitude,
    longitude,
    completed_at,
    fishery_data
  ) VALUES (
    auth.uid(),
    v_org_id,
    p_log_id,
    'departure',
    v_latitude,
    v_longitude,
    v_completed_at,
    p_fishery_data
  );

  -- ⑤ 更新後の waiting_minutes を取得して返却
  SELECT wl.waiting_minutes
  INTO v_waiting_minutes
  FROM public.wait_logs wl
  WHERE wl.id = p_log_id;

  RETURN QUERY
  SELECT
    p_log_id           AS log_id,
    v_completed_at     AS completed_at,
    v_waiting_minutes  AS waiting_minutes;
END;
$$;

COMMENT ON FUNCTION public.complete_ticket(UUID, JSONB) IS
  '取適法・水産流通適正化法: 到着打刻済みwait_logの作業完了処理を行う。departure evidenceを記録し、待機時間を自動確定する。時刻はDBサーバー時刻のみを使用する。';
