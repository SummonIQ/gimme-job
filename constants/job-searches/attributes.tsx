import { JobSearchStatus } from '@/generated/prisma/browser';
import { CheckCircle, Clock4, RefreshCcw, TriangleAlert } from 'lucide-react';

export const JobSearchStatusAttributes = {
  variants: {
    default: {
      [JobSearchStatus.QUEUED]: {
        className: 'bg-gray-400/10 text-gray-400 py-1 px-2',
        icon: <Clock4 className="size-3.5" />,
        label: 'Queued',
      },
      [JobSearchStatus.PROCESSING]: {
        className: 'bg-yellow-400/10 text-yellow-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [JobSearchStatus.COMPLETED]: {
        className: 'text-green-400 bg-green-400/10 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Completed',
      },
      [JobSearchStatus.FAILED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    ghost: {
      [JobSearchStatus.QUEUED]: {
        className:
          'bg-transparent border border-transparent text-gray-400 py-1 px-2',
        icon: <Clock4 className="size-3.5" />,
        label: 'Queued',
      },
      [JobSearchStatus.PROCESSING]: {
        className:
          'bg-transparent text-yellow-400 border border-transparent py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [JobSearchStatus.COMPLETED]: {
        className:
          'bg-transparent text-green-400 border border-transparent py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Completed',
      },
      [JobSearchStatus.FAILED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
    outline: {
      [JobSearchStatus.QUEUED]: {
        className:
          'bg-transparent border border-gray-400/20 text-gray-400 py-1 px-2',
        icon: <Clock4 className="size-3.5" />,
        label: 'Queued',
      },
      [JobSearchStatus.PROCESSING]: {
        className:
          'bg-transparent border border-yellow-400/20 text-yellow-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Processing',
      },
      [JobSearchStatus.COMPLETED]: {
        className:
          'bg-transparent border border-green-400/20 text-green-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Completed',
      },
      [JobSearchStatus.FAILED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <TriangleAlert className="size-3.5" />,
        label: 'Failed',
      },
    },
  },
};
