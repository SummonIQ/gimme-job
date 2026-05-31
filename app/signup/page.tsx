import { Suspense } from 'react';
import Link from 'next/link';

import { Footer } from '@/app/(marketing)/components/layout/footer';
import { Header } from '@/app/(marketing)/components/layout/header';
import { ResponsiveContainer } from '@/app/(marketing)/components/layout/responsive-container';
import { SignupForm } from '@/components/auth/signup-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

async function SignupFormWithRedirect({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ redirect_url?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  return <SignupForm redirectUrl={searchParams.redirect_url} />;
}

export default function SignupPage(props: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-foreground dark:bg-slate-950">
      <header role="banner" className="absolute inset-x-0 top-0 z-50">
        <Header />
      </header>

      <main
        className="relative flex min-h-[48rem] grow bg-[radial-gradient(circle_at_top,_hsl(var(--brand-2-lightest)/0.18)_0%,#fff_44%,#fff_100%)] dark:bg-[radial-gradient(circle_at_top,_hsl(var(--brand-1)_/_0.12)_0%,#020617_48%,#020617_100%)] lg:min-h-[54rem]"
        id="marketing-main"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-[hsl(var(--brand-1-light))/0.24] blur-3xl dark:opacity-30" />
          <div className="absolute right-[-4rem] top-1/3 h-64 w-64 rounded-full bg-[hsl(var(--brand-2))/0.14] blur-3xl dark:opacity-30" />
          <div className="absolute bottom-[-3rem] left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-[hsl(var(--brand-2-lightest))/0.45] blur-3xl dark:opacity-20" />
        </div>

        <ResponsiveContainer className="relative flex pb-24 pt-28 lg:pb-32 lg:pt-36">
          <div className="flex w-full flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
            <section className="flex-1 px-1 py-2 lg:max-w-[42rem] lg:pr-10">
              <div className="space-y-7">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/80">
                  Start strong
                </p>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[4rem] lg:leading-[0.96]">
                  Build a sharper job search system from day one.
                </h1>
                <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Create your account to organize leads, tailor resumes, and use
                  AI Assist to move through applications with less friction.
                </p>
              </div>

              <div className="mt-12 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/40 bg-card/50 p-4 backdrop-blur-xl">
                  <p className="text-sm font-semibold text-foreground">
                    Organized pipeline
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Track every role from discovery to interview without losing
                    context.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-card/50 p-4 backdrop-blur-xl">
                  <p className="text-sm font-semibold text-foreground">
                    Smarter resumes
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Keep polished base resumes and adapt them to the jobs that
                    matter.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-card/50 p-4 backdrop-blur-xl">
                  <p className="text-sm font-semibold text-foreground">
                    Faster applications
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use Assist Mode to reduce repetitive field entry and stay
                    focused on quality.
                  </p>
                </div>
              </div>
            </section>

            <Card className="relative w-full shrink-0 overflow-hidden rounded-3xl border-border/70 bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.16)] ring-1 ring-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 dark:shadow-black/35 dark:ring-white/10 lg:mt-6 lg:max-w-[25rem]">
              <CardHeader className="gap-1 border-b border-border/70 bg-background/50 px-6 pb-4 pt-7 dark:border-white/10 dark:bg-white/[0.03]">
                <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                  Create your account
                </CardTitle>
                <CardDescription className="max-w-sm text-sm leading-6 text-muted-foreground">
                  Set up your profile and start managing your search.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-6 py-6">
                <Suspense fallback={null}>
                  <SignupFormWithRedirect
                    searchParamsPromise={props.searchParams}
                  />
                </Suspense>
              </CardContent>

              <CardFooter className="flex items-center justify-center border-t border-border/70 bg-muted/35 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    className="font-semibold text-primary no-underline underline-offset-4 hover:underline"
                    href="/login"
                  >
                    Login
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
