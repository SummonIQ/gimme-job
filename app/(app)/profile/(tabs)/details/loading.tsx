import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileDetailsLoading() {
  return (
    <Card>
      <CardHeader>
        <CardSummary>
          <CardTitle>My Details</CardTitle>
          <CardDescription>
            Edit your personal details so that resume optimization results are
            more accurate; this information is used to personalize your resume
            and cover letter and fill in any missing information.
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
