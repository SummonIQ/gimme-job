import { ReactNode } from 'react';

import { requireAdminUser } from './require-admin-user';

export default async function AdminAreaLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminUser();

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-x-0 top-0 z-0 flex items-start justify-center overflow-hidden"
        style={{ transform: 'translateY(-25%)' }}
      >
        <span
          className="block whitespace-nowrap font-black uppercase leading-none tracking-tighter text-foreground/3"
          style={{ fontSize: '38vw' }}
        >
          Admin
        </span>
      </div>
      <div>{children}</div>
    </>
  );
}
