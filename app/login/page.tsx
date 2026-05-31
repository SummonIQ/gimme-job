import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Footer } from '@/app/(marketing)/components/layout/footer';
import { Header } from '@/app/(marketing)/components/layout/header';
import { ResponsiveContainer } from '@/app/(marketing)/components/layout/responsive-container';
import LoginForm from '@/components/auth/login-form';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { getCurrentUser } from '@/lib/user/query';

export default async function LoginPage(props: {
  searchParams: Promise<{ redirect_url?: string; redirect_to?: string }>;
}) {
  const user = await getCurrentUser();
  const searchParams = await props.searchParams;
  const redirectTarget =
    searchParams.redirect_url ?? searchParams.redirect_to ?? '/dashboard';

  if (user) {
    return redirect(redirectTarget);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <header role="banner" className="absolute inset-x-0 top-0 z-50">
        <Header />
      </header>

      <main
        className="relative flex min-h-[48rem] grow bg-[radial-gradient(circle_at_top,_hsl(var(--brand-2-lightest)/0.18)_0%,#fff_44%,#fff_100%)] dark:bg-[radial-gradient(circle_at_top,_hsl(var(--brand-1)_/_0.12)_0%,#020617_48%,#020617_100%)] lg:min-h-[54rem]"
        id="marketing-main"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[hsl(var(--brand-1-light))/0.12] blur-3xl dark:bg-[hsl(var(--brand-1))/0.13]" />
          <div className="absolute right-[-5rem] top-1/3 h-80 w-80 rounded-full bg-[hsl(var(--brand-2))/0.1] blur-3xl dark:bg-[hsl(var(--brand-2))/0.11]" />
          <div className="absolute bottom-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-400/8 blur-3xl dark:bg-sky-400/7" />
        </div>

        <ResponsiveContainer className="relative flex pb-24 pt-28 lg:pb-32 lg:pt-36">
          <div className="flex w-full flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
            <section className="flex-1 px-1 py-2 lg:max-w-[42rem] lg:pr-10">
              <div className="space-y-7">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/80">
                  Welcome back
                </p>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[4rem] lg:leading-[0.96]">
                  Pick up right where you left off.
                </h1>
                <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Your leads, resumes, and application progress are waiting.
                  Sign in to keep your job search moving forward.
                </p>
              </div>

              <div className="mt-12 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/40 bg-card/50 p-4 backdrop-blur-xl">
                  <p className="text-sm font-semibold text-foreground">
                    Lead tracking
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Keep outreach, applications, and follow-ups tied to the same
                    opportunity.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-card/50 p-4 backdrop-blur-xl">
                  <p className="text-sm font-semibold text-foreground">
                    Resume refinement
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Tailor your materials to each role without losing the base
                    version.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-card/50 p-4 backdrop-blur-xl">
                  <p className="text-sm font-semibold text-foreground">
                    AI assist
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Let Assist Mode handle repetitive form work while you stay
                    in control.
                  </p>
                </div>
              </div>
            </section>

            <Card className="relative w-full shrink-0 overflow-hidden rounded-3xl border-border/70 bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.16)] ring-1 ring-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 dark:shadow-black/35 dark:ring-white/10 lg:mt-6 lg:max-w-[25rem]">
              <CardHeader className="gap-1 border-b border-border/70 bg-background/50 px-6 pb-4 pt-7 dark:border-white/10 dark:bg-white/[0.03]">
                <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                  Sign in
                </CardTitle>
                <CardDescription className="max-w-sm text-sm leading-6 text-muted-foreground">
                  Use your account to get back to your dashboard.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 px-6 py-6">
                <LoginForm isLoggedIn={false} redirectUrl={redirectTarget} />
              </CardContent>

              <CardFooter className="flex items-center justify-center border-t border-border/70 bg-muted/35 px-6 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-center text-sm text-muted-foreground">
                  Not a member?{' '}
                  <Link
                    className="font-semibold text-primary no-underline underline-offset-4 hover:underline"
                    href="/signup"
                  >
                    Sign up now!
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </ResponsiveContainer>
      </main>

      <Footer />
    </div>
  );
}
