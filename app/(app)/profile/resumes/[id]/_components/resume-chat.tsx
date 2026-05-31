'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  MessageSquare,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MarkdownPreview } from '@/components/data/markdown-preview';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ResumeChatProps {
  resumeId: string;
  resumeName: string;
  currentMarkdown: string | null;
  triggerClassName?: string;
}

const QUICK_ACTIONS = [
  { label: 'Add a job', prompt: 'I want to add a new job to my work history.' },
  { label: 'Add a skill', prompt: 'I want to add new skills to my resume.' },
  {
    label: 'Improve bullets',
    prompt:
      'Improve the bullet points in my most recent job to use stronger action verbs and quantified achievements.',
  },
  {
    label: 'Fix formatting',
    prompt:
      'Review and fix the formatting of my resume to be more consistent and professional.',
  },
  {
    label: 'Shorten it',
    prompt:
      'Make my resume more concise. Remove filler words and reduce it to fit on fewer pages.',
  },
  {
    label: 'Add education',
    prompt: 'I want to add an education entry to my resume.',
  },
];

/** Extract concatenated text from a UIMessage's parts array */
function getMessageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

export function ResumeChat({
  resumeId,
  resumeName,
  triggerClassName,
}: ResumeChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/resumes/${resumeId}/chat` }),
    [resumeId],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current)
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const extractResumeMarkdown = useCallback(
    (content: string): string | null => {
      const match = content.match(/```resume-markdown\n([\s\S]*?)```/);
      return match?.[1]?.trim() ?? null;
    },
    [],
  );

  const handleApplyChanges = useCallback(
    async (markdown: string) => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown }),
        });
        if (!res.ok) throw new Error('Failed to save');
        toast({
          title: 'Resume updated',
          description: 'Your resume has been updated with the changes.',
        });
        window.location.reload();
      } catch {
        toast({
          title: 'Failed to apply changes',
          description: 'Could not save the updated resume. Try again.',
          variant: 'destructive',
        });
      }
    },
    [resumeId, toast],
  );

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      setInputValue('');
      await sendMessage({ text });
    },
    [isLoading, sendMessage],
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      void handleSend(prompt);
    },
    [handleSend],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend(inputValue);
      }
    },
    [handleSend, inputValue],
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void handleSend(inputValue);
    },
    [handleSend, inputValue],
  );

  const renderMessageContent = useCallback(
    (content: string, messageId: string) => {
      const resumeMd = extractResumeMarkdown(content);
      if (!resumeMd) {
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
            <MarkdownPreview markdown={content} />
          </div>
        );
      }
      const splitParts = content.split(/```resume-markdown\n[\s\S]*?```/);
      const before = splitParts[0]?.trim();
      const after = splitParts[1]?.trim();
      return (
        <div className="space-y-3">
          {before && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownPreview markdown={before} />
            </div>
          )}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3" />
                Updated Resume
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={() => handleCopy(resumeMd, messageId)}
                >
                  {copiedId === messageId ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copiedId === messageId ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={() => handleApplyChanges(resumeMd)}
                >
                  <Check className="size-3" />
                  Apply Changes
                </Button>
              </div>
            </div>
            <details className="group">
              <summary className="cursor-pointer text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                Preview changes
              </summary>
              <div className="mt-2 max-h-64 overflow-auto rounded border border-border bg-background p-3">
                <div className="prose prose-xs dark:prose-invert max-w-none">
                  <MarkdownPreview markdown={resumeMd} />
                </div>
              </div>
            </details>
          </div>
          {after && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownPreview markdown={after} />
            </div>
          )}
        </div>
      );
    },
    [copiedId, extractResumeMarkdown, handleApplyChanges, handleCopy],
  );

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          triggerClassName,
        )}
      >
        <MessageSquare className="size-4" />
        Edit with AI
      </Button>
    );
  }

  return (
    <div
      className={cn(
        ' z-50 flex flex-col border border-border bg-background shadow-2xl transition-all duration-200 ease-out',
        isExpanded
          ? 'rounded-xl rounded-none h-[600px] w-[440px] '
          : '',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-none">
              Resume Editor
            </h3>
            <p className="mt-0.5 max-w-[260px] truncate text-[10px] text-muted-foreground">
              {resumeName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setIsOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                What would you like to change?
              </p>
              <p className="mt-1 max-w-[300px] text-xs text-muted-foreground">
                Ask me to add jobs, skills, education, improve bullet points,
                fix formatting, or anything else.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => handleQuickAction(a.prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m => {
          const text = getMessageText(
            m.parts as { type: string; text?: string }[],
          );
          return (
            <div
              key={m.id}
              className={cn(
                'flex gap-2.5',
                m.role === 'user' ? 'flex-row-reverse' : 'flex-row',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                  m.role === 'user' ? 'bg-foreground/10' : 'bg-primary/10',
                )}
              >
                {m.role === 'user' ? (
                  <User className="size-3.5" />
                ) : (
                  <Bot className="size-3.5 text-primary" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  m.role === 'user' ? 'bg-foreground/5' : 'bg-transparent',
                )}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{text}</p>
                ) : (
                  renderMessageContent(text, m.id)
                )}
              </div>
            </div>
          );
        })}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-3.5 text-primary" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Something went wrong. Please try again.
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        {messages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {QUICK_ACTIONS.slice(0, 3).map(a => (
              <button
                key={a.label}
                type="button"
                onClick={() => handleQuickAction(a.prompt)}
                disabled={isLoading}
                className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleFormSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to edit your resume..."
            rows={1}
            className="w-full min-h-[36px] max-h-32 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-lg"
            disabled={isLoading || !inputValue.trim()}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
