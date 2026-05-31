export const DESKTOP_SIDEBAR_WIDTH = 320;
export const DESKTOP_ASSIST_WIDTH = 520;
export const DESKTOP_VIEW_GAP = 8;
export function calculateDesktopLayout(size) {
    const height = Math.max(0, size.height);
    const width = Math.max(DESKTOP_SIDEBAR_WIDTH, size.width);
    const availableWidth = Math.max(0, width - DESKTOP_SIDEBAR_WIDTH);
    const assistWidth = Math.min(DESKTOP_ASSIST_WIDTH, Math.max(0, Math.floor(availableWidth * 0.42)));
    const mainWidth = Math.max(0, availableWidth - assistWidth - DESKTOP_VIEW_GAP);
    return {
        assist: {
            height,
            width: assistWidth,
            x: DESKTOP_SIDEBAR_WIDTH + mainWidth + DESKTOP_VIEW_GAP,
            y: 0,
        },
        main: {
            height,
            width: mainWidth,
            x: DESKTOP_SIDEBAR_WIDTH,
            y: 0,
        },
        sidebar: {
            height,
            width: DESKTOP_SIDEBAR_WIDTH,
            x: 0,
            y: 0,
        },
    };
}
