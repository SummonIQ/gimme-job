import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function JobPreferencesLoading() {
  return (
    <Card>
      <CardHeader>
        <CardSummary>
          <CardTitle>Job Preferences</CardTitle>
          <CardDescription>
            Edit your job preferences so that resume optimization results are
            more accurate.
          </CardDescription>
        </CardSummary>
      </CardHeader>
      <CardContent className="pt-4 md:pt-5">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}
