ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS waiting_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uncompensated_work boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipper_name text DEFAULT '不明';