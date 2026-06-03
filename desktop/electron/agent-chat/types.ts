import type { DesktopSubmitLeadResult } from '../submit/greenhouse-submit.js';

export type DesktopAgentChatRole = 'assistant' | 'user';

export interface DesktopAgentChatMessage {
  readonly content: string;
  readonly role: DesktopAgentChatRole;
}

export interface DesktopAssistPageFieldAutofill {
  readonly action: string;
  readonly ok: boolean;
  readonly reason?: string;
  readonly value?: string;
}

export interface DesktopAssistPageField {
  readonly ariaLabel: string | null;
  readonly autocomplete: string | null;
  readonly candidateSelectors: readonly string[];
  readonly checked: boolean | null;
  readonly disabled: boolean;
  readonly id: string | null;
  readonly inputType: string | null;
  readonly label: string | null;
  readonly name: string | null;
  readonly options: readonly string[];
  // Parallel to `options` — same length, holds the underlying form value for
  // each option label so inline editing can submit the value the form expects
  // (e.g. "US" for the "United States" option) instead of the visible label.
  readonly optionValues?: readonly string[];
  readonly placeholder: string | null;
  readonly required: boolean;
  readonly selector: string;
  readonly shouldAvoid?: boolean;
  readonly tagName: string;
  readonly value: string | null;
  readonly visible: boolean;
  readonly wasAutofilled?: DesktopAssistPageFieldAutofill;
}

export interface DesktopAssistPageIssue {
  readonly fieldSelector?: string;
  readonly kind?: 'required-empty' | 'tool-error';
  readonly message: string;
  readonly severity: 'info' | 'warning';
}

export interface DesktopAssistPageContext {
  readonly capturedAt: string;
  readonly fields: readonly DesktopAssistPageField[];
  readonly issues: readonly DesktopAssistPageIssue[];
  readonly lastSubmitResult: DesktopSubmitLeadResult | null;
  readonly screenshotDataUrl: string | null;
  readonly title: string;
  readonly url: string;
}

export interface DesktopAgentChatRequest {
  readonly aiProvider?: 'openai' | 'ollama';
  readonly allowTrainingWrite: boolean;
  readonly messages: readonly DesktopAgentChatMessage[];
}

export interface DesktopAgentChatMutation {
  readonly message: string;
  readonly selector?: string;
  readonly type: 'training_correction';
}

export interface DesktopAgentChatResult {
  readonly content: string;
  readonly context: DesktopAssistPageContext;
  readonly mutations: readonly DesktopAgentChatMutation[];
}
