import { type ReactNode } from 'react';

import { PageHeader } from '@/components/layout/page';
import { Responsive } from '@/components/layout/responsive';

interface AdminPageShellProps {
  children: ReactNode;
  description: string;
  title: string;
}

const AdminPageShell = ({
  children,
  description,
  title,
}: AdminPageShellProps) => {
  return (
    <Responsive center className="flex grow flex-col px-6 pb-4">
      <PageHeader title={title} description={description} />
      <div className="space-y-6">{children}</div>
    </Responsive>
  );
};

export { AdminPageShell };
