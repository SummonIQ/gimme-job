'use client';

import { NotificationItem } from '@/components/notifications/notification-item';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  NotificationCategory,
  NotificationStatus,
} from '@/lib/notifications/types';
import { Bell, Check, Inbox, Loader2, Search } from 'lucide-react';
import { useCallback, useState } from 'react';

interface NotificationsPageProps {
  userId: string;
  initialData: {
    notifications: any[];
    totalCount: number;
    hasMore: boolean;
  };
}

export default function NotificationsPage({
  userId,
  initialData,
}: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<any[]>(
    initialData.notifications,
  );
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  // Load notifications via API route
  const loadNotifications = useCallback(
    async (
      pageToLoad = 0,
      includeRead = true,
      query = searchQuery,
      categoryFilter = filter,
    ) => {
      try {
        setLoading(true);
        const limit = 10;
        const offset = pageToLoad * limit;

        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          includeRead: String(includeRead || tab === 'all'),
        });

        const response = await fetch(`/api/notifications?${params}`);
        if (!response.ok) throw new Error('Failed to fetch notifications');
        const json = await response.json();
        const result = json.data;

        // Apply client-side filters if needed
        let filtered = result.notifications;

        if (query) {
          const lowerQuery = query.toLowerCase();
          filtered = filtered.filter(
            (n: any) =>
              n.title.toLowerCase().includes(lowerQuery) ||
              n.message?.toLowerCase().includes(lowerQuery),
          );
        }

        if (categoryFilter) {
          filtered = filtered.filter((n: any) => n.category === categoryFilter);
        }

        if (pageToLoad === 0) {
          setNotifications(filtered);
        } else {
          setNotifications(prev => [...prev, ...filtered]);
        }

        setHasMore(result.hasMore);
        setPage(pageToLoad);
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, filter, tab],
  );

  // Handle tab change
  const handleTabChange = (value: string) => {
    setTab(value as 'all' | 'unread');
    loadNotifications(0, value === 'all');
  };

  // Handle search query change
  const handleSearch = () => {
    loadNotifications(0, tab === 'all', searchQuery, filter);
  };

  // Handle category filter change
  const handleFilterChange = (category: string | null) => {
    setFilter(category);
    loadNotifications(0, tab === 'all', searchQuery, category);
  };

  // Load more notifications
  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadNotifications(page + 1, tab === 'all', searchQuery, filter);
    }
  };

  // Mark notification as read
  const handleMarkAsRead = (id: string) => {
    setNotifications(
      notifications.map((n: any) =>
        n.id === id ? { ...n, status: NotificationStatus.READ } : n,
      ),
    );
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    // In a real implementation, you would call an API endpoint to mark all as read
    setNotifications(
      notifications.map(n => ({ ...n, status: NotificationStatus.READ })),
    );
  };

  // Render category badge
  const renderCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      [NotificationCategory.APPLICATION_STATUS]: 'bg-blue-100 text-blue-800',
      [NotificationCategory.INTERVIEW_REQUEST]: 'bg-green-100 text-green-800',
      [NotificationCategory.NETWORKING]: 'bg-purple-100 text-purple-800',
      [NotificationCategory.RESUME_FEEDBACK]: 'bg-amber-100 text-amber-800',
      [NotificationCategory.SHARE_ACTIVITY]: 'bg-indigo-100 text-indigo-800',
      [NotificationCategory.SYSTEM]: 'bg-gray-100 text-gray-800',
      [NotificationCategory.JOB_SEARCH]: 'bg-orange-100 text-orange-800',
      [NotificationCategory.RESUME_ANALYSIS]: 'bg-teal-100 text-teal-800',
      [NotificationCategory.AUTOMATION]: 'bg-cyan-100 text-cyan-800',
    };

    const labels: Record<string, string> = {
      [NotificationCategory.APPLICATION_STATUS]: 'Application',
      [NotificationCategory.INTERVIEW_REQUEST]: 'Interview',
      [NotificationCategory.NETWORKING]: 'Networking',
      [NotificationCategory.RESUME_FEEDBACK]: 'Resume',
      [NotificationCategory.SHARE_ACTIVITY]: 'Sharing',
      [NotificationCategory.SYSTEM]: 'System',
      [NotificationCategory.JOB_SEARCH]: 'Job Search',
      [NotificationCategory.RESUME_ANALYSIS]: 'Resume Analysis',
      [NotificationCategory.AUTOMATION]: 'Automation',
    };

    return (
      <span
        className={`text-xs px-2 py-1 rounded ${colors[category] || 'bg-gray-100 text-gray-800'}`}
      >
        {labels[category] || category}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              Notifications
            </CardTitle>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleMarkAllAsRead}
              >
                <Check className="mr-1 h-4 w-4" /> Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and filter */}
          <div className="mb-4 flex flex-col md:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="max-w-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSearch();
                }}
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2 items-center">
              <div className="text-sm mr-2">Filter:</div>
              <div className="flex flex-wrap gap-1">
                {Object.values(NotificationCategory).map(category => (
                  <Button
                    key={category}
                    variant={filter === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      handleFilterChange(filter === category ? null : category)
                    }
                    className="h-8"
                  >
                    {renderCategoryBadge(category)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs for All/Unread */}
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              {renderNotificationList()}
            </TabsContent>

            <TabsContent value="unread" className="mt-0">
              {renderNotificationList()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );

  function renderNotificationList() {
    if (loading && notifications.length === 0) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="text-center py-10">
          <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No notifications</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            When you receive notifications, they will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="border rounded-md">
        <div className="divide-y">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              id={notification.id}
              title={notification.title}
              content={notification.body}
              category={notification.category}
              createdAt={new Date(notification.createdAt)}
              isRead={notification.status === NotificationStatus.READ}
              onMarkAsRead={handleMarkAsRead}
              actionUrl={
                notification.actionUrl ??
                (notification.metadata?.jobLeadId
                  ? `/leads/${notification.metadata.jobLeadId}`
                  : undefined)
              }
              actionLabel={notification.actionLabel ?? undefined}
            />
          ))}
        </div>

        {hasMore && (
          <div className="py-4 text-center">
            <Button
              onClick={handleLoadMore}
              disabled={loading}
              variant="outline"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load more
            </Button>
          </div>
        )}
      </div>
    );
  }
}
