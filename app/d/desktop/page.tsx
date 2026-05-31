import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DOWNLOAD_URL =
  'https://hwrfvrfenycmhhuw.public.blob.vercel-storage.com/desktop/GimmeJob-0.1.0-arm64.dmg';

export const metadata: Metadata = {
  title: 'Gimme Job Desktop',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

const steps = [
  {
    title: 'Download the DMG',
    body: 'Click the button above. The installer is about 110 MB.',
  },
  {
    title: 'Drag Gimme Job to Applications',
    body: 'The DMG opens to a drag-and-drop installer window.',
  },
  {
    title: 'First-launch warning',
    body: 'macOS may say the developer is unverified. Right-click the app in Applications and choose Open to bypass the Gatekeeper warning.',
  },
  {
    title: 'Sign in',
    body: 'The app prompts you to sign in with your Gimme Job account on launch.',
  },
];

export default function DesktopDownloadPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Preview build · macOS · Apple Silicon
        </p>
        <h1 className="mt-4 text-5xl font-black tracking-tight">
          Gimme Job Desktop
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-7 text-muted-foreground">
          The desktop companion app. Sits on top of job application forms and
          fills them out using your saved profile, resume, and the training
          you&apos;ve already given the model.
        </p>

        <div className="mt-10">
          <Button asChild size="lg" className="w-fit">
            <a href={DOWNLOAD_URL} download>
              <Download className="mr-2 h-4 w-4" />
              Download Gimme Job for Mac
            </a>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            v0.1.0 · Apple Silicon (arm64) · ~110 MB
          </p>
        </div>

        <section className="mt-16 border-t pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Setup
          </h2>
          <ol className="mt-6 space-y-5">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-bold">
                  {index + 1}
                </span>
                <div>
                  <p className="text-base font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-auto pt-16 text-xs text-muted-foreground">
          This page is unlisted. Share the URL only with people you trust.
        </p>
      </div>
    </main>
  );
}
