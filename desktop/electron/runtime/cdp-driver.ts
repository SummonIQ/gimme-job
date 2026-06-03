import type {
  ClickInput,
  ClickResult,
  DesktopCdpToolDriver,
  FillInput,
  FillResult,
  NavigateInput,
  NavigateResult,
  PressKeyInput,
  PressKeyResult,
  ReadElementInput,
  ReadElementResult,
  ScrollIntoViewInput,
  ScrollIntoViewResult,
  SelectInput,
  SelectResult,
  UploadInput,
  UploadResult,
  WaitForInput,
  WaitForResult,
} from '../tools/types.js';

/**
 * Structural `FlowDriver` contract mirrored from
 * `lib/applications/flow-executor/types.ts`. Re-declared here so the
 * desktop package stays self-contained at `tsc` build time while still
 * producing an object that is assignment-compatible with the shared
 * executor's `FlowDriver` interface.
 *
 * Kept in lock-step with the shared definition - if one changes, both
 * must. Cross-driver parity tests catch drift.
 */
export interface CdpFlowDriver {
  navigate(input: NavigateInput): Promise<NavigateResult>;
  waitFor(input: WaitForInput): Promise<WaitForResult>;
  click(input: ClickInput): Promise<ClickResult>;
  fill(input: FillInput): Promise<FillResult>;
  select(input: SelectInput): Promise<SelectResult>;
  upload(input: UploadInput): Promise<UploadResult>;
  scrollIntoView(input: ScrollIntoViewInput): Promise<ScrollIntoViewResult>;
  readElement(input: ReadElementInput): Promise<ReadElementResult>;
  pressKey(input: PressKeyInput): Promise<PressKeyResult>;
}

/**
 * Adapt the existing `DesktopCdpToolDriver` (P5.2/P5.3/P5.6) to the
 * shared `FlowDriver` contract used by `runFlow` (P7.5). The shared
 * executor only needs the subset of tools that perform step-level
 * actions; network/cookie/screenshot helpers stay on the larger driver
 * for AI tool-call use.
 */
export function createCdpFlowDriver(
  desktopDriver: DesktopCdpToolDriver,
): CdpFlowDriver {
  return {
    navigate: input => desktopDriver.navigate(input),
    waitFor: input => desktopDriver.waitFor(input),
    click: input => desktopDriver.click(input),
    fill: input => desktopDriver.fill(input),
    select: input => desktopDriver.select(input),
    upload: input => desktopDriver.upload(input),
    scrollIntoView: input => desktopDriver.scrollIntoView(input),
    readElement: input => desktopDriver.readElement(input),
    pressKey: input => desktopDriver.pressKey(input),
  };
}
