'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function NotificationsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  
  // This would be replaced with actual notification count from your API
  const hasNewNotifications = false;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-8 w-8 rounded-full border border-border/40"
          aria-label="Open notifications"
        >
          <Bell className="h-4 w-4" />
          {hasNewNotifications && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[380px] p-4" 
        align="end"
        side="bottom"
        sideOffset={12}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Notifications</h2>
          </div>
          <div className="text-sm text-muted-foreground text-center py-8">
            No new notifications
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
