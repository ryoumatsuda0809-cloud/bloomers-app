-- =============================================================================
-- STEP 7: waiting_evidence テーブル作成
--
-- 【目的】待機料エビデンス（到着/出発/GPSチェックポイント）を不変記録する。
--
-- 【法的要件】
--   - 証拠データはDBサーバー時刻で記録し、クライアント偽装を排除する。
--   - GPS座標は必須（位置証明）。
--   - is_signed = true になった行は一切の変更・削除を禁止する。
--   - 物理削除はロール問わず全面禁止。
--
-- 【二重防御構造】
--   Layer 1 (RLS)     : authenticated ロールの UPDATE/DELETE を制限
--   Layer 2 (Trigger) : service_role を含む全ロールで署名済み行の変更・削除を拒否
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUM: evidence_type（到着 / 出発 / GPS中間チェックポイント）
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.evidence_type AS ENUM (
    'arrival',
    'departure',
    'gps_checkpoint'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- TABLE: waiting_evidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waiting_evidence (
  id              UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 記録したドライバー
  user_id         UUID                   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 所属組織（組織単位での一覧取得に使用）
  organization_id UUID                   REFERENCES public.organizations(id) ON DELETE SET NULL,
  -- 紐づく待機セッション（任意。事後記録の場合はNULL許容）
  wait_log_id     UUID                   REFERENCES public.wait_logs(id) ON DELETE RESTRICT,
  -- エビデンス種別
  evidence_type   public.evidence_type   NOT NULL,
  -- GPS座標（必須。STEP 4 のトリガーとは別にDDL制約も付与）
  latitude        DOUBLE PRECISION       NOT NULL,
  longitude       DOUBLE PRECISION       NOT NULL,
  -- 写真URL（Storage オブジェクトパス）
  photo_url       TEXT,
  -- 補足メモ
  note            TEXT,
  -- 署名フラグ（true にすると以降の変更・削除が不可）
  is_signed       BOOLEAN                NOT NULL DEFAULT false,
  -- 署名時刻（DBトリガーによりサーバー時刻で自動設定）
  signed_at       TIMESTAMPTZ,
  -- 記録時刻（DBトリガーによりサーバー時刻で強制上書き）
  recorded_at     TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- レコード作成時刻（DBトリガーによりサーバー時刻で強制上書き）
  created_at      TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  public.waiting_evidence                IS '待機料エビデンステーブル。到着・出発・GPSチェックポイントを法的証拠として不変保存する。';
COMMENT ON COLUMN public.waiting_evidence.is_signed      IS 'trueにすると以後の変更・削除が全ロールで禁止される。';
COMMENT ON COLUMN public.waiting_evidence.recorded_at    IS '法的証拠要件: INSERT時にDBサーバー時刻で強制上書き。クライアント送信値は無効。';

-- ---------------------------------------------------------------------------
-- RLS（Row Level Security）
-- ---------------------------------------------------------------------------
ALTER TABLE public.waiting_evidence ENABLE ROW LEVEL SECURITY;

-- SELECT: 本人 OR 同組織メンバー
CREATE POLICY "waiting_evidence_select"
  ON public.waiting_evidence FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_member_of_org(auth.uid(), organization_id)
  );

-- INSERT: 本人のみ（user_id を auth.uid() に固定）
CREATE POLICY "waiting_evidence_insert"
  ON public.waiting_evidence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 未署名行のみ、本人のみ
CREATE POLICY "waiting_evidence_update"
  ON public.waiting_evidence FOR UPDATE TO authenticated
  USING     (user_id = auth.uid() AND is_signed = false)
  WITH CHECK (user_id = auth.uid() AND is_signed = false);

-- DELETE: RLS で全て拒否（ポリシーなし = 拒否）
-- Layer 2 トリガーで service_role も含め全ロールで禁止する。

-- ---------------------------------------------------------------------------
-- TRIGGER A: サーバー時刻強制（INSERT 時）
--   クライアントが送信した recorded_at / created_at を無視し、
--   DBサーバーの CURRENT_TIMESTAMP で上書きする。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_waiting_evidence_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.recorded_at := CURRENT_TIMESTAMP;
    NEW.created_at  := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.force_waiting_evidence_timestamps() IS
  '法的証拠要件: waiting_evidence.recorded_at / created_at をDBサーバー時刻で強制上書きする。';

DROP TRIGGER IF EXISTS trg_force_waiting_evidence_timestamps ON public.waiting_evidence;
CREATE TRIGGER trg_force_waiting_evidence_timestamps
  BEFORE INSERT ON public.waiting_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.force_waiting_evidence_timestamps();

-- ---------------------------------------------------------------------------
-- TRIGGER B: 署名後の変更禁止 + 署名時刻のサーバー記録（UPDATE 時）
--   - is_signed = true の行への UPDATE を全ロールで拒否。
--   - is_signed が false → true に変わる瞬間に signed_at をサーバー時刻で記録。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_waiting_evidence_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 署名済み行への変更は法的に禁止
  IF OLD.is_signed = true THEN
    RAISE EXCEPTION
      '[法的保護] waiting_evidence (id=%) は署名済みのため変更できません。',
      OLD.id
    USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 署名フラグが立った瞬間に signed_at をサーバー時刻で記録
  IF NEW.is_signed = true AND OLD.is_signed = false THEN
    NEW.signed_at := CURRENT_TIMESTAMP;
  END IF;

  -- created_at の改ざんを防ぐ
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_waiting_evidence_update() IS
  '法的証拠要件: 署名済みwating_evidenceへの変更を全ロールで禁止し、署名時刻をサーバー時刻で記録する。';

DROP TRIGGER IF EXISTS trg_guard_waiting_evidence_update ON public.waiting_evidence;
CREATE TRIGGER trg_guard_waiting_evidence_update
  BEFORE UPDATE ON public.waiting_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_waiting_evidence_update();

-- ---------------------------------------------------------------------------
-- TRIGGER C: 物理削除の完全禁止（DELETE）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_waiting_evidence_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    '[法的保護] waiting_evidence (id=%) の削除は法律により禁止されています。待機料エビデンスは不変です。',
    OLD.id
  USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public.block_waiting_evidence_delete() IS
  '法的証拠要件: waiting_evidence への DELETE を全ロールで禁止する。';

DROP TRIGGER IF EXISTS trg_block_waiting_evidence_delete ON public.waiting_evidence;
CREATE TRIGGER trg_block_waiting_evidence_delete
  BEFORE DELETE ON public.waiting_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.block_waiting_evidence_delete();

-- ---------------------------------------------------------------------------
-- TRIGGER D: TRUNCATE の完全禁止
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_waiting_evidence_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    '[法的保護] waiting_evidence の TRUNCATE は法律により禁止されています。'
  USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public.block_waiting_evidence_truncate() IS
  '法的証拠要件: waiting_evidence への TRUNCATE を全ロールで禁止する。';

DROP TRIGGER IF EXISTS trg_block_waiting_evidence_truncate ON public.waiting_evidence;
CREATE TRIGGER trg_block_waiting_evidence_truncate
  BEFORE TRUNCATE ON public.waiting_evidence
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.block_waiting_evidence_truncate();

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_waiting_evidence_user_id     ON public.waiting_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_waiting_evidence_org_id      ON public.waiting_evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_waiting_evidence_wait_log_id ON public.waiting_evidence(wait_log_id);
CREATE INDEX IF NOT EXISTS idx_waiting_evidence_type        ON public.waiting_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_waiting_evidence_recorded_at ON public.waiting_evidence(recorded_at DESC);
