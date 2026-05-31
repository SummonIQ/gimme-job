'use client';

import { cn } from '@/lib/css';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// Diverse range of job titles across different industries
const JOB_TITLES = [
  'Dream',
  'Software Engineer',
  'Registered Nurse',
  'Teacher',
  'Marketing Manager',
  'Data Analyst',
  'Project Manager',
  'Sales Representative',
  'Graphic Designer',
  'Accountant',
  'Physical Therapist',
  'Operations Manager',
  'UX Designer',
  'HR Manager',
  'Financial Analyst',
  'Product Manager',
  'Customer Success',
  'DevOps Engineer',
  'Business Analyst',
  'Content Writer',
  'Medical Assistant',
  'Dental Hygienist',
  'Social Worker',
  'Paralegal',
  'Executive Assistant',
  'Pharmacy Technician',
  'Real Estate Agent',
  'Construction Manager',
  'Mechanical Engineer',
  'Cybersecurity Analyst',
  'Chef',
  'Electrician',
  'Plumber',
  'Hair Stylist',
  'Personal Trainer',
  'Event Planner',
  'Supply Chain Manager',
  'Quality Assurance',
  'Network Engineer',
  'Interior Designer',
];

export function AnimatedJobTitle() {
  const [titleIndex, setTitleIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [textWidth, setTextWidth] = useState(0);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Measure the width of the current text after DOM update
    const measureWidth = () => {
      if (textRef.current) {
        const span = textRef.current.querySelector(
          `[data-active="true"]`,
        ) as HTMLElement;
        if (span) {
          setTextWidth(span.offsetWidth);
        }
      }
    };

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(measureWidth);
  }, [titleIndex]);

  useEffect(() => {
    // Randomly select job titles every 3 seconds
    const interval = setInterval(() => {
      setTitleIndex(prev => {
        setPrevIndex(prev);
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * JOB_TITLES.length);
        } while (newIndex === prev && JOB_TITLES.length > 1);
        return newIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex justify-center w-full -translate-y-[4px] px-4">
      <motion.span
        className="inline-flex items-center justify-center px-8 py-1 rounded-xl border-2 border-primary/20 bg-brand-1-lightest/35 backdrop-blur-sm shadow-sm dark:border-primary/30 dark:bg-slate-900/60"
        style={{ boxSizing: 'content-box' }}
        animate={{ width: textWidth > 0 ? textWidth : 'auto' }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <span
          ref={textRef}
          className="relative inline-block translate-y-[7px]"
          style={{ height: '1.2em' }}
        >
          {JOB_TITLES.map((title, index) => (
            <span
              key={title}
              data-active={index === titleIndex}
              className={cn(
                'absolute left-1/2 -translate-x-1/2 top-0 whitespace-nowrap transition-all duration-500 ease-in-out',
                'bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent',
                index === titleIndex
                  ? 'opacity-100 translate-y-0 scale-100'
                  : index === prevIndex
                    ? 'opacity-0 translate-y-full scale-90'
                    : 'opacity-0 -translate-y-full scale-90',
              )}
            >
              {title}
            </span>
          ))}
        </span>
      </motion.span>
    </span>
  );
}
