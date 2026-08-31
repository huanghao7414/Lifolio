import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ChatMessage } from '@lifolio/shared-types';

export function useAIStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentChunk, setCurrentChunk] = useState('');
  const abortRef = useRef<boolean>(false);

  const sendMessage = async (content: string) => {
    if (streaming) return;
    abortRef.current = false;

    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);
    setCurrentChunk('');

    let full = '';
    try {
      for await (const chunk of api.streamChat(next)) {
        if (abortRef.current) break;
        full += chunk;
        setCurrentChunk(full);
      }
    } catch {
      full = full || '出了点问题，请稍后再试。';
    } finally {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: full, timestamp: new Date().toISOString() },
      ]);
      setStreaming(false);
      setCurrentChunk('');
    }
  };

  const stop = () => { abortRef.current = true; };
  const clear = () => { setMessages([]); setCurrentChunk(''); };

  return { messages, streaming, currentChunk, sendMessage, stop, clear };
}
