import { GuidedApplicationStatus } from '@/generated/prisma/browser';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Upload,
  User,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../../_components/admin-page-shell';
import { requireAdminUser } from '../../require-admin-user';

const statusConfig: Record<
  GuidedApplicationStatus,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  DRAFT: { label: 'Draft', color: 'text-slate-400', icon: FileText },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-400', icon: Clock },
  PAUSED: { label: 'Paused', color: 'text-amber-400', icon: Clock },
  ANALYZING: { label: 'Analyzing', color: 'text-indigo-400', icon: Lightbulb },
  READY_TO_SUBMIT: {
    label: 'Ready to Submit',
    color: 'text-emerald-400',
    icon: CheckCircle,
  },
  SUBMITTING: { label: 'Submitting', color: 'text-violet-400', icon: Upload },
  SUBMITTED: { label: 'Submitted', color: 'text-green-500', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'text-red-400', icon: AlertTriangle },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-400', icon: AlertTriangle },
};

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;

  const session = await db.guidedApplication.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      jobLead: {
        select: {
          title: true,
          jobListing: { select: { company: true, location: true } },
        },
      },
      fieldSuggestions: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!session) {
    return (
      <AdminPageShell title="Not Found" description="">
        <p className="text-muted-foreground">Session not found.</p>
      </AdminPageShell>
    );
  }

  const status = statusConfig[session.status];
  const StatusIcon = status.icon;
  const formAnalysis = session.formAnalysis as Record<string, unknown> | null;
  const detectedFields = (session.detectedFields ??
    (formAnalysis as any)?.fields ??
    []) as Array<Record<string, unknown>>;

  const categoryLabels: Record<string, string> = {
    personal: 'Personal Info',
    contact: 'Contact',
    work: 'Work Experience',
    education: 'Education',
    documents: 'Documents',
    preferences: 'Preferences',
    custom: 'Other',
  };

  // Group fields by category
  const fieldsByCategory = new Map<string, typeof session.fieldSuggestions>();
  for (const field of session.fieldSuggestions) {
    const cat = field.category ?? 'custom';
    if (!fieldsByCategory.has(cat)) fieldsByCategory.set(cat, []);
    fieldsByCategory.get(cat)!.push(field);
  }

  const suggestionStatusColors: Record<string, string> = {
    PENDING: 'bg-slate-400/20 text-slate-400',
    ACCEPTED: 'bg-green-500/20 text-green-500',
    MODIFIED: 'bg-blue-400/20 text-blue-400',
    REJECTED: 'bg-red-400/20 text-red-400',
    SKIPPED: 'bg-gray-400/20 text-gray-400',
  };

  return (
    <AdminPageShell
      title="AI Assist Session"
      description={`${session.jobTitle ?? 'Untitled'} at ${session.company ?? 'Unknown company'}`}
    >
      {/* Header Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon className={`size-4 ${status.color}`} />
            <span className="text-sm font-medium">{status.label}</span>
          </div>
          <Progress value={session.progress} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            Step {session.currentStep}
            {session.totalSteps ? `/${session.totalSteps}` : ''} · {session.progress}%
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">User</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {session.user.firstName} {session.user.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Application URL</span>
          </div>
          <a
            href={session.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate block"
          >
            {session.applicationUrl}
          </a>
          {session.jobProvider && (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {session.jobProvider}
            </Badge>
          )}
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Timeline</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Started: {session.createdAt.toLocaleString()}
          </p>
          {session.submittedAt && (
            <p className="text-xs text-muted-foreground">
              Submitted: {session.submittedAt.toLocaleString()}
            </p>
          )}
          {session.completedAt && (
            <p className="text-xs text-muted-foreground">
              Completed: {session.completedAt.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {session.errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-red-500" />
            <span className="text-sm font-semibold text-red-500">Error</span>
          </div>
          <p className="text-sm text-red-400">{session.errorMessage}</p>
        </div>
      )}

      {/* Form Analysis */}
      {formAnalysis && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Form Analysis</h2>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {formAnalysis.pageTitle && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Page Title
                  </p>
                  <p className="text-sm font-medium">
                    {formAnalysis.pageTitle as string}
                  </p>
                </div>
              )}
              {formAnalysis.company && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Company
                  </p>
                  <p className="text-sm font-medium">
                    {formAnalysis.company as string}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Multi-step
                </p>
                <p className="text-sm font-medium">
                  {(formAnalysis.isMultiStep as boolean) ? 'Yes' : 'No'}
                  {formAnalysis.totalSteps
                    ? ` (${formAnalysis.totalSteps} steps)`
                    : ''}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Fields Detected
                </p>
                <p className="text-sm font-medium">
                  {Array.isArray(detectedFields) ? detectedFields.length : 0}
                </p>
              </div>
            </div>

            {/* Detected capabilities */}
            <div className="flex flex-wrap gap-2">
              {(formAnalysis.hasResumeField as boolean) && (
                <Badge variant="secondary">Resume Upload</Badge>
              )}
              {(formAnalysis.hasCoverLetterField as boolean) && (
                <Badge variant="secondary">Cover Letter</Badge>
              )}
              {(formAnalysis.hasFileUpload as boolean) && (
                <Badge variant="secondary">File Upload</Badge>
              )}
              {formAnalysis.submitButtonText && (
                <Badge variant="outline">
                  Submit: "{formAnalysis.submitButtonText as string}"
                </Badge>
              )}
              {formAnalysis.nextButtonText && (
                <Badge variant="outline">
                  Next: "{formAnalysis.nextButtonText as string}"
                </Badge>
              )}
            </div>

            {/* Detected Fields Table */}
            {Array.isArray(detectedFields) && detectedFields.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Detected Fields</h3>
                <div className="divide-y divide-border/50 rounded-lg border border-border/60">
                  {detectedFields.map((field, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 text-sm"
                    >
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {(field.type as string) ?? 'text'}
                      </Badge>
                      <span className="font-medium min-w-0 truncate">
                        {(field.label as string) || (field.name as string)}
                      </span>
                      {field.required && (
                        <span className="text-red-400 text-xs shrink-0">
                          required
                        </span>
                      )}
                      {field.category && (
                        <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">
                          {categoryLabels[(field.category as string)] ?? (field.category as string)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Field Suggestions */}
      {session.fieldSuggestions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            AI Suggestions ({session.fieldSuggestions.length} fields)
          </h2>
          <div className="space-y-4">
            {Array.from(fieldsByCategory.entries()).map(([category, fields]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  {categoryLabels[category] ?? category}
                </h3>
                <div className="divide-y divide-border/50 rounded-lg border border-border/60">
                  {fields.map(field => (
                    <div key={field.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {field.fieldLabel || field.fieldName}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0"
                            >
                              {field.fieldType}
                            </Badge>
                            {field.isRequired && (
                              <span className="text-red-400 text-[10px]">
                                required
                              </span>
                            )}
                          </div>
                          {field.suggestedValue && (
                            <div className="mt-1.5 rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wider text-primary/60 mb-0.5">
                                AI Suggestion
                              </p>
                              <p className="text-sm">{field.suggestedValue}</p>
                            </div>
                          )}
                          {field.userValue &&
                            field.userValue !== field.suggestedValue && (
                              <div className="mt-1.5 rounded-md bg-muted px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                                  User's Value
                                </p>
                                <p className="text-sm">{field.userValue}</p>
                              </div>
                            )}
                          {field.aiReasoning && (
                            <p className="mt-1.5 text-xs text-muted-foreground italic">
                              {field.aiReasoning}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            className={`text-[10px] ${suggestionStatusColors[field.status] ?? ''}`}
                          >
                            {field.status}
                          </Badge>
                          {field.confidence != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(field.confidence * 100)}% confident
                            </span>
                          )}
                          {field.suggestedSource && (
                            <span className="text-[10px] text-muted-foreground">
                              from: {field.suggestedSource}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!formAnalysis && session.fieldSuggestions.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p>No form analysis or field suggestions recorded for this session.</p>
          <p className="text-sm mt-1">
            The session may have failed before analysis completed.
          </p>
        </div>
      )}
    </AdminPageShell>
  );
}
