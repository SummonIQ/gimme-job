'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import {
  Bell,
  CalendarDays,
  Check,
  Clock,
  PlusCircle,
  RefreshCw,
  Search
} from 'lucide-react';
import { ReminderCard } from '@/components/networking/reminder-card';
import { ReminderStatus, ReminderType } from '@/lib/networking/types';

export default function RemindersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [reminders, setReminders] = useState<any[]>([]);
  const [filteredReminders, setFilteredReminders] = useState<any[]>([]);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [view, setView] = useState<string>('upcoming');
  
  // Fetch reminders on component mount
  useEffect(() => {
    const fetchReminders = async () => {
      setIsLoading(true);
      
      try {
        // In a real implementation, this would be an actual API call
        // For now, we'll use mock data
        
        // Simulated API response
        const mockReminders = [
          {
            id: 'r1',
            title: 'Follow up with Jane about position',
            description: 'Check if there are any updates on the application process',
            contactId: 'c1',
            type: 'FOLLOW_UP',
            status: 'PENDING',
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
            notificationSent: false,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c1',
              name: 'Jane Smith',
              company: 'Tech Innovations',
              position: 'Senior Developer'
            }
          },
          {
            id: 'r2',
            title: 'Virtual meeting with Michael',
            description: 'Discuss potential job openings and team structure',
            contactId: 'c2',
            type: 'MEETING',
            status: 'PENDING',
            dueDate: new Date(), // Today
            notificationSent: true,
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c2',
              name: 'Michael Johnson',
              company: 'Global Solutions Inc.',
              position: 'Engineering Manager'
            }
          },
          {
            id: 'r3',
            title: 'Send portfolio to Sarah',
            description: 'Include latest projects and design work',
            contactId: 'c3',
            type: 'CUSTOM',
            status: 'PENDING',
            dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday (overdue)
            notificationSent: true,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c3',
              name: 'Sarah Williams',
              company: 'DataViz Corp',
              position: 'Product Manager'
            }
          },
          {
            id: 'r4',
            title: 'Thank David for meeting',
            description: 'Express appreciation for the time and insights shared',
            contactId: 'c4',
            type: 'THANK_YOU',
            status: 'COMPLETED',
            dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            completedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            notificationSent: true,
            createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c4',
              name: 'David Chen',
              company: 'Startup Innovations',
              position: 'CTO'
            }
          },
          {
            id: 'r5',
            title: 'Submit application for UX position',
            description: 'Follow up on job lead from Emily',
            contactId: 'c5',
            type: 'APPLICATION',
            status: 'COMPLETED',
            dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            completedDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
            notificationSent: true,
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c5',
              name: 'Emily Rodriguez',
              company: 'Design Masters LLC',
              position: 'UX Director'
            }
          },
          {
            id: 'r6',
            title: 'Check on status of referral',
            contactId: 'c2',
            type: 'FOLLOW_UP',
            status: 'PENDING',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            notificationSent: false,
            createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c2',
              name: 'Michael Johnson',
              company: 'Global Solutions Inc.',
              position: 'Engineering Manager'
            }
          }
        ];
        
        setReminders(mockReminders);
      } catch (error) {
        console.error('Error fetching reminders:', error);
        toast({
          title: 'Failed to load reminders',
          description: 'There was a problem fetching your reminders.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchReminders();
  }, []);
  
  // Apply filters when any filter changes
  useEffect(() => {
    let results = [...reminders];
    
    // Apply status filter
    if (statusFilter) {
      results = results.filter(reminder => reminder.status === statusFilter);
    }
    
    // Apply type filter
    if (typeFilter) {
      results = results.filter(reminder => reminder.type === typeFilter);
    }
    
    // Apply view filter
    if (view === 'upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      results = results.filter(reminder => {
        const dueDate = new Date(reminder.dueDate);
        return dueDate >= today && dueDate <= nextWeek && reminder.status === 'PENDING';
      });
    } else if (view === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      results = results.filter(reminder => {
        const dueDate = new Date(reminder.dueDate);
        return dueDate >= today && dueDate < tomorrow && reminder.status === 'PENDING';
      });
    } else if (view === 'overdue') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      results = results.filter(reminder => {
        const dueDate = new Date(reminder.dueDate);
        return dueDate < today && reminder.status === 'PENDING';
      });
    }
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(reminder => 
        reminder.title.toLowerCase().includes(searchLower) ||
        (reminder.description && reminder.description.toLowerCase().includes(searchLower)) ||
        (reminder.contact && reminder.contact.name.toLowerCase().includes(searchLower)) ||
        (reminder.contact && reminder.contact.company && reminder.contact.company.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort by due date
    results.sort((a, b) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    
    setFilteredReminders(results);
  }, [reminders, search, statusFilter, typeFilter, view]);
  
  const handleCompleteReminder = async (id: string) => {
    try {
      // In a real implementation, this would be an API call
      // For now, we'll just update the local state
      setReminders(prevReminders => 
        prevReminders.map(reminder => 
          reminder.id === id 
            ? { ...reminder, status: 'COMPLETED', completedDate: new Date() } 
            : reminder
        )
      );
      
      toast({
        title: 'Reminder completed',
        description: 'The reminder has been marked as complete',
      });
    } catch (error) {
      toast({
        title: 'Failed to complete reminder',
        description: 'There was a problem updating the reminder.',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteReminder = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reminder?')) {
      return;
    }
    
    try {
      // In a real implementation, this would be an API call
      // For now, we'll just update the local state
      setReminders(prevReminders => 
        prevReminders.filter(reminder => reminder.id !== id)
      );
      
      toast({
        title: 'Reminder deleted',
        description: 'The reminder has been removed',
      });
    } catch (error) {
      toast({
        title: 'Failed to delete reminder',
        description: 'There was a problem deleting the reminder.',
        variant: 'destructive',
      });
    }
  };
  
  const resetFilters = () => {
    setSearch('');
    setStatusFilter('PENDING');
    setTypeFilter('');
    setView('upcoming');
  };
  
  // Count stats for the tabs
  const todayCount = reminders.filter(reminder => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = new Date(reminder.dueDate);
    return dueDate >= today && dueDate < tomorrow && reminder.status === 'PENDING';
  }).length;
  
  const overdueCount = reminders.filter(reminder => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(reminder.dueDate);
    return dueDate < today && reminder.status === 'PENDING';
  }).length;
  
  const upcomingCount = reminders.filter(reminder => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueDate = new Date(reminder.dueDate);
    return dueDate >= today && dueDate <= nextWeek && reminder.status === 'PENDING';
  }).length;
  
  const totalPendingCount = reminders.filter(reminder => reminder.status === 'PENDING').length;
  const totalCompletedCount = reminders.filter(reminder => reminder.status === 'COMPLETED').length;
  
  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Reminders</h1>
          <p className="text-muted-foreground">
            Keep track of your networking follow-ups
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/networking/reminders/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Reminder
            </Button>
          </Link>
        </div>
      </div>
      
      {/* View Tabs */}
      <Tabs value={view} onValueChange={setView} className="mb-6">
        <TabsList className="grid grid-cols-3 md:w-[400px]">
          <TabsTrigger value="upcoming" className="flex gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>Upcoming</span>
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {upcomingCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="today" className="flex gap-2">
            <Clock className="h-4 w-4" />
            <span>Today</span>
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {todayCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex gap-2">
            <Bell className="h-4 w-4" />
            <span>Overdue</span>
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              {overdueCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reminders..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              {Object.values(ReminderStatus).map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {Object.values(ReminderType).map(type => (
                <SelectItem key={type} value={type}>
                  {type.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={resetFilters}
            className="h-10 w-10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stats summary */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="bg-slate-100 rounded-md px-4 py-2 flex items-center">
              <Check className="h-5 w-5 text-green-600 mr-2" />
              <div>
                <div className="text-sm font-medium">Completed</div>
                <div className="text-2xl font-bold">{totalCompletedCount}</div>
              </div>
            </div>
            <div className="bg-slate-100 rounded-md px-4 py-2 flex items-center">
              <Clock className="h-5 w-5 text-blue-600 mr-2" />
              <div>
                <div className="text-sm font-medium">Pending</div>
                <div className="text-2xl font-bold">{totalPendingCount}</div>
              </div>
            </div>
          </div>
          
          {filteredReminders.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-gray-50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <Bell className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No reminders found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {(statusFilter || typeFilter || search) 
                  ? 'Try adjusting your filters or search criteria' 
                  : 'Get started by creating your first reminder'}
              </p>
              <div className="mt-6">
                <Link href="/networking/reminders/new">
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Reminder
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Showing {filteredReminders.length} {filteredReminders.length === 1 ? 'reminder' : 'reminders'}
              </p>
              
              <div className="space-y-4">
                {filteredReminders.map(reminder => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onComplete={handleCompleteReminder}
                    onDelete={handleDeleteReminder}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
