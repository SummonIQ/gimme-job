import { Globe, Plus, X } from 'lucide-react';
import { useState, type DragEvent, type KeyboardEvent } from 'react';

export type DesktopTabKind = 'working' | 'review' | 'failed' | 'custom';

export interface DesktopTab {
  readonly id: string;
  readonly title: string;
  readonly kind: DesktopTabKind;
  /** Working tab is always-on; others can be closed. */
  readonly closable: boolean;
  /**
   * BrowserView URL this tab is bound to. Empty string means the tab
   * has no destination yet — switching to it leaves the BrowserView
   * untouched.
   */
  readonly url: string;
}

interface DesktopTabBarProps {
  readonly tabs: readonly DesktopTab[];
  readonly activeTabId: string;
  readonly onSelectTab: (id: string) => void;
  readonly onCloseTab: (id: string) => void;
  readonly onCreateTab: () => void;
  readonly onReorderTabs: (nextIds: readonly string[]) => void;
}

const TAB_DRAG_MIME = 'application/x-desktop-tab-id';

export function DesktopTabBar(props: DesktopTabBarProps) {
  const {
    tabs,
    activeTabId,
    onSelectTab,
    onCloseTab,
    onCreateTab,
    onReorderTabs,
  } = props;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  function handleDragStart(event: DragEvent<HTMLDivElement>, id: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(TAB_DRAG_MIME, id);
    setDraggingId(id);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, id: string) {
    if (!event.dataTransfer.types.includes(TAB_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(id);
  }

  function handleDragLeave(id: string) {
    setDropTargetId(current => (current === id ? null : current));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, dropId: string) {
    const sourceId = event.dataTransfer.getData(TAB_DRAG_MIME);
    setDraggingId(null);
    setDropTargetId(null);
    if (!sourceId || sourceId === dropId) return;
    const ids = tabs.map(tab => tab.id);
    const fromIndex = ids.indexOf(sourceId);
    const toIndex = ids.indexOf(dropId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...ids];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, sourceId);
    onReorderTabs(next);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectTab(id);
    }
  }

  return (
    <div className="desktop-tab-bar" role="tablist" aria-label="Application tabs">
      <div className="desktop-tab-bar-strip">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isDragging = tab.id === draggingId;
          const isDropTarget =
            tab.id === dropTargetId && draggingId !== null && tab.id !== draggingId;
          const classes = ['desktop-tab'];
          if (isActive) classes.push('desktop-tab--active');
          if (isDragging) classes.push('desktop-tab--dragging');
          if (isDropTarget) classes.push('desktop-tab--drop-target');
          if (!tab.closable) classes.push('desktop-tab--pinned');
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              draggable
              onClick={() => onSelectTab(tab.id)}
              onDragStart={event => handleDragStart(event, tab.id)}
              onDragOver={event => handleDragOver(event, tab.id)}
              onDragLeave={() => handleDragLeave(tab.id)}
              onDrop={event => handleDrop(event, tab.id)}
              onDragEnd={handleDragEnd}
              onKeyDown={event => handleKeyDown(event, tab.id)}
              className={classes.join(' ')}
              data-kind={tab.kind}
              title={tab.title}
            >
              <Globe className="desktop-tab-icon" aria-hidden />
              <span className="desktop-tab-title">{tab.title}</span>
              {tab.closable ? (
                <button
                  type="button"
                  className="desktop-tab-close"
                  aria-label={`Close ${tab.title}`}
                  onClick={event => {
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  onMouseDown={event => event.stopPropagation()}
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          className="desktop-tab-add"
          aria-label="Open new tab"
          title="Open new tab"
          onClick={() => onCreateTab()}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
