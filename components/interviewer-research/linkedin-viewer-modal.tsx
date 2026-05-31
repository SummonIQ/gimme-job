'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { ExternalLink, Info } from 'lucide-react';
import { useState } from 'react';

interface LinkedInViewerModalProps {
  linkedinUrls: Array<{ name: string; url: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkedInViewerModal({
  linkedinUrls,
  open,
  onOpenChange,
}: LinkedInViewerModalProps) {
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [showIframe, setShowIframe] = useState(false);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>LinkedIn Profile Viewer</ModalTitle>
          <ModalDescription>
            View LinkedIn profiles to gather additional information for your
            interview prep
          </ModalDescription>
        </ModalHeader>

        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            <strong>Note:</strong> LinkedIn profiles cannot be automatically
            scraped due to their anti-bot protections. You can view them here
            manually or open them in a new tab.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Found LinkedIn Profiles:</h4>
            <div className="space-y-2">
              {linkedinUrls.map((profile, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-border/50 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{profile.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.url}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUrl(profile.url);
                        setShowIframe(true);
                      }}
                    >
                      View Here
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a
                        href={profile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        Open <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showIframe && selectedUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Profile Preview</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowIframe(false);
                    setSelectedUrl(null);
                  }}
                >
                  Close Preview
                </Button>
              </div>
              <div className="border border-border/50 rounded-md overflow-hidden">
                <iframe
                  src={selectedUrl}
                  className="w-full h-[500px]"
                  title="LinkedIn Profile"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                If the profile doesn't load, LinkedIn may be blocking iframe
                embedding. Click "Open" to view it in a new tab with your
                logged-in session.
              </p>
            </div>
          )}
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">Tips for Better Research:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              Make sure you're logged into LinkedIn in this browser for best
              results
            </li>
            <li>Review their current role, past experience, and skills</li>
            <li>Look for shared connections or interests</li>
            <li>
              Check their recent posts and activity for conversation topics
            </li>
            <li>Note any publications, certifications, or achievements</li>
          </ul>
        </div>
      </ModalContent>
    </Modal>
  );
}
