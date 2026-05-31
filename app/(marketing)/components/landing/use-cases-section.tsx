import { Briefcase, GraduationCap, TrendingUp, Users } from 'lucide-react';

const useCases = [
  {
    title: 'Recent Graduates',
    description: 'Land your first role with optimized materials and guided job search strategies.',
    icon: GraduationCap,
    stats: '2,500+ graduates hired',
    features: ['Entry-level focus', 'Resume building', 'Interview prep'],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'Career Changers',
    description: 'Transition to a new industry with tailored resume optimization and skills mapping.',
    icon: TrendingUp,
    stats: '1,800+ successful transitions',
    features: ['Skills translation', 'Industry insights', 'Network building'],
    color: 'from-purple-500 to-pink-500',
  },
  {
    title: 'Senior Professionals',
    description: 'Find executive and leadership roles with advanced search and networking tools.',
    icon: Briefcase,
    stats: '900+ executives placed',
    features: ['Executive search', 'Salary negotiation', 'Leadership prep'],
    color: 'from-orange-500 to-red-500',
  },
  {
    title: 'Freelancers & Contractors',
    description: 'Find contract opportunities and manage multiple applications efficiently.',
    icon: Users,
    stats: '3,200+ contracts secured',
    features: ['Contract tracking', 'Rate optimization', 'Client management'],
    color: 'from-green-500 to-emerald-500',
  },
];

export function UseCasesSection() {
  return (
    <section className="bg-white dark:bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">For everyone</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Built for Every Stage of Your Career
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Whether you're just starting out or looking for your next executive role,
            Gimme Job adapts to your unique needs.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl gap-8 sm:mt-20 lg:max-w-none lg:grid-cols-2">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all hover:shadow-xl"
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${useCase.color} opacity-0 transition-opacity group-hover:opacity-5`} />
              
              <div className="relative">
                <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${useCase.color} p-3`}>
                  <useCase.icon className="size-6 text-white" />
                </div>

                <h3 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
                  {useCase.title}
                </h3>

                <p className="mb-4 text-gray-600 dark:text-gray-400">
                  {useCase.description}
                </p>

                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1">
                  <div className="size-2 rounded-full bg-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    {useCase.stats}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {useCase.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-md bg-gray-100 dark:bg-slate-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-300"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
