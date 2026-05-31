import { UpgradeContent } from '@/components/subscription/upgrade-content';

interface UpgradePageProps {
  searchParams: Promise<{ feature?: string }>;
}

export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  const { feature } = await searchParams;

  return (
    <div className="container max-w-3xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Upgrade to Pro</h1>
        <p className="mt-2 text-muted-foreground">
          Unlock powerful AI features to supercharge your job search.
        </p>
      </div>
      <UpgradeContent feature={feature} />
    </div>
  );
}
