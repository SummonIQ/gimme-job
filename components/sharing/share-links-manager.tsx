'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShareableResourceType, ShareStatus, ShareLink, ShareAccessLevel } from '@/lib/sharing/types';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Copy, Link2, Mail, Trash2, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ShareResourceDialog } from './share-resource-dialog';

interface ShareLinksManagerProps {
  resourceId: string;
  resourceType: ShareableResourceType;
  resourceName: string;
}

export function ShareLinksManager({
  resourceId,
  resourceType,
  resourceName
}: ShareLinksManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  
  const fetchShareLinks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/sharing?resourceId=${resourceId}&resourceType=${resourceType}`,
        { method: 'GET' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch share links');
      }
      
      const data = await response.json();
      setShareLinks(data.data || []);
    } catch (error) {
      console.error('Error fetching share links:', error);
      toast({
        title: 'Error',
        description: 'Failed to load share links',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (resourceId) {
      fetchShareLinks();
    }
  }, [resourceId]);
  
  const handleCreateShareLink = () => {
    setShareDialogOpen(true);
  };
  
  const handleDeleteShareLink = (id: string) => {
    setSelectedLinkId(id);
    setDeleteDialogOpen(true);
  };
  
  const confirmDeleteShareLink = async () => {
    if (!selectedLinkId) return;
    
    try {
      const response = await fetch('/api/sharing', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedLinkId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke share link');
      }
      
      // Remove the deleted link from state
      setShareLinks(shareLinks.filter(link => link.id !== selectedLinkId));
      
      toast({
        title: 'Share link revoked',
        description: 'The share link has been successfully revoked',
      });
    } catch (error) {
      console.error('Error revoking share link:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke share link',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedLinkId(null);
    }
  };
  
  const handleCopyLink = (token: string) => {
    const shareUrl = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(shareUrl);
    
    toast({
      title: 'Copied to clipboard',
      description: 'Share link has been copied to your clipboard',
    });
  };
  
  const getAccessLevelLabel = (level: ShareAccessLevel) => {
    switch (level) {
      case ShareAccessLevel.VIEW:
        return 'View only';
      case ShareAccessLevel.COMMENT:
        return 'Can comment';
      case ShareAccessLevel.EDIT:
        return 'Can edit';
      default:
        return 'Unknown';
    }
  };
  
  const getStatusBadgeClass = (status: ShareStatus) => {
    switch (status) {
      case ShareStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case ShareStatus.EXPIRED:
        return 'bg-amber-100 text-amber-800';
      case ShareStatus.REVOKED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Share Links</CardTitle>
            <CardDescription>Manage links used to share this {resourceType === ShareableResourceType.JOB_LEAD ? 'job lead' : 'resume'}</CardDescription>
          </div>
          <Button onClick={handleCreateShareLink}>
            <Link2 className="h-4 w-4 mr-2" />
            Create Share Link
          </Button>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : shareLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No share links created yet</p>
              <p className="text-sm mt-1">Create a share link to allow others to view this {resourceType === ShareableResourceType.JOB_LEAD ? 'job lead' : 'resume'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shareLinks.map(link => (
                <div 
                  key={link.id} 
                  className="border rounded-md p-4 flex flex-col md:flex-row md:items-center md:justify-between"
                >
                  <div className="mb-3 md:mb-0">
                    <div className="flex items-center mb-1">
                      <Badge className={getStatusBadgeClass(link.status)}>
                        {link.status}
                      </Badge>
                      <Badge variant="outline" className="ml-2">
                        {getAccessLevelLabel(link.accessLevel)}
                      </Badge>
                      {link.allowFeedback && (
                        <Badge variant="outline" className="ml-2 bg-blue-50">
                          Feedback enabled
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center">
                        <span>Created: {formatDate(link.createdAt)}</span>
                        {link.expiresAt && (
                          <span className="ml-3">
                            Expires: {formatDate(link.expiresAt)}
                          </span>
                        )}
                      </div>
                      
                      {link.recipientEmail && (
                        <div className="flex items-center">
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          <span>{link.recipientEmail}</span>
                        </div>
                      )}
                      
                      {link.lastAccessedAt && (
                        <div>
                          Last accessed: {formatDate(link.lastAccessedAt)} (Views: {link.accessCount})
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 self-end md:self-center">
                    {link.status === ShareStatus.ACTIVE && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleCopyLink(link.token)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href={`/shared/${link.token}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Open
                          </a>
                        </Button>
                      </>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => handleDeleteShareLink(link.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <ShareResourceDialog
        isOpen={shareDialogOpen}
        onClose={() => {
          setShareDialogOpen(false);
          fetchShareLinks(); // Refresh the list after closing
        }}
        resourceId={resourceId}
        resourceType={resourceType}
        resourceName={resourceName}
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Share Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this share link? Anyone with this link will no longer be able to access the {resourceType === ShareableResourceType.JOB_LEAD ? 'job lead' : 'resume'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteShareLink}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
