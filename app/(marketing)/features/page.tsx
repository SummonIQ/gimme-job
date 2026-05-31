import {
  Bot,
  Calendar,
  FileSearch,
  Search,
  Shield,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Features - Gimme Job',
  description:
    'Discover all the powerful features that make Gimme Job the best AI-powered job search platform.',
};

const allFeatures = [
  {
    name: 'AI Resume Optimizer',
    description:
      'Automatically optimize your resume for ATS systems and specific job descriptions with AI-powered suggestions. Our advanced algorithms analyze your resume against job requirements and suggest improvements.',
    icon: Bot,
    benefits: [
      'ATS compatibility check',
      'Keyword optimization',
      'Industry-specific recommendations',
      'Real-time scoring',
    ],
  },
  {
    name: 'Smart Job Matching',
    description:
      'Get personalized job recommendations based on your skills, experience, and preferences. Our AI learns from your interactions to provide increasingly relevant suggestions.',
    icon: Target,
    benefits: [
      'Personalized recommendations',
      'Skills-based matching',
      'Salary range filtering',
      'Location preferences',
    ],
  },
  {
    name: 'Application Tracking',
    description:
      'Keep track of all your applications in one central dashboard. Never lose track of where you applied or when to follow up.',
    icon: Calendar,
    benefits: [
      'Centralized dashboard',
      'Status tracking',
      'Follow-up reminders',
      'Document organization',
    ],
  },
  {
    name: 'Interview Preparation',
    description:
      'Research companies and interviewers with our comprehensive database. Get AI-powered interview prep tailored to each specific role.',
    icon: FileSearch,
    benefits: [
      'Company research tools',
      'Interviewer profiles',
      'Question predictions',
      'Answer frameworks',
    ],
  },
  {
    name: 'Analytics Dashboard',
    description:
      "Track your job search metrics and optimize your strategy with data-driven insights. Understand what works and what doesn't.",
    icon: TrendingUp,
    benefits: [
      'Response rate tracking',
      'Success metrics',
      'A/B testing',
      'Performance insights',
    ],
  },
  {
    name: 'Application Automation',
    description:
      'Speed up your applications with smart form filling and automated follow-ups. Save hours of repetitive work.',
    icon: Zap,
    benefits: [
      'Auto-fill forms',
      'Template management',
      'Bulk applications',
      'Scheduled follow-ups',
    ],
  },
  {
    name: 'Advanced Search',
    description:
      "Find exactly what you're looking for with powerful search filters and saved searches. Never miss a relevant opportunity.",
    icon: Search,
    benefits: [
      'Advanced filters',
      'Saved searches',
      'Email alerts',
      'Custom criteria',
    ],
  },
  {
    name: 'Collaboration Tools',
    description:
      'Share your progress with mentors, career coaches, or accountability partners. Get feedback and support throughout your journey.',
    icon: Users,
    benefits: [
      'Shared dashboards',
      'Notes and feedback',
      'Progress sharing',
      'Team workspace',
    ],
  },
  {
    name: 'Data Security',
    description:
      'Your data is encrypted and secure. We take privacy seriously and give you full control over your information.',
    icon: Shield,
    benefits: [
      'End-to-end encryption',
      'GDPR compliant',
      'Data export',
      'Privacy controls',
    ],
  },
];

const featureToneClasses = [
  {
    icon: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/15 dark:bg-violet-300/10 dark:text-violet-200',
    marker: 'bg-violet-500 dark:bg-violet-300',
    glow: 'from-violet-50 via-white to-white dark:from-violet-500/10 dark:via-white/[0.03] dark:to-transparent',
  },
  {
    icon: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/15 dark:bg-rose-300/10 dark:text-rose-200',
    marker: 'bg-rose-500 dark:bg-rose-300',
    glow: 'from-rose-50 via-white to-white dark:from-rose-500/10 dark:via-white/[0.03] dark:to-transparent',
  },
  {
    icon: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-300/15 dark:bg-fuchsia-300/10 dark:text-fuchsia-200',
    marker: 'bg-fuchsia-500 dark:bg-fuchsia-300',
    glow: 'from-fuchsia-50 via-white to-white dark:from-fuchsia-500/10 dark:via-white/[0.03] dark:to-transparent',
  },
] as const;

export default function FeaturesPage() {
  return (
    <div className="bg-white pb-24 pt-32 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pb-32 sm:pt-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center pt-12 sm:pt-16 mb-24 sm:mb-32">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Everything You Need to Land Your Dream Job
          </h1>
          <p className="mt-8 text-lg leading-8 text-slate-600 dark:text-slate-300">
            Powerful features designed to streamline every step of your job
            search journey, from resume optimization to offer negotiation.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mx-auto grid max-w-2xl gap-8 lg:max-w-none lg:grid-cols-3">
          {allFeatures.map((feature, index) => {
            const tone = featureToneClasses[index % featureToneClasses.length];

            return (
              <div
                key={feature.name}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300/60 hover:shadow-[0_28px_60px_-36px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_26px_60px_-34px_rgba(0,0,0,0.85)] dark:hover:border-rose-300/20 dark:hover:bg-white/[0.06]"
              >
                <div className={`mb-4 inline-flex rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${tone.icon}`}>
                  <feature.icon className="size-6" />
                </div>

                <h3 className="mb-3 text-xl font-semibold text-slate-950 dark:text-white">
                  {feature.name}
                </h3>

                <p className="mb-4 text-slate-600 dark:text-slate-300">
                  {feature.description}
                </p>

                <ul className="space-y-2">
                  {feature.benefits.map(benefit => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <div className={`size-1.5 rounded-full ${tone.marker}`} />
                      {benefit}
                    </li>
                  ))}
                </ul>

                {/* Hover gradient */}
                <div className={`absolute inset-0 -z-10 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100 ${tone.glow}`} />
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-20 rounded-2xl border border-violet-300/20 bg-[radial-gradient(circle_at_top_left,rgba(232,116,170,0.34),transparent_34%),linear-gradient(135deg,#8b5cf6,#be185d)] px-6 py-16 text-center shadow-[0_30px_80px_-46px_rgba(139,92,246,0.75)] dark:border-white/10 sm:px-16">
          <h2 className="text-3xl font-bold text-white">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Build a calmer, more organized job search with the tools that keep
            your pipeline moving.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              className="bg-white text-violet-700 hover:bg-rose-50"
            >
              <Link href="/signup">Get Started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
            >
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
