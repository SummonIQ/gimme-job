// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runRegression } from '../regression-run.js';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { force: true, recursive: true });
  }
});

describe('runRegression (integration)', () => {
  it('writes a dated report for a clean fixture run', async () => {
    const reportDir = await makeTempDir();
    const result = await runRegression({
      baselinePath: null,
      families: ['greenhouse'],
      now: new Date('2026-04-23T00:00:00.000Z'),
      reportDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.reportPath).toBe(path.join(reportDir, 'regression-2026-04-23.md'));
    expect(result.markdown).toContain('Status: PASS');
    expect(result.markdown).toContain('greenhouse');
    expect(result.results[0].passRate).toBe(100);
  });

  it('returns exit code 1 when the current fixture drops more than 5pp from baseline', async () => {
    const root = await makeTempDir();
    const reportDir = path.join(root, 'reports');
    const fixturesRoot = path.join(root, 'fixtures');
    await mkdir(reportDir, { recursive: true });
    await writeFile(
      path.join(reportDir, 'regression-2026-04-22.md'),
      '<!-- p7.3-regression-summary: {"greenhouse":100} -->\n',
      'utf8',
    );
    await writeBrokenGreenhouseFixture(fixturesRoot);

    const result = await runRegression({
      families: ['greenhouse'],
      fixturesRoot,
      now: new Date('2026-04-23T00:00:00.000Z'),
      reportDir,
    });

    expect(result.exitCode).toBe(1);
    expect(result.results[0].passRate).toBeLessThan(95);
    expect(result.comparisons[0].regressed).toBe(true);
    expect(result.markdown).toContain('Status: FAIL');
  });
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p7-3-regression-'));
  tempDirs.push(dir);
  return dir;
}

async function writeBrokenGreenhouseFixture(fixturesRoot: string): Promise<void> {
  const familyRoot = path.join(fixturesRoot, 'greenhouse');
  await mkdir(familyRoot, { recursive: true });
  await writeFile(
    path.join(familyRoot, 'fixture.json'),
    JSON.stringify(
      {
        company: 'Fixture Co',
        confirmationPath: '/fixtures/greenhouse/confirmation',
        confirmationPhrase: 'Application submitted!',
        family: 'greenhouse',
        fields: {
          email: { required: true, selector: '#email' },
          first_name: { required: true, selector: '#first_name' },
        },
        role: 'Broken Fixture',
        steps: [{ label: 'Contact', sectionId: 'section_contact' }],
        submitPath: '/fixtures/greenhouse/submit',
        submitSelector: '#submit_app',
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    path.join(familyRoot, 'application.html'),
    `<!doctype html>
<html>
  <body>
    <form action="/fixtures/greenhouse/submit">
      <input id="first_name" name="first_name" />
      <button id="submit_app" type="submit">Submit</button>
    </form>
  </body>
</html>`,
    'utf8',
  );
  await writeFile(
    path.join(familyRoot, 'confirmation.html'),
    '<html><body>Application submitted! <span data-field="reference"></span></body></html>',
    'utf8',
  );
}
