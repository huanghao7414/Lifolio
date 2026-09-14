from __future__ import annotations
from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# ─── Transaction ─────────────────────────────────────────────────────────────

TransactionType = Literal["expense", "income"]


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    transaction_type: TransactionType = "expense"
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: date = Field(default_factory=date.today)
    is_split: bool = False
    split_count: Optional[int] = Field(None, ge=2)
    raw_input: Optional[str] = None


class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    transaction_type: Optional[TransactionType] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    transaction_date: Optional[date] = None
    is_split: Optional[bool] = None
    split_count: Optional[int] = None


class TransactionOut(BaseModel):
    id: str
    user_id: str
    amount: float
    transaction_type: TransactionType = "expense"
    category_id: Optional[int]
    description: Optional[str]
    transaction_date: date
    is_split: bool
    split_count: Optional[int]
    ai_flagged: bool
    ai_flag_reason: Optional[str]
    raw_input: Optional[str]
    created_at: str


class CategoryOut(BaseModel):
    id: int
    name: str
    name_en: Optional[str]
    icon: Optional[str]
    color: Optional[str]


# ─── Item ─────────────────────────────────────────────────────────────────────

ItemCategory = Literal["electronics", "clothing", "furniture", "vehicle", "appliance", "other"]
HoldRec = Literal["keep", "sell", "warning"]


class ItemCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    category: ItemCategory = "other"
    purchase_price: float = Field(..., gt=0)
    purchase_date: date = Field(default_factory=date.today)


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    category: Optional[ItemCategory] = None
    purchase_price: Optional[float] = Field(None, gt=0)
    purchase_date: Optional[date] = None


class ItemOut(BaseModel):
    id: str
    user_id: str
    name: str
    brand: Optional[str]
    model: Optional[str]
    category: ItemCategory
    purchase_price: float
    purchase_date: date
    image_url: Optional[str]
    usage_count: int
    total_usage_hours: float
    depreciation_rate: Optional[float]
    estimated_current_value: Optional[float]
    ai_hold_recommendation: Optional[HoldRec]
    last_valued_at: Optional[str]
    created_at: str


class ItemUsageCreate(BaseModel):
    duration_hours: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None


# ─── AI ──────────────────────────────────────────────────────────────────────

class ParseRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=2000)
    input_type: Literal["text", "voice_transcript"] = "text"


class ParsedTransaction(BaseModel):
    amount: float
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    is_split: bool = False
    split_count: Optional[int] = None


class ParsedItem(BaseModel):
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    purchase_price: Optional[float] = None
    category: Optional[str] = None


class ParseResult(BaseModel):
    type: Literal["transaction", "item", "mixed", "question"]
    transactions: list[ParsedTransaction] = []
    items: list[ParsedItem] = []
    answer: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=20000)

    @field_validator("content")
    @classmethod
    def nonblank_content(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("消息不能为空")
        return value


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=100)
    # 传了就落库续聊；不传则按一次性对话处理（不持久化）
    conversation_id: Optional[str] = None

    @model_validator(mode="after")
    def last_message_is_user(self):
        if self.messages[-1].role != "user":
            raise ValueError("最后一条消息必须来自用户")
        return self


# ─── 会话持久化 ──────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("会话名称不能为空")
        return value.strip()


class ConversationOut(BaseModel):
    id: str
    user_id: str
    title: str
    message_count: int
    last_message_at: str
    created_at: str
    updated_at: str


class ChatMessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    model: Optional[str]
    created_at: str


class ConversationDetail(BaseModel):
    conversation: ConversationOut
    messages: list[ChatMessageOut]


# ─── 用户自配 LLM ────────────────────────────────────────────────────────────

LLMProvider = Literal[
    "openai", "azure_openai", "deepseek", "moonshot", "qwen", "zhipu", "openrouter", "custom"
]

# 常见厂商的默认 base_url，用户选 provider 后可自动填充
PROVIDER_DEFAULTS: dict[str, tuple[str, str]] = {
    "openai":       ("https://api.openai.com/v1",              "gpt-4o"),
    "deepseek":     ("https://api.deepseek.com/v1",            "deepseek-chat"),
    "moonshot":     ("https://api.moonshot.cn/v1",             "moonshot-v1-8k"),
    "qwen":         ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"),
    "zhipu":        ("https://open.bigmodel.cn/api/paas/v4",   "glm-4"),
    "openrouter":   ("https://openrouter.ai/api/v1",           "openai/gpt-4o"),
}


class LLMSettingsUpdate(BaseModel):
    """更新用户 LLM 配置。

    api_key 语义：
      * 传入非空字符串 → 加密后覆盖存储
      * 传入空字符串   → 清除已存 Key（回落服务端兜底）
      * 不传（None）   → 保持原样
    """
    provider: Optional[LLMProvider] = None
    base_url: Optional[str] = Field(None, max_length=2048)
    api_key: Optional[str] = Field(None, max_length=4096, repr=False)
    chat_model: Optional[str] = Field(None, max_length=80)
    vision_model: Optional[str] = Field(None, max_length=80)
    temperature: Optional[float] = Field(None, ge=0, le=2)
    is_enabled: Optional[bool] = None


class LLMSettingsOut(BaseModel):
    """注意：永远不包含明文 API Key，只有掩码 key_hint 与 has_key 标志。"""
    provider: str
    base_url: Optional[str]
    chat_model: str
    vision_model: Optional[str]
    temperature: float
    is_enabled: bool
    has_key: bool
    key_hint: Optional[str]
    last_verified_at: Optional[str]
    last_error: Optional[str]
    source: Literal["user", "global", "unconfigured"]
    updated_at: Optional[str]


# ─── Insights ────────────────────────────────────────────────────────────────

class CategoryBreakdown(BaseModel):
    category: str
    amount: float
    percentage: float
    count: int


class InsightReport(BaseModel):
    period: str
    period_start: str
    period_end: str
    total_spend: float
    total_income: float
    net: float
    savings_rate: float
    summary: str
    highlights: list[str]
    categories_breakdown: list[CategoryBreakdown]
    value_score: float
    suggestions: list[str]


class ValueScoreBreakdown(BaseModel):
    savings_rate: float
    spend_diversity: float
    asset_utilization: float
    budget_adherence: float


class ValueScore(BaseModel):
    score: float
    breakdown: ValueScoreBreakdown
    suggestions: list[str]
    trend: Literal["up", "down", "stable"]


# ─── Depreciation ─────────────────────────────────────────────────────────────

class DepreciationPoint(BaseModel):
    date: str
    value: float


class DepreciationData(BaseModel):
    item_id: str
    purchase_price: float
    current_value: float
    depreciation_percentage: float
    cost_per_use: Optional[float]
    hold_recommendation: HoldRec
    hold_reason: str
    timeline: list[DepreciationPoint]


# ─── Profile ─────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    currency: Optional[str] = None
    monthly_budget: Optional[float] = Field(None, ge=0)
    ai_tone: Optional[Literal["professional", "casual", "strict"]] = None
    ai_push_frequency: Optional[Literal["realtime", "daily", "weekly"]] = None


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    monthly_spend: float
    monthly_budget: Optional[float]
    budget_remaining: Optional[float]
    budget_used_pct: Optional[float]
    total_assets_value: float
    savings_rate: float
    ai_summary: str
    recent_transactions: list[TransactionOut]
    unread_insight_count: int
