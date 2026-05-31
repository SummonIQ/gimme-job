'use client';

import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import {
  Briefcase,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  Send,
  Target,
  UserRound,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileNavItemProps {
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

const MobileNavItem = ({
  href,
  icon: Icon,
  label,
  description,
  active,
  onClick,
  children,
  className,
}: MobileNavItemProps) => {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    if (children) {
      setExpanded(!expanded);
    } else if (onClick) {
      onClick();
    }
  };

  const content = (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5',
        active ? 'bg-accent/50' : 'hover:bg-accent/30',
        className,
      )}
    >
      {Icon && (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
          <Icon className="size-4.5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">{label}</div>
        {description && (
          <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {href && !children ? (
        <Link href={href} onClick={onClick} className="block w-full">
          {content}
        </Link>
      ) : (
        <Button
          variant="ghost"
          className="h-auto w-full justify-start p-0 font-normal"
          onClick={handleClick}
        >
          {content}
        </Button>
      )}

      {children && expanded && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-muted pl-4">
          {children}
        </div>
      )}
    </div>
  );
};

export function MobileMainNavigation({ close }: { close: () => void }) {
  const pathName = usePathname();

  const isActive = (path: string, exact: boolean = false) => {
    if (exact && pathName === path) {
      return true;
    }

    if (!exact && pathName.startsWith(path)) {
      return true;
    }

    return false;
  };

  return (
    <div className="flex w-full flex-col space-y-2 overflow-y-auto p-4">
      <MobileNavItem
        href="/dashboard"
        icon={LayoutDashboard}
        label="Overview"
        active={isActive('/dashboard', true)}
        onClick={close}
      />

      <MobileNavItem
        href="/inbox"
        icon={Inbox}
        label="Inbox"
        description="Emails from your job applications"
        active={isActive('/inbox')}
        onClick={close}
      />

      <MobileNavItem
        href="/jobs"
        icon={Briefcase}
        label="Jobs"
        description="Browse and manage job opportunities"
        active={isActive('/jobs')}
        onClick={close}
      />

      <MobileNavItem
        icon={ClipboardCheck}
        label="Leads"
        description="Track your job applications"
        active={isActive('/leads') || isActive('/applications')}
      >
        <MobileNavItem
          href="/leads"
          icon={Target}
          label="All Leads"
          description="Browse and manage every job lead in your pipeline"
          active={isActive('/leads')}
          onClick={close}
          className="py-2"
        />
        <MobileNavItem
          href="/applications"
          icon={Send}
          label="Applications"
          description="Every job application you have submitted"
          active={isActive('/applications')}
          onClick={close}
          className="py-2"
        />
      </MobileNavItem>

      <MobileNavItem
        href="/profile"
        icon={UserRound}
        label="My Profile"
        description="Manage your profile and resumes"
        active={isActive('/profile')}
        onClick={close}
      />

      <MobileNavItem
        icon={Wrench}
        label="Tools"
        description="Optimize your job search"
        active={isActive('/tools') || isActive('/people-profiles')}
      >
        <MobileNavItem
          href="/tools/interview-prep"
          icon={Target}
          label="Interview Prep"
          description="Research interviewers and get AI-powered interview strategies"
          active={isActive('/tools/interview-prep')}
          onClick={close}
          className="py-2"
        />
        <MobileNavItem
          href="/tools/job-details-optimizer"
          icon={Wrench}
          label="Job Details Optimizer"
          description="Optimize a resume for a job description"
          active={isActive('/tools/job-details-optimizer')}
          onClick={close}
          className="py-2"
        />
      </MobileNavItem>
    </div>
  );
}

MobileMainNavigation.displayName = 'MobileMainNavigation';
