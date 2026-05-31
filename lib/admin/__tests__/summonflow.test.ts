import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DETECTION_HEALTH_CHANNEL,
  DETECTION_HEALTH_EVENT,
  publishDetectionHealthEvent,
  publishPlanBoardEvent,
} from '@/lib/admin/summonflow';

vi.mock('server-only', () => ({}));

const ORIGINAL_ENV = { ...process.env };

describe('summonflow helpers', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('publishes plan board events to the managed platform when no origin override exists', async () => {
    process.env.NEXT_PUBLIC_SUMMONFLOW_APP_KEY = 'app-key';
    process.env.SUMMONFLOW_PUBLISH_TOKEN = 'publish-token';
    delete process.env.SUMMONFLOW_HTTP_ORIGIN;

    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await publishPlanBoardEvent({
      data: { taskId: 'P15.2' },
      event: 'plan-task-updated',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, requestInit] = fetchMock.mock.calls[0] ?? [];

    expect(String(endpoint)).toBe(
      'https://realtime.summonflow.com/apps/app-key/events',
    );
    expect(requestInit).toEqual({
      body: JSON.stringify({
        channel: 'public-gimme-job-plan-board',
        data: { taskId: 'P15.2' },
        event: 'plan-task-updated',
      }),
      headers: {
        Authorization: 'Bearer publish-token',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  });

  it('publishes detection-health events on the dedicated channel', async () => {
    process.env.NEXT_PUBLIC_SUMMONFLOW_APP_KEY = 'app-key';
    process.env.SUMMONFLOW_PUBLISH_TOKEN = 'publish-token';
    delete process.env.SUMMONFLOW_HTTP_ORIGIN;

    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await publishDetectionHealthEvent({
      data: { hostname: 'jobs.example.com', triggered: ['CAPTCHA_SPIKE'] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(requestInit).toMatchObject({
      body: JSON.stringify({
        channel: DETECTION_HEALTH_CHANNEL,
        data: { hostname: 'jobs.example.com', triggered: ['CAPTCHA_SPIKE'] },
        event: DETECTION_HEALTH_EVENT,
      }),
    });
  });

  it('skips publish when SummonFlow credentials are absent', async () => {
    delete process.env.SUMMONFLOW_APP_KEY;
    delete process.env.NEXT_PUBLIC_SUMMONFLOW_APP_KEY;
    delete process.env.SUMMONFLOW_PUBLISH_TOKEN;

    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await publishDetectionHealthEvent({ data: {} });
    await publishPlanBoardEvent({ data: {}, event: 'noop' });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
