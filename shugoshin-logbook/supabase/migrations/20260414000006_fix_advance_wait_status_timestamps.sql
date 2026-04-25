-- =============================================================================
-- STEP 6: advance_wait_status RPC のサーバー時刻強制
--
-- 【法的要件】待機セッションの各フェーズ遷移時刻（呼び出し・作業開始・完了）は
-- DBサーバーの CURRENT_TIMESTAMP を証拠として使用する。
--
-- 【現状の問題】advance_wait_status の実装が Supabaseコンソールで直接作成されており、
-- 時刻の扱いが不明確。本マイグレーションで SECURITY DEFINER 関数として
-- 正式に定義し直し、クライアントから時刻パラメータを受け取らない設計を明確にする。
--
-- 【シグネチャ】
--   Args: { p_log_id: string; p_new_status: string }  ← 時刻パラメータなし
--   Returns: void
-- =============================================================================

CREATE OR REPLACE FUNCTION public.advance_wait_status(
  p_log_id    UUID,
  p_new_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- 対象レコードの現在ステータスを取得（本人のログのみ）
  SELECT status INTO v_current_status
  FROM public.wait_logs
  WHERE id = p_log_id
    AND user_id = auth.uid()
  FOR UPDATE;  -- 同時更新を防ぐためロック

  IF NOT FOUND THEN
    RAISE EXCEPTION '待機ログが見つからないか、操作権限がありません。 (log_id: %)', p_log_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ステータス遷移の検証（不正な遷移を防ぐ）
  IF p_new_status = 'called' AND v_current_status != 'waiting' THEN
    RAISE EXCEPTION 'ステータス遷移エラー: % → called は無効です。現在のステータス: %',
      v_current_status, v_current_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_new_status = 'working' AND v_current_status NOT IN ('waiting', 'called') THEN
    RAISE EXCEPTION 'ステータス遷移エラー: % → working は無効です。',
      v_current_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_new_status = 'completed' AND v_current_status NOT IN ('working', 'called', 'waiting') THEN
    RAISE EXCEPTION 'ステータス遷移エラー: % → completed は無効です。',
      v_current_status
      USING ERRCODE = 'check_violation';
  END IF;

  -- 各フェーズの時刻はDBサーバーの CURRENT_TIMESTAMP で記録する。
  -- クライアントから時刻を受け取らないことでクライアントサイドの時刻操作を排除。
  UPDATE public.wait_logs
  SET
    status = p_new_status,
    -- 「呼び出し済み」フェーズ: called_time をサーバー時刻で記録
    called_time     = CASE
                        WHEN p_new_status = 'called'    THEN CURRENT_TIMESTAMP
                        ELSE called_time
                      END,
    -- 「作業開始」フェーズ: work_start_time をサーバー時刻で記録
    work_start_time = CASE
                        WHEN p_new_status = 'working'   THEN CURRENT_TIMESTAMP
                        ELSE work_start_time
                      END,
    -- 「完了」フェーズ: work_end_time をサーバー時刻で記録
    work_end_time   = CASE
                        WHEN p_new_status = 'completed' THEN CURRENT_TIMESTAMP
                        ELSE work_end_time
                      END
  WHERE id = p_log_id
    AND user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.advance_wait_status(UUID, TEXT) IS
  '法的証拠要件: 待機セッションのステータス遷移時刻をDBサーバーのCURRENT_TIMESTAMPで記録する。クライアントからの時刻入力を受け付けない。';
