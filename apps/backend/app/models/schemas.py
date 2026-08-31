from __future__ import annotations
from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field


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
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)


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
