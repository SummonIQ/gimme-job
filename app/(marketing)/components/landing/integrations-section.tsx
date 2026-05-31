import { Cloud, Database, Mail, MessageSquare, Zap } from 'lucide-react';

const integrations = [
  {
    name: 'LinkedIn',
    description: 'Import your profile and sync applications',
    icon: MessageSquare,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
  },
  {
    name: 'Gmail',
    description: 'Track applications from your inbox',
    icon: Mail,
    color: 'bg-red-100 text-red-600',
  },
  {
    name: 'Indeed',
    description: 'Search and apply to jobs seamlessly',
    icon: Zap,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
  },
  {
    name: 'Glassdoor',
    description: 'Research companies and salaries',
    icon: Database,
    color: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
  },
  {
    name: 'Google Calendar',
    description: 'Schedule interviews automatically',
    icon: Cloud,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
  },
  {
    name: 'Zapier',
    description: 'Connect with 5,000+ apps',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400',
  },
];

export function IntegrationsSection() {
  return (
    <section className="bg-gradient-to-b from-white dark:from-background to-gray-50 dark:to-slate-900 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Integrations</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Works with Your Favorite Tools
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Seamlessly integrate with the platforms you already use for a unified job search experience.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:max-w-none lg:grid-cols-3">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${integration.color}`}>
                  <integration.icon className="size-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {integration.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {integration.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            And many more integrations coming soon.{' '}
            <a href="/integrations" className="font-semibold text-blue-600 hover:text-blue-700">
              View all →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
