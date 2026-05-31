'use client';

import { Github, Linkedin, Twitter } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { ResponsiveContainer } from './responsive-container';

const footerLinks = {
  product: [
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/changelog', label: 'Changelog' },
    { href: '/faq', label: 'FAQ' },
  ],
  company: [
    { href: '/about', label: 'About' },
    { href: '/blog', label: 'Blog' },
  ],
  legal: [
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
    { href: '/cookies', label: 'Cookies' },
  ],
  support: [
    { href: '/help', label: 'Help Center' },
    { href: '/contact', label: 'Contact' },
    { href: '/status', label: 'Status' },
  ],
};

const socialLinks = [
  { icon: Twitter, label: 'Twitter' },
  { icon: Linkedin, label: 'LinkedIn' },
  { icon: Github, label: 'GitHub' },
];

const Footer = () => (
  <footer className="border-t border-slate-200 bg-white dark:border-white/10 dark:bg-[#08080e]">
    <ResponsiveContainer>
      <div className="py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link className="flex items-center gap-2" href="/">
              <img
                alt="Gimme Job"
                className="h-7 w-auto opacity-75 dark:opacity-65"
                src="/brand/gimme-job-logo-grayscale.svg"
              />
            </Link>
            <p className="mt-4 text-sm text-gray-600 dark:text-white/60">
              AI-powered job search platform helping thousands land their dream
              jobs faster.
            </p>
            <div className="mt-6 flex gap-4">
              {socialLinks.map(social => (
                <Tooltip key={social.label}>
                  <TooltipTrigger asChild>
                    <span
                      aria-label={`${social.label} coming soon`}
                      className="inline-flex cursor-default text-gray-300 opacity-45 transition-opacity hover:opacity-70 dark:text-white/25 dark:hover:text-white/40"
                      role="img"
                      tabIndex={0}
                    >
                      <social.icon className="size-5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              Product
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              Company
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              Support
            </h3>
            <ul className="space-y-3">
              {footerLinks.support.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-white/60 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-8 dark:border-white/10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-gray-500 dark:text-white/45">
              © 2026 Gimme Job. All rights reserved.
            </p>
            <div className="flex gap-6">
              {footerLinks.legal.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-white/45 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ResponsiveContainer>
  </footer>
);
Footer.displayName = 'Footer';

export { Footer };
