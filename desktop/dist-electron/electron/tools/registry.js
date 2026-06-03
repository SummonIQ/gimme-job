import { click } from './click.js';
import { cookies_get } from './cookies-get.js';
import { cookies_set } from './cookies-set.js';
import { dom_snapshot } from './dom-snapshot.js';
import { fill } from './fill.js';
import { identity_load } from './identity-load.js';
import { navigate } from './navigate.js';
import { network_observe } from './network-observe.js';
import { network_replay } from './network-replay.js';
import { press_key } from './press-key.js';
import { read_element } from './read-element.js';
import { screenshot_region } from './screenshot-region.js';
import { scroll_into_view } from './scroll-into-view.js';
import { select } from './select.js';
import { submit_guard } from './submit-guard.js';
import { DESKTOP_TOOL_NAMES, } from './types.js';
import { upload } from './upload.js';
import { parseClickInput, parseCookiesGetInput, parseCookiesSetInput, parseDomSnapshotInput, parseFillInput, parseIdentityLoadInput, parseNavigateInput, parseNetworkObserveInput, parseNetworkReplayInput, parsePressKeyInput, parseReadElementInput, parseScreenshotRegionInput, parseScrollIntoViewInput, parseSelectInput, parseSubmitGuardInput, parseUploadInput, parseWaitForInput, } from './validation.js';
import { wait_for } from './wait-for.js';
const TOOL_HANDLERS = {
    click: (driver, input) => click(driver, parseClickInput(input)),
    cookies_get: (driver, input) => cookies_get(driver, parseCookiesGetInput(input)),
    cookies_set: (driver, input) => cookies_set(driver, parseCookiesSetInput(input)),
    dom_snapshot: (driver, input) => dom_snapshot(driver, parseDomSnapshotInput(input)),
    fill: (driver, input) => fill(driver, parseFillInput(input)),
    identity_load: (driver, input) => identity_load(driver, parseIdentityLoadInput(input)),
    navigate: (driver, input) => navigate(driver, parseNavigateInput(input)),
    network_observe: (driver, input) => network_observe(driver, parseNetworkObserveInput(input)),
    network_replay: (driver, input) => network_replay(driver, parseNetworkReplayInput(input)),
    press_key: (driver, input) => press_key(driver, parsePressKeyInput(input)),
    read_element: (driver, input) => read_element(driver, parseReadElementInput(input)),
    screenshot_region: (driver, input) => screenshot_region(driver, parseScreenshotRegionInput(input)),
    scroll_into_view: (driver, input) => scroll_into_view(driver, parseScrollIntoViewInput(input)),
    select: (driver, input) => select(driver, parseSelectInput(input)),
    submit_guard: (driver, input) => submit_guard(driver, parseSubmitGuardInput(input)),
    upload: (driver, input) => upload(driver, parseUploadInput(input)),
    wait_for: (driver, input) => wait_for(driver, parseWaitForInput(input)),
};
export function createDesktopToolRegistry(driver) {
    return {
        async call(request) {
            if (!isDesktopToolName(request.tool)) {
                return {
                    error: {
                        code: 'UNKNOWN_TOOL',
                        message: `Unknown desktop tool: ${String(request.tool)}`,
                    },
                    ok: false,
                    tool: request.tool,
                };
            }
            try {
                return {
                    data: await TOOL_HANDLERS[request.tool](driver, request.input ?? {}),
                    ok: true,
                    tool: request.tool,
                };
            }
            catch (error) {
                return {
                    error: {
                        code: 'TOOL_ERROR',
                        message: error instanceof Error ? error.message : 'Desktop tool failed.',
                    },
                    ok: false,
                    tool: request.tool,
                };
            }
        },
        listTools() {
            return [...DESKTOP_TOOL_NAMES];
        },
    };
}
function isDesktopToolName(value) {
    return DESKTOP_TOOL_NAMES.includes(value);
}
