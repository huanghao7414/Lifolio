-- ════════════════════════════════════════════════════════════
--  Migration 003: 对话持久化 + 用户自配 LLM
--
--  设计要点：
--  1. 每张业务表都有 user_id，且外键 ON DELETE CASCADE —— 删号即清空
--  2. 每张表都开 RLS，策略统一为 auth.uid() = user_id
--  3. chat_messages 冗余 user_id（同 item_usages 的做法），
--     这样 RLS 策略可以只查本表，不必 JOIN conversations
--  4. llm_configs 的 api_key 只存密文，明文永不落库
--  ════════════════════════════════════════════════════════════

-- ── 通用 updated_at 触发器 ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════
--  一、对话持久化
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.conversations (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            VARCHAR(200) NOT NULL DEFAULT '新对话',
  message_count    INTEGER     NOT NULL DEFAULT 0,
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON public.conversations (user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  -- 冗余 user_id：让 RLS 策略无需 JOIN 即可生效
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT        NOT NULL,
  model            VARCHAR(80),
  prompt_tokens    INTEGER,
  completion_tokens INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON public.chat_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON public.chat_messages (user_id, created_at DESC);

-- 会话的 updated_at / message_count / last_message_at 由消息表驱动
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
     SET message_count   = message_count + 1,
         last_message_at = NEW.created_at,
         updated_at      = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_insert ON public.chat_messages;
CREATE TRIGGER on_chat_message_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE PROCEDURE public.touch_conversation_on_message();

-- ════════════════════════════════════════════════════════════
--  二、用户自配 LLM
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.llm_configs (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         VARCHAR(30) NOT NULL DEFAULT 'openai'
                     CHECK (provider IN ('openai', 'azure_openai', 'deepseek', 'moonshot',
                                         'qwen', 'zhipu', 'openrouter', 'custom')),
  base_url         TEXT,
  -- Fernet 密文，明文 API Key 永不落库；未配置时为 NULL（回落到服务端全局 Key）
  encrypted_api_key TEXT,
  key_hint         VARCHAR(20),            -- 掩码回显，如 sk-…7f3a
  chat_model       VARCHAR(80) NOT NULL DEFAULT 'gpt-4o',
  vision_model     VARCHAR(80),
  temperature      NUMERIC(3,2) NOT NULL DEFAULT 0.30 CHECK (temperature >= 0 AND temperature <= 2),
  is_enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- 最近一次连通性校验结果
  last_verified_at TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_llm_configs_updated_at ON public.llm_configs;
CREATE TRIGGER trg_llm_configs_updated_at
  BEFORE UPDATE ON public.llm_configs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ════════════════════════════════════════════════════════════
--  三、Row Level Security
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_configs   ENABLE ROW LEVEL SECURITY;

-- conversations：只允许操作自己的会话
DROP POLICY IF EXISTS "own_conversations" ON public.conversations;
CREATE POLICY "own_conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- chat_messages：靠冗余的 user_id 直接判定，无需 JOIN
DROP POLICY IF EXISTS "own_chat_messages" ON public.chat_messages;
CREATE POLICY "own_chat_messages" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- llm_configs：仅本人可见可改
DROP POLICY IF EXISTS "own_llm_config" ON public.llm_configs;
CREATE POLICY "own_llm_config" ON public.llm_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
--  四、加固：明确 items 的写策略
--
--  旧版 items 只有 USING (auth.uid() = user_id)，缺 WITH CHECK，
--  意味着「写入时校验」在部分场景未被强制。这里补齐。
--  应用层仍须在每条语句上带 .eq("user_id", ...)，不要依赖 RLS 单点。
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "own_items" ON public.items;
CREATE POLICY "own_items" ON public.items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_transactions" ON public.transactions;
CREATE POLICY "own_transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_item_usages" ON public.item_usages;
CREATE POLICY "own_item_usages" ON public.item_usages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
