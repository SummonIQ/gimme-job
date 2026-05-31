import { Play } from 'lucide-react';

export function DemoSection() {
  return (
    <section className="bg-white py-24 dark:bg-gray-900 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">See it in action</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Watch How Gimme Job Works
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            A quick 2-minute overview of how our platform helps you land your dream job faster.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="group relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 shadow-2xl">
            {/* Placeholder for video */}
            <div className="flex size-full items-center justify-center">
              <button className="flex size-20 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-lg transition-all hover:scale-110">
                <Play className="ml-1 size-8 text-blue-600 dark:text-blue-400" fill="currentColor" />
              </button>
            </div>
            
            {/* Optional: Image thumbnail */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-purple-600/20">
              <div className="text-center text-white">
                <p className="text-2xl font-bold">Product Demo Video</p>
                <p className="mt-2 text-sm opacity-90">Click to watch</p>
              </div>
            </div>
          </div>

          {/* Features list below video */}
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-blue-600">2:30</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Watch time</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-blue-600">5 min</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Setup time</div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-blue-600">∞</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Possibilities</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
