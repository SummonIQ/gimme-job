import { JobFitAnalysisStatus } from '@/generated/prisma/browser';
import { CheckCircle, Clock, RefreshCcw, TriangleAlert } from 'lucide-react';

export const JobFitAnalysisStatusAttributes = {
  variants: {
    default: {
      [JobFitAnalysisStatus.QUEUED]: {
        className: 'bg-gray-400/10 text-gray-400 py-1 px-2',
        icon: <Clock className="size-3.5" />,
        label: 'Queued',
      },
      [JobFitAnalysisStatus.ANALYZING]: {
        className: 'bg-blue-400/10 text-blue-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [JobFitAnalysisStatus.COMPLETED]: {
        className: 'bg-green-400/10 text-green-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Job Fit Analyzed',
      },
      [JobFitAnalysisStatus.FAILED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    ghost: {
      [JobFitAnalysisStatus.QUEUED]: {
        className:
          'bg-transparent text-gray-400 border border-transparent py-1 px-2',
        icon: <Clock className="size-3.5" />,
        label: 'Queued',
      },
      [JobFitAnalysisStatus.ANALYZING]: {
        className:
          'bg-transparent text-blue-400 border border-transparent py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [JobFitAnalysisStatus.COMPLETED]: {
        className:
          'bg-transparent text-green-400 border border-transparent py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Job Fit Analyzed',
      },
      [JobFitAnalysisStatus.FAILED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    outline: {
      [JobFitAnalysisStatus.QUEUED]: {
        className:
          'bg-transparent border border-gray-400/20 text-gray-400 py-1 px-2',
        icon: <Clock className="size-3.5" />,
        label: 'Queued',
      },
      [JobFitAnalysisStatus.ANALYZING]: {
        className:
          'bg-transparent border border-blue-400/20 text-blue-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [JobFitAnalysisStatus.COMPLETED]: {
        className:
          'bg-transparent border border-green-400/20 text-green-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Job Fit Analyzed',
      },
      [JobFitAnalysisStatus.FAILED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
  },
};
