import { ResumeOptimizationStatus } from '@/generated/prisma/browser';
import { BoltIcon as SolidBoltIcon } from '@heroicons/react/24/solid';
import { CheckCircle, Clock4, RefreshCcw, TriangleAlert } from 'lucide-react';

export const ResumeOptimizationStatusAttributes = {
  variants: {
    default: {
      [ResumeOptimizationStatus.QUEUED]: {
        className:
          'bg-gray-400/10 text-gray-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30',
        icon: <Clock4 className="size-3.5" />,
        label: 'Queued',
      },
      [ResumeOptimizationStatus.PROCESSING]: {
        className:
          'bg-yellow-400/10 text-yellow-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-yellow-400/25 border-b-yellow-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [ResumeOptimizationStatus.REVISING]: {
        className:
          'bg-orange-400/10 text-orange-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-orange-400/25 border-b-orange-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Revising',
      },
      [ResumeOptimizationStatus.ANALYZING]: {
        className:
          'bg-blue-400/10 text-blue-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-blue-400/25 border-b-blue-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [ResumeOptimizationStatus.ANALYZED]: {
        className:
          'bg-blue-400/10 text-blue-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-blue-400/25 border-b-blue-900/30',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analyzed',
      },
      [ResumeOptimizationStatus.OPTIMIZING]: {
        className:
          'bg-purple-400/10 text-purple-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-purple-400/25 border-b-purple-900/30',
        icon: <SolidBoltIcon className="size-3.5 animate-pulse" />,
        label: 'Optimizing',
      },
      [ResumeOptimizationStatus.COMPLETED]: {
        className:
          'bg-amber-500/15 text-amber-500 overflow-visible min-w-max px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-amber-400/25 border-b-amber-900/30',
        icon: (
          <SolidBoltIcon className="size-3.5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.55)]" />
        ),
        label: 'Optimized',
      },
      [ResumeOptimizationStatus.FAILED]: {
        className:
          'bg-red-400/10 text-red-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-red-400/25 border-b-red-900/30',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    ghost: {
      [ResumeOptimizationStatus.QUEUED]: {
        className:
          'bg-transparent text-gray-400 border border-transparent py-1 px-2.5',
        icon: <Clock4 className="size-3.5" />,
        label: 'Queued',
      },
      [ResumeOptimizationStatus.PROCESSING]: {
        className:
          'bg-transparent text-yellow-400 border border-transparent py-1 px-2.5',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [ResumeOptimizationStatus.REVISING]: {
        className:
          'bg-transparent text-orange-400 border border-transparent py-1 px-2.5',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Revising',
      },
      [ResumeOptimizationStatus.ANALYZING]: {
        className:
          'bg-transparent text-blue-400 border border-transparent py-1 px-2.5',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [ResumeOptimizationStatus.ANALYZED]: {
        className:
          'bg-transparent text-blue-400 border border-transparent py-1 px-2.5',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analyzed',
      },
      [ResumeOptimizationStatus.OPTIMIZING]: {
        className:
          'bg-transparent text-purple-400 border border-transparent py-1 px-2.5',
        icon: <SolidBoltIcon className="size-3.5 animate-pulse" />,
        label: 'Optimizing',
      },
      [ResumeOptimizationStatus.COMPLETED]: {
        className:
          'bg-amber-500/15 text-amber-500 overflow-visible min-w-max border border-transparent py-1 px-2.5',
        icon: (
          <SolidBoltIcon className="size-3.5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.55)]" />
        ),
        label: 'Optimized',
      },
      [ResumeOptimizationStatus.FAILED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2.5',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    outline: {
      [ResumeOptimizationStatus.QUEUED]: {
        className:
          'bg-gray-400/10 text-gray-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30',
        icon: <Clock4 className="size-3.5" />,
        label: 'Queued',
      },
      [ResumeOptimizationStatus.PROCESSING]: {
        className:
          'bg-yellow-400/10 text-yellow-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-yellow-400/25 border-b-yellow-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [ResumeOptimizationStatus.REVISING]: {
        className:
          'bg-orange-400/10 text-orange-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-orange-400/25 border-b-orange-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Revising',
      },

      [ResumeOptimizationStatus.ANALYZING]: {
        className:
          'bg-blue-400/10 text-blue-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-blue-400/25 border-b-blue-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [ResumeOptimizationStatus.ANALYZED]: {
        className:
          'bg-blue-400/10 text-blue-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-blue-400/25 border-b-blue-900/30',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analyzed',
      },
      [ResumeOptimizationStatus.OPTIMIZING]: {
        className:
          'bg-purple-400/10 text-purple-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-purple-400/25 border-b-purple-900/30',
        icon: <SolidBoltIcon className="size-3.5 animate-pulse" />,
        label: 'Optimizing',
      },
      [ResumeOptimizationStatus.COMPLETED]: {
        className:
          'bg-amber-500/15 text-amber-500 overflow-visible min-w-max px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-amber-400/25 border-b-amber-900/30',
        icon: (
          <SolidBoltIcon className="size-3.5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.55)]" />
        ),
        label: 'Optimized',
      },
      [ResumeOptimizationStatus.FAILED]: {
        className:
          'bg-red-400/10 text-red-400 px-2.5 py-1 rounded-full border-x-0 border-t border-b border-t-red-400/25 border-b-red-900/30',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
  },
};
