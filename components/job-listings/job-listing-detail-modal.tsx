'use client';

import { JobListing, JobListingStatus } from '@/generated/prisma/browser';
import {
  Ban,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CalendarPlus,
  DollarSign,
  Loader2,
  MapPin,
  MoreHorizontal,
  PlusCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ApplyButton } from '@/components/job-applications/apply-button';
import { JobListingStatusBadge } from '@/components/job-listings/job-listing-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { Separator } from '@/components/ui/separator';
import {
  saveLiveJobListing,
  unsaveLiveJobListing,
} from '@/lib/job-listings/live';
import { formatLocationLabel } from '@/lib/utils';
import { JobDescription } from './job-description';

interface JobListingDetailModalProps {
  job: JobListing | null;
  onClose: () => void;
  open: boolean;
}

export function JobListingDetailModal({
  job,
  onClose,
  open,
}: JobListingDetailModalProps) {
  const [isAddingToLeads, setIsAddingToLeads] = useState(false);
  const [isAddedToLeads, setIsAddedToLeads] = useState(
    job?.status === JobListingStatus.ADDED_TO_LEADS,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(job?.saved ?? false);
  const [isDismissingCompany, setIsDismissingCompany] = useState(false);

  if (!job) return null;

  const handleDismissCompany = async () => {
    if (!job.company) return;
    setIsDismissingCompany(true);
    try {
      const response = await fetch('/api/jobs/dismiss-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: job.company }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to dismiss company');
      }
      const data = await response.json();
      toast.success(
        `Dismissed ${data.dismissed} job${data.dismissed === 1 ? '' : 's'} from ${job.company}`,
      );
      onClose();
    } catch (error) {
      console.error('Failed to dismiss company:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to dismiss company jobs.',
      );
    } finally {
      setIsDismissingCompany(false);
    }
  };

  const handleAddToLeads = async () => {
    setIsAddingToLeads(true);
    try {
      const response = await fetch('/api/jobs/add-to-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to leads');
      }
      const updatedJob = {
        ...job,
        status: JobListingStatus.ADDED_TO_LEADS,
      };
      const encodedId = encodeURIComponent(job.id);
      sessionStorage.setItem(`job-${encodedId}`, JSON.stringify(updatedJob));
      window.dispatchEvent(
        new CustomEvent('job-listing-updated', {
          detail: {
            id: job.id,
            status: JobListingStatus.ADDED_TO_LEADS,
          },
        }),
      );
      setIsAddedToLeads(true);
      toast.success('Added to job leads! Resume optimization is in progress.');
    } catch (error) {
      console.error('Failed to add to leads:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to add to job leads. Please try again.',
      );
    } finally {
      setIsAddingToLeads(false);
    }
  };

  const handleSaveJob = async () => {
    setIsSaving(true);
    try {
      if (isSaved) {
        await unsaveLiveJobListing(job);
        setIsSaved(false);
        toast.success('Job removed from saved');
      } else {
        await saveLiveJobListing(job);
        setIsSaved(true);
        toast.success('Job saved');
      }
    } catch (error) {
      console.error('Failed to save job:', error);
      toast.error('Failed to save job. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isAlreadyInLeads = isAddedToLeads;
  const addedAt = job.createdAt ? formatDetailDate(job.createdAt) : null;

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent
        className="p-0 flex flex-col"
        style={{ width: '60vw', height: '90vh', maxWidth: 'none' }}
        closeActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="bg-background border-border rounded-full border p-2 transition-all duration-150 active:scale-95 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              {job.company && (
                <DropdownMenuItem
                  onClick={handleDismissCompany}
                  disabled={isDismissingCompany}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="h-4 w-4" />
                  {isDismissingCompany
                    ? 'Dismissing...'
                    : `Ignore all jobs from ${job.company}`}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <ModalHeader>
          <div className="flex min-w-0 items-start gap-3">
            {job.companyLogoUrl ? (
              <img
                alt={`${job.company ?? 'Company'} logo`}
                className="size-12 shrink-0 rounded-xl border border-border/60 bg-muted/40 object-contain p-1.5"
                loading="lazy"
                src={job.companyLogoUrl}
              />
            ) : null}

            <div className="flex-1 min-w-0 space-y-2">
              <ModalTitle className="truncate text-xl font-semibold leading-tight">
                {job.title}
              </ModalTitle>
              {job.company && (
                <p className="truncate text-lg font-medium text-muted-foreground">
                  {job.company}
                </p>
              )}
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                {job.location && (
                  <div className="flex items-center gap-1">
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {formatLocationLabel(job.location)}
                    </span>
                  </div>
                )}
                {job.jobType && job.jobType !== 'UNKNOWN' && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {job.jobType
                        .replace(/_/g, ' ')
                        .toLowerCase()
                        .replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                )}
                {addedAt && (
                  <div className="flex items-center gap-1.5">
                    <CalendarPlus
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Added {addedAt}</span>
                  </div>
                )}
                {job.salary &&
                  !/^[\s$€£¥0.,]*$/.test(job.salary) &&
                  (() => {
                    let display = job.salary;
                    if (display.startsWith('{')) {
                      try {
                        const p = JSON.parse(display);
                        const c =
                          p.currency === '$' || p.currency === 'USD'
                            ? '$'
                            : (p.currency ?? '$');
                        const min = p.minValue ?? p.value;
                        const max = p.maxValue;
                        const u = p.unitText
                          ? `/${p.unitText.toLowerCase().replace('year', 'yr').replace('hour', 'hr').replace('month', 'mo')}`
                          : '';
                        if (min != null && max != null && min !== max)
                          display = `${c}${Number(min).toLocaleString()} – ${c}${Number(max).toLocaleString()}${u}`;
                        else if (min != null)
                          display = `${c}${Number(min).toLocaleString()}${u}`;
                        else return null;
                      } catch {
                        /* use raw */
                      }
                    }
                    return (
                      <div className="flex items-center gap-1">
                        <DollarSign
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{display}</span>
                      </div>
                    );
                  })()}
                {job.remote &&
                  !/remote|anywhere|work\s*from\s*home/i.test(
                    job.location ?? '',
                  ) && (
                    <Badge variant="secondary" className="text-xs">
                      Remote
                    </Badge>
                  )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                {isAlreadyInLeads ? (
                  <JobListingStatusBadge
                    status={JobListingStatus.ADDED_TO_LEADS}
                    variant="outline"
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAddToLeads}
                    disabled={isAddingToLeads}
                  >
                    {isAddingToLeads ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4 w-4" />
                        Add to Leads
                      </>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveJob}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isSaved ? 'Unsaving...' : 'Saving...'}
                    </>
                  ) : isSaved ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 text-yellow-500" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" />
                      Save Job
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          <div className="space-y-6">
            {/* Description */}
            {job.description && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Description</h3>
                <JobDescription
                  description={job.description}
                  className="text-sm text-muted-foreground/90 space-y-1"
                />
              </div>
            )}

            {/* Only show separator if there's content after description */}
            {((job.requirements &&
              Array.isArray(job.requirements) &&
              job.requirements.length > 0) ||
              (job.qualifications &&
                Array.isArray(job.qualifications) &&
                job.qualifications.length > 0) ||
              (job.responsibilities &&
                Array.isArray(job.responsibilities) &&
                job.responsibilities.length > 0) ||
              (job.benefits &&
                Array.isArray(job.benefits) &&
                job.benefits.length > 0)) && <Separator />}

            {/* Requirements */}
            {job.requirements &&
              Array.isArray(job.requirements) &&
              job.requirements.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Requirements</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {job.requirements.map((req, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Qualifications */}
            {job.qualifications &&
              Array.isArray(job.qualifications) &&
              job.qualifications.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Qualifications</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {job.qualifications.map((qual, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{qual}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Responsibilities */}
            {job.responsibilities &&
              Array.isArray(job.responsibilities) &&
              job.responsibilities.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Responsibilities
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {job.responsibilities.map((resp, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Benefits */}
            {job.benefits &&
              Array.isArray(job.benefits) &&
              job.benefits.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Benefits</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {job.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </ModalBody>

        {/* Footer Actions */}
        <ModalFooter>
          <div className="flex gap-2">
            <ApplyButton
              jobId={job.id}
              size="sm"
              jobProvider={job.jobProvider ?? undefined}
              applyUrl={
                (job.applyOptions as { applyUrl?: string } | null)?.applyUrl ||
                job.jobProviderUrl ||
                (job as { url?: string }).url
              }
              applyOptions={
                Array.isArray(job.applyOptions)
                  ? (job.applyOptions as Array<{
                      link: string;
                      title?: string;
                      buttonText?: string;
                    }>)
                  : undefined
              }
            />
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function formatDetailDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
