'use client';

import { PeopleProfile } from '@/generated/prisma/browser';
import { Download, MoreHorizontal, Trash2, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { Report } from '@/components/data/report';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReportColumn } from '@/types/reporting/report';

export const DateLabel = dynamic(
  () => import('@/components/data/date-label').then(mod => mod.DateLabel),
  { ssr: false },
);

export interface PeopleProfilesReportProps {
  initialData?: PeopleProfile[];
  onDelete?: (id: string) => Promise<void>;
  onExport?: (profile: PeopleProfile) => void;
}

export function PeopleProfilesReport({
  initialData = [],
  onDelete,
  onExport,
}: PeopleProfilesReportProps) {
  const router = useRouter();

  const handleRowClick = (profile: PeopleProfile) => {
    router.push(`/people-profiles/${profile.id}`);
  };

  const columns: ReportColumn<PeopleProfile>[] = [
    {
      cellFn: profile => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users className="size-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{profile.name}</span>
            <span className="text-xs text-muted-foreground">
              {profile.title && <span>{profile.title} at </span>}
              {profile.company}
            </span>
          </div>
        </div>
      ),
      className: 'min-w-[280px]',
      header: 'Person',
      key: 'name',
      sortable: true,
      visible: true,
    },
    {
      cellFn: profile => (
        <span className="text-sm text-muted-foreground">{profile.company}</span>
      ),
      className: 'min-w-[140px]',
      header: 'Company',
      key: 'company',
      sortable: true,
      visible: true,
    },
    {
      cellFn: profile => (
        <span className="text-sm text-muted-foreground">
          {profile.title || '-'}
        </span>
      ),
      className: 'min-w-[160px]',
      header: 'Title',
      key: 'title',
      sortable: true,
      visible: true,
    },
    {
      align: 'left',
      cellFn: profile => (
        <span className="text-xs text-muted-foreground">
          <DateLabel date={profile.createdAt} variant="relative" />
        </span>
      ),
      className: 'min-w-[100px]',
      header: 'Added',
      key: 'createdAt',
      sortable: true,
      visible: true,
    },
    {
      align: 'right',
      cellFn: profile => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="size-8 rounded-full border border-border/20 p-2 hover:border-border/50 hover:bg-muted/50"
              variant="ghost"
              onClick={event => {
                event.stopPropagation();
              }}
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onExport && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={event => {
                  event.stopPropagation();
                  onExport(profile);
                }}
              >
                <Download className="size-4" />
                <span className="text-xs font-medium">Export</span>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="cursor-pointer text-red-500 hover:bg-red-500/10! hover:text-red-600!"
                onClick={event => {
                  event.stopPropagation();
                  onDelete(profile.id);
                }}
              >
                <Trash2 className="size-4" />
                <span className="text-xs font-medium">Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: 'w-[60px]',
      header: '',
      visible: true,
    },
  ];

  return (
    <Report<PeopleProfile, never>
      columns={columns}
      initialData={initialData}
      model="people-profiles"
      onRowClick={handleRowClick}
      searchField="name"
      searchPlaceholder="Search by name..."
      showColumnToggle={true}
      showPagination={true}
      showSearch={true}
    />
  );
}
