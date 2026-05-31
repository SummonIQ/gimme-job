'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function NewsletterSection() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter signup
    console.log('Newsletter signup:', email);
  };

  return (
    <section className="bg-gradient-to-br from-blue-50 dark:from-slate-900 to-purple-50 dark:to-slate-800 py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Stay Updated with Job Search Tips
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Get weekly insights, resume tips, and job search strategies delivered to your inbox.
          </p>
          
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full sm:w-80 bg-white dark:bg-slate-900 border-gray-300 dark:border-gray-700 shadow-sm"
              required
            />
            <Button type="submit" size="lg">
              Subscribe
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Join 5,000+ subscribers. Unsubscribe anytime. No spam, ever.
          </p>
        </div>
      </div>
    </section>
  );
}
