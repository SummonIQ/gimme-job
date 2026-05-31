import { ArrowRight, MessageCircle } from 'lucide-react';
import Link from 'next/link';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

const faqCategories = [
  {
    title: 'Getting Started',
    faqs: [
      {
        question: 'How do I get started with Gimme Job?',
        answer:
          'Simply sign up for a free account, upload your resume, and start exploring jobs. Our onboarding wizard will guide you through the setup process and help you optimize your profile.',
      },
      {
        question: 'Do I need a credit card to sign up?',
        answer:
          "No! Our free plan doesn't require a credit card. You can start using Gimme Job immediately after signing up. You'll only need to add payment information if you decide to upgrade to a paid plan.",
      },
      {
        question: 'How long does it take to optimize my resume?',
        answer:
          'Our AI can analyze and provide optimization suggestions for your resume in seconds. However, we recommend taking time to review and implement the suggestions thoughtfully. Most users spend about 15-30 minutes on their first optimization.',
      },
    ],
  },
  {
    title: 'Features & Functionality',
    faqs: [
      {
        question: 'How does the AI resume optimizer work?',
        answer:
          'Our AI analyzes your resume against job descriptions and industry best practices. It checks for ATS compatibility, identifies missing keywords, suggests formatting improvements, and provides a score with specific recommendations for improvement.',
      },
      {
        question: 'Can I track applications from other job boards?',
        answer:
          'Yes! You can manually add applications from any job board or company website to your Gimme Job dashboard. We also offer browser extensions that can automatically capture application data.',
      },
      {
        question: 'How accurate is the job matching algorithm?',
        answer:
          'Our matching algorithm considers your skills, experience, preferences, and past interactions. It gets more accurate over time as it learns from your behavior. Most users report a 80%+ relevance rate for recommended jobs.',
      },
      {
        question: 'Can I collaborate with my career coach?',
        answer:
          'Yes! Pro and Enterprise users can share their dashboard with mentors, career coaches, or accountability partners. They can view your progress, leave notes, and provide feedback.',
      },
    ],
  },
  {
    title: 'Pricing & Billing',
    faqs: [
      {
        question: "What's included in the free plan?",
        answer:
          "The free plan includes up to 10 resume optimizations per month, basic job search and matching, tracking for up to 25 applications, basic analytics, and email support. It's perfect for getting started.",
      },
      {
        question: 'Can I change plans at any time?',
        answer:
          'Absolutely! You can upgrade or downgrade your plan at any time. If you upgrade, the change takes effect immediately. If you downgrade, the change takes effect at the end of your current billing period.',
      },
      {
        question: 'Do you offer discounts for students?',
        answer:
          'Yes! We offer a 50% discount on Pro plans for verified students and recent graduates (within 6 months). Contact our support team with your .edu email address to get your discount code.',
      },
    ],
  },
  {
    title: 'Privacy & Security',
    faqs: [
      {
        question: 'Is my data secure?',
        answer:
          "Yes. We use industry-standard encryption to protect your data both in transit and at rest. We're SOC 2 compliant and regularly undergo third-party security audits. Your personal information is never shared with third parties without your explicit consent.",
      },
      {
        question: 'Who can see my resume and applications?',
        answer:
          'Only you can see your data by default. If you choose to share your dashboard with a coach or mentor, you have full control over what they can see. We never share your information with employers or recruiters without your permission.',
      },
      {
        question: 'Can I delete my account and data?',
        answer:
          'Yes. You can delete your account at any time from your settings. When you delete your account, all your data is permanently removed from our servers within 30 days.',
      },
      {
        question: 'Are you GDPR compliant?',
        answer:
          "Yes. We're fully GDPR compliant. You have the right to access, correct, delete, or export your data at any time. We also provide clear information about how we collect and use your data.",
      },
    ],
  },
  {
    title: 'Support',
    faqs: [
      {
        question: 'How can I get help if I have a problem?',
        answer:
          'Free users can contact us via email support. Pro users get priority email support with faster response times. Enterprise users have access to a dedicated success manager and phone support.',
      },
      {
        question: 'Do you have video tutorials?',
        answer:
          'Yes! We have an extensive library of video tutorials covering all features. You can access them from our help center or directly within the app.',
      },
      {
        question: 'Can I suggest new features?',
        answer:
          'Absolutely! We love hearing from our users. You can submit feature requests through our feedback portal, and we regularly review and implement the most popular suggestions.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="bg-white pb-24 pt-32 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pb-32 sm:pt-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-2xl pt-12 text-center sm:mb-20 sm:pt-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary dark:border-primary/25 dark:bg-primary/15">
            <MessageCircle className="size-3.5" />
            Help center
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
            Everything you need to know about Gimme Job. Can&apos;t find what you&apos;re
            looking for?{' '}
            <Link
              href="/contact"
              className="font-semibold text-primary hover:underline"
            >
              Contact our support team
            </Link>
            .
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="mx-auto max-w-3xl space-y-10">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {category.title}
              </h2>

              <Accordion type="single" collapsible className="space-y-2">
                {category.faqs.map((faq, faqIndex) => (
                  <AccordionItem
                    key={faqIndex}
                    value={`item-${categoryIndex}-${faqIndex}`}
                    className="rounded-xl border border-slate-200 bg-white px-5 shadow-sm transition-colors data-[state=open]:border-primary/30 data-[state=open]:bg-primary/5 dark:border-white/10 dark:bg-white/[0.04] dark:data-[state=open]:bg-primary/10"
                  >
                    <AccordionTrigger className="text-left font-semibold text-slate-950 hover:text-primary hover:no-underline dark:text-white [&[data-state=open]]:text-primary">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="leading-relaxed text-slate-600 dark:text-slate-300">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mx-auto mt-20 max-w-2xl rounded-2xl bg-gradient-to-br from-primary/80 to-primary px-6 py-12 text-center shadow-xl shadow-primary/15 sm:px-12">
          <h2 className="text-2xl font-bold text-primary-foreground">
            Still have questions?
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Our support team is here to help.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
            >
              <Link href="/contact">
                Contact Support
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
