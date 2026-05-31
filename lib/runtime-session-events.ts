export async function emitRuntimeSessionUpdate(
  _sessionId: string,
): Promise<void> {
  // Placeholder event hook. The runtime session write has already happened;
  // deployments without a realtime transport should not fail the request.
}
