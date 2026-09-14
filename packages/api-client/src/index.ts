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
  Conversation,
  ConversationDetail,
  LLMSettings,
  LLMSettingsUpdate,
  LLMTestResult,
  AuthConfig,
  AuthIdentity,
  AdminOverview,
} from '@lifolio/shared-types';

export interface APIClientConfig {
  baseUrl: string;
  getToken: () => string | null | Promise<string | null>;
  /** Expo's native streaming fetch on mobile; defaults to the browser fetch. */
  streamFetch?: typeof fetch;
}

export interface ChatStreamOptions {
  conversationId?: string;
  signal?: AbortSignal;
  onWarning?: (message: string) => void;
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

async function responseError(res: Response): Promise<APIError> {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  const message = typeof detail === 'string' ? detail
    : Array.isArray(detail) ? detail.map((entry: { msg?: string }) => entry.msg || '输入无效').join('；')
    : `请求失败（HTTP ${res.status}）`;
  return new APIError(res.status, message, body?.code);
}

function abortError(): Error {
  const error = new Error('已停止生成');
  error.name = 'AbortError';
  return error;
}

export class LifolioAPIClient {
  private baseUrl: string;
  private getToken: () => string | null | Promise<string | null>;
  private streamFetch: typeof fetch;

  constructor(config: APIClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
    this.streamFetch = config.streamFetch ?? ((...args) => fetch(...args));
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
    if (!res.ok) throw await responseError(res);
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getAuthConfig(): Promise<AuthConfig> {
    return this.request('/api/auth/config');
  }

  async getIdentity(): Promise<AuthIdentity> {
    return this.request('/api/auth/me');
  }

  async getAdminOverview(): Promise<AdminOverview> {
    return this.request('/api/admin/overview');
  }

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

  async analyzeImage(file: File | Blob | FormData): Promise<ParseResult> {
    const token = await this.getToken();
    const form = file instanceof FormData ? file : new FormData();
    if (!(file instanceof FormData)) form.append('file', file);
    const res = await fetch(`${this.baseUrl}/api/ai/vision`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw await responseError(res);
    return res.json();
  }

  /** Decode complete SSE events, preserving UTF-8 across network boundaries. */
  async *streamChat(messages: ChatMessage[], options: ChatStreamOptions = {}): AsyncGenerator<string> {
    if (options.signal?.aborted) throw abortError();
    const token = await this.getToken();
    if (options.signal?.aborted) throw abortError();
    const res = await this.streamFetch(`${this.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages, conversation_id: options.conversationId }),
      signal: options.signal,
    });
    if (!res.ok) throw await responseError(res);
    if (!res.body?.getReader) throw new APIError(0, '当前环境不支持流式回复，请更新应用');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const cancel = () => { void reader.cancel().catch(() => {}); };
    options.signal?.addEventListener('abort', cancel, { once: true });

    const parseEvent = (event: string): { done?: boolean; content?: string } => {
      const data = event.split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, '')).join('\n');
      if (!data) return {};
      if (data.trim() === '[DONE]') return { done: true };
      let parsed: { content?: string; error?: string; warning?: string };
      try {
        parsed = JSON.parse(data);
      } catch {
        throw new APIError(0, 'AI 回复格式异常，请重试', 'invalid_stream');
      }
      if (!parsed || typeof parsed !== 'object') throw new APIError(0, 'AI 回复格式异常', 'invalid_stream');
      if (parsed.error) throw new APIError(0, String(parsed.error), 'stream_error');
      if (parsed.warning) options.onWarning?.(String(parsed.warning));
      return { content: typeof parsed.content === 'string' ? parsed.content : undefined };
    };

    try {
      while (true) {
        if (options.signal?.aborted) throw abortError();
        const { done, value } = await reader.read();
        if (options.signal?.aborted) throw abortError();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let boundary: RegExpExecArray | null;
        while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
          const event = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary[0].length);
          const parsed = parseEvent(event);
          if (parsed.content) yield parsed.content;
          if (parsed.done) return;
        }
        if (done) {
          if (buffer.trim()) {
            const parsed = parseEvent(buffer);
            if (parsed.content) yield parsed.content;
            if (parsed.done) return;
          }
          throw new APIError(0, '回复连接中断，请重新打开会话查看已保存的内容', 'incomplete_stream');
        }
      }
    } finally {
      options.signal?.removeEventListener('abort', cancel);
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  // ─── Saved conversations ─────────────────────────────────────────────────

  async getConversations(params: { limit?: number; offset?: number } = {}): Promise<Conversation[]> {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    return this.request(`/api/conversations?${query}`);
  }

  async createConversation(title?: string): Promise<Conversation> {
    return this.request('/api/conversations', { method: 'POST', body: JSON.stringify({ title }) });
  }

  async getConversation(id: string): Promise<ConversationDetail> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}`);
  }

  async renameConversation(id: string, title: string): Promise<Conversation> {
    return this.request(`/api/conversations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.request(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ─── Personal AI provider settings ────────────────────────────────────────

  async getLLMSettings(): Promise<LLMSettings> {
    return this.request('/api/settings/llm');
  }

  async updateLLMSettings(data: LLMSettingsUpdate): Promise<LLMSettings> {
    return this.request('/api/settings/llm', { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteLLMSettings(): Promise<void> {
    await this.request('/api/settings/llm', { method: 'DELETE' });
  }

  async testLLMSettings(data?: LLMSettingsUpdate): Promise<LLMTestResult> {
    return this.request('/api/settings/llm/test', { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
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
