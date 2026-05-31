import { Upload, Sparkles, Send, TrendingUp } from 'lucide-react';

const steps = [
  {
    name: 'Import your resume',
    description:
      'Drop in a PDF or DOCX and we parse every section. Your profile, work history, and skills auto-populate so the rest of the product works without any setup.',
    icon: Upload,
    color: 'from-blue-500 to-blue-600',
  },
  {
    name: 'Tailor with AI',
    description:
      'Paste a job description or pick from live listings. GPT-4 rewrites your resume for that specific role — keyword alignment, ATS scoring, tone matching.',
    icon: Sparkles,
    color: 'from-purple-500 to-purple-600',
  },
  {
    name: 'Apply on autopilot',
    description:
      'AI Assist mode fills the entire application in one click — even multi-page Workday forms. Review, tweak, submit. Gimme Job learns each ATS as you go.',
    icon: Send,
    color: 'from-green-500 to-green-600',
  },
  {
    name: 'Track every outcome',
    description:
      'Command center shows response rates, interview conversions, and which resume versions are working. Your follow-ups surface automatically.',
    icon: TrendingUp,
    color: 'from-orange-500 to-orange-600',
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 dark:from-slate-900 to-white dark:to-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Simple process</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            How It Works
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Get started in minutes and supercharge your job search with our proven 4-step process.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.name} className="relative flex flex-col items-center h-full">
                {/* Card with border */}
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow w-full h-full flex flex-col">
                  {/* Step Number */}
                  <div className="mb-4 flex justify-center">
                    <div className={`flex size-12 items-center justify-center rounded-full bg-gradient-to-br ${step.color} shadow-lg`}>
                      <span className="text-xl font-bold text-white">{index + 1}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white text-center">
                      {step.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center flex-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Visual connector for mobile */}
          <div className="mt-8 flex justify-center lg:hidden">
            <div className="flex items-center gap-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className="size-2 rounded-full bg-blue-600"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
