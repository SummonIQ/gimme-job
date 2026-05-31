import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const TableSkeleton = ({ card = false }: { card?: boolean }) => {
  const content = (
    <>
      <div className="flex items-center justify-between pb-2 opacity-70">
        <Input
          className="w-56 max-w-sm"
          disabled
          placeholder="Search..."
          type="search"
        />
      </div>

      <div className="rounded-t-md border-x border-t border-border/50 bg-background/60">
        <div className="flex h-[56.5px] items-center space-x-4 border-b border-border/70 p-3 px-5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>

        <div className="flex h-[56.5px] items-center space-x-4 border-b border-border/50 px-5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>

        <div className="flex h-[56.5px] items-center space-x-4 border-b border-border/50 px-5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      <div className="flex h-[58px] items-center justify-between space-x-4 rounded-b-md border border-border/40 bg-accent/10 px-5">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </>
  );

  if (card) {
    return (
      <Card className="border-border/40 drop-shadow-sm">
        <CardContent className="bg-accent/30 p-2 md:p-2">{content}</CardContent>
      </Card>
    );
  }

  return content;
};
TableSkeleton.displayName = 'TableSkeleton';

export { TableSkeleton };
