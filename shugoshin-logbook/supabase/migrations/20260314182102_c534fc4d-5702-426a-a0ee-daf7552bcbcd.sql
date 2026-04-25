ALTER TABLE public.submitted_reports
  ADD COLUMN IF NOT EXISTS original_ai_output text,
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS formal_report text;