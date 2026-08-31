'use client';

import { useEffect, useRef, useState } from 'react';
import { getAPIClient } from '@/lib/api';
import type { ChatMessage } from '@lifolio/shared-types';
import StreamingText from './StreamingText';

export default function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Open via custom event from Sidebar
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('lifolio:open-ai', handler);
    return () => window.removeEventListener('lifolio:open-ai', handler);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);
    setStreamingText('');

    try {
      const api = getAPIClient();
      let full = '';
      for await (const chunk of api.streamChat(newMessages)) {
        full += chunk;
        setStreamingText(full);
      }
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: full, timestamp: new Date().toISOString() },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '出了点问题，请稍后再试。', timestamp: new Date().toISOString() },
      ]);
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/40"
         onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="w-full sm:w-[420px] h-[85vh] sm:h-[80vh] sm:m-4 bg-[#1A1A1A] rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="ai-tag text-white">
            <span className="text-brand">✦</span>
            <span className="text-sm font-semibold text-white">AI 助手</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-white/40 text-sm mt-8">
              <p className="text-3xl mb-3">✦</p>
              <p>你好！我是 Lifolio AI。</p>
              <p className="mt-1">说说今天的消费，或者问我任何问题。</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand text-white'
                    : 'bg-white/10 text-white'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {streaming && streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm bg-white/10 text-white">
                <StreamingText text={streamingText} />
              </div>
            </div>
          )}
          {streaming && !streamingText && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl bg-white/10">
                <span className="inline-flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 bg-white/10 rounded-2xl px-4 py-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="说说今天的消费..."
              className="flex-1 bg-transparent text-white placeholder-white/30 text-sm focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="text-brand disabled:text-white/20 text-lg transition-colors"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
