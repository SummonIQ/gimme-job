import { Check, X } from 'lucide-react';

export function ComparisonSection() {
  const features = [
    { name: 'AI Resume Optimization', gimmeJob: true, traditional: false, diy: false },
    { name: 'Application Tracking', gimmeJob: true, traditional: true, diy: true },
    { name: 'Job Matching Algorithm', gimmeJob: true, traditional: false, diy: false },
    { name: 'Interview Preparation', gimmeJob: true, traditional: true, diy: false },
    { name: 'Analytics & Insights', gimmeJob: true, traditional: false, diy: false },
    { name: 'Automation Tools', gimmeJob: true, traditional: false, diy: false },
    { name: 'Cost', gimmeJob: 'Free - $39/mo', traditional: '$100-500+', diy: 'Free' },
    { name: 'Time Investment', gimmeJob: '10 min/day', traditional: '1-2 hrs/day', diy: '3+ hrs/day' },
  ];

  return (
    <section className="bg-white py-24 dark:bg-gray-900 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Why choose us</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Better Than Traditional Methods
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            See how Gimme Job compares to traditional job search services and DIY approaches.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Feature
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-600">
                      Gimme Job
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                      Traditional Services
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                      DIY Approach
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {features.map((feature, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {feature.name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof feature.gimmeJob === 'boolean' ? (
                          feature.gimmeJob ? (
                            <Check className="mx-auto size-5 text-green-600" />
                          ) : (
                            <X className="mx-auto size-5 text-gray-300" />
                          )
                        ) : (
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {feature.gimmeJob}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof feature.traditional === 'boolean' ? (
                          feature.traditional ? (
                            <Check className="mx-auto size-5 text-green-600" />
                          ) : (
                            <X className="mx-auto size-5 text-gray-300" />
                          )
                        ) : (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {feature.traditional}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof feature.diy === 'boolean' ? (
                          feature.diy ? (
                            <Check className="mx-auto size-5 text-green-600" />
                          ) : (
                            <X className="mx-auto size-5 text-gray-300" />
                          )
                        ) : (
                          <span className="text-sm text-gray-600 dark:text-gray-400">{feature.diy}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
