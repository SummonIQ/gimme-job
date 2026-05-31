import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardActions,
  CardDescription,
  CardHeader,
  CardSummary,
  CardTitle,
} from '@/components/ui/card';
import { CardContent } from '@/components/ui/card';

export default function ProfileResumesLoading() {
  return (
    <Card className="opacity-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardSummary>
          <CardTitle>My Resumes</CardTitle>
          <CardDescription>View and manage your resumes.</CardDescription>
        </CardSummary>

        <CardActions>
          <Button className="opacity-50" disabled size="sm">
            New Resume
          </Button>
        </CardActions>
      </CardHeader>
      <CardContent className="bg-accent/30 p-2 md:p-2">
        <TableSkeleton card={false} />
      </CardContent>
    </Card>
  );
}
