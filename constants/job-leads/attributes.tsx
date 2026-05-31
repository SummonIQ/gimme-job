import { JobLeadStatus } from '@/generated/prisma/browser';
import {
  ArrowRight,
  Ban,
  CalendarCheck2,
  CalendarClock,
  CalendarX,
  CheckCircle,
  CircleAlert,
  Handshake,
  Loader2,
  RefreshCcw,
  ThumbsDown,
} from 'lucide-react';
import { PiSignatureBold } from 'react-icons/pi';
import { TbTargetArrow } from 'react-icons/tb';

export const JobLeadStatusAccents = {
  [JobLeadStatus.ADDED]: {
    dotClass: 'bg-gray-400',
    glowColor: 'rgba(156, 163, 175, 0.03)',
    inactiveDotClass: 'bg-gray-500/10',
    ringClass: 'ring-gray-500/30',
    textClass: 'text-gray-400',
  },
  [JobLeadStatus.ANALYZING]: {
    dotClass: 'bg-blue-400',
    glowColor: 'rgba(96, 165, 250, 0.03)',
    inactiveDotClass: 'bg-blue-500/10',
    ringClass: 'ring-blue-500/30',
    textClass: 'text-blue-400',
  },
  [JobLeadStatus.ANALYZED]: {
    dotClass: 'bg-blue-400',
    glowColor: 'rgba(96, 165, 250, 0.03)',
    inactiveDotClass: 'bg-blue-500/10',
    ringClass: 'ring-blue-500/30',
    textClass: 'text-blue-400',
  },
  [JobLeadStatus.OPTIMIZING]: {
    dotClass: 'bg-emerald-400',
    glowColor: 'rgba(52, 211, 153, 0.03)',
    inactiveDotClass: 'bg-emerald-500/10',
    ringClass: 'ring-emerald-500/30',
    textClass: 'text-emerald-400',
  },
  [JobLeadStatus.ANALYSIS_FAILED]: {
    dotClass: 'bg-red-400',
    glowColor: 'rgba(248, 113, 113, 0.03)',
    inactiveDotClass: 'bg-red-500/10',
    ringClass: 'ring-red-500/30',
    textClass: 'text-red-400',
  },
  [JobLeadStatus.OPTIMIZED]: {
    dotClass: 'bg-amber-400',
    glowColor: 'rgba(251, 191, 36, 0.03)',
    inactiveDotClass: 'bg-amber-500/10',
    ringClass: 'ring-amber-500/30',
    textClass: 'text-amber-400',
  },
  [JobLeadStatus.OPTIMIZATION_FAILED]: {
    dotClass: 'bg-red-400',
    glowColor: 'rgba(248, 113, 113, 0.03)',
    inactiveDotClass: 'bg-red-500/10',
    ringClass: 'ring-red-500/30',
    textClass: 'text-red-400',
  },
  [JobLeadStatus.APPLYING]: {
    dotClass: 'bg-yellow-400',
    glowColor: 'rgba(250, 204, 21, 0.03)',
    inactiveDotClass: 'bg-yellow-500/10',
    ringClass: 'ring-yellow-500/30',
    textClass: 'text-yellow-400',
  },
  [JobLeadStatus.APPLIED]: {
    dotClass: 'bg-emerald-400',
    glowColor: 'rgba(52, 211, 153, 0.03)',
    inactiveDotClass: 'bg-emerald-500/10',
    ringClass: 'ring-emerald-500/30',
    textClass: 'text-emerald-400',
  },
  [JobLeadStatus.INTERVIEW_SCHEDULED]: {
    dotClass: 'bg-orange-400',
    glowColor: 'rgba(251, 146, 60, 0.03)',
    inactiveDotClass: 'bg-orange-500/10',
    ringClass: 'ring-orange-500/30',
    textClass: 'text-orange-400',
  },
  [JobLeadStatus.INTERVIEW_COMPLETED]: {
    dotClass: 'bg-blue-400',
    glowColor: 'rgba(96, 165, 250, 0.03)',
    inactiveDotClass: 'bg-blue-500/10',
    ringClass: 'ring-blue-500/30',
    textClass: 'text-blue-400',
  },
  [JobLeadStatus.OFFER]: {
    dotClass: 'bg-purple-400',
    glowColor: 'rgba(192, 132, 252, 0.03)',
    inactiveDotClass: 'bg-purple-500/10',
    ringClass: 'ring-purple-500/30',
    textClass: 'text-purple-400',
  },
} as const;

export const JobLeadStatusAttributes = {
  variants: {
    default: {
      [JobLeadStatus.ADDED]: {
        className: 'bg-gray-400/10 text-gray-400 py-1 px-2',
        icon: <TbTargetArrow className="size-3.5" />,
        label: 'Added',
      },
      [JobLeadStatus.ANALYZING]: {
        className: 'bg-blue-400/10 text-blue-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [JobLeadStatus.ANALYZED]: {
        className: 'bg-blue-400/10 text-blue-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analyzed',
      },
      [JobLeadStatus.ANALYSIS_FAILED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <CircleAlert className="size-3.5" />,
        label: 'Analysis Failed',
      },
      [JobLeadStatus.OPTIMIZING]: {
        className: 'bg-emerald-400/10 text-emerald-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Optimizing',
      },
      [JobLeadStatus.OPTIMIZED]: {
        className: 'bg-amber-400/10 text-amber-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Optimized',
      },
      [JobLeadStatus.OPTIMIZATION_FAILED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <CircleAlert className="size-3.5" />,
        label: 'Optimization Failed',
      },
      [JobLeadStatus.APPLYING]: {
        className: 'bg-yellow-400/10 text-yellow-400 py-1 px-2',
        icon: <Loader2 className="size-3.5 animate-spin" />,
        label: 'Applying',
      },
      [JobLeadStatus.APPLIED]: {
        className: 'bg-emerald-400/10 text-emerald-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Applied',
      },
      [JobLeadStatus.REJECTED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <Ban className="size-3.5" />,
        label: 'Rejected',
      },
      [JobLeadStatus.ADVANCED]: {
        className: 'bg-green-400/10 text-green-400 py-1 px-2',
        icon: <ArrowRight className="size-3.5" />,
        label: 'Advanced',
      },
      [JobLeadStatus.INTERVIEW_SCHEDULED]: {
        className: 'bg-orange-400/10 text-orange-400 py-1 px-2',
        icon: <CalendarClock className="size-3.5" />,
        label: 'Interview Scheduled',
      },
      [JobLeadStatus.INTERVIEW_CANCELLED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <CalendarX className="size-3.5" />,
        label: 'Interview Cancelled',
      },
      [JobLeadStatus.INTERVIEW_COMPLETED]: {
        className: 'bg-blue-400/10 text-blue-400 py-1 px-2',
        icon: <CalendarCheck2 className="size-3.5" />,
        label: 'Interview Completed',
      },
      [JobLeadStatus.INTERVIEWED_NOT_SELECTED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <ThumbsDown className="size-3.5" />,
        label: 'Interviewed, Not Selected',
      },
      [JobLeadStatus.OFFER]: {
        className: 'bg-purple-400/10 text-purple-400 py-1 px-2',
        icon: <PiSignatureBold className="size-3.5" />,
        label: 'Offer',
      },
      [JobLeadStatus.OFFER_DECLINED]: {
        className: 'bg-red-400/10 text-red-400 py-1 px-2',
        icon: <ThumbsDown className="size-3.5" />,
        label: 'Offer Declined',
      },
      [JobLeadStatus.HIRED]: {
        className: 'bg-green-400/10 text-green-400 py-1 px-2',
        icon: <Handshake className="size-3.5" />,
        label: 'Hired',
      },
      [JobLeadStatus.REMOVED]: {
        className: 'bg-gray-400/10 text-gray-400 py-1 px-2',
        icon: <Ban className="size-3.5" />,
        label: 'Removed',
      },
    },
    ghost: {
      [JobLeadStatus.ADDED]: {
        className:
          'bg-transparent text-gray-400 border border-transparent py-1 px-2',
        icon: <TbTargetArrow className="size-3.5" />,
        label: 'Added',
      },
      [JobLeadStatus.ANALYZING]: {
        className:
          'bg-transparent text-blue-400 border border-transparent py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [JobLeadStatus.ANALYZED]: {
        className:
          'bg-transparent text-blue-400 border border-transparent py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analyzed',
      },
      [JobLeadStatus.ANALYSIS_FAILED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <CircleAlert className="size-3.5" />,
        label: 'Analysis Failed',
      },
      [JobLeadStatus.OPTIMIZING]: {
        className:
          'bg-transparent text-emerald-400 border border-transparent py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Optimizing',
      },
      [JobLeadStatus.OPTIMIZED]: {
        className:
          'bg-transparent text-amber-400 border border-transparent py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Optimized',
      },
      [JobLeadStatus.OPTIMIZATION_FAILED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <CircleAlert className="size-3.5" />,
        label: 'Optimization Failed',
      },
      [JobLeadStatus.APPLYING]: {
        className:
          'bg-transparent text-yellow-400 border border-transparent py-1 px-2',
        icon: <Loader2 className="size-3.5 animate-spin" />,
        label: 'Applying',
      },
      [JobLeadStatus.APPLIED]: {
        className:
          'bg-transparent text-emerald-400 border border-transparent py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Applied',
      },
      [JobLeadStatus.REJECTED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <Ban className="size-3.5" />,
        label: 'Rejected',
      },
      [JobLeadStatus.ADVANCED]: {
        className:
          'bg-transparent text-green-400 border border-transparent py-1 px-2',
        icon: <ArrowRight className="size-3.5" />,
        label: 'Advanced',
      },
      [JobLeadStatus.INTERVIEW_SCHEDULED]: {
        className:
          'bg-transparent text-orange-400 border border-transparent py-1 px-2',
        icon: <CalendarClock className="size-3.5" />,
        label: 'Interview Scheduled',
      },
      [JobLeadStatus.INTERVIEW_CANCELLED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <CalendarX className="size-3.5" />,
        label: 'Interview Cancelled',
      },
      [JobLeadStatus.INTERVIEW_COMPLETED]: {
        className:
          'bg-transparent text-blue-400 border border-transparent py-1 px-2',
        icon: <CalendarCheck2 className="size-3.5" />,
        label: 'Interview Completed',
      },
      [JobLeadStatus.INTERVIEWED_NOT_SELECTED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <ThumbsDown className="size-3.5" />,
        label: 'Interviewed, Not Selected',
      },
      [JobLeadStatus.OFFER]: {
        className:
          'bg-transparent text-purple-400 border border-transparent py-1 px-2',
        icon: <PiSignatureBold className="size-3.5" />,
        label: 'Offer',
      },
      [JobLeadStatus.OFFER_DECLINED]: {
        className:
          'bg-transparent text-red-400 border border-transparent py-1 px-2',
        icon: <ThumbsDown className="size-3.5" />,
        label: 'Offer Declined',
      },
      [JobLeadStatus.HIRED]: {
        className:
          'bg-transparent text-green-400 border border-transparent py-1 px-2',
        icon: <Handshake className="size-3.5" />,
        label: 'Hired',
      },
      [JobLeadStatus.REMOVED]: {
        className:
          'bg-transparent text-gray-400 border border-transparent py-1 px-2',
        icon: <Ban className="size-3.5" />,
        label: 'Removed',
      },
    },
    outline: {
      [JobLeadStatus.ADDED]: {
        className:
          'bg-transparent border border-gray-400/20 text-gray-400 py-1 px-2',
        icon: <TbTargetArrow className="size-3.5" />,
        label: 'Added',
      },
      [JobLeadStatus.ANALYZING]: {
        className:
          'bg-transparent border border-blue-400/20 text-blue-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Analyzing',
      },
      [JobLeadStatus.ANALYZED]: {
        className:
          'bg-transparent border border-blue-400/20 text-blue-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Analyzed',
      },
      [JobLeadStatus.ANALYSIS_FAILED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <CircleAlert className="size-3.5" />,
        label: 'Analysis Failed',
      },
      [JobLeadStatus.OPTIMIZING]: {
        className:
          'bg-transparent border border-emerald-400/20 text-emerald-400 py-1 px-2',
        icon: <RefreshCcw className="size-3.5 animate-spin" />,
        label: 'Optimizing',
      },
      [JobLeadStatus.OPTIMIZED]: {
        className:
          'bg-transparent border border-amber-400/20 text-amber-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Optimized',
      },
      [JobLeadStatus.OPTIMIZATION_FAILED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <CircleAlert className="size-3.5" />,
        label: 'Optimization Failed',
      },
      [JobLeadStatus.APPLYING]: {
        className:
          'bg-transparent border border-yellow-400/20 text-yellow-400 py-1 px-2',
        icon: <Loader2 className="size-3.5 animate-spin" />,
        label: 'Applying',
      },
      [JobLeadStatus.APPLIED]: {
        className:
          'bg-transparent border border-emerald-400/20 text-emerald-400 py-1 px-2',
        icon: <CheckCircle className="size-3.5" />,
        label: 'Applied',
      },
      [JobLeadStatus.REJECTED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <Ban className="size-3.5" />,
        label: 'Rejected',
      },
      [JobLeadStatus.ADVANCED]: {
        className:
          'bg-transparent border border-green-400/20 text-green-400 py-1 px-2',
        icon: <ArrowRight className="size-3.5" />,
        label: 'Advanced',
      },
      [JobLeadStatus.INTERVIEW_SCHEDULED]: {
        className:
          'bg-transparent border border-orange-400/20 text-orange-400 py-1 px-2',
        icon: <CalendarClock className="size-3.5" />,
        label: 'Interview Scheduled',
      },
      [JobLeadStatus.INTERVIEW_CANCELLED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <CalendarX className="size-3.5" />,
        label: 'Interview Cancelled',
      },
      [JobLeadStatus.INTERVIEW_COMPLETED]: {
        className:
          'bg-transparent border border-blue-400/20 text-blue-400 py-1 px-2',
        icon: <CalendarCheck2 className="size-3.5" />,
        label: 'Interview Completed',
      },
      [JobLeadStatus.INTERVIEWED_NOT_SELECTED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <ThumbsDown className="size-3.5" />,
        label: 'Interviewed, Not Selected',
      },
      [JobLeadStatus.OFFER]: {
        className:
          'bg-transparent border border-purple-400/20 text-purple-400 py-1 px-2',
        icon: <PiSignatureBold className="size-3.5" />,
        label: 'Offer',
      },
      [JobLeadStatus.OFFER_DECLINED]: {
        className:
          'bg-transparent border border-red-400/20 text-red-400 py-1 px-2',
        icon: <ThumbsDown className="size-3.5" />,
        label: 'Offer Declined',
      },
      [JobLeadStatus.HIRED]: {
        className:
          'bg-transparent border border-green-400/20 text-green-400 py-1 px-2',
        icon: <Handshake className="size-3.5" />,
        label: 'Hired',
      },
      [JobLeadStatus.REMOVED]: {
        className:
          'bg-transparent border border-gray-400/20 text-gray-400 py-1 px-2',
        icon: <Ban className="size-3.5" />,
        label: 'Removed',
      },
    },
  },
};
