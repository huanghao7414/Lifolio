-- All verified email, phone and third-party identities share auth.users.id.
BEGIN;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, left(COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Lifolio 用户'), 80))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

INSERT INTO public.user_profiles (id, display_name, created_at)
SELECT id, left(COALESCE(NULLIF(raw_user_meta_data->>'display_name', ''),
  NULLIF(raw_user_meta_data->>'full_name', ''), 'Lifolio 用户'), 80), created_at
FROM auth.users ON CONFLICT (id) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles (created_at DESC);
COMMIT;
