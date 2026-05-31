const pressQuotes = [
  {
    quote: "A game-changer for job seekers in the AI era",
    source: "TechCrunch",
    logo: "TC",
  },
  {
    quote: "The future of job searching is here",
    source: "Forbes",
    logo: "F",
  },
  {
    quote: "Innovative approach to career advancement",
    source: "Business Insider",
    logo: "BI",
  },
  {
    quote: "Makes job hunting actually enjoyable",
    source: "Product Hunt",
    logo: "PH",
  },
];

export function PressSection() {
  return (
    <section className="bg-white dark:bg-background py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="mb-12 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
          As featured in
        </p>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {pressQuotes.map((press) => (
            <div key={press.source} className="text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex size-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700 text-lg font-bold text-gray-400 dark:text-gray-500">
                  {press.logo}
                </div>
              </div>
              <p className="mb-2 text-sm italic text-gray-600 dark:text-gray-400">
                "{press.quote}"
              </p>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">
                {press.source}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
