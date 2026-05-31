export function StatsSection() {
  const stats = [
    {
      value: '10,000+',
      label: 'Active Job Seekers',
      description: 'Using Gimme Job daily',
    },
    {
      value: '50,000+',
      label: 'Applications Tracked',
      description: 'With an 85% success rate',
    },
    {
      value: '40%',
      label: 'Faster Hiring',
      description: 'Compared to traditional methods',
    },
    {
      value: '$15k',
      label: 'Avg. Salary Increase',
      description: 'Better offers, better negotiation',
    },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 py-24 sm:py-32">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-white/10" />
      
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Trusted by Thousands of Job Seekers
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Real results from real people using Gimme Job to advance their careers.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:grid-cols-2 lg:max-w-none lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <div className="text-5xl font-bold text-white">{stat.value}</div>
              <div className="mt-2 text-lg font-semibold text-blue-100">
                {stat.label}
              </div>
              <div className="mt-1 text-sm text-blue-200">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
