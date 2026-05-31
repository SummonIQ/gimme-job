import { DesktopSidebar } from '../components/desktop-sidebar';

const appUrl =
  import.meta.env.VITE_GIMME_JOB_APP_URL ?? 'https://app.gimme-job.com';
const assistUrl =
  import.meta.env.VITE_GIMME_JOB_ASSIST_URL ??
  'https://job-boards.greenhouse.io';

export function DesktopApp() {
  return (
    <main className="desktop-shell">
      <DesktopSidebar
        appUrl={appUrl}
        assistUrl={assistUrl}
        mode="Training"
        status="Ready"
        submitGuardEnabled
      />
    </main>
  );
}
