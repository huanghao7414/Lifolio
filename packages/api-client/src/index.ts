import type {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  Item,
  ItemCreate,
  ItemUpdate,
  ItemUsage,
  AIInsight,
  ParseRequest,
  ParseResult,
  ChatMessage,
  InsightReport,
  ValueScore,
  DepreciationData,
  DashboardSummary,
  PaginatedResponse,
  UserProfile,
  Category,
} from '@lifolio/shared-types';

export interface APIClientConfig {
  baseUrl: string;
  getToken: () => string | null | Promise<string | null>;
}

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class LifolioAPIClient {
  private baseUrl: string;
  private getToken: () => string | null | Promise<string | null>;

  constructor(config: APIClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
  }

  private async buildHeaders(extra?: HeadersInit): Promise<HeadersInit> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extra as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = await this.buildHeaders(options.headers as HeadersInit);
    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new APIError(res.status, body.detail ?? 'Unknown error', body.code);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(): Promise<DashboardSummary> {
    return this.request('/api/dashboard');
  }

  // ─── Categories ───────────────────────────────────────────────────────────

  async getCategories(): Promise<Category[]> {
    return this.request('/api/transactions/categories');
  }

  // ─── Transactions ─────────────────────────────────────────────────────────

  async getTransactions(params?: {
    page?: number;
    per_page?: number;
    category?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<Transaction>> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.per_page) q.set('per_page', String(params.per_page));
    if (params?.category) q.set('category', params.category);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    return this.request(`/api/transactions?${q}`);
  }

  async createTransaction(data: TransactionCreate): Promise<Transaction> {
    return this.request('/api/transactions', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTransaction(id: string, data: TransactionUpdate): Promise<Transaction> {
    return this.request(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteTransaction(id: string): Promise<void> {
    return this.request(`/api/transactions/${id}`, { method: 'DELETE' });
  }

  // ─── Items ────────────────────────────────────────────────────────────────

  async getItems(): Promise<Item[]> {
    return this.request('/api/items');
  }

  async getItem(id: string): Promise<Item> {
    return this.request(`/api/items/${id}`);
  }

  async createItem(data: ItemCreate): Promise<Item> {
    return this.request('/api/items', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateItem(id: string, data: ItemUpdate): Promise<Item> {
    return this.request(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteItem(id: string): Promise<void> {
    return this.request(`/api/items/${id}`, { method: 'DELETE' });
  }

  async getItemDepreciation(id: string): Promise<DepreciationData> {
    return this.request(`/api/items/${id}/depreciation`);
  }

  async logItemUsage(id: string, data: { duration_hours?: number; notes?: string }): Promise<ItemUsage> {
    return this.request(`/api/items/${id}/usage`, { method: 'POST', body: JSON.stringify(data) });
  }

  async uploadItemImage(id: string, file: File | Blob): Promise<{ image_url: string }> {
    const token = await this.getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${this.baseUrl}/api/items/${id}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new APIError(res.status, `Upload failed: ${res.status}`);
    return res.json();
  }

  // ─── AI ───────────────────────────────────────────────────────────────────

  async parse(req: ParseRequest): Promise<ParseResult> {
    return this.request('/api/ai/parse', { method: 'POST', body: JSON.stringify(req) });
  }

  async analyzeImage(file: File | Blob): Promise<ParseResult> {
    const token = await this.getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${this.baseUrl}/api/ai/vision`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new APIError(res.status, `Vision failed: ${res.status}`);
    return res.json();
  }

  /** Streaming chat — yields text delta chunks */
  async *streamChat(messages: ChatMessage[]): AsyncGenerator<string> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new APIError(res.status, `Chat failed: ${res.status}`);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as { content?: string };
          if (parsed.content) yield parsed.content;
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  // ─── Insights ─────────────────────────────────────────────────────────────

  async getInsightReport(period?: 'current_month' | 'last_month'): Promise<InsightReport> {
    const q = period ? `?period=${period}` : '';
    return this.request(`/api/insights/report${q}`);
  }

  async getValueScore(): Promise<ValueScore> {
    return this.request('/api/insights/score');
  }

  async getInsights(type?: string): Promise<AIInsight[]> {
    const q = type ? `?type=${type}` : '';
    return this.request(`/api/insights${q}`);
  }

  async markInsightRead(id: string): Promise<void> {
    return this.request(`/api/insights/${id}/read`, { method: 'POST' });
  }

  // ─── User Profile ─────────────────────────────────────────────────────────

  async getProfile(): Promise<UserProfile> {
    return this.request('/api/profile');
  }

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request('/api/profile', { method: 'PATCH', body: JSON.stringify(data) });
  }
}

export type { Transaction, Item, AIInsight, ChatMessage, ParseResult, Category, DashboardSummary, PaginatedResponse };
