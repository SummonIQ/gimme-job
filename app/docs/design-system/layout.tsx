import { ReactNode } from 'react';

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-8">{children}</div>
    </div>
  );
}
