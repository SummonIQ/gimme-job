import { MessageCircle, Users, Zap } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function CommunitySection() {
  return (
    <section className="bg-gradient-to-b from-gray-50 dark:from-slate-900 to-white dark:to-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Community</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            You're Not Alone in Your Journey
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Join thousands of job seekers supporting each other, sharing tips, and celebrating wins together.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl gap-8 lg:max-w-none lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
            <div className="mb-4 inline-flex rounded-lg bg-blue-100 dark:bg-blue-500/20 p-3">
              <MessageCircle className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Community Forum
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Ask questions, share experiences, and get advice from peers who understand your journey.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">2,500+</span> active members
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
            <div className="mb-4 inline-flex rounded-lg bg-purple-100 dark:bg-purple-500/20 p-3">
              <Users className="size-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Weekly Meetups
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Join virtual meetups to network, practice interviews, and learn from industry professionals.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">Every Wednesday</span> at 6 PM ET
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
            <div className="mb-4 inline-flex rounded-lg bg-green-100 dark:bg-green-500/20 p-3">
              <Zap className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Success Stories
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Get inspired by members who landed their dream jobs and learn from their strategies.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">500+</span> success stories shared
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Button asChild size="lg">
            <Link href="/community">Join the Community</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
