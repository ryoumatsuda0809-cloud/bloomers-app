-- =============================================================================
-- STEP 1: ベーススキーマ回収
-- Supabaseコンソールで直接作成されており、マイグレーション管理外だった
-- 5テーブルを IF NOT EXISTS で正規化記録する。
-- 本番DBの既存データには一切影響しない。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1-A: organization_members
--   組織への招待・参加を管理するテーブル。
--   join_organization_by_invite_code RPC がこのテーブルへINSERTするが、
--   CREATE TABLE が存在しなかった。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1-B: organization_financials
--   組織の財務情報（資本金・従業員数）を格納するテーブル。
--   20260218105418 でRLSポリシーが追加されたが CREATE TABLE が存在しなかった。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_financials (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  capital_amount  BIGINT,
  employee_count  INTEGER,
  is_regulated    BOOLEAN     GENERATED ALWAYS AS (
                    capital_amount > 300000000 OR employee_count > 300
                  ) STORED,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_financials ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1-C: daily_reports
--   ドライバーが入力する日次業務報告。
--   20260310063001 でカラム追加ALTER が実行されたが CREATE TABLE が存在しなかった。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_text         TEXT        NOT NULL,
  summary             TEXT,
  waiting_minutes     INTEGER     DEFAULT 0,
  uncompensated_work  BOOLEAN     DEFAULT false,
  shipper_name        TEXT        DEFAULT '不明',
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily reports"
  ON public.daily_reports FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 1-D: submitted_reports
--   提出済み（証拠として確定した）待機時間レポート。
--   20260314182102・20260323040012 で参照されたが CREATE TABLE が存在しなかった。
--   法的証拠として不変性が求められる最重要テーブル。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submitted_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL DEFAULT auth.uid(),
  organization_id     UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  report_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  timeline_snapshot   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  total_wait_minutes  INTEGER     NOT NULL DEFAULT 0,
  estimated_wait_cost INTEGER     NOT NULL DEFAULT 0,
  has_discrepancy     BOOLEAN     NOT NULL DEFAULT false,
  vehicle_class       TEXT        NOT NULL DEFAULT '',
  original_ai_output  TEXT,
  is_edited           BOOLEAN     NOT NULL DEFAULT false,
  formal_report       TEXT
);

ALTER TABLE public.submitted_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own submitted reports"
  ON public.submitted_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can view submitted reports in their org"
  ON public.submitted_reports FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_member_of_org(auth.uid(), organization_id)
  );

-- ---------------------------------------------------------------------------
-- 1-E: wait_logs
--   施設ごとの待機セッションを記録するテーブル。
--   20260409135804 のVIEWで参照されたが CREATE TABLE が存在しなかった。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wait_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id     UUID        NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  ticket_number   INTEGER     NOT NULL,
  arrival_time    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  called_time     TIMESTAMPTZ,
  work_start_time TIMESTAMPTZ,
  work_end_time   TIMESTAMPTZ,
  status          TEXT        DEFAULT 'waiting',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.wait_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wait logs"
  ON public.wait_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own wait logs"
  ON public.wait_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- インデックス
CREATE INDEX IF NOT EXISTS idx_wait_logs_user_id     ON public.wait_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_wait_logs_facility_id  ON public.wait_logs(facility_id);
CREATE INDEX IF NOT EXISTS idx_wait_logs_status       ON public.wait_logs(status);
CREATE INDEX IF NOT EXISTS idx_submitted_reports_user ON public.submitted_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_submitted_reports_org  ON public.submitted_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user     ON public.daily_reports(user_id);
