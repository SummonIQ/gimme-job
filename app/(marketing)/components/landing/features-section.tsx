import {
  Bot,
  Database,
  FileText,
  LayoutDashboard,
  Sparkles,
  Zap,
} from 'lucide-react';

const features = [
  {
    name: 'AI Assist mode',
    description:
      'One click fills entire application forms — name, email, work history, screening questions, file uploads. Learns each ATS as you go so the second application is faster than the first.',
    icon: Bot,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
  },
  {
    name: 'AI resume optimization',
    description:
      'Per-role resume tailoring powered by GPT-4. Keyword alignment, ATS scoring, and revision history so every version of your resume stays linked to the job it was written for.',
    icon: FileText,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-500/20',
  },
  {
    name: 'Live job data',
    description:
      'Millions of listings pulled in real-time from Greenhouse, Lever, Workday, Ashby, LinkedIn, Indeed, and Google Jobs. No stale aggregator data, no duplicate postings.',
    icon: Database,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
  },
  {
    name: 'Auto-submit automation',
    description:
      'Queue applications and let Gimme Job submit them in the background using rules learned from your own training runs. Review every submission before it goes out.',
    icon: Zap,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-500/20',
  },
  {
    name: 'Command center dashboard',
    description:
      'Every lead, resume, interview, and outcome in one view. Filter by status, stage, ATS, or custom tags. Real-time metrics on response rates and follow-up SLAs.',
    icon: LayoutDashboard,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-500/20',
  },
  {
    name: 'Interview prep with AI',
    description:
      'GPT-generated practice questions tailored to each role, company research summaries, and answer frameworks you can rehearse against before the call.',
    icon: Sparkles,
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-100 dark:bg-pink-500/20',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white dark:bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            Feature set
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for people who actually apply
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Not another aggregator. Gimme Job replaces the copy-paste loop with
            real automation: live listings, AI-tailored resumes, one-click
            applications, and a command center that tracks every outcome.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-7xl sm:mt-20 lg:mt-24">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-3 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-foreground">
                  <div className={`absolute left-0 top-0 flex size-12 items-center justify-center rounded-lg ${feature.bgColor}`}>
                    <feature.icon className={`size-6 ${feature.color}`} aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-muted-foreground">
                  {feature.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
