import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Desktop notifications dropdown. Mirrors the web's
 * components/notifications/notifications-panel.tsx layout (Bell button
 * trigger, dropdown panel) but renders an empty state for now — the
 * notifications API (/api/notifications) is session-cookie-authed, not
 * desktop-token-authed, so wiring it requires a new /api/desktop/
 * endpoint that's out of scope for this pass.
 */
export const DesktopNotificationsPanel = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-md p-0"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          No notifications yet.
          <br />
          <span className="text-muted-foreground/70">
            Notifications wire up when /api/desktop/notifications lands.
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
DesktopNotificationsPanel.displayName = 'DesktopNotificationsPanel';
