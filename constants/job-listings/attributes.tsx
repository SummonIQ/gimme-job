import { JobListingStatus } from '@/generated/prisma/browser';
import { Ban, EyeOff } from 'lucide-react';
import { TbTargetArrow } from 'react-icons/tb';

export const JobListingStatusAttributes = {
  variants: {
    default: {
      [JobListingStatus.UNREVIEWED]: {
        className:
          'bg-muted! text-muted-foreground! px-2.5 pt-[4px] pb-[4px] border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30',
        icon: <EyeOff className="size-3.5" />,
        label: 'Unreviewed',
      },
      [JobListingStatus.DISMISSED]: {
        className:
          'bg-muted! text-muted-foreground! px-2.5 pt-[4px] pb-[4px] border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30',
        icon: <Ban className="size-3.5" />,
        label: 'Dismissed',
      },
      [JobListingStatus.ADDED_TO_LEADS]: {
        className:
          'text-green-400! bg-green-400/10! px-2.5 pt-[4px] pb-[4px] border-x-0 border-t border-b border-t-green-400/25 border-b-green-900/30',
        icon: <TbTargetArrow className="size-3.5" />,
        label: 'Added to Leads',
      },
    },
    ghost: {
      [JobListingStatus.UNREVIEWED]: {
        className:
          'bg-muted! text-muted-foreground! border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30 py-1 px-2.5',
        icon: <EyeOff className="size-3.5" />,
        label: 'Unreviewed',
      },
      [JobListingStatus.DISMISSED]: {
        className:
          'bg-muted! text-muted-foreground! border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30 py-1 px-2.5',
        icon: <Ban className="size-3.5" />,
        label: 'Dismissed',
      },
      [JobListingStatus.ADDED_TO_LEADS]: {
        className:
          'bg-transparent text-green-400! border-x-0 border-t border-b border-t-green-400/25 border-b-green-900/30 py-1 px-2.5',
        icon: <TbTargetArrow className="size-3.5" />,
        label: 'Added to Leads',
      },
    },
    outline: {
      [JobListingStatus.UNREVIEWED]: {
        className:
          'bg-muted! border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30 text-gray-400! py-1 px-2.5',
        icon: <EyeOff className="size-3.5" />,
        label: 'Unreviewed',
      },
      [JobListingStatus.DISMISSED]: {
        className:
          'bg-muted! border-x-0 border-t border-b border-t-gray-400/20 border-b-gray-900/30 text-gray-400! py-1 px-2.5',
        icon: <Ban className="size-3.5" />,
        label: 'Dismissed',
      },
      [JobListingStatus.ADDED_TO_LEADS]: {
        className:
          'bg-green-400/10! border-x-0 border-t border-b border-t-green-400/25 border-b-green-900/30 text-green-400! py-1 px-2.5',
        icon: <TbTargetArrow className="size-3.5" />,
        label: 'Added to Leads',
      },
    },
  },
};
