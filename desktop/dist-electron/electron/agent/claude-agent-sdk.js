export function createClaudeAgentSdkRuntime(sdkSession) {
    return {
        run(input) {
            return sdkSession.run(input);
        },
    };
}
