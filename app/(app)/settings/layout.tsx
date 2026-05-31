// import { auth } from '@clerk/nextjs';
import type { PropsWithChildren } from 'react';

import { Page, PageHeader } from '@/components/layout/page';
import { SettingsMenu } from '@/components/user/settings-menu';
// import { Heading } from '@/components/ui/heading';

export default async function SettingsLayout({ children }: PropsWithChildren) {
  // const session = await auth();

  // if (!session || session.user) {
  //   throw new Error('User not found');
  // }

  // const user = await getUser(session.user.id);

  return (
    <Page card={false} name="settings">
        <PageHeader title="Settings" />
        <div className="flex grow flex-col overflow-clip rounded-xl border border-border/30 bg-page md:flex-row">
          <div className="shrink-0 border-b border-border/50 bg-sidebar p-3 md:w-56 md:border-b-0 md:border-r">
            <SettingsMenu />
          </div>

          <div className="flex grow flex-col bg-page p-4 px-5">{children}</div>
        </div>
    </Page>
  );
}
