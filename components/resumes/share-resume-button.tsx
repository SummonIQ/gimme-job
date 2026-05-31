'use client';

import { useState } from 'react';
import { ShareResourceDialog } from '@/components/sharing/share-resource-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ShareableResourceType } from '@/lib/sharing/types';
import { Share2 } from 'lucide-react';

interface ShareResumeButtonProps {
  resumeId: string;
  resumeName: string;
  variant?:
    | 'outline'
    | 'default'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ShareResumeButton({
  resumeId,
  resumeName,
  variant = 'outline',
  size = 'sm',
  className,
}: ShareResumeButtonProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={() => setShareDialogOpen(true)}
        className={className}
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>

      <ShareResourceDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        resourceId={resumeId}
        resourceType={ShareableResourceType.RESUME}
        resourceName={resumeName}
      />
    </>
  );
}

export function ShareResumeMenuItem({
  resumeId,
  resumeName,
}: Pick<ShareResumeButtonProps, 'resumeId' | 'resumeName'>) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenuItem
        className="gap-2 text-sm font-medium"
        onSelect={event => {
          event.preventDefault();
          setShareDialogOpen(true);
        }}
      >
        <Share2 className="size-4 text-current" />
        <span className="text-sm font-medium">Share</span>
      </DropdownMenuItem>

      <ShareResourceDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        resourceId={resumeId}
        resourceType={ShareableResourceType.RESUME}
        resourceName={resumeName}
      />
    </>
  );
}
