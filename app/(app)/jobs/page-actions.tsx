'use client';

import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

export function JobsPageActions() {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="default"
        size="sm"
        className="gap-1.5 text-[0.9375rem] font-semibold active:scale-100"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('job-player:open'));
        }}
      >
        <Play className="size-3.5 fill-current" />
        Job Player
      </Button>
    </div>
  );
}
