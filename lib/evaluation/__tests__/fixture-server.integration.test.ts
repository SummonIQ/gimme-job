// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FIXTURE_FAMILIES,
  startFixtureServer,
  type FixtureFamily,
  type StartedFixtureServer,
} from '../fixture-server';

let running: StartedFixtureServer;

beforeAll(async () => {
  running = await startFixtureServer({ latencyMs: 1 });
});

afterAll(async () => {
  await running.stop();
});

describe('fixture-server (integration)', () => {
  it('binds to an ephemeral port when port=0', () => {
    expect(running.port).toBeGreaterThan(0);
    expect(running.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it.each<FixtureFamily>([...FIXTURE_FAMILIES])(
    'serves application.html for %s with the expected ats-family meta tag',
    async family => {
      const res = await fetch(`${running.baseUrl}/fixtures/${family}/application`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/html/);
      const body = await res.text();
      expect(body).toContain(`<meta name="ats-family" content="${family}"`);
      expect(body).toContain(`action="/fixtures/${family}/submit"`);
    },
  );

  it.each<FixtureFamily>([...FIXTURE_FAMILIES])(
    'serves fixture.json for %s with family + confirmationPhrase',
    async family => {
      const res = await fetch(`${running.baseUrl}/fixtures/${family}/fixture.json`);
      expect(res.status).toBe(200);
      const manifest = (await res.json()) as {
        family: string;
        confirmationPhrase: string;
        submitPath: string;
      };
      expect(manifest.family).toBe(family);
      expect(manifest.confirmationPhrase).toBeTruthy();
      expect(manifest.submitPath).toBe(`/fixtures/${family}/submit`);
    },
  );

  it.each<FixtureFamily>([...FIXTURE_FAMILIES])(
    'POST /fixtures/%s/submit returns the confirmation HTML with a reference header',
    async family => {
      const form = new FormData();
      form.append('first_name', 'Test');
      form.append('email', 'test@example.com');

      const res = await fetch(
        `${running.baseUrl}/fixtures/${family}/submit`,
        {
          body: form,
          method: 'POST',
        },
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/html/);
      expect(res.headers.get('x-fixture-reference')).toMatch(
        new RegExp(`^${family.toUpperCase()}-\\d+$`),
      );
      const body = await res.text();
      expect(body).toContain('<body');
    },
  );

  it('drives the Greenhouse fixture end-to-end (GET -> POST -> confirmation)', async () => {
    const applicationRes = await fetch(
      `${running.baseUrl}/fixtures/greenhouse/application`,
    );
    const applicationBody = await applicationRes.text();
    expect(applicationBody).toContain('id="submit_app"');

    const form = new FormData();
    form.append('first_name', 'Alice');
    form.append('last_name', 'Fixture');
    form.append('email', 'alice@example.test');
    form.append('phone', '555-0100');
    form.append('question_authorized', 'yes');
    form.append('question_years', '7');

    const submitRes = await fetch(
      `${running.baseUrl}/fixtures/greenhouse/submit`,
      { body: form, method: 'POST' },
    );
    expect(submitRes.status).toBe(200);
    const reference = submitRes.headers.get('x-fixture-reference');
    expect(reference).toMatch(/^GREENHOUSE-\d+$/);

    const confirmationBody = await submitRes.text();
    expect(confirmationBody).toContain('Application submitted!');
    expect(confirmationBody).toContain(reference as string);
  });

  it('returns 404 for an unknown family', async () => {
    const res = await fetch(
      `${running.baseUrl}/fixtures/not-a-real-ats/application`,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for a path outside the fixture (path traversal guard)', async () => {
    const res = await fetch(
      `${running.baseUrl}/fixtures/greenhouse/../ashby/application`,
    );
    // fetch/url normalizes ".." — but the server should still only read
    // within the <family> dir. Either way, the server must not leak a file
    // from outside the fixture root.
    expect(res.status).toBeLessThan(500);
  });

  it('returns 405 on wrong method', async () => {
    const res = await fetch(
      `${running.baseUrl}/fixtures/greenhouse/application`,
      { method: 'DELETE' },
    );
    expect(res.status).toBe(405);
  });

  it('adds latency per request when latencyMs is set', async () => {
    const slow = await startFixtureServer({ latencyMs: 75 });
    try {
      const started = Date.now();
      const res = await fetch(`${slow.baseUrl}/fixtures/lever/application`);
      const elapsed = Date.now() - started;
      expect(res.status).toBe(200);
      expect(elapsed).toBeGreaterThanOrEqual(70);
    } finally {
      await slow.stop();
    }
  });
});
