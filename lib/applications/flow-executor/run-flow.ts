import {
  DEFAULT_WAIT_TIMEOUT_MS,
  type FlowActionType,
  type FlowContext,
  type FlowDriver,
  type FlowEvent,
  type FlowStep,
  type RunFlowResult,
} from './types';

export interface RunFlowOptions {
  /**
   * When true, the executor stops at the first failing step. Otherwise it
   * records the error event and moves on. Defaults to true - flows are
   * deterministic; a failure usually means the next step is unreachable.
   */
  readonly stopOnError?: boolean;
}

/**
 * Execute an ordered list of `FlowStep`s against a driver.
 *
 * The desktop runtime supplies a CDP driver backed by `WebContents`.
 * The replay harness supplies a fixture driver backed by a parsed DOM.
 * Both produce the same `FlowEvent[]` trace for a given flow - that is
 * the P7.5 acceptance invariant.
 */
export async function runFlow(
  steps: readonly FlowStep[],
  driver: FlowDriver,
  _context: FlowContext,
  options: RunFlowOptions = {},
): Promise<RunFlowResult> {
  const stopOnError = options.stopOnError ?? true;
  const events: FlowEvent[] = [];
  let completedSteps = 0;
  let failed = false;

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    const action = step.type as FlowActionType;
    const selector = 'selector' in step ? step.selector ?? null : null;

    try {
      await executeStep(step, driver);
      events.push({
        action,
        errorMessage: null,
        selector,
        status: 'ok',
        stepIndex,
      });
      completedSteps += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      events.push({
        action,
        errorMessage,
        selector,
        status: 'error',
        stepIndex,
      });
      failed = true;
      if (stopOnError) break;
    }
  }

  return { completedSteps, events, failed };
}

async function executeStep(
  step: FlowStep,
  driver: FlowDriver,
): Promise<void> {
  switch (step.type) {
    case 'navigate':
      await driver.navigate({ url: step.url });
      return;
    case 'wait_for':
      await driver.waitFor({
        selector: step.selector,
        text: step.text,
        timeoutMs: step.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
      });
      return;
    case 'click':
      await driver.click({ selector: step.selector });
      return;
    case 'fill':
      await driver.fill({ selector: step.selector, value: step.value });
      return;
    case 'select':
      await driver.select({ selector: step.selector, value: step.value });
      return;
    case 'upload':
      await driver.upload({
        filePath: step.filePath,
        selector: step.selector,
      });
      return;
    case 'scroll_into_view':
      await driver.scrollIntoView({ selector: step.selector });
      return;
    case 'read_element':
      await driver.readElement({ selector: step.selector });
      return;
    case 'press_key':
      await driver.pressKey({ key: step.key });
      return;
  }
}
