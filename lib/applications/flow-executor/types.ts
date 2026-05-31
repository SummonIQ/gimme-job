/**
 * Shared flow-executor types. Consumed by both the desktop CDP driver
 * (Electron `WebContents`) and the fixture replay driver (DOM snapshot
 * over HTML text). The goal is one `runFlow` function that both
 * consumers call with the same `FlowStep[]` + a driver implementation.
 */

export type FlowActionType =
  | 'navigate'
  | 'wait_for'
  | 'click'
  | 'fill'
  | 'select'
  | 'upload'
  | 'scroll_into_view'
  | 'read_element'
  | 'press_key';

export interface FlowStepNavigate {
  readonly type: 'navigate';
  readonly url: string;
}

export interface FlowStepWaitFor {
  readonly type: 'wait_for';
  readonly selector?: string;
  readonly text?: string;
  readonly timeoutMs?: number;
}

export interface FlowStepClick {
  readonly type: 'click';
  readonly selector: string;
}

export interface FlowStepFill {
  readonly type: 'fill';
  readonly selector: string;
  readonly value: string;
}

export interface FlowStepSelect {
  readonly type: 'select';
  readonly selector: string;
  readonly value: string;
}

export interface FlowStepUpload {
  readonly type: 'upload';
  readonly selector: string;
  readonly filePath: string;
}

export interface FlowStepScrollIntoView {
  readonly type: 'scroll_into_view';
  readonly selector: string;
}

export interface FlowStepReadElement {
  readonly type: 'read_element';
  readonly selector: string;
}

export interface FlowStepPressKey {
  readonly type: 'press_key';
  readonly key: string;
}

export type FlowStep =
  | FlowStepNavigate
  | FlowStepWaitFor
  | FlowStepClick
  | FlowStepFill
  | FlowStepSelect
  | FlowStepUpload
  | FlowStepScrollIntoView
  | FlowStepReadElement
  | FlowStepPressKey;

/**
 * Minimal driver contract. Each method is narrowly typed and returns a
 * deterministic object so that the CDP driver and the fixture driver
 * produce byte-identical event traces for the same fixture flow.
 */
export interface FlowDriver {
  navigate(input: { url: string }): Promise<{ url: string }>;
  waitFor(input: {
    selector?: string;
    text?: string;
    timeoutMs: number;
  }): Promise<{ matched: boolean; selector: string | null; text: string | null }>;
  click(input: { selector: string }): Promise<{ clicked: boolean; selector: string }>;
  fill(input: {
    selector: string;
    value: string;
  }): Promise<{ selector: string; value: string }>;
  select(input: {
    selector: string;
    value: string;
  }): Promise<{ selector: string; value: string }>;
  upload(input: {
    selector: string;
    filePath: string;
  }): Promise<{ selector: string; filePath: string }>;
  scrollIntoView(input: {
    selector: string;
  }): Promise<{ selector: string }>;
  readElement(input: { selector: string }): Promise<{
    attributes: Record<string, string>;
    selector: string;
    tagName: string;
    text: string;
    value: string | null;
  }>;
  pressKey(input: { key: string }): Promise<{ key: string }>;
}

export interface FlowContext {
  readonly sessionId: string;
  readonly mode: 'training' | 'submit' | 'replay';
}

export type FlowEventStatus = 'ok' | 'error';

export interface FlowEvent {
  readonly stepIndex: number;
  readonly action: FlowActionType;
  readonly selector: string | null;
  readonly status: FlowEventStatus;
  readonly errorMessage: string | null;
}

export interface RunFlowResult {
  readonly completedSteps: number;
  readonly events: readonly FlowEvent[];
  readonly failed: boolean;
}

export const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
