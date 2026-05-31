'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { ShareableResourceType } from '@/lib/sharing/types';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SharedResource {
  id: string;
  type: ShareableResourceType;
  name: string;
  content: any;
  allowFeedback?: boolean;
}

export default function SharedResourcePage() {
  const { token } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [resource, setResource] = useState<SharedResource | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchResource = async () => {
      try {
        const response = await fetch(`/api/sharing/access?token=${token}`);

        if (!response.ok) {
          throw new Error('Failed to fetch shared resource');
        }

        const data = await response.json();

        // Transform the resource data into a consistent format
        const resource = data.data;
        let transformedResource: SharedResource = {
          id: resource.id,
          type: resource.jobListing
            ? ShareableResourceType.JOB_LEAD
            : ShareableResourceType.RESUME,
          name:
            resource.jobListing?.title || resource.name || 'Shared Resource',
          content: resource,
          allowFeedback: true, // This would come from the share link in a real implementation
        };

        setResource(transformedResource);
      } catch (error) {
        console.error('Error fetching shared resource:', error);
        toast({
          title: 'Error',
          description:
            'Failed to load the shared resource. The link may be expired or invalid.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResource();
  }, [token]);

  const handleSendFeedback = async () => {
    if (!feedback.trim()) {
      toast({
        title: 'Empty feedback',
        description: 'Please enter your feedback before submitting',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingFeedback(true);

    try {
      const response = await fetch('/api/sharing/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          content: feedback,
          createdByName: feedbackName || undefined,
          createdByEmail: feedbackEmail || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send feedback');
      }

      setFeedbackSent(true);
      toast({
        title: 'Feedback sent',
        description: 'Your feedback has been sent successfully',
      });
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to send feedback',
        variant: 'destructive',
      });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Shared Resource</CardTitle>
            <CardDescription>Fetching the shared content...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Spinner size="sm" />
              <span>Loading shared resource...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="container mx-auto max-w-2xl py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">
              Error Loading Resource
            </CardTitle>
            <CardDescription>
              The shared resource could not be loaded. The link may be expired
              or invalid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>This could be due to one of the following reasons:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>The share link has expired</li>
              <li>The share link has been revoked</li>
              <li>The resource no longer exists</li>
              <li>You do not have permission to access this resource</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <a href="/">Go to Home</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <div className="mb-6">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">{resource.name}</h1>
          <span className="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            Shared{' '}
            {resource.type === ShareableResourceType.JOB_LEAD
              ? 'Job Lead'
              : 'Resume'}
          </span>
        </div>
      </div>

      <Tabs defaultValue="resource" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resource">Resource</TabsTrigger>
          {resource.allowFeedback && (
            <TabsTrigger value="feedback">Provide Feedback</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="resource" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {resource.type === ShareableResourceType.JOB_LEAD
                  ? 'Job Lead Details'
                  : 'Resume'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resource.type === ShareableResourceType.JOB_LEAD ? (
                // Render job lead content
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Company</h3>
                    <p>
                      {resource.content.jobListing?.company || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Location</h3>
                    <p>
                      {resource.content.jobListing?.location || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Description</h3>
                    <div className="whitespace-pre-wrap rounded-md border p-4 bg-gray-50">
                      {resource.content.jobListing?.description ||
                        'No description provided'}
                    </div>
                  </div>
                </div>
              ) : (
                // Render resume content
                <div className="space-y-4">
                  {resource.content.markdown ? (
                    <div className="whitespace-pre-wrap rounded-md border p-4 bg-gray-50">
                      {resource.content.markdown}
                    </div>
                  ) : resource.content.revisions?.[0]?.markdown ? (
                    <div className="whitespace-pre-wrap rounded-md border p-4 bg-gray-50">
                      {resource.content.revisions[0].markdown}
                    </div>
                  ) : (
                    <p>
                      This resume has no content available in markdown format.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {resource.allowFeedback && (
          <TabsContent value="feedback">
            <Card>
              <CardHeader>
                <CardTitle>Provide Feedback</CardTitle>
                <CardDescription>
                  Share your thoughts and suggestions about this{' '}
                  {resource.type === ShareableResourceType.JOB_LEAD
                    ? 'job lead'
                    : 'resume'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!feedbackSent ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Your Name (optional)</Label>
                      <Input
                        id="name"
                        value={feedbackName}
                        onChange={e => setFeedbackName(e.target.value)}
                        placeholder="Enter your name"
                        disabled={isSendingFeedback}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Your Email (optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={feedbackEmail}
                        onChange={e => setFeedbackEmail(e.target.value)}
                        placeholder="Enter your email"
                        disabled={isSendingFeedback}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedback">Feedback</Label>
                      <Textarea
                        id="feedback"
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="Enter your feedback..."
                        rows={6}
                        disabled={isSendingFeedback}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="mx-auto w-12 h-12 bg-green-100 text-green-800 rounded-full flex items-center justify-center mb-4">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium mb-2">
                      Feedback Sent Successfully!
                    </h3>
                    <p className="text-muted-foreground">
                      Thank you for providing your feedback.
                    </p>
                  </div>
                )}
              </CardContent>
              {!feedbackSent && (
                <CardFooter className="flex justify-end">
                  <Button
                    onClick={handleSendFeedback}
                    disabled={isSendingFeedback || !feedback.trim()}
                  >
                    {isSendingFeedback ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Sending...
                      </>
                    ) : (
                      'Send Feedback'
                    )}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
