-- ════════════════════════════════════════════════════════════
--  Lifolio — Initial Database Schema (Supabase / PostgreSQL)
--  Run via: Supabase SQL Editor or supabase db push
-- ════════════════════════════════════════════════════════════

-- ── User profiles (extends Supabase auth.users) ──────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                 UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name       TEXT,
  avatar_url         TEXT,
  currency           VARCHAR(3)  NOT NULL DEFAULT 'CNY',
  monthly_budget     NUMERIC(12,2),
  ai_tone            VARCHAR(20) NOT NULL DEFAULT 'casual'
                       CHECK (ai_tone IN ('professional','casual','strict')),
  ai_push_frequency  VARCHAR(20) NOT NULL DEFAULT 'daily'
                       CHECK (ai_push_frequency IN ('realtime','daily','weekly')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── Transaction categories ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
  id       SERIAL      PRIMARY KEY,
  name     VARCHAR(50) NOT NULL,
  name_en  VARCHAR(50),
  icon     VARCHAR(50),
  color    VARCHAR(7)
);

INSERT INTO public.categories (name, name_en, color) VALUES
  ('餐饮',   'food',          '#FF6B6B'),
  ('通勤',   'commute',       '#4ECDC4'),
  ('购物',   'shopping',      '#45B7D1'),
  ('娱乐',   'entertainment', '#96CEB4'),
  ('医疗',   'healthcare',    '#FFEAA7'),
  ('教育',   'education',     '#DDA0DD'),
  ('其他',   'other',         '#B0B0B0')
ON CONFLICT DO NOTHING;

-- ── Transactions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transactions (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id      INTEGER     REFERENCES public.categories(id),
  description      TEXT,
  transaction_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_split         BOOLEAN     NOT NULL DEFAULT FALSE,
  split_count      INTEGER     CHECK (split_count >= 2),
  ai_flagged       BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_flag_reason   TEXT,
  raw_input        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_date ON public.transactions (user_id, transaction_date DESC);

-- ── Items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.items (
  id                        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                      TEXT        NOT NULL,
  brand                     TEXT,
  model                     TEXT,
  category                  VARCHAR(30) NOT NULL DEFAULT 'other'
                              CHECK (category IN ('electronics','clothing','furniture','vehicle','appliance','other')),
  purchase_price            NUMERIC(12,2) NOT NULL CHECK (purchase_price > 0),
  purchase_date             DATE        NOT NULL,
  image_url                 TEXT,
  usage_count               INTEGER     NOT NULL DEFAULT 0,
  total_usage_hours         NUMERIC(10,2) NOT NULL DEFAULT 0,
  depreciation_rate         NUMERIC(5,4),
  estimated_current_value   NUMERIC(12,2),
  ai_hold_recommendation    VARCHAR(10) CHECK (ai_hold_recommendation IN ('keep','sell','warning')),
  last_valued_at            TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_user ON public.items (user_id);

-- ── Item usages ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.item_usages (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id        UUID        NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_hours NUMERIC(6,2),
  notes          TEXT
);

-- ── AI insights cache ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type  VARCHAR(50) NOT NULL
                  CHECK (insight_type IN ('monthly_report','value_score','anomaly','suggestion')),
  content       TEXT        NOT NULL,
  metadata      JSONB,
  period_start  DATE,
  period_end    DATE,
  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_user_unread ON public.ai_insights (user_id, is_read);

-- ════════════════════════════════════════════════════════════
--  Row Level Security
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_usages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights     ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "own_profile_select" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_insert" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own_profile_update" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

-- transactions
CREATE POLICY "own_transactions"   ON public.transactions  FOR ALL USING (auth.uid() = user_id);

-- items
CREATE POLICY "own_items"          ON public.items         FOR ALL USING (auth.uid() = user_id);

-- item_usages
CREATE POLICY "own_item_usages"    ON public.item_usages   FOR ALL USING (auth.uid() = user_id);

-- ai_insights
CREATE POLICY "own_insights"       ON public.ai_insights   FOR ALL USING (auth.uid() = user_id);

-- categories are public read
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);
