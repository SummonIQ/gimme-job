import { Download } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/css';

export function DownloadResume({ url }: { url: string }) {
  return (
    <Link
      className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
      href={url}
    >
      <Download className="size-4" />
      <span>Download Resume</span>
    </Link>
  );
}
