'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'How does Gimme Job help me find jobs faster?',
    answer: 'Gimme Job combines AI-powered resume optimization, smart job matching, and application tracking to streamline your entire job search. Our tools help you apply to more relevant positions, optimize your materials for ATS systems, and track your progress - all in one place.',
  },
  {
    question: 'Is my data secure and private?',
    answer: 'Absolutely. We take data security seriously. All your personal information and resumes are encrypted and stored securely. We never share your data with third parties without your explicit consent, and you have full control over your information.',
  },
  {
    question: 'Can I use Gimme Job for free?',
    answer: 'Yes! We offer a free tier that includes basic resume optimization, job search, and application tracking. Premium features like advanced analytics, unlimited AI optimizations, and automation tools are available with our paid plans.',
  },
  {
    question: 'How does the AI resume optimizer work?',
    answer: 'Our AI analyzes your resume against job descriptions and industry best practices. It identifies missing keywords, suggests improvements for ATS compatibility, and helps you tailor your resume for specific positions. The result is a resume that gets past automated filters and catches recruiters\' attention.',
  },
  {
    question: 'What types of jobs can I find on Gimme Job?',
    answer: 'Gimme Job aggregates job listings from multiple sources across all industries and experience levels. Whether you\'re looking for tech roles, marketing positions, healthcare jobs, or anything in between, we have you covered.',
  },
  {
    question: 'How long does it take to see results?',
    answer: 'Most users see an increase in interview requests within 1-2 weeks of optimizing their resume and applications. However, results vary based on your industry, experience level, and the job market. Our analytics help you track progress and optimize your strategy over time.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time with no questions asked. If you cancel, you\'ll continue to have access to premium features until the end of your current billing period.',
  },
  {
    question: 'Do you offer support if I need help?',
    answer: 'Yes! We offer email support for all users, with priority support for premium subscribers. We also have extensive documentation, video tutorials, and a community forum where you can get help and share tips with other job seekers.',
  },
];

export function FAQSection() {
  return (
    <section className="bg-white dark:bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">FAQ</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Frequently Asked Questions
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Everything you need to know about Gimme Job. Can't find the answer you're looking for? 
            Reach out to our support team.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-6 shadow-sm"
              >
                <AccordionTrigger className="text-left text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 dark:text-gray-400">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
