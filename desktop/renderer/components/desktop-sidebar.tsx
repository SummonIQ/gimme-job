interface DesktopSidebarProps {
  appUrl: string;
  assistUrl: string;
  mode: string;
  status: string;
  submitGuardEnabled: boolean;
}

const shellItems = [
  { label: 'Queue', value: 'No lead selected' },
  { label: 'Session', value: 'Idle' },
  { label: 'Audit', value: 'Waiting' },
] as const;

export function DesktopSidebar({
  appUrl,
  assistUrl,
  mode,
  status,
  submitGuardEnabled,
}: DesktopSidebarProps) {
  return (
    <aside aria-label="Desktop runtime sidebar" className="desktop-sidebar">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">Desktop runtime</p>
          <h1>Gimme Job</h1>
        </div>
        <span className="status-pill">{status}</span>
      </div>

      <section className="sidebar-section" aria-labelledby="views-heading">
        <h2 id="views-heading">Views</h2>
        <ViewRow label="Main app" url={appUrl} />
        <ViewRow label="ATS assist" url={assistUrl} />
      </section>

      <section className="sidebar-section" aria-labelledby="mode-heading">
        <h2 id="mode-heading">Mode</h2>
        <div className="mode-row">
          <span>{mode}</span>
          <strong>
            {submitGuardEnabled ? 'Submit guard on' : 'Submit guard off'}
          </strong>
        </div>
      </section>

      <section className="sidebar-section" aria-labelledby="state-heading">
        <h2 id="state-heading">State</h2>
        <div className="state-list">
          {shellItems.map(item => (
            <div className="state-row" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function ViewRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="view-row">
      <span>{label}</span>
      <strong title={url}>{url}</strong>
    </div>
  );
}
