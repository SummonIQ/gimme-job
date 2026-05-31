'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, History, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { redirectIfUnauthorized } from '@/lib/auth/redirect-if-unauthorized';
import { createJobSearch } from '@/lib/job-searches/create';

interface IndeedSearchFormProps {
  hasApiKey: boolean;
  recentSearches?: Array<{
    id: string;
    query: string;
    location?: string;
    radius?: number;
  }>;
}

// Form validation schema
const formSchema = z.object({
  query: z.string().min(1, 'Search term is required'),
  location: z.string().optional(),
  radius: z.coerce.number().optional(),
  jobType: z
    .enum(['fulltime', 'parttime', 'contract', 'internship', 'temporary', ''])
    .optional(),
  fromage: z.coerce.number().optional(),
  remote: z.boolean().default(false),
  sortBy: z.enum(['relevance', 'date']).default('relevance'),
  saveSearch: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export function IndeedSearchForm({
  hasApiKey,
  recentSearches = [],
}: IndeedSearchFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: '',
      location: '',
      radius: 25,
      jobType: '',
      fromage: 30,
      remote: false,
      sortBy: 'relevance',
      saveSearch: true,
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    try {
      // Create a job search in the database
      const result = await createJobSearch({
        searchTerm: data.query,
        location: data.location || null,
        radius: data.radius || null,
        jobType: data.jobType || null,
        remote: data.remote,
        sortBy: data.sortBy,
        provider: 'INDEED',
        saveSearch: data.saveSearch,
      });

      if (result.success) {
        toast({
          title: 'Search started',
          description: "We're searching for jobs that match your criteria.",
        });

        // Redirect to the job search results page
        router.push(`/jobs/searches/${result.jobSearchId}`);
      } else {
        const redirected: boolean = await redirectIfUnauthorized(result.error);
        if (redirected) return;
        toast({
          variant: 'destructive',
          title: 'Search failed',
          description:
            result.error || 'There was a problem starting your job search.',
        });
      }
    } catch (error) {
      const redirected: boolean = await redirectIfUnauthorized(error);
      if (redirected) return;
      toast({
        variant: 'destructive',
        title: 'Search failed',
        description:
          error instanceof Error
            ? error.message
            : 'There was a problem starting your job search.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle loading a recent search
  const handleLoadRecentSearch = (search: (typeof recentSearches)[0]) => {
    form.setValue('query', search.query);
    if (search.location) form.setValue('location', search.location);
    if (search.radius) form.setValue('radius', search.radius);
    setShowRecentSearches(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>What</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Job title, keywords, or company"
                      className="pl-9"
                      {...field}
                    />
                    {recentSearches.length > 0 && (
                      <div className="absolute right-3 top-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="h-5 px-2"
                          onClick={() =>
                            setShowRecentSearches(!showRecentSearches)
                          }
                        >
                          <History className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Recent</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Where</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="City, state, or zip code"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="radius"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distance</FormLabel>
                <Select
                  onValueChange={value => field.onChange(parseInt(value))}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Search radius" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="5">Within 5 miles</SelectItem>
                    <SelectItem value="10">Within 10 miles</SelectItem>
                    <SelectItem value="25">Within 25 miles</SelectItem>
                    <SelectItem value="50">Within 50 miles</SelectItem>
                    <SelectItem value="100">Within 100 miles</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="jobType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Any job type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Any job type</SelectItem>
                    <SelectItem value="fulltime">Full-time</SelectItem>
                    <SelectItem value="parttime">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fromage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date Posted</FormLabel>
                <Select
                  onValueChange={value => field.onChange(parseInt(value))}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">Last 24 hours</SelectItem>
                    <SelectItem value="3">Last 3 days</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col space-y-4">
          <FormField
            control={form.control}
            name="remote"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Remote Jobs Only</FormLabel>
                  <FormDescription>
                    Only show jobs that can be done remotely
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sortBy"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Sort Results By</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-4"
                  >
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="relevance" />
                      </FormControl>
                      <FormLabel className="font-normal">Relevance</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="date" />
                      </FormControl>
                      <FormLabel className="font-normal">Date</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="saveSearch"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Save this search</FormLabel>
                  <FormDescription>
                    Save this search for later use and enable job alerts
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        {!hasApiKey && (
          <div className="text-sm text-amber-500 bg-amber-50 p-3 rounded-md">
            <p>
              You haven't set up your Indeed API key yet. Search results may be
              limited.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>
      </form>

      {showRecentSearches && recentSearches.length > 0 && (
        <div className="mt-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium">
                Recent Searches
              </CardTitle>
              <CardDescription>
                Select a previous search to load it
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <ul className="space-y-2">
                {recentSearches.map(search => (
                  <li
                    key={search.id}
                    className="flex items-start p-2 hover:bg-muted rounded-md cursor-pointer transition-colors"
                    onClick={() => handleLoadRecentSearch(search)}
                  >
                    <Search className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{search.query}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {search.location && (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />{' '}
                            {search.location}
                          </Badge>
                        )}
                        {search.radius && (
                          <Badge variant="outline" className="text-xs">
                            {search.radius} miles
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowRecentSearches(false)}
              >
                Close
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </Form>
  );
}
