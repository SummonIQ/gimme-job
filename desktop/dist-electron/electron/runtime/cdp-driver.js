/**
 * Adapt the existing `DesktopCdpToolDriver` (P5.2/P5.3/P5.6) to the
 * shared `FlowDriver` contract used by `runFlow` (P7.5). The shared
 * executor only needs the subset of tools that perform step-level
 * actions; network/cookie/screenshot helpers stay on the larger driver
 * for AI tool-call use.
 */
export function createCdpFlowDriver(desktopDriver) {
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
