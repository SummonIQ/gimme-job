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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import {
  ChevronDown,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  User,
  UserPlus
} from 'lucide-react';
import { ContactCard } from '@/components/networking/contact-card';
import { ContactStatus, ContactPriority, ContactSource } from '@/lib/networking/types';

export default function ContactsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [contacts, setContacts] = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('lastContactDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Fetch contacts on component mount
  useEffect(() => {
    const fetchContacts = async () => {
      setIsLoading(true);
      
      try {
        // In a real implementation, this would be an actual API call
        // For now, we'll use mock data
        
        // Simulated API response
        const mockContacts = [
          {
            id: 'c1',
            name: 'Jane Smith',
            company: 'Tech Innovations',
            position: 'Senior Developer',
            email: 'jane@techinnovations.com',
            phone: '(555) 123-4567',
            linkedinUrl: 'https://linkedin.com/in/janesmith',
            notes: 'Met at React Conference. Interested in frontend opportunities.',
            status: 'CONTACTED',
            priority: 'HIGH',
            source: 'LINKEDIN',
            lastContactDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            tags: ['React', 'Frontend', 'Senior'],
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 3,
              reminders: 1
            }
          },
          {
            id: 'c2',
            name: 'Michael Johnson',
            company: 'Global Solutions Inc.',
            position: 'Engineering Manager',
            email: 'michael@globalsolutions.com',
            phone: '(555) 987-6543',
            linkedinUrl: 'https://linkedin.com/in/michaeljohnson',
            notes: 'Referred by Alex. They are expanding their engineering team.',
            status: 'MEETING_SCHEDULED',
            priority: 'MEDIUM',
            source: 'REFERRAL',
            lastContactDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            tags: ['Management', 'Hiring Manager'],
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 2,
              reminders: 2
            }
          },
          {
            id: 'c3',
            name: 'Sarah Williams',
            company: 'DataViz Corp',
            position: 'Product Manager',
            email: 'sarah@dataviz.com',
            linkedinUrl: 'https://linkedin.com/in/sarahwilliams',
            notes: 'Met at Tech Meetup. Looking for product designers.',
            status: 'NEW',
            priority: 'MEDIUM',
            source: 'EVENT',
            tags: ['Product', 'Design'],
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 0,
              reminders: 1
            }
          },
          {
            id: 'c4',
            name: 'David Chen',
            company: 'Startup Innovations',
            position: 'CTO',
            email: 'david@startupinnovations.com',
            phone: '(555) 789-0123',
            notes: 'Interested in discussing potential collaboration.',
            status: 'RESPONDED',
            priority: 'HIGH',
            source: 'COLD_OUTREACH',
            lastContactDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            tags: ['Startup', 'Technical', 'Leadership'],
            createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 2,
              reminders: 0
            }
          },
          {
            id: 'c5',
            name: 'Emily Rodriguez',
            company: 'Design Masters LLC',
            position: 'UX Director',
            email: 'emily@designmasters.com',
            linkedinUrl: 'https://linkedin.com/in/emilyrodriguez',
            status: 'CONNECTED',
            priority: 'MEDIUM',
            source: 'LINKEDIN',
            lastContactDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            tags: ['Design', 'UX', 'Creative'],
            createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            _count: {
              interactions: 5,
              reminders: 0
            }
          }
        ];
        
        setContacts(mockContacts);
        setFilteredContacts(mockContacts);
      } catch (error) {
        console.error('Error fetching contacts:', error);
        toast({
          title: 'Failed to load contacts',
          description: 'There was a problem fetching your contacts.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchContacts();
  }, []);
  
  // Apply filters when any filter changes
  useEffect(() => {
    let results = [...contacts];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(contact => 
        contact.name.toLowerCase().includes(searchLower) ||
        (contact.company && contact.company.toLowerCase().includes(searchLower)) ||
        (contact.position && contact.position.toLowerCase().includes(searchLower)) ||
        (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
        (contact.notes && contact.notes.toLowerCase().includes(searchLower)) ||
        contact.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      results = results.filter(contact => contact.status === statusFilter);
    }
    
    // Apply priority filter
    if (priorityFilter) {
      results = results.filter(contact => contact.priority === priorityFilter);
    }
    
    // Apply source filter
    if (sourceFilter) {
      results = results.filter(contact => contact.source === sourceFilter);
    }
    
    // Apply sorting
    results.sort((a, b) => {
      let valA, valB;
      
      switch (sortBy) {
        case 'name':
          valA = a.name;
          valB = b.name;
          break;
        case 'company':
          valA = a.company || '';
          valB = b.company || '';
          break;
        case 'lastContactDate':
          valA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
          valB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
          break;
        case 'createdAt':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        default:
          valA = a[sortBy];
          valB = b[sortBy];
      }
      
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    setFilteredContacts(results);
  }, [contacts, search, statusFilter, priorityFilter, sourceFilter, sortBy, sortDirection]);
  
  const handleStatusChange = async (id: string, status: ContactStatus) => {
    try {
      // In a real implementation, this would be an API call
      // For now, we'll just update the local state
      setContacts(prevContacts => 
        prevContacts.map(contact => 
          contact.id === id ? { ...contact, status } : contact
        )
      );
      
      toast({
        title: 'Status updated',
        description: `Contact status changed to ${status.replace('_', ' ')}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to update status',
        description: 'There was a problem updating the contact status.',
        variant: 'destructive',
      });
    }
  };
  
  const handlePriorityChange = async (id: string, priority: ContactPriority) => {
    try {
      // In a real implementation, this would be an API call
      // For now, we'll just update the local state
      setContacts(prevContacts => 
        prevContacts.map(contact => 
          contact.id === id ? { ...contact, priority } : contact
        )
      );
      
      toast({
        title: 'Priority updated',
        description: `Contact priority changed to ${priority}`,
      });
    } catch (error) {
      toast({
        title: 'Failed to update priority',
        description: 'There was a problem updating the contact priority.',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }
    
    try {
      // In a real implementation, this would be an API call
      // For now, we'll just update the local state
      setContacts(prevContacts => 
        prevContacts.filter(contact => contact.id !== id)
      );
      
      toast({
        title: 'Contact deleted',
        description: 'The contact has been removed from your network',
      });
    } catch (error) {
      toast({
        title: 'Failed to delete contact',
        description: 'There was a problem deleting the contact.',
        variant: 'destructive',
      });
    }
  };
  
  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setSourceFilter('');
    setSortBy('lastContactDate');
    setSortDirection('desc');
  };
  
  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your professional network
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/networking/contacts/import">
            <Button variant="outline" size="sm" className="h-9">
              <Download className="mr-2 h-4 w-4" />
              Import
            </Button>
          </Link>
          <Link href="/networking/contacts/new">
            <Button size="sm" className="h-9">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
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
              {Object.values(ContactStatus).map(status => (
                <SelectItem key={status} value={status}>
                  {status.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Priorities</SelectItem>
              {Object.values(ContactPriority).map(priority => (
                <SelectItem key={priority} value={priority}>{priority}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Sources</SelectItem>
              {Object.values(ContactSource).map(source => (
                <SelectItem key={source} value={source}>
                  {source.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setSortBy('name')}
                className={sortBy === 'name' ? 'bg-accent' : ''}
              >
                Name
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('company')}
                className={sortBy === 'company' ? 'bg-accent' : ''}
              >
                Company
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('lastContactDate')}
                className={sortBy === 'lastContactDate' ? 'bg-accent' : ''}
              >
                Last Contact
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('createdAt')}
                className={sortBy === 'createdAt' ? 'bg-accent' : ''}
              >
                Date Added
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              >
                {sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetFilters}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Filter badges */}
      {(statusFilter || priorityFilter || sourceFilter || search) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {statusFilter && (
            <Badge variant="secondary" className="pl-2 pr-1 py-1">
              Status: {statusFilter.replace('_', ' ')}
              <button 
                className="ml-1 hover:bg-gray-200 rounded-full p-1" 
                onClick={() => setStatusFilter('')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {priorityFilter && (
            <Badge variant="secondary" className="pl-2 pr-1 py-1">
              Priority: {priorityFilter}
              <button 
                className="ml-1 hover:bg-gray-200 rounded-full p-1" 
                onClick={() => setPriorityFilter('')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {sourceFilter && (
            <Badge variant="secondary" className="pl-2 pr-1 py-1">
              Source: {sourceFilter.replace('_', ' ')}
              <button 
                className="ml-1 hover:bg-gray-200 rounded-full p-1" 
                onClick={() => setSourceFilter('')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {search && (
            <Badge variant="secondary" className="pl-2 pr-1 py-1">
              Search: {search}
              <button 
                className="ml-1 hover:bg-gray-200 rounded-full p-1" 
                onClick={() => setSearch('')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={resetFilters}
          >
            Clear All
          </Button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-gray-50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <User className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No contacts found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {(statusFilter || priorityFilter || sourceFilter || search) 
                  ? 'Try adjusting your filters or search criteria' 
                  : 'Get started by adding your first contact'}
              </p>
              <div className="mt-6">
                <Link href="/networking/contacts/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Showing {filteredContacts.length} {filteredContacts.length === 1 ? 'contact' : 'contacts'}
              </p>
              
              <div className="space-y-6">
                {filteredContacts.map(contact => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onStatusChange={handleStatusChange}
                    onPriorityChange={handlePriorityChange}
                    onDelete={handleDeleteContact}
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

// X icon for filter badges
function X(props: any) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
