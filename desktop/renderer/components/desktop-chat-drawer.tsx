import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface DesktopChatDrawerProps {
  readonly children: ReactNode;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function DesktopChatDrawer({
  children,
  isOpen,
  onClose,
}: DesktopChatDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Agent chat"
      className="desktop-chat-drawer"
      ref={drawerRef}
      role="complementary"
    >
      <div className="desktop-chat-drawer-header">
        <span>Agent</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close agent chat"
          className="desktop-chat-drawer-close size-6"
          onClick={onClose}
          type="button"
        >
          ×
        </Button>
      </div>
      <div className="desktop-chat-drawer-body">{children}</div>
    </aside>
  );
}
