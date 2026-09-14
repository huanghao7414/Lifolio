// ─── User ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  currency: string;
  monthly_budget?: number;
  ai_tone: 'professional' | 'casual' | 'strict';
  ai_push_frequency: 'realtime' | 'daily' | 'weekly';
  created_at: string;
  updated_at: string;
}

export interface AuthProvider {
  id: 'google' | 'wechat';
  label: string;
  enabled: boolean;
  provider: 'google' | `custom:${string}` | null;
  status: 'enabled' | 'not_configured';
}

export interface AuthConfig {
  email_enabled: boolean;
  phone_enabled: boolean;
  phone_method: 'sms_otp';
  providers: AuthProvider[];
}

export interface AuthIdentity {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  providers: string[];
  is_admin: boolean;
}

export interface AdminOverview {
  checked_at: string;
  version: string;
  status: 'ok' | 'degraded';
  totals: Record<'users' | 'new_users_7d' | 'transactions' | 'items' | 'conversations' | 'messages' | 'ai_configs', number | null>;
  services: { name: string; status: string; detail: string }[];
  recent_users: { id: string; display_name: string | null; created_at: string }[];
  authentication: AuthConfig;
  metrics: {
    scope: 'current_process'; started_at: string; uptime_seconds: number;
    requests: number; server_errors: number; average_latency_ms: number; p95_latency_ms: number;
    latency_sample_count: number;
    routes: { route: string; requests: number; server_errors: number }[];
  };
}

/** Normalize common Chinese mobile input; other countries must include their calling code. */
export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s()-]/g, '');
  const value = /^1[3-9]\d{9}$/.test(compact) ? `+86${compact}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(value)) throw new Error('请输入带国家区号的手机号，例如 +8613812345678');
  return value;
}

// ─── Category ──────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  name_en: string;
  icon?: string;
  color?: string;
}

// ─── Transaction ───────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: TransactionType;
  category_id?: number;
  category?: Category;
  description?: string;
  transaction_date: string;
  is_split: boolean;
  split_count?: number;
  ai_flagged: boolean;
  ai_flag_reason?: string;
  raw_input?: string;
  created_at: string;
}

export type TransactionCreate = Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'category'>;
export type TransactionUpdate = Partial<TransactionCreate>;

// ─── Pagination ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface DashboardSummary {
  monthly_spend: number;
  monthly_budget?: number;
  budget_remaining?: number;
  budget_used_pct?: number;
  total_assets_value: number;
  savings_rate: number;
  ai_summary: string;
  recent_transactions: Transaction[];
  unread_insight_count: number;
}

// ─── Item ──────────────────────────────────────────────────────────────────

export type ItemCategory =
  | 'electronics'
  | 'clothing'
  | 'furniture'
  | 'vehicle'
  | 'appliance'
  | 'other';

export type HoldRecommendation = 'keep' | 'sell' | 'warning';

export interface Item {
  id: string;
  user_id: string;
  name: string;
  brand?: string;
  model?: string;
  category: ItemCategory;
  purchase_price: number;
  purchase_date: string;
  image_url?: string;
  usage_count: number;
  total_usage_hours: number;
  depreciation_rate?: number;
  estimated_current_value?: number;
  ai_hold_recommendation?: HoldRecommendation;
  last_valued_at?: string;
  created_at: string;
}

export type ItemCreate = Omit<Item, 'id' | 'user_id' | 'created_at' | 'usage_count' | 'total_usage_hours'>;
export type ItemUpdate = Partial<ItemCreate>;

export interface ItemUsage {
  id: string;
  item_id: string;
  user_id: string;
  used_at: string;
  duration_hours?: number;
  notes?: string;
}

// ─── AI Insight ────────────────────────────────────────────────────────────

export type InsightType = 'monthly_report' | 'value_score' | 'anomaly' | 'suggestion';

export interface AIInsight {
  id: string;
  user_id: string;
  insight_type: InsightType;
  content: string;
  metadata?: Record<string, unknown>;
  period_start?: string;
  period_end?: string;
  is_read: boolean;
  created_at: string;
}

// ─── AI API ────────────────────────────────────────────────────────────────

export interface ParseRequest {
  input: string;
  input_type: 'text' | 'voice_transcript';
}

export interface ParsedTransaction {
  amount: number;
  category?: string;
  description?: string;
  date?: string;
  is_split?: boolean;
  split_count?: number;
}

export interface ParsedItem {
  name: string;
  brand?: string;
  model?: string;
  purchase_price?: number;
  category?: ItemCategory;
}

export interface ParseResult {
  type: 'transaction' | 'item' | 'mixed' | 'question';
  transactions?: ParsedTransaction[];
  items?: ParsedItem[];
  answer?: string;
  confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  conversation_id?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: ConversationMessage[];
}

export type LLMProvider = 'openai' | 'azure_openai' | 'deepseek' | 'moonshot' | 'qwen' | 'zhipu' | 'openrouter' | 'custom';

export interface LLMSettings {
  provider: LLMProvider;
  base_url: string | null;
  chat_model: string;
  vision_model: string | null;
  temperature: number;
  is_enabled: boolean;
  has_key: boolean;
  key_hint: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  source: 'user' | 'global' | 'unconfigured';
  updated_at: string | null;
}

export interface LLMSettingsUpdate {
  provider?: LLMProvider;
  base_url?: string;
  /** Omit to keep the saved key; an empty string clears it. */
  api_key?: string;
  chat_model?: string;
  vision_model?: string;
  temperature?: number;
  is_enabled?: boolean;
}

export interface LLMTestResult {
  ok: boolean;
  model: string;
  base_url: string | null;
}

/** Editable starter values; model availability depends on the provider account. */
export const LLM_PROVIDER_PRESETS: ReadonlyArray<{
  value: LLMProvider; label: string; base_url: string; chat_model: string;
}> = [
  { value: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com/v1', chat_model: 'gpt-4o' },
  { value: 'deepseek', label: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', chat_model: 'deepseek-chat' },
  { value: 'moonshot', label: 'Moonshot', base_url: 'https://api.moonshot.cn/v1', chat_model: 'moonshot-v1-8k' },
  { value: 'qwen', label: '通义千问', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', chat_model: 'qwen-plus' },
  { value: 'zhipu', label: '智谱', base_url: 'https://open.bigmodel.cn/api/paas/v4', chat_model: 'glm-4' },
  { value: 'openrouter', label: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', chat_model: 'openai/gpt-4o' },
  { value: 'custom', label: '自定义兼容接口', base_url: '', chat_model: '' },
];

// ─── Insights / Reports ────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface InsightReport {
  period: string;
  period_start: string;
  period_end: string;
  total_spend: number;
  total_income: number;
  net: number;
  savings_rate: number;
  summary: string;
  highlights: string[];
  categories_breakdown: CategoryBreakdown[];
  value_score: number;
  suggestions: string[];
}

export interface ValueScore {
  score: number;
  breakdown: {
    savings_rate: number;
    spend_diversity: number;
    asset_utilization: number;
    budget_adherence: number;
  };
  suggestions: string[];
  trend: 'up' | 'down' | 'stable';
}

// ─── Depreciation ──────────────────────────────────────────────────────────

export interface DepreciationPoint {
  date: string;
  value: number;
}

export interface DepreciationData {
  item_id: string;
  purchase_price: number;
  current_value: number;
  depreciation_percentage: number;
  cost_per_use?: number;
  hold_recommendation: HoldRecommendation;
  hold_reason: string;
  timeline: DepreciationPoint[];
}

// ─── API Response ──────────────────────────────────────────────────────────

export interface ApiError {
  detail: string;
  code?: string;
}
