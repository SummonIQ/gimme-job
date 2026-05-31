import {
  JobFitAnalysisStatus,
  JobLeadStatus,
  JobListingStatus,
  JobSearchStatus,
  ResumeAnalysisStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';

import { JobFitAnalysisStatusBadge } from '@/components/job-leads/job-fit-analysis-status-badge';
import { JobLeadStatusBadge } from '@/components/job-leads/job-lead-status-badge';
import { JobListingStatusBadge } from '@/components/job-listings/job-listing-status-badge';
import { JobSearchStatusBadge } from '@/components/job-searches/job-search-status-badge';
import {
  Page,
  PageActions,
  PageContent,
  PageDescription,
  PageHeader,
  PageSummary,
  PageTitle,
} from '@/components/layout/page';
import { ResumeAnalysisStatusBadge } from '@/components/resumes/resume-analysis-status-badge';
import { ResumeOptimizationStatusBadge } from '@/components/resumes/resume-optimization-status-badge';
import { ThemeModeToggle } from '@/components/ui/theme-mode-toggle';
import {
  JobFitAnalysisStatusAttributes,
  JobLeadStatusAttributes,
} from '@/constants/job-leads';
import { JobListingStatusAttributes } from '@/constants/job-listings';
import { JobSearchStatusAttributes } from '@/constants/job-searches';
import { ResumeAnalysisStatusAttributes } from '@/constants/resumes/analysis/attributes';
import { ResumeOptimizationStatusAttributes } from '@/constants/resumes/optimization/attributes';

export default function BadgesPage() {
  const statusGroups = [
    {
      attributes: JobFitAnalysisStatusAttributes,
      name: 'JobFitAnalysisStatusBadge',
    },
    {
      attributes: JobLeadStatusAttributes,
      name: 'JobLeadStatusBadge',
    },
    {
      attributes: JobListingStatusAttributes,
      name: 'JobListingStatusBadge',
    },
    {
      attributes: JobSearchStatusAttributes,
      name: 'JobSearchStatusBadge',
    },
    {
      attributes: ResumeAnalysisStatusAttributes,
      name: 'ResumeAnalysisStatusBadge',
    },
    {
      attributes: ResumeOptimizationStatusAttributes,
      name: 'ResumeOptimizationStatusBadge',
    },
  ];

  const getComponent = ({
    groupName,
    status,
    variant,
  }:
    | {
        groupName: 'JobFitAnalysisStatusBadge';
        status: JobFitAnalysisStatus;
        variant: 'default' | 'outline' | 'ghost';
      }
    | {
        groupName: 'ResumeAnalysisStatusBadge';
        status: ResumeAnalysisStatus;
        variant: 'default' | 'outline' | 'ghost';
      }
    | {
        groupName: 'ResumeOptimizationStatusBadge';
        status: ResumeOptimizationStatus;
        variant: 'default' | 'outline' | 'ghost';
      }
    | {
        groupName: 'JobListingStatusBadge';
        status: JobListingStatus;
        variant: 'default' | 'outline' | 'ghost';
      }
    | {
        groupName: 'JobLeadStatusBadge';
        status: JobLeadStatus;
        variant: 'default' | 'outline' | 'ghost';
      }
    | {
        groupName: 'JobSearchStatusBadge';
        status: JobSearchStatus;
        variant: 'default' | 'outline' | 'ghost';
      }) => {
    switch (groupName) {
      case 'JobFitAnalysisStatusBadge': {
        return <JobFitAnalysisStatusBadge status={status} variant={variant} />;
      }
      case 'JobLeadStatusBadge': {
        return <JobLeadStatusBadge status={status} variant={variant} />;
      }
      case 'JobListingStatusBadge': {
        return <JobListingStatusBadge status={status} variant={variant} />;
      }
      case 'JobSearchStatusBadge': {
        return <JobSearchStatusBadge status={status} variant={variant} />;
      }
      case 'ResumeAnalysisStatusBadge': {
        return <ResumeAnalysisStatusBadge status={status} variant={variant} />;
      }
      case 'ResumeOptimizationStatusBadge': {
        return (
          <ResumeOptimizationStatusBadge status={status} variant={variant} />
        );
      }
    }
  };

  // Define the desired variant display order.
  const variantDisplayOrder = ['default', 'outline', 'ghost'];

  return (
    <Page>
      <PageHeader>
        <PageSummary>
          <PageTitle>Status Badges</PageTitle>
          <PageDescription>
            All status badge variants used throughout the application
          </PageDescription>
        </PageSummary>
        <PageActions>
          <div className="flex flex-row items-center gap-2">
            <span className="text-xs text-muted-foreground">Theme:</span>
            <ThemeModeToggle />
          </div>
        </PageActions>
      </PageHeader>
      <PageContent className="space-y-12">
        {statusGroups
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(group => {
            // Sort variants based on the defined display order.
            const groupVariants = Object.entries(
              group.attributes.variants,
            ).sort(
              (a, b) =>
                variantDisplayOrder.indexOf(a[0]) -
                variantDisplayOrder.indexOf(b[0]),
            );

            return (
              <section className="rounded-lg border" key={group.name}>
                <h2 className="border-b border-border p-4 text-sm font-semibold">
                  {group.name}
                </h2>

                <div className="flex flex-col divide-y divide-border">
                  {groupVariants.map(([variant, statuses]) => (
                    <div
                      className="flex flex-row items-center gap-2"
                      key={variant}
                    >
                      <h3 className="w-32 min-w-32 text-nowrap border-r border-border p-4 pr-3 text-xs font-semibold text-muted-foreground/80">
                        <span className="rounded-sm bg-secondary px-1.5 py-1 pb-[4px] font-mono text-muted-foreground">
                          {variant}
                        </span>
                      </h3>

                      <div className="flex flex-row flex-wrap justify-start gap-4 p-3">
                        {Object.entries(statuses)
                          // .sort((a, b) => a[0].localeCompare(b[0]))
                          .map(([statusKey, status]) => (
                            <div className="min-w-12" key={statusKey}>
                              {getComponent({
                                groupName: group.name,
                                status: statusKey,
                                variant,
                              })}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
      </PageContent>
    </Page>
  );
}
