-- =============================================================================
-- STEP 5: 提出済みレポートの絶対的不変性（DBトリガーによるハードブロック）
--
-- 【法的要件】submitted_reports は「提出済み証拠」として一切の変更を禁止する。
--
-- 【既存対策との違い】
--   20260323040012 で追加した RESTRICTIVE RLSポリシーは authenticated ロールに
--   対してのみ有効。service_role やDB管理者接続ではRLSがバイパスされる。
--   DBトリガーはロールに関係なく全ての接続に適用されるため、より強固な保護となる。
--
-- 【二重防御構造】
--   Layer 1 (RLS)     : authenticated ロールの UPDATE/DELETE を拒否（既存）
--   Layer 2 (Trigger) : service_role を含む全ロールの UPDATE/DELETE/TRUNCATE を拒否（本STEP）
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5-A: UPDATE / DELETE をブロックするトリガー関数
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_submitted_reports_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    '[法的保護] submitted_reports への % 操作は法律により禁止されています。'
    '提出済みレポートは法的証拠として変更・削除が不可です。'
    ' report_id: %, submitted_at: %',
    TG_OP,
    COALESCE(OLD.id::text, NEW.id::text),
    COALESCE(OLD.submitted_at::text, NEW.submitted_at::text)
  USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public.block_submitted_reports_mutation() IS
  '法的証拠要件: submitted_reports への UPDATE/DELETE を全ロール（service_role含む）に対してブロックする。';

-- ---------------------------------------------------------------------------
-- 5-B: UPDATE ブロックトリガー
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_block_submitted_reports_update ON public.submitted_reports;
CREATE TRIGGER trg_block_submitted_reports_update
  BEFORE UPDATE ON public.submitted_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.block_submitted_reports_mutation();

-- ---------------------------------------------------------------------------
-- 5-C: DELETE ブロックトリガー
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_block_submitted_reports_delete ON public.submitted_reports;
CREATE TRIGGER trg_block_submitted_reports_delete
  BEFORE DELETE ON public.submitted_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.block_submitted_reports_mutation();

-- ---------------------------------------------------------------------------
-- 5-D: TRUNCATE ブロックトリガー（テーブル全消去の防止）
--   TRUNCATE は行レベルトリガーではなく文レベル（STATEMENT）で捕捉する。
--   PostgreSQL の TRUNCATE トリガーは FOR EACH STATEMENT のみ。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_submitted_reports_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    '[法的保護] submitted_reports の TRUNCATE は法律により禁止されています。'
    '提出済みレポートは法的証拠として一括削除が不可です。'
  USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_submitted_reports_truncate ON public.submitted_reports;
CREATE TRIGGER trg_block_submitted_reports_truncate
  BEFORE TRUNCATE ON public.submitted_reports
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.block_submitted_reports_truncate();

-- ---------------------------------------------------------------------------
-- 5-E: submitted_at をINSERT時にDBサーバー時刻で強制上書き
--   提出時刻もクライアント偽装を防ぐためサーバー時刻を強制する。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_submitted_at_to_server_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.submitted_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.force_submitted_at_to_server_time() IS
  '法的証拠要件: submitted_reports.submitted_at をDBサーバー時刻で強制上書きする。';

DROP TRIGGER IF EXISTS trg_force_submitted_at ON public.submitted_reports;
CREATE TRIGGER trg_force_submitted_at
  BEFORE INSERT ON public.submitted_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.force_submitted_at_to_server_time();
