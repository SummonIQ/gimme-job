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
  Calendar,
  Check,
  Clock,
  Edit,
  Trash2,
  User,
  AlertCircle
} from 'lucide-react';
import {
  NetworkReminder,
  ReminderStatus,
  ReminderType
} from '@/lib/networking/types';

interface ReminderCardProps {
  reminder: NetworkReminder & {
    contact?: {
      id: string;
      name: string;
      company?: string;
      position?: string;
    };
  };
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function ReminderCard({
  reminder,
  onComplete,
  onDelete,
  compact = false
}: ReminderCardProps) {
  const formatDate = (dateString: Date | string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  const formatTime = (dateString: Date | string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getDueStatus = (dueDate: Date | string) => {
    const now = new Date();
    const due = new Date(dueDate);
    
    // Check if the reminder is overdue
    if (due < now && reminder.status === ReminderStatus.PENDING) {
      return 'overdue';
    }
    
    // Check if the reminder is due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (due >= today && due < tomorrow && reminder.status === ReminderStatus.PENDING) {
      return 'today';
    }
    
    // Check if the reminder is due tomorrow
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    if (due >= tomorrow && due < dayAfterTomorrow && reminder.status === ReminderStatus.PENDING) {
      return 'tomorrow';
    }
    
    // Check if the reminder is completed
    if (reminder.status === ReminderStatus.COMPLETED) {
      return 'completed';
    }
    
    return 'upcoming';
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      case 'today':
        return <Badge className="bg-yellow-100 text-yellow-800">Due Today</Badge>;
      case 'tomorrow':
        return <Badge className="bg-blue-100 text-blue-800">Due Tomorrow</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Upcoming</Badge>;
    }
  };
  
  const getTypeColor = (type: ReminderType) => {
    switch (type) {
      case ReminderType.FOLLOW_UP:
        return 'bg-blue-100 text-blue-800';
      case ReminderType.MEETING:
        return 'bg-purple-100 text-purple-800';
      case ReminderType.APPLICATION:
        return 'bg-indigo-100 text-indigo-800';
      case ReminderType.THANK_YOU:
        return 'bg-teal-100 text-teal-800';
      case ReminderType.CUSTOM:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const dueStatus = getDueStatus(reminder.dueDate);
  
  const isOverdue = dueStatus === 'overdue';
  const isPending = reminder.status === ReminderStatus.PENDING;
  
  if (compact) {
    return (
      <Card className={`mb-3 ${isOverdue ? 'border-red-300' : ''}`}>
        <CardHeader className="py-3 px-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">
                  {reminder.title}
                </CardTitle>
                <Badge className={getTypeColor(reminder.type)}>
                  {reminder.type.replace('_', ' ')}
                </Badge>
              </div>
              {reminder.contact && (
                <CardDescription className="flex items-center mt-1 text-xs">
                  <User className="h-3 w-3 mr-1" />
                  {reminder.contact.name}
                  {reminder.contact.company && ` - ${reminder.contact.company}`}
                </CardDescription>
              )}
            </div>
            <div>
              {getStatusBadge(dueStatus)}
            </div>
          </div>
        </CardHeader>
        <CardFooter className="py-2 px-4 flex justify-between border-t">
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            <span>
              {formatDate(reminder.dueDate)} at {formatTime(reminder.dueDate)}
            </span>
          </div>
          <div className="flex space-x-1">
            {isPending && onComplete && (
              <Button 
                size="sm" 
                variant="ghost"
                className="h-6 px-2 text-green-700 hover:text-green-800 hover:bg-green-50"
                onClick={() => onComplete(reminder.id)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Link href={`/networking/reminders/${reminder.id}`}>
              <Button size="sm" variant="ghost" className="h-6 px-2">
                View
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className={`mb-4 ${isOverdue ? 'border-red-300' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {reminder.title}
              <Badge className={getTypeColor(reminder.type)}>
                {reminder.type.replace('_', ' ')}
              </Badge>
            </CardTitle>
            {reminder.contact && (
              <CardDescription className="flex items-center mt-1">
                <User className="h-4 w-4 mr-1" />
                <Link 
                  href={`/networking/contacts/${reminder.contact.id}`}
                  className="hover:underline"
                >
                  {reminder.contact.name}
                </Link>
                {reminder.contact.company && ` - ${reminder.contact.company}`}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center">
            {getStatusBadge(dueStatus)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-gray-500" />
            <span>
              {formatDate(reminder.dueDate)} at {formatTime(reminder.dueDate)}
            </span>
          </div>
          {reminder.completedDate && (
            <div className="flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-600" />
              <span>Completed on {formatDate(reminder.completedDate)}</span>
            </div>
          )}
        </div>
        
        {isOverdue && (
          <div className="bg-red-50 p-3 rounded-md border border-red-200 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-700">Reminder is overdue</h4>
              <p className="text-sm text-red-600">
                This reminder was due on {formatDate(reminder.dueDate)} at {formatTime(reminder.dueDate)}.
                {isPending && ' Mark it as complete or reschedule it.'}
              </p>
            </div>
          </div>
        )}
        
        {reminder.description && (
          <div className="mt-2">
            <h4 className="text-sm font-medium mb-1">Description</h4>
            <div className="text-muted-foreground text-sm bg-gray-50 p-3 rounded-md border">
              {reminder.description}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        {isPending ? (
          <div className="flex space-x-2">
            {onComplete && (
              <Button 
                variant="outline" 
                size="sm"
                className="text-green-600 hover:bg-green-50 border-green-200"
                onClick={() => onComplete(reminder.id)}
              >
                <Check className="mr-1 h-4 w-4" />
                Mark as Complete
              </Button>
            )}
            <Link href={`/networking/reminders/${reminder.id}/edit`}>
              <Button variant="outline" size="sm">
                <Clock className="mr-1 h-4 w-4" />
                Reschedule
              </Button>
            </Link>
          </div>
        ) : (
          <div />
        )}
        <div className="flex space-x-2">
          <Link href={`/networking/reminders/${reminder.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="mr-1 h-4 w-4" />
              Edit
            </Button>
          </Link>
          {onDelete && (
            <Button 
              variant="outline" 
              size="sm"
              className="text-red-500 hover:bg-red-50"
              onClick={() => onDelete(reminder.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
