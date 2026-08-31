-- ════════════════════════════════════════════════════════════
--  Migration 002: Fix trigger + add income transaction type
-- ════════════════════════════════════════════════════════════

-- ── Fix: copy display_name from auth metadata on signup ───────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── Add transaction type (expense / income) ────────────────────

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(10) NOT NULL DEFAULT 'expense'
    CHECK (transaction_type IN ('expense', 'income'));

-- Remove the old `amount > 0` constraint and replace with a sign-agnostic one
-- (amount is always stored positive; direction comes from transaction_type)
-- Nothing to change on existing rows — they are all expenses.

-- ── Add RLS policy for ai_insights (was missing) ──────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_insights' AND policyname = 'own_ai_insights'
  ) THEN
    CREATE POLICY "own_ai_insights" ON public.ai_insights FOR ALL USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- ── Add category name_en index for filter performance ─────────

CREATE INDEX IF NOT EXISTS idx_categories_name_en ON public.categories (name_en);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions (user_id, category_id);
