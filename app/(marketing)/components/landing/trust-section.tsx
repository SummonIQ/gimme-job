import { Award, Lock, Shield, Users } from 'lucide-react';

const trustBadges = [
  {
    icon: Shield,
    title: 'SOC 2 Certified',
    description: 'Enterprise-grade security standards',
  },
  {
    icon: Lock,
    title: 'GDPR Compliant',
    description: 'Your data privacy is protected',
  },
  {
    icon: Users,
    title: '10,000+ Users',
    description: 'Trusted by job seekers worldwide',
  },
  {
    icon: Award,
    title: '4.9/5 Rating',
    description: 'Highly rated on all platforms',
  },
];

export function TrustSection() {
  return (
    <section className="border-y border-gray-200 dark:border-gray-700 bg-white dark:bg-background py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {trustBadges.map((badge) => (
            <div key={badge.title} className="text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
                <badge.icon className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                {badge.title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
