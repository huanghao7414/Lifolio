import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ChatMessage, Conversation, ConversationDetail } from '@lifolio/shared-types';

const PAGE_SIZE = 30;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试。';

/** Keeps an in-flight response scoped to its conversation, including while navigating away. */
export function useAIStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [currentChunk, setCurrentChunk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const mounted = useRef(true);
  const operation = useRef(0);
  const historyOperation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const conversationRef = useRef<Conversation | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);

  const storeConversation = (value: Conversation | null) => {
    conversationRef.current = value;
    setConversation(value);
  };
  const storeMessages = (value: ChatMessage[]) => {
    messagesRef.current = value;
    setMessages(value);
  };
  const storeHistory = (value: Conversation[]) => {
    conversationsRef.current = value;
    setConversations(value);
  };
  const applyDetail = (detail: ConversationDetail) => {
    storeConversation(detail.conversation);
    storeMessages(detail.messages.map(message => ({
      role: message.role, content: message.content, timestamp: message.created_at,
    })));
  };

  const refreshConversations = useCallback(async (append = false) => {
    const id = ++historyOperation.current;
    const offset = append ? conversationsRef.current.length : 0;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await api.getConversations({ limit: PAGE_SIZE, offset });
      if (!mounted.current || id !== historyOperation.current) return;
      const combined = append ? [...conversationsRef.current, ...rows] : rows;
      storeHistory(combined.filter((row, index) => combined.findIndex(item => item.id === row.id) === index));
      setHasMore(rows.length === PAGE_SIZE);
    } catch (cause) {
      if (mounted.current && id === historyOperation.current) setHistoryError(errorMessage(cause));
    } finally {
      if (mounted.current && id === historyOperation.current) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshConversations();
    return () => {
      mounted.current = false;
      operation.current += 1;
      historyOperation.current += 1;
      controller.current?.abort();
    };
  }, [refreshConversations]);

  const resetActive = () => {
    operation.current += 1;
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
    setStreaming(false);
    setLoading(false);
    setCurrentChunk('');
    setError(null);
    setWarning(null);
  };

  const newConversation = () => {
    resetActive();
    storeConversation(null);
    storeMessages([]);
  };

  const openConversation = async (id: string) => {
    resetActive();
    const request = operation.current;
    busy.current = true;
    setLoading(true);
    try {
      const detail = await api.getConversation(id);
      if (!mounted.current || request !== operation.current) return false;
      applyDetail(detail);
      return true;
    } catch (cause) {
      if (mounted.current && request === operation.current) setError(errorMessage(cause));
      return false;
    } finally {
      if (mounted.current && request === operation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  };

  const sendMessage = async (content: string) => {
    const text = content.trim();
    if (!mounted.current || busy.current || !text) return false;
    busy.current = true;
    const request = ++operation.current;
    const abort = new AbortController();
    controller.current = abort;
    const active = () => mounted.current && request === operation.current;
    setStreaming(true);
    setCurrentChunk('');
    setError(null);
    setWarning(null);
    let full = '';
    let sent = false;
    let saveWarning = false;
    let completed = false;
    try {
      let current = conversationRef.current;
      if (!current) {
        current = await api.createConversation();
        if (!active()) return false;
        storeConversation(current);
        void refreshConversations();
      }
      if (abort.signal.aborted || !active()) return false;
      const next: ChatMessage[] = [
        ...messagesRef.current,
        { role: 'user', content: text, timestamp: new Date().toISOString() },
      ];
      storeMessages(next);
      sent = true;
      for await (const chunk of api.streamChat(next, {
        conversationId: current.id,
        signal: abort.signal,
        onWarning: message => {
          saveWarning = true;
          if (active()) setWarning(message);
        },
      })) {
        if (!active() || abort.signal.aborted) break;
        full += chunk;
        setCurrentChunk(full);
      }
      if (!active()) return true;
      if (abort.signal.aborted) {
        setWarning('已停止生成。未完成的回答不会保存到历史。');
      } else {
        completed = true;
        if (!full.trim()) setWarning('模型未返回内容，请检查模型设置后重试。');
      }
    } catch (cause) {
      if (active()) {
        if (abort.signal.aborted) setWarning('已停止生成。未完成的回答不会保存到历史。');
        else setError(errorMessage(cause));
      }
    } finally {
      if (active()) {
        setCurrentChunk('');
        if (full) storeMessages([...messagesRef.current, {
          role: 'assistant', content: full, timestamp: new Date().toISOString(),
        }]);
        // A warning means the streamed answer may only exist locally. Preserve it on screen.
        if (completed && !saveWarning && conversationRef.current) {
          try {
            const detail = await api.getConversation(conversationRef.current.id);
            if (active()) applyDetail(detail);
          } catch {
            if (active()) setWarning('回答已生成，暂时无法刷新历史。请稍后重试。');
          }
        }
        if (active()) {
          controller.current = null;
          busy.current = false;
          setStreaming(false);
          setCurrentChunk('');
          void refreshConversations();
        }
      }
    }
    return sent;
  };

  const renameConversation = async (id: string, title: string) => {
    const renamed = await api.renameConversation(id, title.trim());
    if (!mounted.current) return;
    if (conversationRef.current?.id === id) storeConversation(renamed);
    storeHistory(conversationsRef.current.map(item => item.id === id ? renamed : item));
    void refreshConversations();
  };

  const deleteConversation = async (id: string) => {
    await api.deleteConversation(id);
    if (!mounted.current) return;
    if (conversationRef.current?.id === id) newConversation();
    storeHistory(conversationsRef.current.filter(item => item.id !== id));
    void refreshConversations();
  };

  return {
    messages, conversation, conversations, streaming, currentChunk, loading,
    error, warning, historyLoading, historyError, hasMore,
    sendMessage, stop: () => controller.current?.abort(), newConversation,
    openConversation, renameConversation, deleteConversation, refreshConversations,
  };
}
