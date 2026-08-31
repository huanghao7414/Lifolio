// ─── User ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  currency: string;
  monthly_budget?: number;
  ai_tone: 'professional' | 'casual' | 'strict';
  ai_push_frequency: 'realtime' | 'daily' | 'weekly';
  created_at: string;
  updated_at: string;
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
}

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
  unread_insights: AIInsight[];
}
