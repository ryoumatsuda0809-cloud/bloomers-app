-- =============================================================================
-- STEP 4: GPS座標のNOT NULL強制（トリガーによる新規INSERT制限）
--
-- 【法的要件】場所の証拠能力確保のため、GPS座標（latitude / longitude）が
-- NULL のままレコードを作成することを禁止する。
--
-- 【なぜ ALTER COLUMN SET NOT NULL ではなくトリガーか】
--   本番DBに既存のNULLレコードが存在する可能性があり、
--   DDL制約を直接追加するとマイグレーションが失敗する。
--   まずトリガーで新規INSERTを制限し、既存データの修正完了後に
--   フェーズ2でDDL制約（ALTER COLUMN SET NOT NULL）を追加する。
--
-- 対象:
--   - compliance_logs (latitude, longitude)
--   - wait_logs       (latitude, longitude) ← STEP 2 で追加済み
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4-A: GPS座標NULL拒否の共通トリガー関数
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_gps_not_null()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    RAISE EXCEPTION
      '[法的保護] GPS座標 (latitude/longitude) は必須です。'
      'クライアントは有効な座標を送信してください。'
      ' テーブル: %, イベント種別: %',
      TG_TABLE_NAME,
      CASE TG_TABLE_NAME
        WHEN 'compliance_logs' THEN NEW.event_type::text
        ELSE COALESCE(NEW.status, 'N/A')
      END
    USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_gps_not_null() IS
  '法的証拠要件: GPS座標(latitude/longitude)がNULLのINSERTを拒否する。compliance_logs・wait_logs 共用。';

-- ---------------------------------------------------------------------------
-- 4-B: compliance_logs への適用
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_gps_compliance ON public.compliance_logs;
CREATE TRIGGER trg_enforce_gps_compliance
  BEFORE INSERT ON public.compliance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gps_not_null();

-- ---------------------------------------------------------------------------
-- 4-C: wait_logs への適用（STEP 2 でカラム追加済みが前提）
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_gps_wait ON public.wait_logs;
CREATE TRIGGER trg_enforce_gps_wait
  BEFORE INSERT ON public.wait_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gps_not_null();

-- ---------------------------------------------------------------------------
-- 4-D: 既存NULLデータの確認クエリ（参考用コメント）
--   実施前に以下を実行して既存NULL件数を確認すること:
--
--   SELECT count(*) FROM public.compliance_logs
--     WHERE latitude IS NULL OR longitude IS NULL;
--
--   SELECT count(*) FROM public.wait_logs
--     WHERE latitude IS NULL OR longitude IS NULL;
--
--   件数が0になった後、フェーズ2で以下のDDL制約を追加する:
--   ALTER TABLE public.compliance_logs
--     ALTER COLUMN latitude  SET NOT NULL,
--     ALTER COLUMN longitude SET NOT NULL;
--   ALTER TABLE public.wait_logs
--     ALTER COLUMN latitude  SET NOT NULL,
--     ALTER COLUMN longitude SET NOT NULL;
-- ---------------------------------------------------------------------------
