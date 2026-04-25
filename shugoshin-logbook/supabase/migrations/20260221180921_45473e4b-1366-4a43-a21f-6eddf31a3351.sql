
-- Step 1: organization_details テーブル作成
CREATE TABLE public.organization_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number text,
  postal_code text,
  prefecture text,
  city text,
  address_line1 text,
  address_line2 text,
  website_url text,
  description text,
  industry_type varchar,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 既存データを移行
INSERT INTO public.organization_details (
  organization_id, phone_number, postal_code, prefecture, city,
  address_line1, address_line2, website_url, description, industry_type
)
SELECT id, phone_number, postal_code, prefecture, city,
       address_line1, address_line2, website_url, description, industry_type
FROM public.organizations;

-- RLS有効化
ALTER TABLE public.organization_details ENABLE ROW LEVEL SECURITY;

-- Step 2: RLSポリシー（管理者のみ）
CREATE POLICY "Admins can view org details"
  ON public.organization_details FOR SELECT
  USING (has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can update org details"
  ON public.organization_details FOR UPDATE
  USING (has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can insert org details"
  ON public.organization_details FOR INSERT
  WITH CHECK (has_role_in_org(auth.uid(), organization_id, 'admin'));

-- Step 3: organizations テーブルから旧カラム削除
ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS prefecture,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS industry_type;
