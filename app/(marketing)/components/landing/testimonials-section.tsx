import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    content: "Gimme Job helped me land my dream role at a Fortune 500 company. The AI resume optimizer was a game-changer - I went from 0 interviews to 5 in just two weeks!",
    author: "Sarah Chen",
    role: "Senior Software Engineer",
    company: "Tech Corp",
    rating: 5,
  },
  {
    content: "The application tracking and analytics helped me understand what was working and what wasn't. I optimized my approach and got 3x more responses. Highly recommend!",
    author: "Michael Rodriguez",
    role: "Product Manager",
    company: "StartupXYZ",
    rating: 5,
  },
  {
    content: "As someone who was applying to hundreds of jobs, the automation features saved me countless hours. I could focus on interview prep instead of filling out forms.",
    author: "Emily Thompson",
    role: "Marketing Director",
    company: "Growth Agency",
    rating: 5,
  },
  {
    content: "The interview prep tools and company research features gave me confidence going into every interview. I felt prepared and landed offers from my top 3 choices!",
    author: "David Park",
    role: "Data Scientist",
    company: "AI Labs",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-gradient-to-b from-white dark:from-background to-gray-50 dark:to-slate-900 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Success stories</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Loved by Job Seekers Worldwide
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            See what our users have to say about their experience with Gimme Job.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:mt-20 lg:max-w-none lg:grid-cols-2">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all hover:shadow-lg"
            >
              {/* Quote icon */}
              <Quote className="mb-4 size-8 text-blue-600 opacity-20" />
              
              {/* Rating */}
              <div className="mb-4 flex gap-1">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="size-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Content */}
              <p className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-400" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {testimonial.role} at {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="mt-16 grid grid-cols-2 gap-8 border-t border-gray-200 dark:border-gray-700 pt-10 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">10,000+</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Active Users</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">50,000+</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Jobs Applied</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">85%</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-gray-900 dark:text-white">4.9/5</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">User Rating</p>
          </div>
        </div>
      </div>
    </section>
  );
}
