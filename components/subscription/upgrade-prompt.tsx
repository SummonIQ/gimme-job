import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface UpgradePromptProps {
  feature?: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

const FEATURES = [
  'AI-Guided Job Application Assist',
  'Automated Application Submission',
  'Advanced Resume Optimization',
  'Priority Job Matching',
];

const UpgradePrompt = ({
  feature,
  title = 'Upgrade to Pro',
  description,
  compact = false,
}: UpgradePromptProps) => {
  const defaultDescription = feature
    ? `${feature} is a Pro feature. Upgrade to unlock it and supercharge your job search.`
    : 'Unlock powerful AI features to supercharge your job search.';

  const upgradeHref = feature
    ? `/upgrade?feature=${encodeURIComponent(feature)}`
    : '/upgrade';

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <p className="font-medium">{title}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {description || defaultDescription}
        </p>
        <Button asChild size="sm">
          <Link href={upgradeHref}>
            <Sparkles className="h-4 w-4" />
            Upgrade — $39/mo
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description || defaultDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              {f}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={upgradeHref}>
            <Sparkles className="h-4 w-4" />
            Upgrade — $39/mo
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
UpgradePrompt.displayName = 'UpgradePrompt';

export { UpgradePrompt };
