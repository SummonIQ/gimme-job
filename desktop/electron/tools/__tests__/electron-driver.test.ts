import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { createElectronCdpToolDriver } from '../electron-driver';

describe('electron cdp tool driver', () => {
  it('times out cleanly when wait_for text runs before document.body exists', async () => {
    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => {
            const document = {
              body: null,
              querySelector: () => null,
            };

            return vm.runInNewContext(script, { document });
          },
        }) as never,
    });

    await expect(
      driver.waitFor({ text: 'hello', timeoutMs: 50 }),
    ).rejects.toThrow('wait_for timed out.');
  });

  it('surfaces the underlying page error instead of a generic executeJavaScript failure', async () => {
    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => {
            const document = {
              querySelector: () => null,
            };

            return vm.runInNewContext(script, { document, Error, eval });
          },
          getURL: () => 'https://job-boards.greenhouse.io/example/jobs/123',
        }) as never,
    });

    await expect(
      driver.fill({ selector: '#first_name', value: 'Steven' }),
    ).rejects.toThrow('Fill target not found: #first_name');
  });

  it('fills the visible interactive field instead of a hidden duplicate match', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <input name="first_name" type="hidden" value="" />
            <input id="visible-first-name" name="first_name" type="text" value="" />
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
    );

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://job-boards.greenhouse.io/example/jobs/123',
        }) as never,
    });

    await driver.fill({
      selector: 'input[name="first_name"]',
      value: 'Steven',
    });

    expect(
      (
        dom.window.document.querySelector(
          'input[type="hidden"]',
        ) as HTMLInputElement
      ).value,
    ).toBe('');
    expect(
      (
        dom.window.document.querySelector(
          '#visible-first-name',
        ) as HTMLInputElement
      ).value,
    ).toBe('Steven');
  });

  it('selects options by visible text and boolean-like fallbacks when raw values differ', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <select id="country">
              <option value="">Select...</option>
              <option value="US">United States</option>
            </select>
            <select id="authorized">
              <option value="">Select...</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
    );

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://job-boards.greenhouse.io/example/jobs/123',
        }) as never,
    });

    await driver.select({ selector: '#country', value: 'United States' });
    await driver.select({ selector: '#authorized', value: 'yes' });

    expect(
      (dom.window.document.querySelector('#country') as HTMLSelectElement)
        .value,
    ).toBe('US');
    expect(
      (dom.window.document.querySelector('#authorized') as HTMLSelectElement)
        .value,
    ).toBe('1');
  });

  it('selects custom combobox options by visible text', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <button id="gender" role="combobox">Select...</button>
            <div role="option" data-value="male">Male</div>
            <div role="option" data-value="female">Female</div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://jobs.ashbyhq.com/example/application',
      },
    );
    let selected = '';
    dom.window.document
      .querySelector('[data-value="male"]')
      ?.addEventListener('click', event => {
        selected = (event.currentTarget as HTMLElement).dataset.value ?? '';
      });

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://jobs.ashbyhq.com/example/application',
        }) as never,
    });

    await driver.select({ selector: 'button[id="gender"]', value: 'Male' });

    expect(selected).toBe('male');
  });

  it('waits for React-style combobox options to render after opening', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <div class="select__control">
              <input id="authorized" role="combobox" />
            </div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
    );
    let selected = '';
    dom.window.document
      .querySelector('.select__control')
      ?.addEventListener('mousedown', () => {
        const option = dom.window.document.createElement('div');
        option.setAttribute('role', 'option');
        option.dataset.value = '1';
        option.textContent = 'Yes';
        option.addEventListener('click', event => {
          selected = (event.currentTarget as HTMLElement).dataset.value ?? '';
        });
        dom.window.document.body.append(option);
      });

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://job-boards.greenhouse.io/example/jobs/123',
        }) as never,
    });

    await driver.select({ selector: 'input[id="authorized"]', value: 'yes' });

    expect(selected).toBe('1');
  });

  it('clicks the React-Select control ancestor when touching a combobox input', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <div class="select__control">
              <input id="race" role="combobox" />
            </div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
      },
    );
    const events: string[] = [];
    dom.window.document
      .querySelector('.select__control')
      ?.addEventListener('mousedown', event => {
        events.push((event.currentTarget as HTMLElement).className.toString());
      });

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () =>
            'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
        }) as never,
    });

    await driver.click({ selector: 'input[id="race"]' });

    expect(events).toEqual(['select__control']);
    expect(dom.window.document.activeElement?.id).toBe('race');
  });

  it('uses Chromium mouse events to commit React-Select custom options when available', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <div class="select__control">
              <input id="race" role="combobox" />
            </div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
      },
    );
    const control = dom.window.document.querySelector(
      '.select__control',
    ) as HTMLElement;
    control.getBoundingClientRect = () =>
      ({
        bottom: 130,
        height: 40,
        left: 20,
        right: 220,
        top: 90,
        width: 200,
        x: 20,
        y: 90,
        toJSON: () => ({}),
      }) as DOMRect;
    const commands: Array<{ command: string; params: unknown }> = [];
    let attached = false;
    let selected = '';

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          debugger: {
            attach: () => {
              attached = true;
            },
            detach: () => {
              attached = false;
            },
            isAttached: () => attached,
            sendCommand: async (command: string, params: unknown) => {
              commands.push({ command, params });
              const point = params as { type?: string; x?: number; y?: number };
              if (
                command === 'Input.dispatchMouseEvent' &&
                point.type === 'mouseReleased' &&
                point.x === 120 &&
                point.y === 110 &&
                !dom.window.document.querySelector('[role="option"]')
              ) {
                const option = dom.window.document.createElement('div');
                option.setAttribute('role', 'option');
                option.textContent = 'White';
                option.getBoundingClientRect = () =>
                  ({
                    bottom: 180,
                    height: 32,
                    left: 20,
                    right: 220,
                    top: 148,
                    width: 200,
                    x: 20,
                    y: 148,
                    toJSON: () => ({}),
                  }) as DOMRect;
                dom.window.document.body.append(option);
              }
              if (
                command === 'Input.dispatchMouseEvent' &&
                point.type === 'mouseReleased' &&
                point.x === 120 &&
                point.y === 164
              ) {
                selected = 'White';
              }
              return {};
            },
          },
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () =>
            'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
        }) as never,
    });

    await driver.select({ selector: 'input[id="race"]', value: 'White' });

    expect(selected).toBe('White');
    expect(
      commands.filter(c => c.command === 'Input.dispatchMouseEvent'),
    ).toHaveLength(4);
  });

  it('does not pick "Female" when the requested gender is "Male" (custom combobox)', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <input id="gender" role="combobox" />
            <div role="option" data-value="female">Female</div>
            <div role="option" data-value="male">Male</div>
            <div role="option" data-value="non-binary">Non-binary</div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
    );
    const clicks: string[] = [];
    for (const node of dom.window.document.querySelectorAll(
      '[role="option"]',
    )) {
      node.addEventListener('click', event => {
        clicks.push((event.currentTarget as HTMLElement).dataset.value ?? '');
      });
    }

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://job-boards.greenhouse.io/example/jobs/123',
        }) as never,
    });

    await driver.select({ selector: 'input[id="gender"]', value: 'Male' });

    expect(clicks).toEqual(['male']);
  });

  it('does not pick "Female" when the requested gender is "Male" (native select)', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <select id="gender">
              <option value="">Select...</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
    );

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://job-boards.greenhouse.io/example/jobs/123',
        }) as never,
    });

    await driver.select({ selector: '#gender', value: 'Male' });

    expect(
      (dom.window.document.querySelector('#gender') as HTMLSelectElement).value,
    ).toBe('male');
  });

  it('selects custom combobox boolean options', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <button id="authorized" role="combobox">Select...</button>
            <div role="option" data-value="authorized">Authorized to work in the US</div>
            <div role="option" data-value="not_authorized">Not authorized to work in the US</div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://jobs.ashbyhq.com/example/application',
      },
    );
    let selected = '';
    dom.window.document
      .querySelector('[data-value="authorized"]')
      ?.addEventListener('click', event => {
        selected = (event.currentTarget as HTMLElement).dataset.value ?? '';
      });

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://jobs.ashbyhq.com/example/application',
        }) as never,
    });

    await driver.select({ selector: 'button[id="authorized"]', value: 'yes' });

    expect(selected).toBe('authorized');
  });

  it('sets file input files through Chromium debugger when uploading', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <input id="resume" name="resume" type="file" />
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
    );
    const commands: Array<{ command: string; params: unknown }> = [];
    let attached = false;

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          debugger: {
            attach: () => {
              attached = true;
            },
            detach: () => {
              attached = false;
            },
            isAttached: () => attached,
            sendCommand: async (command: string, params: unknown) => {
              commands.push({ command, params });
              if (command === 'DOM.getDocument') {
                return { root: { nodeId: 1 } };
              }
              if (command === 'DOM.querySelector') {
                return { nodeId: 2 };
              }
              if (command === 'DOM.describeNode') {
                return {
                  node: {
                    attributes: ['id', 'resume', 'name', 'resume', 'type', 'file'],
                    nodeName: 'INPUT',
                  },
                };
              }
              if (command === 'DOM.setFileInputFiles') {
                const input = dom.window.document.querySelector(
                  '#resume',
                ) as HTMLInputElement;
                Object.defineProperty(input, 'files', {
                  configurable: true,
                  value: [{ name: 'resume.pdf' }],
                });
              }
              return {};
            },
          },
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://job-boards.greenhouse.io/example/jobs/123',
        }) as never,
    });

    await driver.upload({ filePath: '/tmp/resume.pdf', selector: '#resume' });

    expect(commands).toContainEqual({
      command: 'DOM.setFileInputFiles',
      params: { files: ['/tmp/resume.pdf'], nodeId: 2 },
    });
    expect(
      (dom.window.document.querySelector('#resume') as HTMLInputElement).dataset
        .uploadPath,
    ).toBe('/tmp/resume.pdf');
  });

  it('uploads the resume on Greenhouse boards via CDP file chooser interception (trusted click + DOM.setFileInputFiles by nodeId)', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <div style="position: absolute; left: 50px; top: 100px; width: 200px; height: 40px;">
              <button type="button" style="width: 200px; height: 40px;">Attach</button>
              <label for="resume">Attach</label>
              <input id="resume" type="file" />
            </div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
      },
    );
    const attachButton = dom.window.document.querySelector(
      'button',
    ) as HTMLElement;
    attachButton.getBoundingClientRect = () =>
      ({
        bottom: 140,
        height: 40,
        left: 50,
        right: 250,
        top: 100,
        width: 200,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    const commands: Array<{ command: string; params?: unknown }> = [];
    let attached = false;

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          debugger: {
            attach: () => {
              attached = true;
            },
            detach: () => {
              attached = false;
            },
            isAttached: () => attached,
            sendCommand: async (command: string, params: unknown) => {
              commands.push({ command, params });
              if (command === 'DOM.getDocument') {
                return { root: { nodeId: 1 } };
              }
              if (command === 'DOM.querySelector') {
                return { nodeId: 2 };
              }
              if (command === 'DOM.setFileInputFiles') {
                const resumeInput = dom.window.document.querySelector(
                  '#resume',
                ) as HTMLInputElement;
                Object.defineProperty(resumeInput, 'files', {
                  configurable: true,
                  value: [{ name: 'resume.pdf' }],
                });
              }
              return {};
            },
          },
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () =>
            'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
        }) as never,
    });

    await driver.upload({ filePath: '/tmp/resume.pdf', selector: '#resume' });

    expect(
      commands.find(
        c =>
          c.command === 'Page.setInterceptFileChooserDialog' &&
          (c.params as { enabled?: boolean }).enabled === true,
      ),
    ).toBeDefined();
    expect(
      commands.filter(
        c =>
          c.command === 'Input.dispatchMouseEvent' &&
          ['mousePressed', 'mouseReleased'].includes(
            (c.params as { type?: string }).type ?? '',
          ),
      ).length,
    ).toBe(2);
    const setFiles = commands.find(c => c.command === 'DOM.setFileInputFiles');
    expect(setFiles?.params).toMatchObject({
      files: ['/tmp/resume.pdf'],
      nodeId: 2,
    });
    expect(
      commands.find(
        c =>
          c.command === 'Page.setInterceptFileChooserDialog' &&
          (c.params as { enabled?: boolean }).enabled === false,
      ),
    ).toBeDefined();
  });

  it('accepts a Greenhouse upload when the file input remounts with the attached file', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <div>
              <button type="button">Attach</button>
              <label for="resume">Attach</label>
              <input id="resume" type="file" />
            </div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
      },
    );
    const attachButton = dom.window.document.querySelector(
      'button',
    ) as HTMLElement;
    attachButton.getBoundingClientRect = () =>
      ({
        bottom: 140,
        height: 40,
        left: 50,
        right: 250,
        top: 100,
        width: 200,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    const commands: Array<{ command: string; params?: unknown }> = [];
    let attached = false;

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          debugger: {
            attach: () => {
              attached = true;
            },
            detach: () => {
              attached = false;
            },
            isAttached: () => attached,
            sendCommand: async (command: string, params: unknown) => {
              commands.push({ command, params });
              if (command === 'DOM.getDocument') {
                return { root: { nodeId: 1 } };
              }
              if (command === 'DOM.querySelector') {
                return { nodeId: 2 };
              }
              if (command === 'DOM.setFileInputFiles') {
                dom.window.document.querySelector('#resume')?.remove();
                const remounted = dom.window.document.createElement('input');
                remounted.id = 'candidate_resume';
                remounted.name = 'candidate_resume';
                remounted.type = 'file';
                remounted.getBoundingClientRect = () =>
                  ({
                    bottom: 20,
                    height: 20,
                    left: 0,
                    right: 120,
                    top: 0,
                    width: 120,
                    x: 0,
                    y: 0,
                    toJSON: () => ({}),
                  }) as DOMRect;
                Object.defineProperty(remounted, 'files', {
                  configurable: true,
                  value: [{ name: 'resume.pdf' }],
                });
                dom.window.document.body.append(remounted);
              }
              return {};
            },
          },
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () =>
            'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
        }) as never,
    });

    await expect(
      driver.upload({ filePath: '/tmp/resume.pdf', selector: '#resume' }),
    ).resolves.toEqual({
      filePath: '/tmp/resume.pdf',
      selector: '#resume',
    });
    expect(
      commands.filter(command => command.command === 'DOM.setFileInputFiles'),
    ).toHaveLength(1);
  });

  it('accepts a Greenhouse upload when the attached resume indicator shows the filename', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <div>
              <button type="button">Attach</button>
              <label for="resume">Attach</label>
              <input id="resume" type="file" />
            </div>
          </body>
        </html>
      `,
      {
        runScripts: 'outside-only',
        url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
      },
    );
    const attachButton = dom.window.document.querySelector(
      'button',
    ) as HTMLElement;
    attachButton.getBoundingClientRect = () =>
      ({
        bottom: 140,
        height: 40,
        left: 50,
        right: 250,
        top: 100,
        width: 200,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    const commands: Array<{ command: string; params?: unknown }> = [];
    let attached = false;

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          debugger: {
            attach: () => {
              attached = true;
            },
            detach: () => {
              attached = false;
            },
            isAttached: () => attached,
            sendCommand: async (command: string, params: unknown) => {
              commands.push({ command, params });
              if (command === 'DOM.getDocument') {
                return { root: { nodeId: 1 } };
              }
              if (command === 'DOM.querySelector') {
                return { nodeId: 2 };
              }
              if (command === 'DOM.setFileInputFiles') {
                dom.window.document.querySelector('#resume')?.remove();
                const indicator = dom.window.document.createElement('div');
                indicator.setAttribute('data-source', 'resume');
                indicator.textContent = 'resume.pdf';
                dom.window.document.body.append(indicator);
              }
              return {};
            },
          },
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () =>
            'https://job-boards.greenhouse.io/zetaglobal/jobs/5836933004',
        }) as never,
    });

    await expect(
      driver.upload({ filePath: '/tmp/resume.pdf', selector: '#resume' }),
    ).resolves.toEqual({
      filePath: '/tmp/resume.pdf',
      selector: '#resume',
    });
    expect(
      commands.filter(command => command.command === 'DOM.setFileInputFiles'),
    ).toHaveLength(1);
  });

  it('does not fail upload when the page change listener throws after file attach', async () => {
    const dom = new JSDOM(
      `
        <!doctype html>
        <html>
          <body>
            <input id="resume" name="resume" type="file" />
            <script>
              document.querySelector('#resume').addEventListener('change', () => {
                throw new TypeError("Cannot read properties of undefined (reading 'uploadFile')");
              });
            </script>
          </body>
        </html>
      `,
      {
        runScripts: 'dangerously',
        url: 'https://jobs.ashbyhq.com/example/application',
      },
    );
    let attached = false;

    const driver = createElectronCdpToolDriver({
      getWebContents: () =>
        ({
          debugger: {
            attach: () => {
              attached = true;
            },
            detach: () => {
              attached = false;
            },
            isAttached: () => attached,
            sendCommand: async (command: string) => {
              if (command === 'DOM.getDocument') {
                return { root: { nodeId: 1 } };
              }
              if (command === 'DOM.querySelector') {
                return { nodeId: 2 };
              }
              if (command === 'DOM.describeNode') {
                return {
                  node: {
                    attributes: ['id', 'resume', 'type', 'file'],
                    nodeName: 'INPUT',
                  },
                };
              }
              if (command === 'DOM.setFileInputFiles') {
                const input = dom.window.document.querySelector(
                  '#resume',
                ) as HTMLInputElement;
                Object.defineProperty(input, 'files', {
                  configurable: true,
                  value: [{ name: 'resume.pdf' }],
                });
              }
              return {};
            },
          },
          executeJavaScript: async (script: string) => dom.window.eval(script),
          getURL: () => 'https://jobs.ashbyhq.com/example/application',
        }) as never,
    });

    await expect(
      driver.upload({ filePath: '/tmp/resume.pdf', selector: '#resume' }),
    ).resolves.toEqual({
      filePath: '/tmp/resume.pdf',
      selector: '#resume',
    });
  });
});
