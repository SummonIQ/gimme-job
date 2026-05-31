'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShareResourceDialog } from '@/components/sharing/share-resource-dialog';
import { ShareableResourceType } from '@/lib/sharing/types';
import { Share2 } from 'lucide-react';

interface ShareJobLeadButtonProps {
  jobLeadId: string;
  jobTitle: string;
}

export function ShareJobLeadButton({ jobLeadId, jobTitle }: ShareJobLeadButtonProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShareDialogOpen(true)}
      >
        <Share2 className="h-4 w-4 mr-2" />
        Share
      </Button>
      
      <ShareResourceDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        resourceId={jobLeadId}
        resourceType={ShareableResourceType.JOB_LEAD}
        resourceName={jobTitle}
      />
    </>
  );
}
