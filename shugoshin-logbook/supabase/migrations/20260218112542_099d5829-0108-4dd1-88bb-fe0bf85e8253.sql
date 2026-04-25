
-- saved_locations テーブルの作成
CREATE TABLE IF NOT EXISTS public.saved_locations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL DEFAULT auth.uid(),
  location_type text        NOT NULL CHECK (location_type IN ('origin', 'destination')),
  address       text        NOT NULL,
  usage_count   integer     NOT NULL DEFAULT 1,
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_locations_user_location_address_key
    UNIQUE (user_id, location_type, address)
);

-- RLS有効化
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

-- ポリシー: 自分のレコードのみ操作可能
CREATE POLICY "Users can manage own locations"
  ON public.saved_locations
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- upsert 時に usage_count を自動インクリメントするトリガー
CREATE OR REPLACE FUNCTION public.increment_location_usage()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.usage_count := OLD.usage_count + 1;
    NEW.last_used_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_location_usage
BEFORE UPDATE ON public.saved_locations
FOR EACH ROW EXECUTE FUNCTION public.increment_location_usage();
