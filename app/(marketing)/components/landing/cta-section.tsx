'use client';

import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/client';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { SmoothGradient } from './smooth-gradient';

const benefits = [
  'Free forever for basic features',
  'No credit card required',
  'Start optimizing in minutes',
  'Cancel anytime',
];

export function CTASection() {
  const { data: session } = useSession();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Update after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!session?.user);
  }, [session?.user]);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 py-24 sm:py-32">
      {/* Smooth animated gradient background */}
      <SmoothGradient />

      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-900/30 via-transparent to-purple-900/30" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Land Your Dream Job?
          </h2>
          <p className="mt-6 text-lg leading-8 text-blue-100">
            Join thousands of successful job seekers who are using Gimme Job to
            accelerate their careers. Get started today.
          </p>

          {/* Benefits */}
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {benefits.map(benefit => (
              <div
                key={benefit}
                className="flex items-center justify-center gap-2 text-white sm:justify-start"
              >
                <CheckCircle2 className="size-5 shrink-0 text-green-300" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div
            className={`mt-10 flex flex-col items-center justify-center gap-4 transition-opacity duration-500 sm:flex-row ${mounted ? 'opacity-100' : 'opacity-0'}`}
          >
            <Button asChild size="lg" className="min-w-[180px]">
              <Link href={isLoggedIn ? '/dashboard' : '/signup'}>
                <span className="inline-flex items-center justify-center gap-2">
                  {isLoggedIn ? 'Go to App' : 'Get Started Free'}
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-w-[180px] border-white text-white hover:bg-white/10"
            >
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-blue-200">
            Free forever for basic features • Pro plan cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
