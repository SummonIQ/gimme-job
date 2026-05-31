import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, buttonVariants } from '@/components/ui/button';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { AnimatedJobTitle } from '@/components/ui/animated-job-title';

export default function HeroSandboxPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-12 space-y-24">
        {/* Variation 1: Single Line with Animated Text */}
        <section className="border-b-4 border-blue-500 pb-24 bg-gray-50">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Variation 1: Single Line Layout
          </h2>
          <div className="relative overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40 bg-white">
            <AnimatedBackground variant="gradient" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-5xl text-center">
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-700/30 bg-gradient-to-br from-gray-700 via-gray-900 to-black px-4 py-1.5 text-xs backdrop-blur-sm shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                  <span className="text-gray-100 font-semibold">
                    AI-Powered Job Search Platform
                  </span>
                </div>

                {/* Main heading - Single Line */}
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                  <span className="inline-flex flex-wrap items-center justify-center gap-2">
                    <span>Land Your</span>
                    <span className="inline-block">
                      <AnimatedJobTitle />
                    </span>
                    <span>
                      Job{' '}
                      <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                        Faster
                      </span>
                    </span>
                  </span>
                </h1>

                {/* Subheading */}
                <p className="mt-6 max-w-3xl mx-auto text-lg leading-8 text-gray-600 sm:text-xl">
                  Streamline your job search with AI-powered tools. Optimize your
                  resume, track applications, and land interviews with companies you
                  love.
                </p>

                {/* CTA Buttons */}
                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="w-full sm:w-auto group relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10"
                  >
                    <Link
                      className={buttonVariants({
                        variant: 'default',
                        size: 'lg',
                        className: 'w-full sm:w-auto relative z-10',
                      })}
                      href="/signup"
                    >
                      Get Started Free
                      <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10"
                  >
                    <Link className="relative z-10" href="#features">Learn More</Link>
                  </Button>
                </div>

                {/* Social proof */}
                <div className="mt-10 flex items-center justify-center gap-3">
                  <div className="flex -space-x-3">
                    <div className="size-10 rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xs shadow-md">
                      <Image
                        height="36"
                        width="36"
                        className="size-9! rounded-full"
                        alt="User"
                        src="https://i.pravatar.cc/32"
                      />
                    </div>
                    <div className="size-10 rounded-full border-2 border-white bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs shadow-md">
                      <Image
                        height="36"
                        width="36"
                        className="size-9! rounded-full"
                        alt="User"
                        src="https://i.pravatar.cc/36"
                      />
                    </div>
                    <div className="size-10 rounded-full border-2 border-white bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center text-white font-semibold text-xs shadow-md">
                      <Image
                        height="36"
                        width="36"
                        className="size-9! rounded-full"
                        alt="User"
                        src="https://i.pravatar.cc/39"
                      />
                    </div>
                    <div className="size-10 rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-md">
                      <Image
                        height="36"
                        width="36"
                        className="size-9! rounded-full"
                        alt="User"
                        src="https://i.pravatar.cc/34"
                      />
                    </div>
                    <div className="size-10 rounded-full border-2 border-white bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-xs shadow-md">
                      <Image
                        height="36"
                        width="36"
                        className="size-9! rounded-full"
                        alt="User"
                        src="https://i.pravatar.cc/31"
                      />
                    </div>
                  </div>
                  <span className="font-medium text-gray-900">
                    10,000+ job seekers
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Variation 2: Minimal Bold Statement */}
        <section className="border-b-4 border-purple-500 pb-24 bg-gray-50">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Variation 2: Minimal & Bold
          </h2>
          <div className="relative overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40 bg-white">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-50 to-white" />

            <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-4xl text-center">
                <h1 className="text-6xl font-black tracking-tight text-gray-900 sm:text-7xl lg:text-8xl mb-6">
                  <span className="block">Get Hired.</span>
                  <span className="block bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">
                    Get Paid.
                  </span>
                </h1>

                <p className="mt-8 text-xl leading-8 text-gray-700 font-medium">
                  Your AI-powered shortcut to landing the perfect job.
                </p>

                <div className="mt-12">
                  <Button
                    asChild
                    size="lg"
                    className="text-lg px-8 py-6 rounded-full relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10"
                  >
                    <Link className="relative z-10" href="/signup">
                      Start Your Journey
                      <ArrowRight className="ml-2 size-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Variation 3: Side-by-Side Split */}
        <section className="border-b-4 border-green-500 pb-24 bg-gray-50">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Variation 3: Split Layout
          </h2>
          <div className="relative overflow-hidden pb-12 pt-20 bg-white">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm mb-6">
                    <Sparkles className="h-4 w-4 text-green-600" />
                    <span className="text-green-900 font-semibold">
                      AI-Powered Platform
                    </span>
                  </div>

                  <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                    Find Your{' '}
                    <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      Dream Job
                    </span>{' '}
                    in Record Time
                  </h1>

                  <p className="mt-6 text-lg leading-8 text-gray-600">
                    Leverage cutting-edge AI to optimize your resume, automate applications,
                    and track your progress all in one place.
                  </p>

                  <div className="mt-8 flex gap-4">
                    <Button asChild size="lg" className="relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10">
                      <Link className="relative z-10" href="/signup">Get Started</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10">
                      <Link className="relative z-10" href="#demo">Watch Demo</Link>
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <div className="aspect-square rounded-2xl bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 shadow-2xl" />
                  <div className="absolute inset-0 rounded-2xl bg-[url('/grid.svg')] opacity-20" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Variation 4: Glassmorphism Style */}
        <section className="border-b-4 border-pink-500 pb-24 bg-gray-50">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Variation 4: Glassmorphism
          </h2>
          <div className="relative overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-300 via-purple-300 to-indigo-400" />
            <div className="absolute inset-0 backdrop-blur-3xl bg-white/30" />

            <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-4xl">
                <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl p-12">
                  <div className="text-center">
                    <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                      <span className="block">Your Career,</span>
                      <span className="block">
                        Elevated by{' '}
                        <span className="bg-gradient-to-r from-yellow-200 to-pink-200 bg-clip-text text-transparent">
                          AI
                        </span>
                      </span>
                    </h1>

                    <p className="mt-6 text-lg leading-8 text-white/90 font-medium">
                      Smart tools for smart job seekers. Automate the boring stuff,
                      focus on what matters.
                    </p>

                    <div className="mt-10">
                      <Button
                        asChild
                        size="lg"
                        className="bg-white text-purple-900 text-lg px-8 relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10"
                      >
                        <Link className="relative z-10" href="/signup">
                          Begin Now
                          <ArrowRight className="ml-2 size-5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Variation 5: Dark Mode with Neon Accents */}
        <section className="border-b-4 border-cyan-500 pb-24 bg-gray-50">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Variation 5: Dark Mode with Neon
          </h2>
          <div className="relative overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40 bg-gray-900">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-gray-900 to-gray-900" />

            <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-4xl text-center">
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-4 py-1.5 text-sm backdrop-blur-sm">
                  <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                  <span className="text-cyan-100 font-semibold">
                    Next-Gen Job Search
                  </span>
                </div>

                <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  <span className="block mb-2">Stop Searching.</span>
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
                    Start Landing.
                  </span>
                </h1>

                <p className="mt-6 max-w-3xl mx-auto text-lg leading-8 text-gray-300 sm:text-xl">
                  AI-driven job matching, automated applications, and intelligent
                  resume optimization. Your next opportunity is one click away.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 border-0 shadow-lg shadow-cyan-500/50 relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10"
                  >
                    <Link className="relative z-10" href="/signup">
                      Launch Your Career
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-cyan-500/50 text-cyan-400 relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10"
                  >
                    <Link className="relative z-10" href="#features">Explore Features</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Variation 6: Compact Centered with Large Animated Element */}
        <section className="pb-24 bg-gray-50">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">
            Variation 6: Compact with Focus on Animation
          </h2>
          <div className="relative overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40 bg-white">
            <AnimatedBackground variant="gradient" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-4">
                  Get Your
                </h1>

                <div className="my-8 scale-125">
                  <AnimatedJobTitle />
                </div>

                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                  With{' '}
                  <span className="bg-gradient-to-r from-orange-400 to-red-600 bg-clip-text text-transparent">
                    AI Assistance
                  </span>
                </h1>

                <p className="mt-8 text-base leading-7 text-gray-600">
                  Powerful automation. Intelligent insights. Your dream job awaits.
                </p>

                <div className="mt-8">
                  <Button asChild size="lg" className="rounded-full px-8 relative overflow-hidden before:absolute before:inset-0 before:bg-black/0 before:transition-all before:duration-200 hover:before:bg-black/10">
                    <Link className="relative z-10" href="/signup">
                      Get Started Free
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
