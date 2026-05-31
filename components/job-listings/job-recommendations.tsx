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
import { Skeleton } from '@/components/ui/skeleton';
import { formatLocationLabel } from '@/lib/utils';
import { JobListing } from '@/generated/prisma/browser';
import { formatDistanceToNow } from 'date-fns';
import {
  BookmarkPlus,
  Building,
  Clock,
  DollarSign,
  ExternalLink,
  MapPin,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface JobRecommendation extends JobListing {
  matchScore: number;
  matchReasons: string[];
}

interface JobRecommendationsProps {
  recommendations: JobRecommendation[];
  isLoading?: boolean;
  onSave?: (jobId: string) => void;
  onFeedback?: (jobId: string, isPositive: boolean) => void;
  className?: string;
}

export function JobRecommendations({
  recommendations,
  isLoading = false,
  onSave,
  onFeedback,
  className,
}: JobRecommendationsProps) {
  const router = useRouter();
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [feedbackGiven, setFeedbackGiven] = useState<Map<string, boolean>>(
    new Map(),
  );

  const handleJobClick = (job: JobRecommendation) => {
    const encodedId = encodeURIComponent(job.id);
    sessionStorage.setItem(`job-${encodedId}`, JSON.stringify(job));
    router.push(`/jobs/${encodedId}`);
  };

  const handleSave = (jobId: string) => {
    setSavedJobs(prev => new Set(prev).add(jobId));
    onSave?.(jobId);
  };

  const handleFeedback = (jobId: string, isPositive: boolean) => {
    setFeedbackGiven(prev => new Map(prev).set(jobId, isPositive));
    onFeedback?.(jobId, isPositive);
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  const getMatchScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    return 'Potential Match';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Recommended Jobs
          </CardTitle>
          <CardDescription>
            Finding jobs that match your profile...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            We'll suggest jobs based on your profile, search history, and
            application patterns. Keep searching and applying to improve
            recommendations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Recommended Jobs
        </CardTitle>
        <CardDescription>
          Jobs that match your skills and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map(job => (
          <div
            key={job.id}
            className="group relative rounded-lg border p-4 transition-all hover:shadow-md"
          >
            {/* Match Score Badge */}
            <div className="absolute -top-2 -right-2 z-10">
              <Badge
                className={cn(
                  'font-semibold',
                  getMatchScoreColor(job.matchScore),
                )}
              >
                {job.matchScore}% Match
              </Badge>
            </div>

            {/* Job Details */}
            <div className="space-y-3">
              <div>
                <button
                  type="button"
                  onClick={() => handleJobClick(job)}
                  className="font-medium hover:underline line-clamp-1 text-left"
                >
                  {job.title}
                </button>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {job.company && (
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5" />
                      {job.company}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {formatLocationLabel(job.location)}
                    </span>
                  )}
                  {job.salary && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {job.salary}
                    </span>
                  )}
                </div>
              </div>

              {/* Match Reasons */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Why this is a match:
                </p>
                <div className="flex flex-wrap gap-1">
                  {job.matchReasons.map((reason, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Posted Time */}
              {job.createdAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Posted{' '}
                  {formatDistanceToNow(new Date(job.createdAt), {
                    addSuffix: true,
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(job.id)}
                    disabled={savedJobs.has(job.id)}
                  >
                    {savedJobs.has(job.id) ? (
                      <>
                        <Star className="h-4 w-4 mr-1 fill-current" />
                        Saved
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-4 w-4 mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleJobClick(job)}
                  >
                    View Details
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>

                {/* Feedback */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleFeedback(job.id, true)}
                    className={cn(
                      'h-8 w-8 p-0',
                      feedbackGiven.get(job.id) === true &&
                        'text-green-600 hover:text-green-700',
                    )}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleFeedback(job.id, false)}
                    className={cn(
                      'h-8 w-8 p-0',
                      feedbackGiven.get(job.id) === false &&
                        'text-red-600 hover:text-red-700',
                    )}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Load More */}
        <div className="text-center pt-4">
          <Button variant="outline" className="w-full">
            Load More Recommendations
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
