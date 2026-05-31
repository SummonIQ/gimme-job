'use client';

import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Building,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Share2,
  Trash2,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  Linkedin,
  Tag
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  ContactStatus,
  ContactSource,
  ContactPriority,
  NetworkContact
} from '@/lib/networking/types';

interface ContactCardProps {
  contact: NetworkContact & {
    reminders?: any[];
    _count?: {
      interactions: number;
      reminders: number;
    };
  };
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: ContactStatus) => void;
  onPriorityChange?: (id: string, priority: ContactPriority) => void;
  compact?: boolean;
}

export function ContactCard({
  contact,
  onDelete,
  onStatusChange,
  onPriorityChange,
  compact = false
}: ContactCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const formatDate = (dateString: Date | string | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };
  
  const getStatusColor = (status: ContactStatus) => {
    switch (status) {
      case ContactStatus.NEW:
        return 'bg-blue-100 text-blue-800';
      case ContactStatus.CONTACTED:
        return 'bg-yellow-100 text-yellow-800';
      case ContactStatus.RESPONDED:
        return 'bg-purple-100 text-purple-800';
      case ContactStatus.MEETING_SCHEDULED:
        return 'bg-green-100 text-green-800';
      case ContactStatus.CONNECTED:
        return 'bg-indigo-100 text-indigo-800';
      case ContactStatus.REFERRED:
        return 'bg-teal-100 text-teal-800';
      case ContactStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getPriorityColor = (priority: ContactPriority) => {
    switch (priority) {
      case ContactPriority.HIGH:
        return 'bg-red-100 text-red-800';
      case ContactPriority.MEDIUM:
        return 'bg-yellow-100 text-yellow-800';
      case ContactPriority.LOW:
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getSourceIcon = (source: ContactSource) => {
    switch (source) {
      case ContactSource.LINKEDIN:
        return <Linkedin className="h-4 w-4" />;
      case ContactSource.EVENT:
        return <Calendar className="h-4 w-4" />;
      case ContactSource.REFERRAL:
        return <Share2 className="h-4 w-4" />;
      case ContactSource.COLD_OUTREACH:
        return <Mail className="h-4 w-4" />;
      case ContactSource.COMPANY_WEBSITE:
        return <Building className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };
  
  const handleStatusChange = (status: ContactStatus) => {
    if (onStatusChange) {
      onStatusChange(contact.id, status);
    }
  };
  
  const handlePriorityChange = (priority: ContactPriority) => {
    if (onPriorityChange) {
      onPriorityChange(contact.id, priority);
    }
  };
  
  if (compact) {
    return (
      <Card className="mb-4">
        <CardHeader className="py-4 px-5">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-base font-medium">
                {contact.name}
              </CardTitle>
              {contact.company && (
                <CardDescription className="flex items-center mt-1">
                  <Building className="h-3.5 w-3.5 mr-1" />
                  {contact.company}
                  {contact.position && ` - ${contact.position}`}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(contact.status)}>
                {contact.status.replace('_', ' ')}
              </Badge>
              <Badge className={getPriorityColor(contact.priority)}>
                {contact.priority}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="py-2 px-5 flex justify-between border-t">
          <div className="flex space-x-2 text-sm text-muted-foreground">
            <span className="flex items-center">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              {contact._count?.interactions || 0}
            </span>
            <span className="flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1" />
              {contact._count?.reminders || 0}
            </span>
            <span className="flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Last: {formatDate(contact.lastContactDate)}
            </span>
          </div>
          <Link href={`/networking/contacts/${contact.id}`}>
            <Button size="sm" variant="ghost">
              View
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center">
              {contact.name}
            </CardTitle>
            {contact.company && (
              <CardDescription className="flex items-center mt-1 text-base">
                <Building className="h-4 w-4 mr-1" />
                {contact.company}
                {contact.position && ` - ${contact.position}`}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Badge className={getStatusColor(contact.status)}>
                    {contact.status.replace('_', ' ')}
                  </Badge>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.values(ContactStatus).map((status) => (
                  <DropdownMenuItem 
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className={contact.status === status ? 'bg-accent' : ''}
                  >
                    <Badge className={getStatusColor(status)}>
                      {status.replace('_', ' ')}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Badge className={getPriorityColor(contact.priority)}>
                    {contact.priority}
                  </Badge>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.values(ContactPriority).map((priority) => (
                  <DropdownMenuItem 
                    key={priority}
                    onClick={() => handlePriorityChange(priority)}
                    className={contact.priority === priority ? 'bg-accent' : ''}
                  >
                    <Badge className={getPriorityColor(priority)}>
                      {priority}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {contact.email && (
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                <a 
                  href={`mailto:${contact.email}`} 
                  className="text-blue-600 hover:underline"
                >
                  {contact.email}
                </a>
              </div>
            )}
            
            {contact.phone && (
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                <a 
                  href={`tel:${contact.phone}`} 
                  className="text-blue-600 hover:underline"
                >
                  {contact.phone}
                </a>
              </div>
            )}
            
            {contact.linkedinUrl && (
              <div className="flex items-center">
                <Linkedin className="h-4 w-4 mr-2" />
                <a 
                  href={contact.linkedinUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  LinkedIn Profile
                </a>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              <span>Last contact: {formatDate(contact.lastContactDate)}</span>
            </div>
            
            <div className="flex items-center">
              <Tag className="h-4 w-4 mr-2" />
              <div className="flex flex-wrap gap-1">
                {contact.tags.length > 0 ? (
                  contact.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="mr-1">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">No tags</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center">
              {getSourceIcon(contact.source)}
              <span className="ml-2">
                Source: {contact.source.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
        
        {contact.notes && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-1">Notes</h4>
            <div className="text-muted-foreground text-sm bg-gray-50 p-3 rounded-md border">
              {expanded ? contact.notes : contact.notes.length > 150 
                ? `${contact.notes.substring(0, 150)}...` 
                : contact.notes}
              {contact.notes.length > 150 && (
                <button 
                  onClick={() => setExpanded(!expanded)} 
                  className="text-blue-600 hover:underline ml-1"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {contact.reminders && contact.reminders.length > 0 && (
          <div className="mt-2">
            <h4 className="text-sm font-medium mb-1">Upcoming reminder</h4>
            <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{contact.reminders[0].title}</p>
                  <p className="text-sm text-muted-foreground">
                    Due: {formatDate(contact.reminders[0].dueDate)}
                  </p>
                </div>
                <Link href={`/networking/reminders/${contact.reminders[0].id}`}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <div className="flex space-x-4">
          <Link href={`/networking/contacts/${contact.id}/interactions`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="mr-1 h-4 w-4" />
              Interactions ({contact._count?.interactions || 0})
            </Button>
          </Link>
          <Link href={`/networking/contacts/${contact.id}/reminders`}>
            <Button variant="outline" size="sm">
              <Clock className="mr-1 h-4 w-4" />
              Reminders ({contact._count?.reminders || 0})
            </Button>
          </Link>
        </div>
        <div className="flex space-x-2">
          <Link href={`/networking/contacts/${contact.id}/edit`}>
            <Button variant="outline" size="sm">Edit</Button>
          </Link>
          {onDelete && (
            <Button 
              variant="outline" 
              size="sm"
              className="text-red-500 hover:bg-red-50"
              onClick={() => onDelete(contact.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
