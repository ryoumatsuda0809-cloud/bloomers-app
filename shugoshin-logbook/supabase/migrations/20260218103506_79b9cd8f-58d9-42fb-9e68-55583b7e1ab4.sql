-- profiles テーブルの organization_id に対するバリデーション
-- ユーザーが自分のプロフィールに任意の organization_id を
-- セットできてしまうセキュリティ問題を修正する

-- トリガー関数: organization_id の正当性を検証
CREATE OR REPLACE FUNCTION public.validate_profile_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- organization_id が NULL の場合はそのまま許可
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- organization_id が変更されている場合にのみ検証
  IF TG_OP = 'UPDATE' AND OLD.organization_id = NEW.organization_id THEN
    RETURN NEW;
  END IF;

  -- ユーザーが指定の組織に招待されているか確認
  -- (user_roles テーブルにエントリが存在するか)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'この組織への参加権限がありません (organization_id: %)', NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

-- INSERT 時のトリガー
DROP TRIGGER IF EXISTS check_profile_organization_on_insert ON public.profiles;
CREATE TRIGGER check_profile_organization_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_organization_id();

-- UPDATE 時のトリガー
DROP TRIGGER IF EXISTS check_profile_organization_on_update ON public.profiles;
CREATE TRIGGER check_profile_organization_on_update
  BEFORE UPDATE OF organization_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_organization_id();
