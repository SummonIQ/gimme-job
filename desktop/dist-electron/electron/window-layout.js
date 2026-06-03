export const DESKTOP_RESIZE_HANDLE_WIDTH = 6;
// Reserve vertical space at the top and bottom of the window for the renderer
// toolbar, browser bar, tab bar, and status bar so the native BrowserViews
// don't paint over them. Keep these in sync with `.desktop-toolbar`,
// `.desktop-browser-bar`, `.desktop-tab-bar`, and `.desktop-status-bar` in
// renderer/styles.css.
//
// The browser bar and tab bar live ONLY above the right-hand `assist`
// browserview (Steven's complaint with a previous full-width layout was
// that they made the left sidebar awkwardly tall). The sidebar's chrome
// is just the top toolbar; the assist view's chrome is toolbar + browser
// bar + tab bar.
// Each value is the rendered height (CSS height + border-bottom + any
// sub-pixel slack from inner flex-end positioning). Under-reserving here
// makes the BrowserView clip the bottom of the chrome — Steven flagged the
// "Working" tab getting cut off when these were set tight to the box-model
// `height` value. Round up generously; a few extra px below the tab bar is
// invisible.
// Top app-header row added in renderer/components/desktop-app-header.tsx —
// the gimmejob wordmark + Training/Scraper nav. Lives above the toolbar.
export const DESKTOP_APP_HEADER_HEIGHT = 54;
export const DESKTOP_TOOLBAR_HEIGHT = 48;
export const DESKTOP_BROWSER_BAR_HEIGHT = 40;
export const DESKTOP_TAB_BAR_HEIGHT = 34;
export const DESKTOP_STATUS_BAR_HEIGHT = 40;
export const DEFAULT_DESKTOP_PANEL_SIZES = {
    assist: 60,
    main: 0,
    sidebar: 40,
};
export function createDesktopPanelSizesFromLayout(layout, currentPanelSizes = {}) {
    const [sidebar, assist] = layout;
    return {
        assist: roundPanelSize(getPositivePanelSize(assist, DEFAULT_DESKTOP_PANEL_SIZES.assist)),
        main: roundPanelSize(getPositivePanelSize(currentPanelSizes.main, DEFAULT_DESKTOP_PANEL_SIZES.main)),
        sidebar: roundPanelSize(getPositivePanelSize(sidebar, DEFAULT_DESKTOP_PANEL_SIZES.sidebar)),
    };
}
export function getDesktopPanelLayout(panelSizes = {}) {
    const normalizedPanelSizes = normalizeVisibleDesktopPanelSizes(panelSizes);
    return [normalizedPanelSizes.sidebar, normalizedPanelSizes.assist];
}
export function calculateDesktopLayout(size, panelSizes = DEFAULT_DESKTOP_PANEL_SIZES) {
    const height = Math.max(0, size.height);
    const width = Math.max(0, size.width);
    const sidebarHidden = !panelSizes.sidebar || panelSizes.sidebar <= 0;
    const handleWidth = sidebarHidden ? 0 : DESKTOP_RESIZE_HANDLE_WIDTH;
    const availableWidth = Math.max(0, width - handleWidth);
    let sidebarWidth = 0;
    if (!sidebarHidden) {
        const normalized = normalizeVisibleDesktopPanelSizes(panelSizes);
        sidebarWidth = Math.max(0, Math.round((availableWidth * normalized.sidebar) / 100));
    }
    const assistWidth = Math.max(0, width - sidebarWidth - handleWidth);
    const sidebarTopChrome = DESKTOP_APP_HEADER_HEIGHT;
    const assistTopChrome = DESKTOP_APP_HEADER_HEIGHT +
        DESKTOP_BROWSER_BAR_HEIGHT +
        DESKTOP_TAB_BAR_HEIGHT;
    const sidebarHeight = Math.max(0, height - sidebarTopChrome - DESKTOP_STATUS_BAR_HEIGHT);
    const assistHeight = Math.max(0, height - assistTopChrome - DESKTOP_STATUS_BAR_HEIGHT);
    return {
        assist: {
            height: assistHeight,
            width: assistWidth,
            x: sidebarWidth + handleWidth,
            y: assistTopChrome,
        },
        main: {
            height: 1,
            width: 1,
            x: -10_000,
            y: 0,
        },
        sidebar: {
            height: sidebarHeight,
            width: sidebarWidth,
            x: 0,
            y: sidebarTopChrome,
        },
    };
}
function normalizeDesktopPanelSizes(panelSizes) {
    const assist = getPositivePanelSize(panelSizes.assist, DEFAULT_DESKTOP_PANEL_SIZES.assist);
    const main = getPositivePanelSize(panelSizes.main, DEFAULT_DESKTOP_PANEL_SIZES.main);
    const sidebar = getPositivePanelSize(panelSizes.sidebar, DEFAULT_DESKTOP_PANEL_SIZES.sidebar);
    const total = assist + main + sidebar;
    return {
        assist: roundPanelSize((assist / total) * 100),
        main: roundPanelSize((main / total) * 100),
        sidebar: roundPanelSize((sidebar / total) * 100),
    };
}
function normalizeVisibleDesktopPanelSizes(panelSizes) {
    const assist = getPositivePanelSize(panelSizes.assist, DEFAULT_DESKTOP_PANEL_SIZES.assist);
    const sidebar = getPositivePanelSize(panelSizes.sidebar, DEFAULT_DESKTOP_PANEL_SIZES.sidebar);
    const total = assist + sidebar;
    return {
        assist: roundPanelSize((assist / total) * 100),
        sidebar: roundPanelSize((sidebar / total) * 100),
    };
}
function getPositivePanelSize(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return value;
}
function roundPanelSize(value) {
    return Number(value.toFixed(4));
}
