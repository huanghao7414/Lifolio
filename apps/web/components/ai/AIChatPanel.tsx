'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAPIClient } from '@/lib/api';
import type { ChatMessage, Conversation, ConversationDetail } from '@lifolio/shared-types';
import StreamingText from './StreamingText';

const PAGE_SIZE = 20;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试。';
const historyMessages = (detail: ConversationDetail): ChatMessage[] => detail.messages.map(message => ({
  role: message.role,
  content: message.content,
  timestamp: message.created_at,
}));

export default function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [partial, setPartial] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const historyRequestRef = useRef(0);
  const busyRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = streaming || busy;

  const loadHistory = useCallback(async (offset = 0) => {
    const request = ++historyRequestRef.current;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const rows = await getAPIClient().getConversations({ limit: PAGE_SIZE, offset });
      if (request !== historyRequestRef.current) return;
      setConversations(previous => offset ? [...previous, ...rows.filter(row => !previous.some(item => item.id === row.id))] : rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      if (request === historyRequestRef.current) setHistoryError(errorMessage(err));
    } finally {
      if (request === historyRequestRef.current) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('lifolio:open-ai', handler);
    return () => {
      window.removeEventListener('lifolio:open-ai', handler);
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadHistory();
    const previousFocus = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        controllerRef.current?.abort();
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!panelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, streamingText, streaming]);

  const resetDraft = () => {
    setMessages([]);
    setConversation(null);
    setInput('');
    setError('');
    setNotice('');
    setPartial('');
    setRenaming(false);
    setConfirmDelete(false);
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const openConversation = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const detail = await getAPIClient().getConversation(id);
      setConversation(detail.conversation);
      setMessages(historyMessages(detail));
      setInput('');
      setPartial('');
      setNotice('');
      setHistoryOpen(false);
      setRenaming(false);
      setConfirmDelete(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const renameConversation = async () => {
    if (!conversation || !title.trim() || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await getAPIClient().renameConversation(conversation.id, title.trim());
      setConversation(updated);
      setConversations(rows => rows.map(row => row.id === updated.id ? updated : row));
      setRenaming(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const deleteConversation = async () => {
    if (!conversation || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await getAPIClient().deleteConversation(conversation.id);
      resetDraft();
      setNotice('对话已删除。');
      await loadHistory();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    const userMessage: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const previousMessages = messages;
    setMessages([...previousMessages, userMessage]);
    setInput('');
    setStreaming(true);
    setStreamingText('');
    setPartial('');
    setError('');
    setNotice('');
    let activeConversation = conversation;
    let full = '';
    let completed = false;
    let warning = '';

    try {
      const api = getAPIClient();
      if (!activeConversation) {
        activeConversation = await api.createConversation();
        setConversation(activeConversation);
      }
      if (controller.signal.aborted) throw new DOMException('已停止', 'AbortError');
      for await (const chunk of api.streamChat([userMessage], {
        conversationId: activeConversation.id,
        signal: controller.signal,
        onWarning: message => { warning = message; setNotice(message); },
      })) {
        full += chunk;
        setStreamingText(full);
      }
      if (!full.trim()) throw new Error('AI 暂未返回内容，请稍后继续对话。');
      completed = true;
      setMessages([...previousMessages, userMessage, { role: 'assistant', content: full, timestamp: new Date().toISOString() }]);
    } catch (err) {
      setPartial(full);
      setError(controller.signal.aborted ? '' : errorMessage(err));
      setNotice(controller.signal.aborted ? '回答已停止。' : '回答未完成。');
      if (!activeConversation) {
        setMessages(previousMessages);
        setInput(text);
      }
    } finally {
      // Reconcile with stored history: a failed stream may already have saved the
      // user message. Never automatically send it again and create duplicates.
      if (activeConversation) {
        try {
          const detail = await getAPIClient().getConversation(activeConversation.id);
          setConversation(detail.conversation);
          if (!completed) {
            setMessages(historyMessages(detail));
            const previousUser = [...previousMessages].reverse().find(message => message.role === 'user');
            const latestSavedUser = [...detail.messages].reverse().find(message => message.role === 'user');
            const savedUser = latestSavedUser?.content === text && latestSavedUser.created_at !== previousUser?.timestamp;
            if (!savedUser) setInput(text);
            setNotice(previous => `${previous} ${savedUser ? '消息已保存，可补充消息继续对话。' : '输入已恢复，可重新发送。'}`);
            if (full && detail.messages.some(message => message.role === 'assistant' && message.content === full)) setPartial('');
          } else if (warning) {
            setNotice(warning);
          }
        } catch {
          if (!completed) setMessages([...previousMessages, userMessage]);
          setNotice(previous => `${previous} 暂时无法核对保存状态，请稍后从历史记录重新打开对话。`);
        }
      }
      await loadHistory();
      controllerRef.current = null;
      busyRef.current = false;
      setStreaming(false);
      setStreamingText('');
    }
  };

  const close = () => { controllerRef.current?.abort(); setOpen(false); };
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/40" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="ai-chat-title" className="w-full sm:w-[520px] h-[90dvh] sm:h-[85vh] sm:m-4 bg-ai-canvas rounded-sheet flex flex-col overflow-hidden shadow-3">
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <h2 id="ai-chat-title" className="text-callout font-semibold text-ai-text"><span className="text-accent">✦</span> AI 助手</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setHistoryOpen(value => !value)} aria-expanded={historyOpen} className="min-h-touch text-caption text-ai-sub hover:text-ai-text">历史记录</button>
              <button onClick={resetDraft} disabled={locked} className="min-h-touch px-2 text-caption text-accent disabled:opacity-40">＋ 新对话</button>
              <button onClick={close} aria-label="关闭 AI 助手" className="w-11 h-11 text-ai-sub hover:text-ai-text text-xl">×</button>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-caption text-ai-sub truncate flex-1">{conversation?.title ?? '新对话'}</p>
            {conversation && <>
              <button disabled={locked} onClick={() => { setTitle(conversation.title); setRenaming(value => !value); setConfirmDelete(false); }} className="text-caption text-ai-sub min-h-touch disabled:opacity-40">重命名</button>
              <button disabled={locked} onClick={() => { setConfirmDelete(value => !value); setRenaming(false); }} className="text-caption text-ai-sub min-h-touch disabled:opacity-40">删除</button>
            </>}
          </div>
          {renaming && <form className="flex gap-2 pb-2" onSubmit={event => { event.preventDefault(); void renameConversation(); }}>
            <input aria-label="对话名称" value={title} onChange={event => setTitle(event.target.value)} maxLength={200} disabled={locked} className="min-w-0 flex-1 bg-ai-surface rounded-md px-3 py-2 text-ai-text text-caption" />
            <button disabled={locked || !title.trim()} className="text-accent text-caption disabled:opacity-40">保存</button>
            <button type="button" disabled={locked} onClick={() => setRenaming(false)} className="text-ai-sub text-caption">取消</button>
          </form>}
          {confirmDelete && <div className="rounded-md bg-ai-surface p-3 text-caption text-ai-text" role="alert">
            <p>删除「{conversation?.title}」及全部消息？此操作无法撤销。</p>
            <div className="flex gap-4 mt-2">
              <button onClick={deleteConversation} disabled={locked} className="min-h-touch text-accent disabled:opacity-40">确认删除</button>
              <button onClick={() => setConfirmDelete(false)} disabled={locked} className="min-h-touch text-ai-sub">保留对话</button>
            </div>
          </div>}
        </div>

        {historyOpen && <div className="max-h-[35%] shrink-0 overflow-y-auto border-b border-white/10 px-4 py-2" aria-label="已保存的对话">
          {conversations.map(item => <button key={item.id} disabled={locked} onClick={() => void openConversation(item.id)} aria-current={item.id === conversation?.id ? 'true' : undefined} className={`w-full text-left rounded-md px-3 py-3 disabled:opacity-40 ${item.id === conversation?.id ? 'bg-ai-elevated' : 'hover:bg-ai-surface'}`}>
            <span className="block truncate text-callout text-ai-text">{item.title}</span>
            <span className="block text-micro text-ai-sub mt-1">{item.message_count} 条消息 · {new Date(item.last_message_at || item.created_at).toLocaleDateString('zh-CN')}</span>
          </button>)}
          {!conversations.length && !historyLoading && !historyError && <p className="py-5 text-center text-caption text-ai-sub">还没有对话，发送第一条消息后会自动保存。</p>}
          {historyError && <div role="alert" className="text-caption text-ai-text py-2">{historyError}<button onClick={() => void loadHistory()} disabled={historyLoading} className="text-accent ml-2 min-h-touch">重试</button></div>}
          {historyLoading && <p role="status" className="text-caption text-ai-sub py-3 text-center">正在加载历史记录…</p>}
          {hasMore && !historyLoading && <button onClick={() => void loadHistory(conversations.length)} className="w-full min-h-touch text-caption text-accent">加载更多</button>}
        </div>}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4" role="log" aria-label="对话消息" aria-busy={streaming || busy}>
          {messages.length === 0 && !busy && <div className="text-center text-ai-sub text-callout mt-8">
            <p className="text-3xl mb-3 text-accent">✦</p><p>你好！我是 Lifolio AI。</p>
            <p className="mt-1">说说今天的消费，或者一起回顾资产与预算。</p>
          </div>}
          {busy && <p role="status" className="text-caption text-ai-sub text-center">正在处理…</p>}
          {messages.map((message, index) => <div key={`${message.timestamp}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-4 py-2.5 rounded-2xl text-callout leading-relaxed text-ai-text break-words whitespace-pre-wrap ${message.role === 'user' ? 'bg-ai-elevated' : 'bg-ai-surface'}`}>
              {message.role === 'assistant' && <span className="block text-micro text-accent mb-1">✦ AI</span>}{message.content}
            </div>
          </div>)}
          {streaming && <div className="flex justify-start"><div className="max-w-[88%] px-4 py-2.5 rounded-2xl text-callout bg-ai-surface text-ai-text break-words whitespace-pre-wrap">
            <span className="block text-micro text-accent mb-1">✦ AI</span>
            {streamingText ? <StreamingText text={streamingText} /> : <span role="status" className="text-ai-sub">正在思考…</span>}
          </div></div>}
          {!streaming && partial && <div className="bg-ai-surface rounded-2xl px-4 py-3 text-callout text-ai-text break-words whitespace-pre-wrap"><span className="block text-micro text-accent mb-1">✦ AI · 未完成，尚未确认保存</span>{partial}</div>}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pb-4 space-y-2">
          {error && <p role="alert" className="text-caption text-ai-text bg-ai-surface rounded-md px-3 py-2">{error}</p>}
          {notice && <p role="status" className="text-caption text-ai-sub">{notice}</p>}
          <form onSubmit={event => { event.preventDefault(); void sendMessage(); }} className="flex gap-2 bg-ai-surface rounded-2xl px-4 py-2">
            <input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.nativeEvent.isComposing && event.key === 'Enter') event.preventDefault(); }} placeholder="说说今天的消费…" aria-label="输入消息" disabled={locked} className="min-w-0 flex-1 bg-transparent text-ai-text placeholder-ai-sub text-callout focus:outline-none disabled:opacity-60" />
            {streaming ? <button type="button" onClick={() => controllerRef.current?.abort()} aria-label="停止生成" className="min-h-touch text-caption text-accent">停止</button> : <button disabled={locked || !input.trim()} aria-label="发送消息" className="text-accent disabled:text-ai-sub text-lg min-w-touch min-h-touch">↑</button>}
          </form>
          <p className="text-center text-micro text-ai-sub">AI 生成内容可能有误，重要财务决策请自行核实</p>
        </div>
      </div>
    </div>
  );
}
