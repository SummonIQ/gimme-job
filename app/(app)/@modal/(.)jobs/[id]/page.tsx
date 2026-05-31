'use client';

import { JobListing } from '@/generated/prisma/browser';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useState } from 'react';

import { JobListingDetailModal } from '@/components/job-listings/job-listing-detail-modal';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';

interface JobModalPageProps {
  params: Promise<{ id: string }>;
}

function getJobFromSessionStorage(id: string): JobListing | null {
  if (typeof window === 'undefined') return null;
  const encodedId = encodeURIComponent(id);
  const cached = sessionStorage.getItem(`job-${encodedId}`);
  if (cached) {
    try {
      return JSON.parse(cached) as JobListing;
    } catch {
      return null;
    }
  }
  return null;
}

// Animation duration matches the modal's data-[state=closed]:duration-200
const CLOSE_ANIMATION_DURATION = 250;

// Reserved paths that shouldn't trigger the modal
const RESERVED_PATHS = [
  'saved',
  'dismissed',
  'searches',
  'search',
  'improved-page',
];

export default function JobModalPage({ params }: JobModalPageProps) {
  const router = useRouter();
  const { id } = use(params);

  // Don't render modal for reserved paths like /jobs/saved, /jobs/dismissed, etc.
  if (RESERVED_PATHS.includes(id)) {
    return null;
  }

  const safeId = useMemo(() => id || '', [id]);

  // Track modal open state for animation
  const [isOpen, setIsOpen] = useState(true);

  // Try to get job from sessionStorage synchronously on initial render
  const [job, setJob] = useState<JobListing | null>(() =>
    safeId ? getJobFromSessionStorage(safeId) : null,
  );
  const [loading, setLoading] = useState(() =>
    safeId ? !getJobFromSessionStorage(safeId) : false,
  );

  // Only fetch from API if not found in sessionStorage
  useEffect(() => {
    // Already have job data from sessionStorage
    if (job) return;

    // Live jobs can't be fetched from API
    if (!safeId) {
      setLoading(false);
      return;
    }

    if (safeId.startsWith('live-')) {
      setLoading(false);
      return;
    }

    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${safeId}`);
        if (response.ok) {
          const jobData = await response.json();
          setJob(jobData);
        }
      } catch (error) {
        console.error('Error fetching job:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [safeId, job]);

  // If job not found after loading, go back
  useEffect(() => {
    if (!loading && !job) {
      router.back();
    }
  }, [loading, job, router]);

  const handleClose = useCallback(() => {
    // Start close animation
    setIsOpen(false);

    // Wait for animation to complete before navigating
    setTimeout(() => {
      if (safeId) {
        const encodedId = encodeURIComponent(safeId);
        sessionStorage.removeItem(`job-${encodedId}`);
      }
      router.back();
    }, CLOSE_ANIMATION_DURATION);
  }, [safeId, router]);

  if (loading) {
    return (
      <Modal open onOpenChange={handleClose}>
        <ModalContent
          className="max-h-[90vh]"
          style={{ width: '52vw', maxWidth: 'none' }}
        >
          <ModalHeader>
            <ModalTitle>Loading...</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="p-8 text-center">Loading job details...</div>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  if (!job) {
    return null;
  }

  return <JobListingDetailModal job={job} open={true} onClose={handleClose} />;
}
