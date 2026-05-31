'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  PlusCircle,
  Search,
  User,
  UserPlus,
  Users
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import { ContactCard } from '@/components/networking/contact-card';
import { ReminderCard } from '@/components/networking/reminder-card';

export default function NetworkingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalContacts: 0,
    activeContacts: 0,
    newContacts: 0,
    pendingReminders: 0,
    dueToday: 0,
    overdue: 0
  });
  const [recentContacts, setRecentContacts] = useState<any[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<any[]>([]);
  
  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // In a real implementation, these would be actual API calls
        // For now, we'll simulate the data
        
        // Fetch stats (this would be an actual API call in production)
        const statsData = {
          totalContacts: 42,
          activeContacts: 35,
          newContacts: 8,
          pendingReminders: 12,
          dueToday: 3,
          overdue: 2
        };
        
        // Fetch recent contacts (this would be an actual API call in production)
        const recentContactsData = [
          {
            id: 'c1',
            name: 'Jane Smith',
            company: 'Tech Innovations',
            position: 'Senior Developer',
            email: 'jane@techinnovations.com',
            status: 'CONTACTED',
            priority: 'HIGH',
            source: 'LINKEDIN',
            tags: ['React', 'Frontend'],
            lastContactDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 2,
              reminders: 1
            }
          },
          {
            id: 'c2',
            name: 'Michael Johnson',
            company: 'Global Solutions Inc.',
            position: 'Engineering Manager',
            email: 'michael@globalsolutions.com',
            status: 'MEETING_SCHEDULED',
            priority: 'MEDIUM',
            source: 'REFERRAL',
            tags: ['Management', 'Hiring'],
            lastContactDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 3,
              reminders: 2
            }
          },
          {
            id: 'c3',
            name: 'Sarah Williams',
            company: 'DataViz Corp',
            position: 'Product Manager',
            email: 'sarah@dataviz.com',
            status: 'NEW',
            priority: 'MEDIUM',
            source: 'EVENT',
            tags: ['Product', 'Data'],
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 0,
              reminders: 1
            }
          }
        ];
        
        // Fetch upcoming reminders (this would be an actual API call in production)
        const upcomingRemindersData = [
          {
            id: 'r1',
            title: 'Follow up on interview process',
            contactId: 'c1',
            type: 'FOLLOW_UP',
            status: 'PENDING',
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
            notificationSent: false,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c1',
              name: 'Jane Smith',
              company: 'Tech Innovations'
            }
          },
          {
            id: 'r2',
            title: 'Initial meeting with Michael',
            contactId: 'c2',
            type: 'MEETING',
            status: 'PENDING',
            dueDate: new Date(), // Today
            notificationSent: true,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c2',
              name: 'Michael Johnson',
              company: 'Global Solutions Inc.'
            }
          },
          {
            id: 'r3',
            title: 'Send portfolio to Sarah',
            contactId: 'c3',
            type: 'CUSTOM',
            status: 'PENDING',
            dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday (overdue)
            notificationSent: true,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            contact: {
              id: 'c3',
              name: 'Sarah Williams',
              company: 'DataViz Corp'
            }
          }
        ];
        
        setStats(statsData);
        setRecentContacts(recentContactsData);
        setUpcomingReminders(upcomingRemindersData);
      } catch (error) {
        console.error('Failed to fetch networking data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load networking data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  const completeReminder = async (id: string) => {
    try {
      // This would be an actual API call in production
      // For now, we'll just update the local state
      
      setUpcomingReminders(prevReminders => 
        prevReminders.map(reminder => 
          reminder.id === id 
            ? { ...reminder, status: 'COMPLETED', completedDate: new Date() } 
            : reminder
        )
      );
      
      toast({
        title: 'Reminder completed',
        description: 'The reminder has been marked as complete',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete reminder',
        variant: 'destructive',
      });
    }
  };
  
  const renderStatCard = (title: string, value: number, icon: React.ReactNode, linkHref?: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
      {linkHref && (
        <CardFooter className="p-2">
          <Link href={linkHref} className="text-xs text-muted-foreground hover:underline w-full text-right">
            View all
            <ChevronRight className="ml-1 h-3 w-3 inline" />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
  
  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Networking</h1>
          <p className="text-muted-foreground">
            Manage your professional connections and follow-ups
          </p>
        </div>
        <div className="flex space-x-2">
          <Link href="/networking/reminders/new">
            <Button variant="outline" className="gap-1">
              <Bell className="h-4 w-4" />
              New Reminder
            </Button>
          </Link>
          <Link href="/networking/contacts/new">
            <Button className="gap-1">
              <UserPlus className="h-4 w-4" />
              Add Contact
            </Button>
          </Link>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Statistics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {renderStatCard('Total Contacts', stats.totalContacts, <Users className="h-4 w-4 text-muted-foreground" />, '/networking/contacts')}
            {renderStatCard('Active Contacts', stats.activeContacts, <User className="h-4 w-4 text-muted-foreground" />, '/networking/contacts?status=active')}
            {renderStatCard('Pending Reminders', stats.pendingReminders, <Bell className="h-4 w-4 text-muted-foreground" />, '/networking/reminders')}
            {renderStatCard('Reminders Due Today', stats.dueToday, <CalendarDays className="h-4 w-4 text-muted-foreground" />, '/networking/reminders?due=today')}
          </div>
          
          {/* Alerts */}
          {stats.overdue > 0 && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <CardTitle className="text-base text-red-700">
                    You have {stats.overdue} overdue {stats.overdue === 1 ? 'reminder' : 'reminders'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-600">
                  Review and update these reminders to keep your networking organized.
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                <Link href="/networking/reminders?status=overdue">
                  <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-100">
                    View Overdue Reminders
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          )}
          
          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column - Upcoming Reminders */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Upcoming Reminders</h2>
                <Link href="/networking/reminders">
                  <Button variant="ghost" size="sm" className="text-sm">
                    View All
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              
              {upcomingReminders.length > 0 ? (
                <div className="space-y-3">
                  {upcomingReminders.map(reminder => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      onComplete={completeReminder}
                      compact={true}
                    />
                  ))}
                </div>
              ) : (
                <Card className="bg-gray-50 border-dashed">
                  <CardContent className="py-6 text-center">
                    <div className="flex justify-center mb-3">
                      <Clock className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="font-medium text-gray-900">No upcoming reminders</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Stay organized by creating reminders for your networking activities
                    </p>
                    <Link href="/networking/reminders/new" className="mt-4 inline-block">
                      <Button size="sm">
                        <PlusCircle className="mr-1 h-4 w-4" />
                        New Reminder
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
              
              <Separator className="my-6" />
              
              {/* Quick Actions */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 gap-2">
                  <Link href="/networking/contacts/import">
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      Import Contacts
                    </Button>
                  </Link>
                  <Link href="/networking/contacts/export">
                    <Button variant="outline" className="w-full justify-start">
                      <Share2 className="mr-2 h-4 w-4" />
                      Export Contacts
                    </Button>
                  </Link>
                  <Link href="/networking/reminders/create-multiple">
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Follow-ups
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Right column - Recent Contacts & Search */}
            <div className="lg:col-span-2">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
                <h2 className="text-lg font-semibold">Recent Contacts</h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    className="pl-9 w-full md:w-64"
                  />
                </div>
              </div>
              
              {recentContacts.length > 0 ? (
                <div className="space-y-4">
                  {recentContacts.map(contact => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      compact={true}
                    />
                  ))}
                  
                  <div className="flex justify-center mt-4">
                    <Link href="/networking/contacts">
                      <Button variant="outline">
                        View All Contacts
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <Card className="bg-gray-50 border-dashed">
                  <CardContent className="py-6 text-center">
                    <div className="flex justify-center mb-3">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="font-medium text-gray-900">No contacts yet</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Start building your professional network
                    </p>
                    <div className="mt-4 space-x-2">
                      <Link href="/networking/contacts/new" className="inline-block">
                        <Button size="sm">
                          <UserPlus className="mr-1 h-4 w-4" />
                          Add Contact
                        </Button>
                      </Link>
                      <Link href="/networking/contacts/import" className="inline-block">
                        <Button size="sm" variant="outline">
                          Import Contacts
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// This component would be defined elsewhere
function Share2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
