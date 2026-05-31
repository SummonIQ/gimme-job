import {
  AppWindow,
  BarChart3,
  Bug,
  BrainCircuit,
  Bot,
  Code2,
  FileText,
  GraduationCap,
  Palette,
  Rocket,
  ShieldCheck,
  Unplug,
  type LucideIcon,
} from 'lucide-react';

// Each category has a unique color scheme used consistently across the
// changelog page and the shipping-in-public section on the landing page.
// Colors are chosen for maximum pairwise distance.

export type CategoryStyle = {
  label: string;
  icon: LucideIcon;
  glow: string;
  badgeClass: string;
  iconTileClass: string;
  iconClass: string;
};

export const CATEGORIES: Record<string, CategoryStyle> = {
  Bug: {
    label: 'Bug',
    icon: Bug,
    glow: 'rgba(248,113,113,0.12)',
    badgeClass:
      'border-red-400/28 bg-[linear-gradient(180deg,rgba(248,113,113,0.16),rgba(248,113,113,0.06))] text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-red-400/18 bg-[radial-gradient(circle_at_top_left,rgba(252,165,165,0.2),rgba(248,113,113,0.08)_58%,transparent_100%)]',
    iconClass: 'text-red-300/90',
  },
  Training: {
    label: 'AI Training',
    icon: GraduationCap,
    glow: 'rgba(129,140,248,0.12)',
    badgeClass:
      'border-indigo-400/28 bg-[linear-gradient(180deg,rgba(129,140,248,0.16),rgba(129,140,248,0.06))] text-indigo-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-indigo-400/18 bg-[radial-gradient(circle_at_top_left,rgba(165,180,252,0.2),rgba(129,140,248,0.08)_58%,transparent_100%)]',
    iconClass: 'text-indigo-300/90',
  },
  Assist: {
    label: 'AI Assist',
    icon: BrainCircuit,
    glow: 'rgba(168,85,247,0.12)',
    badgeClass:
      'border-purple-400/28 bg-[linear-gradient(180deg,rgba(168,85,247,0.16),rgba(168,85,247,0.06))] text-purple-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-purple-400/18 bg-[radial-gradient(circle_at_top_left,rgba(216,180,254,0.2),rgba(168,85,247,0.08)_58%,transparent_100%)]',
    iconClass: 'text-purple-300/90',
  },
  Automation: {
    label: 'Automation',
    icon: Bot,
    glow: 'rgba(34,197,94,0.1)',
    badgeClass:
      'border-emerald-400/26 bg-[linear-gradient(180deg,rgba(52,211,153,0.14),rgba(52,211,153,0.05))] text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-emerald-400/16 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.18),rgba(52,211,153,0.07)_58%,transparent_100%)]',
    iconClass: 'text-emerald-300/86',
  },
  Integrations: {
    label: 'Integrations',
    icon: Unplug,
    glow: 'rgba(96,165,250,0.1)',
    badgeClass:
      'border-sky-400/26 bg-[linear-gradient(180deg,rgba(56,189,248,0.14),rgba(56,189,248,0.05))] text-sky-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-sky-400/16 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),rgba(56,189,248,0.07)_58%,transparent_100%)]',
    iconClass: 'text-sky-300/86',
  },
  Resume: {
    label: 'Resumes',
    icon: FileText,
    glow: 'rgba(244,114,182,0.09)',
    badgeClass:
      'border-pink-400/26 bg-[linear-gradient(180deg,rgba(244,114,182,0.14),rgba(244,114,182,0.05))] text-pink-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-pink-400/16 bg-[radial-gradient(circle_at_top_left,rgba(249,168,212,0.18),rgba(244,114,182,0.07)_58%,transparent_100%)]',
    iconClass: 'text-pink-300/84',
  },
  Analytics: {
    label: 'Analytics',
    icon: BarChart3,
    glow: 'rgba(249,115,22,0.1)',
    badgeClass:
      'border-orange-400/26 bg-[linear-gradient(180deg,rgba(251,146,60,0.14),rgba(251,146,60,0.05))] text-orange-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-orange-400/16 bg-[radial-gradient(circle_at_top_left,rgba(253,186,116,0.18),rgba(251,146,60,0.07)_58%,transparent_100%)]',
    iconClass: 'text-orange-300/86',
  },
  API: {
    label: 'API',
    icon: Code2,
    glow: 'rgba(167,139,250,0.09)',
    badgeClass:
      'border-violet-400/26 bg-[linear-gradient(180deg,rgba(167,139,250,0.14),rgba(167,139,250,0.05))] text-violet-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-violet-400/16 bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.18),rgba(167,139,250,0.07)_58%,transparent_100%)]',
    iconClass: 'text-violet-300/86',
  },
  Design: {
    label: 'Design',
    icon: Palette,
    glow: 'rgba(132,204,22,0.1)',
    badgeClass:
      'border-lime-400/26 bg-[linear-gradient(180deg,rgba(163,230,53,0.14),rgba(163,230,53,0.05))] text-lime-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-lime-400/16 bg-[radial-gradient(circle_at_top_left,rgba(190,242,100,0.18),rgba(163,230,53,0.07)_58%,transparent_100%)]',
    iconClass: 'text-lime-300/86',
  },
  Security: {
    label: 'Security',
    icon: ShieldCheck,
    glow: 'rgba(45,212,191,0.1)',
    badgeClass:
      'border-teal-400/26 bg-[linear-gradient(180deg,rgba(45,212,191,0.14),rgba(45,212,191,0.05))] text-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-teal-400/16 bg-[radial-gradient(circle_at_top_left,rgba(94,234,212,0.18),rgba(45,212,191,0.07)_58%,transparent_100%)]',
    iconClass: 'text-teal-300/86',
  },
  Product: {
    label: 'Product',
    icon: Rocket,
    glow: 'rgba(251,191,36,0.1)',
    badgeClass:
      'border-amber-400/26 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(251,191,36,0.05))] text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-amber-400/16 bg-[radial-gradient(circle_at_top_left,rgba(253,230,138,0.16),rgba(251,191,36,0.06)_58%,transparent_100%)]',
    iconClass: 'text-amber-300/86',
  },
  App: {
    label: 'Product',
    icon: AppWindow,
    glow: 'rgba(129,140,248,0.1)',
    badgeClass:
      'border-indigo-400/26 bg-[linear-gradient(180deg,rgba(129,140,248,0.14),rgba(129,140,248,0.05))] text-indigo-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    iconTileClass:
      'border-indigo-400/16 bg-[radial-gradient(circle_at_top_left,rgba(165,180,252,0.18),rgba(129,140,248,0.07)_58%,transparent_100%)]',
    iconClass: 'text-indigo-300/86',
  },
};

export function getEntryCategory(entry: {
  title: string;
  description: string;
}): CategoryStyle {
  const text = `${entry.title} ${entry.description}`.toLowerCase();

  // Bug fixes — checked first so something like "fix honeypot detection" is
  // tagged Bug rather than Training.
  if (
    /\bfix(es|ed|ing)?\b/.test(text) ||
    /\bbug\b/.test(text) ||
    /\bhotfix\b/.test(text) ||
    text.includes('resolve') ||
    text.includes('regression') ||
    text.includes('broken') ||
    text.includes('crash') ||
    text.includes('stuck')
  ) {
    return CATEGORIES.Bug;
  }

  if (
    text.includes('automation') ||
    text.includes('auto-submit') ||
    text.includes('auto submit') ||
    text.includes('automated submission')
  ) {
    return CATEGORIES.Automation;
  }

  if (
    text.includes('training') ||
    text.includes('trainer') ||
    text.includes('observation') ||
    text.includes('rule promotion') ||
    text.includes('rule ') ||
    text.includes('flow state') ||
    text.includes('honeypot') ||
    text.includes('listing page') ||
    text.includes('post-condition')
  ) {
    return CATEGORIES.Training;
  }

  if (
    text.includes('assist mode') ||
    text.includes('assist-mode') ||
    text.includes('assist ') ||
    text.includes('trust mode') ||
    text.includes('confirm each action')
  ) {
    return CATEGORIES.Assist;
  }

  if (
    text.includes('resume') ||
    text.includes('cover letter')
  ) {
    return CATEGORIES.Resume;
  }

  if (
    text.includes('analytics') ||
    text.includes('metric') ||
    text.includes('dashboard')
  ) {
    return CATEGORIES.Analytics;
  }

  if (
    /\bapi\b/.test(text) ||
    text.includes('endpoint') ||
    text.includes('webhook')
  ) {
    return CATEGORIES.API;
  }

  if (
    text.includes('linkedin') ||
    text.includes('indeed') ||
    text.includes('greenhouse') ||
    text.includes('workday') ||
    text.includes('lever') ||
    text.includes('rippling') ||
    text.includes('ats') ||
    text.includes('integration')
  ) {
    return CATEGORIES.Integrations;
  }

  if (
    text.includes('auth') ||
    text.includes('security') ||
    text.includes('two-factor') ||
    text.includes('password')
  ) {
    return CATEGORIES.Security;
  }

  if (
    text.includes('design') ||
    /\bui\b/.test(text) ||
    text.includes('card') ||
    text.includes('color') ||
    text.includes('animation') ||
    text.includes('gradient') ||
    text.includes('tooltip')
  ) {
    return CATEGORIES.Design;
  }

  return CATEGORIES.Product;
}
