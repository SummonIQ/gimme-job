import {
  Activity,
  Bell,
  Database,
  Eye,
  FileText,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  ListChecks,
  TableProperties,
  Users,
} from 'lucide-react';
import { type ComponentType } from 'react';

interface AdminNavSubItem {
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

interface AdminNavItem {
  children?: AdminNavSubItem[];
  description: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

const adminNavItems: AdminNavItem[] = [
  {
    description: 'Platform-wide funnel, health KPIs, and activity overview',
    href: '/admin',
    icon: LayoutDashboard,
    label: 'Dashboard',
  },
  {
    description: 'Listings, leads, resumes, and application metrics',
    icon: Database,
    label: 'Data',
    children: [
      {
        description:
          'Analytics, ingestion schedules, and manual scrape controls',
        href: '/admin/listings',
        icon: Database,
        label: 'Job Listings',
      },
      {
        description: 'Pipeline movement and lead status progression',
        href: '/admin/leads',
        icon: Activity,
        label: 'Leads',
      },
      {
        description: 'Analysis scores, optimization deltas, and ATS readiness',
        href: '/admin/resumes',
        icon: FileText,
        label: 'Resumes',
      },
      {
        description: 'Submission outcomes, timing metrics, and interview rates',
        href: '/admin/applications',
        icon: FileText,
        label: 'Applications',
      },
      {
        description: 'Desktop submission requests and durable queue health',
        href: '/admin/queue',
        icon: ListChecks,
        label: 'Desktop Queue',
      },
      {
        description:
          'Desktop runner training/submit runs with field-level fail reasons + recommendations',
        href: '/admin/desktop-submissions',
        icon: Activity,
        label: 'Desktop Runs',
      },
      {
        description:
          'Browse all tables: observations, rules, ATS systems, and more',
        href: '/admin/data-explorer',
        icon: TableProperties,
        label: 'Data Explorer',
      },
    ],
  },
  {
    description: 'ATS field observations from assist mode interactions',
    href: '/admin/observations',
    icon: Eye,
    label: 'Observations',
  },
  {
    description:
      'Vision-driven training pipeline for assist mode field selection',
    href: '/admin/assist-training',
    icon: GraduationCap,
    label: 'Training',
  },
  {
    description:
      'Realtime plan tasks, agent claims, blockers, and completion state',
    href: '/admin/plan-board',
    icon: Kanban,
    label: 'Plan Board',
  },
  {
    description: 'User growth, verification, and subscription health',
    href: '/admin/users',
    icon: Users,
    label: 'Users',
  },
  {
    description: 'Delivery health, unread load, and alert volume',
    href: '/admin/notifications',
    icon: Bell,
    label: 'Notifications',
  },
];

export { adminNavItems };
export type { AdminNavItem, AdminNavSubItem };
