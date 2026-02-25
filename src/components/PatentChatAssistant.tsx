import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare, Send, Loader2, Scale, Search, Shield, Bot, User, X, Minimize2, Maximize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };
type ChatMode = 'general' | 'claims' | 'examiner' | 'prior-art';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patent-chat`;

const MODE_CONFIG: Record<ChatMode, { label: string; icon: React.ReactNode; description: string }> = {
  general: { label: 'General', icon: <Bot className="w-3.5 h-3.5" />, description: 'Patent strategy & advice' },
  claims: { label: 'Claims', icon: <Scale className="w-3.5 h-3.5" />, description: 'Claim drafting & analysis' },
  examiner: { label: 'Examiner', icon: <Shield className="w-3.5 h-3.5" />, description: 'Predict Office Actions' },
  'prior-art': { label: 'Prior Art', icon: <Search className="w-3.5 h-3.5" />, description: 'Differentiation help' },
};

interface PatentChatAssistantProps {
  sessionId?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function PatentChatAssistant({ sessionId, isOpen, onToggle }: PatentChatAssistantProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('general');
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages, sessionId, mode }),
    });

    if (!resp.ok || !resp.body) {
      if (resp.status === 429) throw new Error('Rate limited — please wait a moment.');
      if (resp.status === 402) throw new Error('AI credits depleted.');
      throw new Error('Failed to connect to AI.');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantSoFar = '';

    const updateAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) updateAssistant(content);
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw || raw.startsWith(':') || raw.trim() === '' || !raw.startsWith('data: ')) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const c = parsed.choices?.[0]?.delta?.content;
          if (c) updateAssistant(c);
        } catch { /* ignore */ }
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat([...messages, userMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e.message || 'Something went wrong.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center bg-foreground text-background transition-all duration-300 hover:scale-105"
        style={{ boxShadow: '0 4px 24px hsl(220 20% 10% / 0.25)' }}
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[380px] sm:w-[420px] chat-container"
      style={{ height: isMinimized ? 'auto' : '560px' }}
    >
      {/* Header */}
      <div className="chat-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center">
            <Bot className="w-4 h-4 text-background" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Patent AI</h3>
            <p className="text-[10px] text-muted-foreground">{MODE_CONFIG[mode].description}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={onToggle}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Mode selector */}
          <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
            {(Object.entries(MODE_CONFIG) as [ChatMode, typeof MODE_CONFIG[ChatMode]][]).map(([key, cfg]) => (
              <button
                key={key}
                className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0 ${
                  mode === key
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                onClick={() => setMode(key)}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-3" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto">
                  <Bot className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">How can I help?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ask about claims, prior art, prosecution, or compliance.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                  {[
                    'Strengthen my claims',
                    'Predict examiner objections',
                    'Differentiate from prior art',
                    'Improve abstract',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      className="chat-suggestion"
                      onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[11px] [&_pre]:text-[11px]">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3 h-3 text-background" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                      <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                    </div>
                    <div className="chat-bubble-assistant">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="chat-input-bar">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about claims, prior art…"
              className="min-h-[36px] max-h-[80px] text-sm resize-none border-border bg-muted/30 rounded-xl"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all hover:scale-105"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
