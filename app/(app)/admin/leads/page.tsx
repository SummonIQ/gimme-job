import { JobLeadStatus } from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';

const pipelineStatuses = [
  JobLeadStatus.ADDED,
  JobLeadStatus.ANALYZING,
  JobLeadStatus.ANALYZED,
  JobLeadStatus.ANALYSIS_FAILED,
  JobLeadStatus.OPTIMIZING,
  JobLeadStatus.OPTIMIZED,
  JobLeadStatus.OPTIMIZATION_FAILED,
  JobLeadStatus.APPLYING,
  JobLeadStatus.APPLIED,
  JobLeadStatus.REJECTED,
  JobLeadStatus.ADVANCED,
  JobLeadStatus.INTERVIEW_SCHEDULED,
  JobLeadStatus.INTERVIEW_CANCELLED,
  JobLeadStatus.INTERVIEW_COMPLETED,
  JobLeadStatus.INTERVIEWED_NOT_SELECTED,
  JobLeadStatus.OFFER,
  JobLeadStatus.OFFER_DECLINED,
  JobLeadStatus.HIRED,
  JobLeadStatus.REMOVED,
] as const;

const statusLabelMap: Record<JobLeadStatus, string> = {
  ADDED: 'Added',
  ANALYZING: 'Analyzing',
  ANALYZED: 'Analyzed',
  ANALYSIS_FAILED: 'Analysis Failed',
  OPTIMIZING: 'Optimizing',
  OPTIMIZED: 'Optimized',
  OPTIMIZATION_FAILED: 'Optimization Failed',
  APPLYING: 'Applying',
  APPLIED: 'Applied',
  REJECTED: 'Rejected',
  ADVANCED: 'Advanced',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_CANCELLED: 'Interview Cancelled',
  INTERVIEW_COMPLETED: 'Interview Completed',
  INTERVIEWED_NOT_SELECTED: 'Interviewed, Not Selected',
  OFFER: 'Offer',
  OFFER_DECLINED: 'Offer Declined',
  HIRED: 'Hired',
  REMOVED: 'Removed',
};

export default async function AdminLeadsPage() {
  await requireAdminUser();

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [totalLeads, activeLeads, recentLeads7d, groupedByStatus, recentLeads] =
    await Promise.all([
      db.jobLead.count(),
      db.jobLead.count({
        where: {
          status: {
            in: [
              JobLeadStatus.ADDED,
              JobLeadStatus.ANALYZING,
              JobLeadStatus.ANALYZED,
              JobLeadStatus.OPTIMIZING,
              JobLeadStatus.OPTIMIZED,
              JobLeadStatus.APPLYING,
              JobLeadStatus.APPLIED,
              JobLeadStatus.ADVANCED,
              JobLeadStatus.INTERVIEW_SCHEDULED,
              JobLeadStatus.INTERVIEW_COMPLETED,
              JobLeadStatus.OFFER,
            ],
          },
        },
      }),
      db.jobLead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.jobLead.groupBy({
        by: ['status'],
        _count: true,
      }),
      db.jobLead.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: {
          createdAt: true,
          id: true,
          jobListing: {
            select: {
              company: true,
              location: true,
            },
          },
          status: true,
          title: true,
          updatedAt: true,
        },
      }),
    ]);

  const statusMap = groupedByStatus.reduce(
    (accumulator, row) => {
      accumulator[row.status] = row._count;
      return accumulator;
    },
    {} as Record<JobLeadStatus, number>,
  );

  const conversionToApplied =
    totalLeads > 0
      ? Math.round(((statusMap[JobLeadStatus.APPLIED] ?? 0) / totalLeads) * 100)
      : 0;

  return (
    <AdminPageShell
      title="Leads"
      description="Monitor lead pipeline throughput and downstream outcomes."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          title="Total Leads"
          value={totalLeads.toLocaleString()}
        />
        <AdminStatCard
          title="Active Pipeline"
          value={activeLeads.toLocaleString()}
        />
        <AdminStatCard
          title="New Leads (7d)"
          value={recentLeads7d.toLocaleString()}
        />
        <AdminStatCard
          title="Applied Rate"
          value={`${conversionToApplied}%`}
          helperText={`${statusMap[JobLeadStatus.APPLIED] ?? 0} applied`}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold">Pipeline Funnel</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Lead progression through the pipeline with failure states.
        </p>
        <div className="space-y-2 rounded-xl border border-border p-4">
          {(() => {
            const funnelStages: Array<{
              label: string;
              count: number;
              failedLabel?: string;
              failedCount?: number;
              color: string;
              failedColor: string;
            }> = [
              {
                label: 'Added',
                count: totalLeads,
                color: 'bg-blue-500',
                failedColor: 'bg-red-400',
              },
              {
                label: 'Analyzed',
                count:
                  (statusMap[JobLeadStatus.ANALYZING] ?? 0) +
                  (statusMap[JobLeadStatus.ANALYZED] ?? 0) +
                  (statusMap[JobLeadStatus.OPTIMIZING] ?? 0) +
                  (statusMap[JobLeadStatus.OPTIMIZED] ?? 0) +
                  (statusMap[JobLeadStatus.OPTIMIZATION_FAILED] ?? 0) +
                  (statusMap[JobLeadStatus.APPLYING] ?? 0) +
                  (statusMap[JobLeadStatus.APPLIED] ?? 0) +
                  (statusMap[JobLeadStatus.ADVANCED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_SCHEDULED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_COMPLETED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEWED_NOT_SELECTED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_CANCELLED] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER_DECLINED] ?? 0) +
                  (statusMap[JobLeadStatus.HIRED] ?? 0) +
                  (statusMap[JobLeadStatus.REJECTED] ?? 0),
                failedLabel: 'Failed',
                failedCount: statusMap[JobLeadStatus.ANALYSIS_FAILED] ?? 0,
                color: 'bg-indigo-500',
                failedColor: 'bg-red-400',
              },
              {
                label: 'Optimized',
                count:
                  (statusMap[JobLeadStatus.OPTIMIZING] ?? 0) +
                  (statusMap[JobLeadStatus.OPTIMIZED] ?? 0) +
                  (statusMap[JobLeadStatus.APPLYING] ?? 0) +
                  (statusMap[JobLeadStatus.APPLIED] ?? 0) +
                  (statusMap[JobLeadStatus.ADVANCED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_SCHEDULED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_COMPLETED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEWED_NOT_SELECTED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_CANCELLED] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER_DECLINED] ?? 0) +
                  (statusMap[JobLeadStatus.HIRED] ?? 0) +
                  (statusMap[JobLeadStatus.REJECTED] ?? 0),
                failedLabel: 'Failed',
                failedCount: statusMap[JobLeadStatus.OPTIMIZATION_FAILED] ?? 0,
                color: 'bg-violet-500',
                failedColor: 'bg-red-400',
              },
              {
                label: 'Applied',
                count:
                  (statusMap[JobLeadStatus.APPLYING] ?? 0) +
                  (statusMap[JobLeadStatus.APPLIED] ?? 0) +
                  (statusMap[JobLeadStatus.ADVANCED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_SCHEDULED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_COMPLETED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEWED_NOT_SELECTED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_CANCELLED] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER_DECLINED] ?? 0) +
                  (statusMap[JobLeadStatus.HIRED] ?? 0) +
                  (statusMap[JobLeadStatus.REJECTED] ?? 0),
                failedLabel: 'Rejected',
                failedCount: statusMap[JobLeadStatus.REJECTED] ?? 0,
                color: 'bg-purple-500',
                failedColor: 'bg-red-400',
              },
              {
                label: 'Interview Scheduled',
                count:
                  (statusMap[JobLeadStatus.ADVANCED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_SCHEDULED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_COMPLETED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEWED_NOT_SELECTED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEW_CANCELLED] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER_DECLINED] ?? 0) +
                  (statusMap[JobLeadStatus.HIRED] ?? 0),
                failedLabel: 'Cancelled',
                failedCount: statusMap[JobLeadStatus.INTERVIEW_CANCELLED] ?? 0,
                color: 'bg-fuchsia-500',
                failedColor: 'bg-orange-400',
              },
              {
                label: 'Interviewed',
                count:
                  (statusMap[JobLeadStatus.INTERVIEW_COMPLETED] ?? 0) +
                  (statusMap[JobLeadStatus.INTERVIEWED_NOT_SELECTED] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER_DECLINED] ?? 0) +
                  (statusMap[JobLeadStatus.HIRED] ?? 0),
                failedLabel: 'Not Selected',
                failedCount: statusMap[JobLeadStatus.INTERVIEWED_NOT_SELECTED] ?? 0,
                color: 'bg-fuchsia-600',
                failedColor: 'bg-orange-400',
              },
              {
                label: 'Offer',
                count:
                  (statusMap[JobLeadStatus.OFFER] ?? 0) +
                  (statusMap[JobLeadStatus.OFFER_DECLINED] ?? 0) +
                  (statusMap[JobLeadStatus.HIRED] ?? 0),
                failedLabel: 'Declined',
                failedCount: statusMap[JobLeadStatus.OFFER_DECLINED] ?? 0,
                color: 'bg-emerald-500',
                failedColor: 'bg-red-400',
              },
              {
                label: 'Hired',
                count: statusMap[JobLeadStatus.HIRED] ?? 0,
                color: 'bg-green-500',
                failedColor: 'bg-red-400',
              },
            ];

            const maxCount = funnelStages[0]?.count || 1;

            return funnelStages.map((stage) => {
              const totalForStage = stage.count + (stage.failedCount ?? 0);
              // Bar width proportional to top of funnel
              const barWidthPercent = maxCount > 0 ? (totalForStage / maxCount) * 100 : 0;
              // Inside the bar: success and failed portions fill 100% of the bar
              const successPortion = totalForStage > 0 ? (stage.count / totalForStage) * 100 : 0;
              const failedPortion = totalForStage > 0 ? ((stage.failedCount ?? 0) / totalForStage) * 100 : 0;

              const successPercent = maxCount > 0 ? Math.round((stage.count / maxCount) * 100) : 0;

              return (
                <div key={stage.label} className="relative">
                  <div className="text-xs font-medium text-center mb-1">{stage.label}</div>
                  <div
                    className="relative h-8 rounded-lg overflow-hidden mx-auto border border-border/60 bg-muted/20"
                    style={{ width: `${Math.max(barWidthPercent, 4)}%` }}
                  >
                    {stage.count > 0 && (
                      <div
                        className={`${stage.color} absolute inset-y-0 left-0 transition-all duration-500`}
                        style={{ width: `${successPortion}%` }}
                      />
                    )}
                    {(stage.failedCount ?? 0) > 0 && (
                      <div
                        className={`${stage.failedColor} opacity-70 absolute inset-y-0 transition-all duration-500`}
                        style={{ left: `${successPortion}%`, width: `${failedPortion}%` }}
                      />
                    )}
                    {/* Overlay text inside the bar */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 text-[11px] font-medium">
                      <span className="text-white drop-shadow-sm">
                        {stage.count.toLocaleString()} ({successPercent}%)
                      </span>
                      {stage.failedCount != null && stage.failedCount > 0 && (
                        <span className="text-red-100 drop-shadow-sm">
                          +{stage.failedCount.toLocaleString()} {stage.failedLabel ?? 'failed'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
          <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm bg-primary" />
              Success
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm bg-red-400 opacity-60" />
              Failed / Not Selected
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm bg-muted" />
              Removed: {(statusMap[JobLeadStatus.REMOVED] ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Recently Updated</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Latest 15 lead updates and status changes.
        </p>

        {recentLeads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No leads yet. Leads are created when users add job listings to their
            pipeline.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recentLeads.map(lead => (
              <div
                key={lead.id}
                className="rounded-lg border border-border/60 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium">{lead.title}</p>
                  <Badge variant="outline" className="shrink-0">
                    {statusLabelMap[lead.status]}
                  </Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{lead.jobListing.company ?? '—'}</span>
                  {lead.jobListing.location ? (
                    <>
                      <span>·</span>
                      <span>{lead.jobListing.location}</span>
                    </>
                  ) : null}
                  <span>·</span>
                  <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
