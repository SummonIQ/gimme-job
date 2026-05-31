'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import { ShareableResourceType, ShareAccessLevel } from '@/lib/sharing/types';
import { Copy, Link, Mail } from 'lucide-react';
import { useState } from 'react';

interface ShareResourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  resourceId: string;
  resourceType: ShareableResourceType;
  resourceName: string;
}

export function ShareResourceDialog({
  isOpen,
  onClose,
  resourceId,
  resourceType,
  resourceName,
}: ShareResourceDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>(
    ShareAccessLevel.VIEW,
  );
  const [expirationDays, setExpirationDays] = useState(7); // Default 7 days
  const [recipientEmail, setRecipientEmail] = useState('');
  const [allowFeedback, setAllowFeedback] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceId,
          resourceType,
          accessLevel,
          expirationDays,
          recipientEmail: recipientEmail || undefined,
          allowFeedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const data = await response.json();
      const shareToken = data.data.token;
      const url = `${window.location.origin}/shared/${shareToken}`;
      setShareUrl(url);

      if (recipientEmail) {
        toast({
          title: 'Shared successfully',
          description: `An invitation has been sent to ${recipientEmail}`,
        });
      } else {
        toast({
          title: 'Share link created',
          description: 'Copy the link to share with others',
        });
      }
    } catch (error) {
      console.error('Error sharing resource:', error);
      toast({
        title: 'Error',
        description: 'Failed to create share link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Copied to clipboard',
        description: 'Share link has been copied to your clipboard',
      });
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>
            Share{' '}
            {resourceType === ShareableResourceType.JOB_LEAD
              ? 'Job Lead'
              : 'Resume'}
          </ModalTitle>
          <ModalDescription>
            {shareUrl
              ? 'Share this link with others'
              : `Share "${resourceName}" with others`}
          </ModalDescription>
        </ModalHeader>

        {!shareUrl ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="access-level">Access Level</Label>
              <Select
                value={accessLevel}
                onValueChange={value =>
                  setAccessLevel(value as ShareAccessLevel)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="access-level">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ShareAccessLevel.VIEW}>
                    View only
                  </SelectItem>
                  <SelectItem value={ShareAccessLevel.COMMENT}>
                    Allow comments
                  </SelectItem>
                  <SelectItem value={ShareAccessLevel.EDIT}>
                    Allow editing
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration">Expire after</Label>
              <Select
                value={expirationDays.toString()}
                onValueChange={value => setExpirationDays(parseInt(value, 10))}
                disabled={isLoading}
              >
                <SelectTrigger id="expiration">
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">1 week</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="0">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-feedback"
                checked={allowFeedback}
                onCheckedChange={checked => setAllowFeedback(checked === true)}
                disabled={isLoading}
              />
              <label
                htmlFor="allow-feedback"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Allow feedback from viewers
              </label>
            </div>
          </div>
        ) : (
          <div className="py-6">
            <div className="flex items-center space-x-2">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopyLink}
                type="button"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 flex justify-center">
              <div className="bg-gray-100 p-3 rounded-md inline-flex items-center text-sm text-gray-600">
                <Link className="h-4 w-4 mr-2" />
                Anyone with this link can access this{' '}
                {resourceType === ShareableResourceType.JOB_LEAD
                  ? 'job lead'
                  : 'resume'}
              </div>
            </div>
          </div>
        )}

        <ModalFooter className="sm:justify-between">
          {!shareUrl ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating link...
                  </>
                ) : (
                  <>
                    {recipientEmail ? (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send invitation
                      </>
                    ) : (
                      <>
                        <Link className="h-4 w-4 mr-2" />
                        Create link
                      </>
                    )}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
