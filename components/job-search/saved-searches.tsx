'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  BellOff,
  Building,
  Edit,
  MapPin,
  MoreVertical,
  Play,
  Search,
  Trash,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  location?: string;
  radius?: number;
  jobType?: string;
  remote?: boolean;
  alertsEnabled: boolean;
  lastRun?: Date;
  newJobsCount?: number;
  totalJobsCount?: number;
  createdAt: Date;
}

interface SavedSearchesProps {
  searches: SavedSearch[];
  onRunSearch: (searchId: string) => void;
  onToggleAlerts: (searchId: string, enabled: boolean) => void;
  onEditSearch: (search: SavedSearch) => void;
  onDeleteSearch: (searchId: string) => void;
}

export function SavedSearches({
  searches,
  onRunSearch,
  onToggleAlerts,
  onEditSearch,
  onDeleteSearch,
}: SavedSearchesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleRunSearch = (searchId: string) => {
    onRunSearch(searchId);
    toast({
      title: 'Search Started',
      description:
        'Your saved search is now running. Results will appear shortly.',
    });
  };

  const handleToggleAlerts = (search: SavedSearch) => {
    const newState = !search.alertsEnabled;
    onToggleAlerts(search.id, newState);
    toast({
      title: newState ? 'Alerts Enabled' : 'Alerts Disabled',
      description: newState
        ? `You'll receive notifications for new jobs matching "${search.name}"`
        : `Alerts disabled for "${search.name}"`,
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      onDeleteSearch(deleteConfirmId);
      setDeleteConfirmId(null);
      toast({
        title: 'Search Deleted',
        description: 'Your saved search has been removed.',
      });
    }
  };

  if (searches.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No saved searches</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Save your job searches to quickly access them later and enable
            notifications for new matching jobs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Saved Searches</h3>
          <Badge variant="secondary">{searches.length} saved</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {searches.map(search => (
            <Card key={search.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{search.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {search.query}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleRunSearch(search.id)}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Run Search
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingSearch(search)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteConfirmId(search.id)}
                        className="text-destructive"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Search Parameters */}
                <div className="flex flex-wrap gap-2">
                  {search.location && (
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="mr-1 h-3 w-3" />
                      {search.location}
                    </Badge>
                  )}
                  {search.jobType && search.jobType !== 'any' && (
                    <Badge variant="outline" className="text-xs">
                      <Building className="mr-1 h-3 w-3" />
                      {search.jobType}
                    </Badge>
                  )}
                  {search.remote && (
                    <Badge variant="outline" className="text-xs">
                      Remote
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                {search.lastRun && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last run</span>
                      <span>
                        {formatDistanceToNow(search.lastRun, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {search.newJobsCount !== undefined &&
                      search.newJobsCount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            New jobs
                          </span>
                          <Badge variant="default" className="text-xs">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            {search.newJobsCount} new
                          </Badge>
                        </div>
                      )}
                  </div>
                )}

                {/* Alert Toggle */}
                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Switch
                    id={`alerts-${search.id}`}
                    checked={search.alertsEnabled}
                    onCheckedChange={() => handleToggleAlerts(search)}
                  />
                  <Label
                    htmlFor={`alerts-${search.id}`}
                    className="text-sm cursor-pointer flex items-center gap-2"
                  >
                    {search.alertsEnabled ? (
                      <>
                        <Bell className="h-4 w-4" />
                        Alerts enabled
                      </>
                    ) : (
                      <>
                        <BellOff className="h-4 w-4" />
                        Alerts disabled
                      </>
                    )}
                  </Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      {editingSearch && (
        <Modal
          open={!!editingSearch}
          onOpenChange={() => setEditingSearch(null)}
        >
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Edit Saved Search</ModalTitle>
              <ModalDescription>
                Update the name for your saved search.
              </ModalDescription>
            </ModalHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="search-name">Search Name</Label>
                <Input
                  id="search-name"
                  value={editingSearch.name}
                  onChange={e =>
                    setEditingSearch({ ...editingSearch, name: e.target.value })
                  }
                  placeholder="e.g., Remote React Developer Jobs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Query</p>
                <p className="text-sm font-medium">{editingSearch.query}</p>
              </div>
            </div>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditingSearch(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onEditSearch(editingSearch);
                  setEditingSearch(null);
                  toast({
                    title: 'Search Updated',
                    description: 'Your saved search has been updated.',
                  });
                }}
              >
                Save Changes
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <Modal
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Delete Saved Search</ModalTitle>
            <ModalDescription>
              Are you sure you want to delete this saved search? This action
              cannot be undone.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
