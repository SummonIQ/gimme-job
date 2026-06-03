import type {
  DesktopAgentRuntime,
  DesktopAgentRuntimeInput,
  DesktopAgentRuntimeResult,
} from './types.js';

export interface LocalClaudeAgentSdkSession {
  run: (input: DesktopAgentRuntimeInput) => Promise<DesktopAgentRuntimeResult>;
}

export function createClaudeAgentSdkRuntime(
  sdkSession: LocalClaudeAgentSdkSession,
): DesktopAgentRuntime {
  return {
    run(input) {
      return sdkSession.run(input);
    },
  };
}
