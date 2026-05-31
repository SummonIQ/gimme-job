import 'server-only';

export const PLAN_BOARD_CHANNEL = 'public-gimme-job-plan-board';
export const PLAN_BOARD_TASK_EVENT = 'plan-task-updated';
export const DETECTION_HEALTH_CHANNEL =
  'public-gimme-job-detection-health';
export const DETECTION_HEALTH_EVENT = 'detection-health-action';
const DEFAULT_SUMMONFLOW_WS_PORT = 443;
const DEFAULT_SUMMONFLOW_HTTP_ORIGIN = 'https://realtime.summonflow.com';

interface PublishChannelEventInput {
  channel: string;
  data: unknown;
  event: string;
}

export interface SummonFlowRealtimeConfig {
  appKey: string;
  channelName: string;
  forceTLS: boolean;
  wsHost?: string;
  wsPort?: number;
}

export type PlanBoardRealtimeConfig = SummonFlowRealtimeConfig;

function getRealtimeConfigForChannel(
  channelName: string,
): SummonFlowRealtimeConfig {
  return {
    appKey: process.env.NEXT_PUBLIC_SUMMONFLOW_APP_KEY ?? '',
    channelName,
    forceTLS: process.env.NEXT_PUBLIC_SUMMONFLOW_FORCE_TLS !== 'false',
    wsHost: normalizeSummonFlowHost(process.env.NEXT_PUBLIC_SUMMONFLOW_WS_HOST),
    wsPort: parseSummonFlowWsPort(process.env.NEXT_PUBLIC_SUMMONFLOW_WS_PORT),
  };
}

export function getPlanBoardRealtimeConfig(): PlanBoardRealtimeConfig {
  return getRealtimeConfigForChannel(PLAN_BOARD_CHANNEL);
}

export function getDetectionHealthRealtimeConfig(): SummonFlowRealtimeConfig {
  return getRealtimeConfigForChannel(DETECTION_HEALTH_CHANNEL);
}

function normalizeSummonFlowHost(value: string | undefined): string | undefined {
  const host = value?.trim();
  return host ? host : undefined;
}

function parseSummonFlowWsPort(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_SUMMONFLOW_WS_PORT;
}

async function publishChannelEvent({
  channel,
  data,
  event,
}: PublishChannelEventInput): Promise<void> {
  const appKey =
    process.env.SUMMONFLOW_APP_KEY ??
    process.env.NEXT_PUBLIC_SUMMONFLOW_APP_KEY;
  const publishToken = process.env.SUMMONFLOW_PUBLISH_TOKEN;

  if (!appKey || !publishToken) {
    return;
  }

  const baseUrl =
    process.env.SUMMONFLOW_HTTP_ORIGIN?.trim() ??
    DEFAULT_SUMMONFLOW_HTTP_ORIGIN;

  const endpoint = new URL(`/apps/${appKey}/events`, baseUrl);

  await fetch(endpoint, {
    body: JSON.stringify({ channel, data, event }),
    headers: {
      Authorization: `Bearer ${publishToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function publishPlanBoardEvent({
  data,
  event,
}: {
  data: unknown;
  event: string;
}): Promise<void> {
  await publishChannelEvent({ channel: PLAN_BOARD_CHANNEL, data, event });
}

export async function publishDetectionHealthEvent({
  data,
  event = DETECTION_HEALTH_EVENT,
}: {
  data: unknown;
  event?: string;
}): Promise<void> {
  await publishChannelEvent({ channel: DETECTION_HEALTH_CHANNEL, data, event });
}
