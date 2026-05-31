import { ArrowRight, BookOpen, FileText, Video } from 'lucide-react';
import Link from 'next/link';

const resources = [
  {
    type: 'Guide',
    title: 'The Ultimate Resume Optimization Guide',
    description: 'Learn how to create an ATS-friendly resume that gets you interviews.',
    icon: FileText,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    readTime: '15 min read',
  },
  {
    type: 'Video',
    title: 'Interview Preparation Masterclass',
    description: 'Master common interview questions and stand out from other candidates.',
    icon: Video,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
    readTime: '30 min watch',
  },
  {
    type: 'Article',
    title: 'Salary Negotiation Tactics That Work',
    description: 'Get the compensation you deserve with proven negotiation strategies.',
    icon: BookOpen,
    color: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    readTime: '10 min read',
  },
];

export function ResourcesSection() {
  return (
    <section className="bg-white dark:bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Resources</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Learn from the Experts
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Free guides, tutorials, and resources to help you succeed in your job search.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl gap-8 sm:mt-20 lg:max-w-none lg:grid-cols-3">
          {resources.map((resource) => (
            <article
              key={resource.title}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all hover:shadow-lg"
            >
              <div className={`mb-4 inline-flex rounded-lg ${resource.color} p-3`}>
                <resource.icon className="size-6" />
              </div>

              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-600">
                  {resource.type}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{resource.readTime}</span>
              </div>

              <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
                {resource.title}
              </h3>

              <p className="mb-4 text-gray-600 dark:text-gray-400">{resource.description}</p>

              <Link
                href={`/resources/${resource.title.toLowerCase().replace(/\s+/g, '-')}`}
                className="inline-flex items-center text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                Read more
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/resources"
            className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View all resources
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
