export const DESKTOP_TOOL_NAMES = [
  'navigate',
  'wait_for',
  'dom_snapshot',
  'read_element',
  'click',
  'fill',
  'select',
  'upload',
  'press_key',
  'scroll_into_view',
  'network_observe',
  'network_replay',
  'cookies_get',
  'cookies_set',
  'screenshot_region',
  'identity_load',
  'submit_guard',
] as const;

export type DesktopToolName = (typeof DESKTOP_TOOL_NAMES)[number];

export interface DesktopToolCallRequest {
  input?: unknown;
  tool: DesktopToolName;
}

export interface DesktopToolError {
  code: string;
  message: string;
}

export interface DesktopToolCallResult {
  data?: unknown;
  error?: DesktopToolError;
  ok: boolean;
  tool: DesktopToolName;
}

export interface NavigateInput {
  url: string;
}

export interface NavigateResult {
  url: string;
}

export interface WaitForInput {
  selector?: string;
  text?: string;
  timeoutMs: number;
}

export interface WaitForResult {
  matched: boolean;
  selector: string | null;
  text: string | null;
}

export interface DomSnapshotInput {}

export interface DomSnapshotResult {
  html: string;
  title: string;
  url: string;
  // Optional per-field viewport coordinates keyed by selector ('#id' or
  // '[name=name]'). Used to sort fill queues by visual top-to-bottom.
  positions?: Record<string, { top: number; left: number }>;
}

export interface ReadElementInput {
  selector: string;
}

export interface ReadElementResult {
  attributes: Record<string, string>;
  selector: string;
  tagName: string;
  text: string;
  value: string | null;
}

export interface ClickInput {
  selector: string;
}

export interface ClickResult {
  clicked: boolean;
  selector: string;
}

export interface FillInput {
  selector: string;
  value: string;
}

export interface FillResult {
  selector: string;
  value: string;
}

export interface SelectInput {
  selector: string;
  value: string;
}

export interface SelectResult {
  selector: string;
  value: string;
}

export interface UploadInput {
  filePath: string;
  selector: string;
}

export interface UploadResult {
  filePath: string;
  selector: string;
}

export interface PressKeyInput {
  key: string;
}

export interface PressKeyResult {
  key: string;
}

export interface ScrollIntoViewInput {
  selector: string;
}

export interface ScrollIntoViewResult {
  selector: string;
}

export interface NetworkObserveInput {
  enabled: boolean;
}

export interface NetworkObserveResult {
  enabled: boolean;
}

export interface NetworkReplayInput {
  body?: string;
  headers: Record<string, string>;
  method: string;
  url: string;
}

export interface NetworkReplayResult {
  body: string;
  headers: Record<string, string>;
  status: number;
  url: string;
}

export interface CookiesGetInput {
  url?: string;
}

export interface DesktopCookie {
  domain?: string;
  expirationDate?: number;
  httpOnly?: boolean;
  name: string;
  path?: string;
  secure?: boolean;
  url?: string;
  value: string;
}

export interface CookiesGetResult {
  cookies: DesktopCookie[];
}

export interface CookiesSetInput {
  cookies: DesktopCookie[];
}

export interface CookiesSetResult {
  count: number;
}

export interface ScreenshotRegionInput {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ScreenshotRegionResult {
  dataUrl: string;
  height: number;
  width: number;
}

export interface IdentityLoadInput {
  key: string;
}

export interface IdentityLoadResult {
  key: string;
  value: string;
}

export interface SubmitGuardInput {
  enabled?: boolean;
}

export interface SubmitGuardResult {
  enabled: boolean;
}

export interface DesktopCdpToolDriver {
  click: (input: ClickInput) => Promise<ClickResult>;
  cookiesGet: (input: CookiesGetInput) => Promise<CookiesGetResult>;
  cookiesSet: (input: CookiesSetInput) => Promise<CookiesSetResult>;
  domSnapshot: (input: DomSnapshotInput) => Promise<DomSnapshotResult>;
  fill: (input: FillInput) => Promise<FillResult>;
  identityLoad: (input: IdentityLoadInput) => Promise<IdentityLoadResult>;
  navigate: (input: NavigateInput) => Promise<NavigateResult>;
  networkObserve: (input: NetworkObserveInput) => Promise<NetworkObserveResult>;
  networkReplay: (input: NetworkReplayInput) => Promise<NetworkReplayResult>;
  pressKey: (input: PressKeyInput) => Promise<PressKeyResult>;
  readElement: (input: ReadElementInput) => Promise<ReadElementResult>;
  screenshotRegion: (
    input: ScreenshotRegionInput,
  ) => Promise<ScreenshotRegionResult>;
  scrollIntoView: (input: ScrollIntoViewInput) => Promise<ScrollIntoViewResult>;
  select: (input: SelectInput) => Promise<SelectResult>;
  submitGuard: (input: SubmitGuardInput) => Promise<SubmitGuardResult>;
  upload: (input: UploadInput) => Promise<UploadResult>;
  waitFor: (input: WaitForInput) => Promise<WaitForResult>;
}
