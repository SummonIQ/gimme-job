import { Clock, DollarSign, Target, TrendingUp } from 'lucide-react';
import Image from 'next/image';

const benefits = [
  {
    title: 'Save 10+ Hours Weekly',
    description: 'Automate repetitive tasks and focus on what matters - preparing for interviews.',
    icon: Clock,
    stat: '10+ hours',
    statLabel: 'saved per week',
  },
  {
    title: '3x More Interviews',
    description: 'Our optimized resumes and targeted applications get you noticed by recruiters.',
    icon: Target,
    stat: '3x',
    statLabel: 'more interviews',
  },
  {
    title: '40% Faster Hiring',
    description: 'Land job offers faster with our systematic approach and automated follow-ups.',
    icon: TrendingUp,
    stat: '40%',
    statLabel: 'faster hiring',
  },
  {
    title: 'Higher Salary Offers',
    description: 'Better preparation and more offers lead to stronger negotiating power.',
    icon: DollarSign,
    stat: '$15k+',
    statLabel: 'avg. salary increase',
  },
];

export function BenefitsSection() {
  return (
    <section className="bg-white dark:bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Real results</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Why Job Seekers Love Us
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Join thousands of successful job seekers who landed their dream roles with Gimme Job.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:mt-20 lg:max-w-none lg:grid-cols-2 lg:gap-12">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all hover:shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
                  <benefit.icon className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {benefit.description}
                  </p>
                  <div className="mt-4 inline-flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {benefit.stat}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {benefit.statLabel}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Hover effect gradient */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 to-purple-50 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
