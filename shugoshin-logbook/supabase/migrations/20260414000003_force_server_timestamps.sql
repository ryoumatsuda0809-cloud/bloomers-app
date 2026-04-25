-- =============================================================================
-- STEP 3: クライアント時刻偽装防止トリガー
--
-- 【法的要件】荷主側施設でのドライバー待機時刻はDBサーバーの CURRENT_TIMESTAMP を
-- 証拠として使用する。クライアント（アプリ）が送信した時刻は無視し、
-- サーバー側で強制上書きする。
--
-- 対象:
--   - compliance_logs.recorded_at  （コンプライアンスイベント記録時刻）
--   - wait_logs.arrival_time       （施設到着時刻）
--   - wait_logs.created_at         （レコード作成時刻）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3-A: compliance_logs の recorded_at を強制上書き
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_recorded_at_to_server_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- クライアントが送信した recorded_at の値を無視し、
  -- DBサーバーの現在時刻（UTC）で強制上書きする。
  -- これによりクライアントサイドの時刻操作を完全に排除する。
  NEW.recorded_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.force_recorded_at_to_server_time() IS
  '法的証拠要件: compliance_logs.recorded_at をDBサーバー時刻で強制上書きする。クライアント送信値は無効。';

DROP TRIGGER IF EXISTS trg_force_recorded_at ON public.compliance_logs;
CREATE TRIGGER trg_force_recorded_at
  BEFORE INSERT ON public.compliance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.force_recorded_at_to_server_time();

-- ---------------------------------------------------------------------------
-- 3-B: wait_logs の arrival_time / created_at を強制上書き
--   クライアントが到着時刻を遡って入力することを防ぐ。
--   called_time / work_start_time / work_end_time は advance_wait_status RPC
--   (SECURITY DEFINER) 内で CURRENT_TIMESTAMP を使用するため、
--   そちらは STEP 6 で対処する。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_wait_log_arrival_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT時: arrival_time と created_at をサーバー時刻で上書き
  IF TG_OP = 'INSERT' THEN
    NEW.arrival_time := CURRENT_TIMESTAMP;
    NEW.created_at   := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.force_wait_log_arrival_time() IS
  '法的証拠要件: wait_logs.arrival_time をDBサーバー時刻で強制上書きする。クライアント送信値は無効。';

DROP TRIGGER IF EXISTS trg_force_wait_log_arrival ON public.wait_logs;
CREATE TRIGGER trg_force_wait_log_arrival
  BEFORE INSERT ON public.wait_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.force_wait_log_arrival_time();
