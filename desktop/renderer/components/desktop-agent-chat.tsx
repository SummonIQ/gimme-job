import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

import type {
  DesktopAgentChatMessage,
  DesktopAgentChatRequest,
  DesktopAgentChatResult,
} from '../../electron/agent-chat/types';

interface DesktopAgentChatProps {
  readonly authStatus: 'invalid' | 'paired' | 'unpaired';
  readonly onChatResult?: (result: DesktopAgentChatResult) => void;
  readonly onSendMessage: (
    request: DesktopAgentChatRequest,
  ) => Promise<DesktopAgentChatResult>;
}

export function DesktopAgentChat({
  authStatus,
  onChatResult,
  onSendMessage,
}: DesktopAgentChatProps) {
  const [allowTrainingWrite, setAllowTrainingWrite] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<readonly DesktopAgentChatMessage[]>(
    [],
  );
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isPaired = authStatus === 'paired';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (content: string) => {
    if (!content || !isPaired || isPending) return;

    const nextMessages = [...messages, { content, role: 'user' as const }];
    setMessages(nextMessages);
    setDraft('');

    startTransition(async () => {
      try {
        const result = await onSendMessage({
          aiProvider: readSavedAiProvider(),
          allowTrainingWrite,
          messages: nextMessages,
        });
        onChatResult?.(result);
        setMessages(currentMessages => [
          ...currentMessages,
          { content: result.content, role: 'assistant' },
        ]);
      } catch (error) {
        setMessages(currentMessages => [
          ...currentMessages,
          {
            content:
              error instanceof Error ? error.message : 'Desktop chat failed.',
            role: 'assistant',
          },
        ]);
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(draft.trim());
  };

  // Enter sends, Shift+Enter inserts a newline.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    sendMessage(draft.trim());
  };

  return (
    <section className="agent-chat" aria-labelledby="agent-chat-heading">
      <div className="agent-chat-header">
        <h2 id="agent-chat-heading">Agent</h2>
        <Checkbox
          ariaLabel="Allow training corrections"
          checked={allowTrainingWrite}
          onCheckedChange={checked =>
            setAllowTrainingWrite(checked === true)
          }
          label="Allow training corrections"
          className="agent-chat-toggle"
        />
      </div>

      <div
        aria-live="polite"
        className="agent-chat-messages"
        ref={scrollRef}
      >
        {messages.length === 0 ? (
          <p className="agent-chat-empty">No chat messages yet.</p>
        ) : (
          messages.map((message, index) => (
            <article
              className={`agent-chat-message ${message.role}`}
              key={`${message.role}-${index}`}
            >
              <strong>{message.role === 'user' ? 'You' : 'Agent'}</strong>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>

      <form className="agent-chat-form" onSubmit={handleSubmit}>
        <Textarea
          aria-label="Agent message"
          disabled={!isPaired || isPending}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isPaired
              ? 'Ask about the current application page (Enter to send)'
              : 'Pair desktop to chat'
          }
          rows={3}
          value={draft}
        />
        <Button
          size="sm"
          disabled={!isPaired || isPending || !draft.trim()}
          type="submit"
          className="w-fit self-end"
        >
          {isPending ? 'Sending' : 'Send'}
        </Button>
      </form>
    </section>
  );
}

// Mirrors SubmitLeadView so a single user-chosen provider drives both the
// submit flow and the chat panel without a second selector.
const SAVED_AI_PROVIDER_KEY = 'gimme-job.desktop.ai-provider';

function readSavedAiProvider(): 'openai' | 'ollama' {
  if (typeof window === 'undefined') return 'openai';
  const raw = window.localStorage?.getItem(SAVED_AI_PROVIDER_KEY);
  return raw === 'ollama' || raw === 'openai' ? raw : 'openai';
}
