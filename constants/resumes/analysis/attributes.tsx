import { ResumeAnalysisStatus } from '@/generated/prisma/browser';
import { CheckCircle, Clock, RefreshCcw, TriangleAlert } from 'lucide-react';

export const ResumeAnalysisStatusAttributes = {
  variants: {
    default: {
      [ResumeAnalysisStatus.QUEUED]: {
        className:
          'bg-gray-400/10 text-gray-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30',
        icon: <Clock className="size-3.5" />,
        label: 'Queued',
      },
      [ResumeAnalysisStatus.PROCESSING]: {
        className:
          'bg-yellow-400/10 text-yellow-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-yellow-400/25 border-b-yellow-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [ResumeAnalysisStatus.ANALYZING]: {
        className:
          'bg-blue-400/10 text-blue-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-blue-400/25 border-b-blue-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [ResumeAnalysisStatus.COMPLETED]: {
        className:
          'bg-green-400/10 text-green-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-green-400/25 border-b-green-900/30',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analysis Complete',
      },
      [ResumeAnalysisStatus.FAILED]: {
        className:
          'bg-red-400/10 text-red-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-red-400/25 border-b-red-900/30',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    ghost: {
      [ResumeAnalysisStatus.QUEUED]: {
        className:
          'bg-transparent text-gray-400 border border-transparent py-1 px-2',
        icon: <Clock className="size-3.5" />,
        label: 'Queued',
      },
      [ResumeAnalysisStatus.PROCESSING]: {
        className:
          'bg-transparent text-yellow-400 border border-transparent py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [ResumeAnalysisStatus.ANALYZING]: {
        className:
          'bg-transparent text-blue-400 border border-transparent py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [ResumeAnalysisStatus.COMPLETED]: {
        className:
          'bg-transparent text-green-400 border border-transparent py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analysis Complete',
      },
      [ResumeAnalysisStatus.FAILED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    outline: {
      [ResumeAnalysisStatus.QUEUED]: {
        className:
          'bg-gray-400/10 text-gray-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30',
        icon: <Clock className="size-3.5" />,
        label: 'Queued',
      },
      [ResumeAnalysisStatus.PROCESSING]: {
        className:
          'bg-yellow-400/10 text-yellow-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-yellow-400/25 border-b-yellow-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [ResumeAnalysisStatus.ANALYZING]: {
        className:
          'bg-blue-400/10 text-blue-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-blue-400/25 border-b-blue-900/30',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [ResumeAnalysisStatus.COMPLETED]: {
        className:
          'bg-green-400/10 text-green-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-green-400/25 border-b-green-900/30',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analysis Complete',
      },
      [ResumeAnalysisStatus.FAILED]: {
        className:
          'bg-red-400/10 text-red-400 px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-red-400/25 border-b-red-900/30',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
  },
};
