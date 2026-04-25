-- =============================================================================
-- STEP 2: wait_logs への GPS座標カラム追加
-- 到着時の位置情報を記録できるようにする。
-- STEP 4 のNOT NULL強制トリガーの前提として先行して追加する。
-- =============================================================================

ALTER TABLE public.wait_logs
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.wait_logs.latitude  IS '到着時GPS緯度。STEP4トリガーによりINSERT時にNOT NULLが強制される。';
COMMENT ON COLUMN public.wait_logs.longitude IS '到着時GPS経度。STEP4トリガーによりINSERT時にNOT NULLが強制される。';
