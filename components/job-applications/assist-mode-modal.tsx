'use client';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MousePointerClick,
  RefreshCcw,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LoginForm from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/lib/auth/client';
import { cn } from '@/lib/css';
import { AssistPreviewSubmitBanner } from './assist-preview-submit-banner';

interface AssistModeModalProps {
  applyUrl: string | null;
  onClose: () => void;
  open: boolean;
  userName?: string | null;
  // Optional — when this modal is opened from a tracked job lead, pass
  // the lead ID through. The shared resolver uses it to load job context
  // (description, requirements, responsibilities) for long-form
  // "why this company" answers. Modal still works without it.
  jobLeadId?: string | null;
}

interface AutofillProfile {
  city: string;
  currentCompany: string;
  currentTitle: string;
  disabilityStatus: string;
  earliestStartDate: string;
  email: string;
  firstName: string;
  fullName: string;
  gender: string;
  githubUrl: string;
  hispanicLatino: string;
  graduationYear: string;
  hasDefaultResume: boolean;
  highestDegree: string;
  languages: string;
  lastName: string;
  linkedinUrl: string;
  phone: string;
  race: string;
  requiresSponsorship: boolean | null;
  resumeFileName: string;
  salaryExpectation: string;
  skills: string;
  state: string;
  streetAddress: string;
  university: string;
  veteranStatus: string;
  websiteUrl: string;
  workAuthorization: string;
  yearsOfExperience: string;
  zipCode: string;
}

interface ChecklistField {
  fingerprint: string;
  label: string;
  required: boolean;
  status: 'empty' | 'filled' | 'skipped';
}

type ApplicationFieldPattern = {
  label: string;
  regex: RegExp;
  score: number;
};

const APPLICATION_FIELD_PATTERNS: ApplicationFieldPattern[] = [
  {
    label: 'first name',
    regex: /(^|\W)(first\s*name|given\s*name|forename)(\W|$)/i,
    score: 120,
  },
  {
    label: 'last name',
    regex: /(^|\W)(last\s*name|family\s*name|surname)(\W|$)/i,
    score: 120,
  },
  { label: 'full name', regex: /(^|\W)(full\s*name|name)(\W|$)/i, score: 115 },
  { label: 'email', regex: /(^|\W)(email|e-mail)(\W|$)/i, score: 120 },
  {
    label: 'phone',
    regex: /(^|\W)(phone|mobile|telephone|cell)(\W|$)/i,
    score: 118,
  },
  { label: 'linkedin', regex: /(^|\W)(linkedin)(\W|$)/i, score: 116 },
  {
    label: 'portfolio',
    regex: /(^|\W)(portfolio|website|personal\s*site)(\W|$)/i,
    score: 112,
  },
  { label: 'github', regex: /(^|\W)(github)(\W|$)/i, score: 111 },
  { label: 'city', regex: /(^|\W)(city|town)(\W|$)/i, score: 104 },
  { label: 'state', regex: /(^|\W)(state|province|region)(\W|$)/i, score: 103 },
  { label: 'location', regex: /(^|\W)(location|address)(\W|$)/i, score: 100 },
  {
    label: 'resume',
    regex: /(^|\W)(resume|cv|upload\s*resume|attach\s*resume)(\W|$)/i,
    score: 125,
  },
  { label: 'cover letter', regex: /(^|\W)(cover\s*letter)(\W|$)/i, score: 122 },
  {
    label: 'sponsorship',
    regex:
      /(^|\W)(require\s+sponsorship|requires\s+sponsorship|future\s+require\s+sponsorship|employment\s+visa\s+status|visa\s+sponsorship)(\W|$)/i,
    score: 109,
  },
  {
    label: 'work authorization',
    regex:
      /(^|\W)(work\s*authorization|authorized\s*to\s*work|able\s*to\s*work|legally\s*authorized)(\W|$)/i,
    score: 108,
  },
  {
    label: 'years of experience',
    regex:
      /(^|\W)(years?\s*of\s*experience|experience\s*years?|total\s*experience)(\W|$)/i,
    score: 106,
  },
  {
    label: 'salary expectation',
    regex:
      /(^|\W)(salary|compensation|pay\s*expectation|desired\s*salary)(\W|$)/i,
    score: 105,
  },
  {
    label: 'start date',
    regex:
      /(^|\W)(start\s*date|available\s*date|earliest\s*start|availability)(\W|$)/i,
    score: 104,
  },
  {
    label: 'street address',
    regex: /(^|\W)(street\s*address|address\s*line)(\W|$)/i,
    score: 102,
  },
  {
    label: 'zip code',
    regex: /(^|\W)(zip\s*code|postal\s*code|zip)(\W|$)/i,
    score: 101,
  },
  {
    label: 'gender',
    regex: /(^|\W)(gender|sex)(\W|$)/i,
    score: 90,
  },
  {
    label: 'veteran status',
    regex: /(^|\W)(veteran|military\s*service)(\W|$)/i,
    score: 90,
  },
  {
    label: 'disability',
    regex: /(^|\W)(disability|disabled)(\W|$)/i,
    score: 90,
  },
  {
    label: 'hispanic latino',
    regex: /(^|\W)(hispanic|latino|latina|latinx)(\W|$)/i,
    score: 91,
  },
  {
    label: 'race',
    regex: /(^|\W)(race|ethnicity|ethnic)(\W|$)/i,
    score: 90,
  },
  {
    label: 'current company',
    regex:
      /(^|\W)(current\s*(company|employer)|employer\s*name|company\s*name)(\W|$)/i,
    score: 106,
  },
  {
    label: 'current title',
    regex:
      /(^|\W)(current\s*(title|role|position|job\s*title)|job\s*title)(\W|$)/i,
    score: 106,
  },
  {
    label: 'highest degree',
    regex: /(^|\W)(highest?\s*degree|education\s*level|degree)(\W|$)/i,
    score: 100,
  },
  {
    label: 'university',
    regex: /(^|\W)(university|school|college|institution|alma\s*mater)(\W|$)/i,
    score: 100,
  },
  {
    label: 'graduation year',
    regex: /(^|\W)(graduation\s*year|year\s*graduated|grad\s*year)(\W|$)/i,
    score: 99,
  },
  {
    label: 'languages',
    regex:
      /(^|\W)(languages?\s*spoken|languages?\s*proficiency|languages?)(\W|$)/i,
    score: 95,
  },
];

const AssistModeModal = ({
  applyUrl,
  onClose,
  open,
  userName,
  jobLeadId,
}: AssistModeModalProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [html, setHtml] = useState('');
  const [styles, setStyles] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sanitizedHtml, setSanitizedHtml] = useState('');
  const [isSanitizedLoading, setIsSanitizedLoading] = useState(false);
  const [sanitizedError, setSanitizedError] = useState<string | null>(null);
  const [sanitizedContext, setSanitizedContext] = useState<{
    url: string;
    method?: string;
    fields?: Record<string, string | string[]>;
  } | null>(null);
  const [recommendation, setRecommendation] = useState<{
    selector: string;
    reason: string;
  } | null>(null);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null,
  );
  const [sanitizedHistory, setSanitizedHistory] = useState<{
    entries: Array<{
      url: string;
      method?: string;
      fields?: Record<string, string | string[]>;
    }>;
    index: number;
  }>({ entries: [], index: -1 });
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [rawHistory, setRawHistory] = useState<{
    entries: string[];
    index: number;
  }>({ entries: [], index: -1 });
  const [autofillProfile, setAutofillProfile] =
    useState<AutofillProfile | null>(null);
  const [fieldActionTick, setFieldActionTick] = useState(0);
  const observationSessionIdRef = useRef(crypto.randomUUID());
  const [rawLoadCount, setRawLoadCount] = useState(0);
  const [atsResumeUploaded, setAtsResumeUploaded] = useState(false);
  const [atsResumeAutofillSelector, setAtsResumeAutofillSelector] = useState<
    string | null
  >(null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [headerSuggestion, setHeaderSuggestion] = useState<{
    reason: string;
    buttonLabel: string;
  } | null>(null);
  const headerActionRef = useRef<(() => void) | null>(null);
  const [contentView, setContentView] = useState<'adapted' | 'raw'>('adapted');
  const [fieldChecklist, setFieldChecklist] = useState<ChecklistField[]>([]);
  const recommendationFetchIdRef = useRef(0);
  const recommendationKey = useMemo(() => {
    const url = rawUrl ?? applyUrl ?? '';
    return `${url}:${html.length}:${styles.length}:${isLoading}:${open}:${fieldActionTick}`;
  }, [
    rawUrl,
    applyUrl,
    html.length,
    isLoading,
    open,
    styles.length,
    fieldActionTick,
  ]);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const navigateRawRef = useRef<(url: string) => void>(() => {});
  const autoResumeUploadAttemptRef = useRef<string | null>(null);
  const atsAiFieldFillAttemptRef = useRef<string | null>(null);
  const marchingAntsFrameRef = useRef<number | null>(null);
  const ignoredSelectorsRef = useRef<Set<string>>(new Set());
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const nameHintsRegex =
    /(^|\W)(name|full\s*name|first\s*name|last\s*name)(\W|$)/i;
  const firstNameHintsRegex =
    /(^|\W)(first\s*name|given\s*name|forename)(\W|$)/i;
  const lastNameHintsRegex = /(^|\W)(last\s*name|family\s*name|surname)(\W|$)/i;

  const userNameParts = useMemo(() => {
    const fullName = userName?.trim() || session?.user?.name?.trim() || '';
    if (!fullName) return null;
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    return { firstName, fullName, lastName };
  }, [userName, session?.user?.name]);

  const handleUnauthorized = useCallback((reason?: string) => {
    setAuthPromptReason(
      reason ??
        'Your session expired while AI Preview was open. Sign in to continue without losing your place.',
    );
    setAuthPromptOpen(true);
  }, []);
  const handleAssistModalOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) {
      setAutofillProfile(null);
      setHeaderSuggestion(null);
      headerActionRef.current = null;
      return;
    }

    const controller = new AbortController();
    const fetchAutofillProfile = async () => {
      try {
        const response = await fetch('/api/assist-mode/profile', {
          signal: controller.signal,
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as { profile?: AutofillProfile };
        setAutofillProfile(data.profile ?? null);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setAutofillProfile(null);
      }
    };

    fetchAutofillProfile();

    // Pre-warm the resolver cache in the background so when the user clicks
    // "Auto-fill" the first field-answer call hits a warm cache instead of
    // waiting on 4-6 sequential DB round-trips.
    void fetch('/api/applications/field-answer/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobLeadId: jobLeadId ?? undefined,
        applicationUrl: applyUrl ?? undefined,
      }),
      signal: controller.signal,
    }).catch(() => {
      // Non-fatal — the resolver still works without warm cache, just
      // slower on the first call.
    });

    return () => controller.abort();
  }, [applyUrl, handleUnauthorized, jobLeadId, open]);

  const activeRawUrl = rawUrl ?? applyUrl;
  const returnUrl = useMemo(() => {
    const search = searchParams?.toString();
    return `${pathname}${search ? `?${search}` : ''}`;
  }, [pathname, searchParams]);
  const displayUrl = useMemo(() => {
    if (!activeRawUrl) return 'about:blank';
    try {
      return new URL(activeRawUrl).hostname;
    } catch {
      return activeRawUrl;
    }
  }, [activeRawUrl]);

  const getAssociatedLabelText = (element: HTMLElement): string => {
    if ('labels' in element && element.labels && element.labels.length > 0) {
      return Array.from(element.labels)
        .map(label => label.textContent?.trim() ?? '')
        .join(' ');
    }

    const parentLabel = element.closest('label')?.textContent?.trim();
    if (parentLabel) return parentLabel;

    const id = element.getAttribute('id');
    if (id) {
      const explicitLabel = document.querySelector(`label[for="${id}"]`);
      if (explicitLabel instanceof HTMLElement) {
        return explicitLabel.textContent?.trim() ?? '';
      }
    }

    const previousText =
      element.previousElementSibling?.textContent?.trim() ?? '';
    return previousText;
  };

  const getFieldHints = (element: HTMLElement): string => {
    const input = element as HTMLInputElement;
    return [
      input.name,
      input.id,
      input.placeholder,
      input.autocomplete || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('title') || '',
      element.getAttribute('data-testid') || '',
      getAssociatedLabelText(element),
    ]
      .join(' ')
      .toLowerCase();
  };

  const getApplicationFieldPattern = (element: HTMLElement) => {
    const hints = getFieldHints(element);
    return (
      APPLICATION_FIELD_PATTERNS.find(pattern => pattern.regex.test(hints)) ??
      null
    );
  };

  const isLikelyAutocompleteField = (element: HTMLElement): boolean => {
    if (!(element instanceof HTMLInputElement)) return false;
    const hasWidget =
      element.getAttribute('role') === 'combobox' ||
      element.getAttribute('aria-autocomplete') === 'list' ||
      element.getAttribute('aria-autocomplete') === 'both' ||
      element.getAttribute('aria-haspopup') === 'listbox' ||
      element.getAttribute('aria-haspopup') === 'true' ||
      /start\s*typing|type\s+to\s+(search|find)|begin\s*typing/i.test(
        element.placeholder || '',
      );
    if (hasWidget) return true;
    const pattern = getApplicationFieldPattern(element);
    return !!pattern && ['location', 'city'].includes(pattern.label);
  };

  const isLikelyNameField = (element: HTMLElement): boolean => {
    const fieldHints = getFieldHints(element);
    return nameHintsRegex.test(fieldHints);
  };

  const isLikelyFirstNameField = (element: HTMLElement): boolean => {
    const fieldHints = getFieldHints(element);
    return firstNameHintsRegex.test(fieldHints);
  };

  const isLikelyLastNameField = (element: HTMLElement): boolean => {
    const fieldHints = getFieldHints(element);
    return lastNameHintsRegex.test(fieldHints);
  };

  const isElementVisible = (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.pointerEvents === 'none' ||
      Number.parseFloat(style.opacity || '1') === 0 ||
      style.clipPath === 'inset(100%)' ||
      (style.position === 'absolute' &&
        style.overflow === 'hidden' &&
        element.offsetWidth <= 1 &&
        element.offsetHeight <= 1)
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const isElementDisabled = (element: HTMLElement): boolean => {
    if (element.getAttribute('aria-disabled') === 'true') return true;
    if ('disabled' in element) {
      return Boolean(
        (element as HTMLInputElement | HTMLButtonElement).disabled,
      );
    }
    return false;
  };

  const isTextInput = (
    element: HTMLElement,
  ): element is HTMLInputElement | HTMLTextAreaElement => {
    if (element instanceof HTMLTextAreaElement) return true;
    if (!(element instanceof HTMLInputElement)) return false;
    const type = (element.type || 'text').toLowerCase();
    return ![
      'button',
      'checkbox',
      'file',
      'hidden',
      'image',
      'radio',
      'reset',
      'submit',
    ].includes(type);
  };

  const isSelectableField = (
    element: HTMLElement,
  ): element is HTMLSelectElement => {
    return element instanceof HTMLSelectElement;
  };

  const isFieldElement = (
    element: HTMLElement,
  ): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
    if (isTextInput(element) || isSelectableField(element)) {
      return true;
    }

    if (!(element instanceof HTMLInputElement)) {
      return false;
    }

    const type = (element.type || 'text').toLowerCase();
    return ['checkbox', 'file', 'radio'].includes(type);
  };

  const isFieldRequired = (
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ): boolean => {
    return (
      element.required ||
      element.getAttribute('aria-required') === 'true' ||
      element.hasAttribute('required')
    );
  };

  const isFieldEmpty = (
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ): boolean => {
    if (element instanceof HTMLSelectElement) {
      return !element.value || element.value.trim() === '';
    }

    if (element instanceof HTMLInputElement) {
      const type = (element.type || 'text').toLowerCase();
      if (type === 'file') {
        return !element.files || element.files.length === 0;
      }
      if (type === 'checkbox' || type === 'radio') {
        return !element.checked;
      }
    }

    return !element.value || element.value.trim() === '';
  };

  const getVisibleRequiredEmptyFields = (scope: ParentNode) => {
    return Array.from(scope.querySelectorAll('input, textarea, select'))
      .filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      .filter(
        (
          element,
        ): element is
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement => isFieldElement(element),
      )
      .filter(
        element => isElementVisible(element) && !isElementDisabled(element),
      )
      .filter(element => isFieldRequired(element) && isFieldEmpty(element));
  };

  const getVisibleApplicationFields = (scope: ParentNode) => {
    return Array.from(scope.querySelectorAll('input, textarea, select'))
      .filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      )
      .filter(
        (
          element,
        ): element is
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement => isFieldElement(element),
      )
      .filter(
        element => isElementVisible(element) && !isElementDisabled(element),
      )
      .map(element => ({
        element,
        pattern: getApplicationFieldPattern(element),
      }))
      .filter(
        (
          entry,
        ): entry is {
          element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          pattern: ApplicationFieldPattern;
        } => Boolean(entry.pattern),
      );
  };

  const getVisibleEmptyApplicationFields = (scope: ParentNode) => {
    return getVisibleApplicationFields(scope).filter(entry =>
      isFieldEmpty(entry.element),
    );
  };

  const getFieldLabel = (
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ): string => {
    const matchedPattern = getApplicationFieldPattern(element);
    if (matchedPattern) {
      return matchedPattern.label;
    }

    if ('labels' in element && element.labels && element.labels.length > 0) {
      const text = Array.from(element.labels)
        .map(label => label.textContent?.trim() ?? '')
        .find(Boolean);
      if (text) return text;
    }

    const explicitLabel =
      element.getAttribute('aria-label') ||
      element.getAttribute('placeholder') ||
      element.getAttribute('name') ||
      element.id;

    if (explicitLabel) {
      return explicitLabel.trim();
    }

    const parentLabel = element.closest('label')?.textContent?.trim();
    if (parentLabel) return parentLabel;

    return 'required field';
  };

  const getFormScope = (
    element: HTMLElement,
    root: HTMLElement,
  ): ParentNode => {
    const directForm = element.closest('form');
    if (directForm) {
      return directForm;
    }

    const ancestors: HTMLElement[] = [];
    let currentAncestor = element.parentElement;
    while (currentAncestor && currentAncestor !== root) {
      ancestors.push(currentAncestor);
      currentAncestor = currentAncestor.parentElement;
    }

    const candidateContainers = [
      element.closest('fieldset'),
      element.closest('[role="form"]'),
      ...ancestors,
    ].filter((candidate): candidate is HTMLElement => Boolean(candidate));

    const rankedContainer = candidateContainers
      .map(candidate => {
        const requiredEmptyFields = getVisibleRequiredEmptyFields(candidate);
        const applicationFields = getVisibleApplicationFields(candidate);
        const score =
          requiredEmptyFields.length * 40 +
          applicationFields.reduce(
            (total, field) => total + field.pattern.score,
            0,
          ) +
          applicationFields.length * 10;

        return { candidate, score };
      })
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score)[0];

    return rankedContainer?.candidate ?? root;
  };

  const fillInputValue = (
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ): boolean => {
    if (!value) return false;
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  const fillAutocompleteField = async (
    element: HTMLInputElement,
    value: string,
  ): Promise<boolean> => {
    if (!value) return false;

    element.focus();
    element.value = '';
    element.dispatchEvent(new Event('focus', { bubbles: true }));

    // Type characters one at a time to trigger autocomplete listeners
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      element.value = value.slice(0, i + 1);
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: char,
          bubbles: true,
          cancelable: true,
        }),
      );
      element.dispatchEvent(
        new KeyboardEvent('keypress', {
          key: char,
          bubbles: true,
          cancelable: true,
        }),
      );
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: char,
          bubbles: true,
          cancelable: true,
        }),
      );
      await new Promise(resolve =>
        setTimeout(resolve, 30 + Math.random() * 30),
      );
    }

    // Wait for autocomplete dropdown to appear
    const root = shadowRootRef.current?.querySelector('.assist-root');
    if (!root) return true;

    const findDropdownOption = (): HTMLElement | null => {
      // Check aria-controls / aria-owns for associated listbox
      const listboxId =
        element.getAttribute('aria-controls') ||
        element.getAttribute('aria-owns') ||
        element.getAttribute('list');
      let container: Element | null = null;
      if (listboxId) {
        container = root.querySelector(`#${CSS.escape(listboxId)}`);
      }
      if (!container) {
        // Search near the input's parent first, then fall back to root
        const searchScopes = [
          element.closest('form') || element.parentElement?.parentElement,
          root,
        ].filter(Boolean) as Element[];
        const dropdownSelector =
          '[role="listbox"], [role="menu"], [class*="autocomplete-"], ' +
          '[class*="suggestion-list"], [class*="suggestions-"], [class*="dropdown-menu"], ' +
          '[class*="pac-container"], [class*="location-dropdown"]';
        for (const scope of searchScopes) {
          container = scope.querySelector(dropdownSelector);
          if (container) break;
        }
      }
      if (!container) return null;

      const options = Array.from(
        container.querySelectorAll(
          '[role="option"], li, [class*="option"], [class*="item"], [class*="pac-item"]',
        ),
      ).filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el.offsetParent !== null,
      );
      if (options.length === 0) return null;

      const normalized = value.toLowerCase();
      return (
        options.find(opt =>
          opt.textContent?.toLowerCase().includes(normalized),
        ) || options[0]
      );
    };

    let attempts = 0;
    while (attempts < 8) {
      await new Promise(resolve => setTimeout(resolve, 100));
      // Bail if element was removed from DOM during polling
      if (!element.isConnected) return false;
      const option = findDropdownOption();
      if (option) {
        option.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
        );
        option.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
        );
        option.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
        await new Promise(resolve => setTimeout(resolve, 50));
        if (element.value.trim().length > 0) return true;
      }
      attempts++;
    }

    // No dropdown appeared — keep the typed value
    if (!element.isConnected) return false;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  };

  const isAshbyApplicationUrl = (url: string | null): boolean => {
    if (!url) return false;
    try {
      return new URL(url).hostname.includes('ashbyhq.com');
    } catch {
      return false;
    }
  };

  const uploadDefaultResume = useCallback(
    async (input: HTMLInputElement): Promise<boolean> => {
      if (!autofillProfile?.hasDefaultResume) return false;

      if (isAshbyApplicationUrl(activeRawUrl)) {
        const ashbyResponse = await fetch(
          '/api/assist-mode/upload-default-resume',
          {
            body: JSON.stringify({ url: activeRawUrl }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          },
        );
        if (ashbyResponse.status === 401) {
          handleUnauthorized(
            'Your session expired before we could upload your default resume.',
          );
          return false;
        }
        return ashbyResponse.ok;
      }

      const response = await fetch('/api/assist-mode/default-resume');
      if (response.status === 401) {
        handleUnauthorized(
          'Your session expired before we could upload your default resume.',
        );
        return false;
      }
      if (!response.ok) {
        return false;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const matchedName = disposition.match(/filename="?(.*?)"?$/i)?.[1];
      const fileName =
        matchedName || autofillProfile.resumeFileName || 'resume.pdf';
      const file = new File([blob], fileName, {
        type: blob.type || 'application/pdf',
      });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.files?.length === 1;
    },
    [activeRawUrl, autofillProfile, handleUnauthorized],
  );

  const getSuggestedFieldValue = (element: HTMLElement): string | null => {
    const matchedPattern = getApplicationFieldPattern(element);
    if (!matchedPattern) return null;
    const labelText = getAssociatedLabelText(element).toLowerCase();

    switch (matchedPattern.label) {
      case 'first name':
        return autofillProfile?.firstName || userNameParts?.firstName || null;
      case 'last name':
        return autofillProfile?.lastName || userNameParts?.lastName || null;
      case 'full name':
        return autofillProfile?.fullName || userNameParts?.fullName || null;
      case 'email':
        return autofillProfile?.email || null;
      case 'phone':
        return autofillProfile?.phone || null;
      case 'linkedin':
        return autofillProfile?.linkedinUrl || null;
      case 'portfolio':
        return (
          autofillProfile?.websiteUrl || autofillProfile?.githubUrl || null
        );
      case 'github':
        return autofillProfile?.githubUrl || null;
      case 'city':
        return autofillProfile?.city || null;
      case 'state':
        return autofillProfile?.state || null;
      case 'location':
        return autofillProfile
          ? [autofillProfile.city, autofillProfile.state]
              .filter(Boolean)
              .join(', ') || null
          : null;
      case 'work authorization':
        return autofillProfile?.workAuthorization || null;
      case 'sponsorship':
        return autofillProfile?.requiresSponsorship == null
          ? null
          : autofillProfile.requiresSponsorship
            ? 'Yes'
            : 'No';
      case 'years of experience':
        return autofillProfile?.yearsOfExperience || null;
      case 'salary expectation':
        return autofillProfile?.salaryExpectation || null;
      case 'start date':
        return autofillProfile?.earliestStartDate || null;
      case 'street address':
        return autofillProfile?.streetAddress || null;
      case 'zip code':
        return autofillProfile?.zipCode || null;
      case 'gender':
        return autofillProfile?.gender || null;
      case 'hispanic latino':
        return autofillProfile?.hispanicLatino || null;
      case 'veteran status':
        return autofillProfile?.veteranStatus || null;
      case 'disability':
        return autofillProfile?.disabilityStatus || null;
      case 'race':
        return autofillProfile?.race || null;
      case 'current company':
        return autofillProfile?.currentCompany || null;
      case 'current title':
        return autofillProfile?.currentTitle || null;
      case 'highest degree':
        return autofillProfile?.highestDegree || null;
      case 'university':
        return autofillProfile?.university || null;
      case 'graduation year':
        return autofillProfile?.graduationYear || null;
      case 'languages':
        return autofillProfile?.languages || null;
      default:
        return null;
    }
  };

  const PATTERN_TO_PROFILE_FIELD: Record<string, keyof AutofillProfile> = {
    city: 'city',
    'current company': 'currentCompany',
    'current title': 'currentTitle',
    disability: 'disabilityStatus',
    email: 'email',
    'first name': 'firstName',
    'full name': 'fullName',
    gender: 'gender',
    github: 'githubUrl',
    'hispanic latino': 'hispanicLatino',
    'graduation year': 'graduationYear',
    'highest degree': 'highestDegree',
    languages: 'languages',
    'last name': 'lastName',
    linkedin: 'linkedinUrl',
    phone: 'phone',
    portfolio: 'websiteUrl',
    race: 'race',
    'salary expectation': 'salaryExpectation',
    sponsorship: 'requiresSponsorship',
    'start date': 'earliestStartDate',
    state: 'state',
    'street address': 'streetAddress',
    university: 'university',
    'veteran status': 'veteranStatus',
    'work authorization': 'workAuthorization',
    'years of experience': 'yearsOfExperience',
    'zip code': 'zipCode',
  };

  const saveFieldValueToProfile = (element: HTMLElement) => {
    const matchedPattern = getApplicationFieldPattern(element);
    if (!matchedPattern || !autofillProfile) return;

    const profileKey = PATTERN_TO_PROFILE_FIELD[matchedPattern.label];
    if (!profileKey) return;

    const currentValue = autofillProfile[profileKey];
    if (currentValue) return; // already has a value

    const elementValue =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
        ? element.value.trim()
        : '';
    if (!elementValue) return;

    // Map profile key to API field name (for UserProfile-backed fields)
    const apiFieldMap: Record<string, string> = {
      disabilityStatus: 'disabilityStatus',
      earliestStartDate: 'earliestStartDate',
      email: 'email',
      firstName: 'firstName',
      gender: 'gender',
      githubUrl: 'githubUrl',
      lastName: 'lastName',
      linkedinUrl: 'linkedinUrl',
      phone: 'phone',
      race: 'race',
      salaryExpectation: 'salaryExpectation',
      city: 'city',
      state: 'state',
      streetAddress: 'streetAddress',
      veteranStatus: 'veteranStatus',
      websiteUrl: 'websiteUrl',
      workAuthorization: 'workAuthorization',
      yearsOfExperience: 'yearsOfExperience',
      zipCode: 'zipCode',
    };

    if (profileKey === 'fullName') return;

    // Update local state immediately
    setAutofillProfile(prev =>
      prev ? { ...prev, [profileKey]: elementValue } : prev,
    );

    const apiField = apiFieldMap[profileKey];
    if (apiField) {
      // Persist to UserProfile
      fetch('/api/assist-mode/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ field: apiField, value: elementValue }),
      }).catch(() => {});
    } else {
      // Persist to UserKnowledge for fields not in UserProfile
      fetch('/api/user/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          key: profileKey,
          value: elementValue,
          source: 'form',
        }),
      }).catch(() => {});
    }
  };

  const fillSuggestedField = async (element: HTMLElement): Promise<boolean> => {
    const suggestedValue = getSuggestedFieldValue(element);
    if (!suggestedValue) return false;

    // Handle autocomplete/combobox fields with character-by-character typing
    if (
      isTextInput(element) &&
      element instanceof HTMLInputElement &&
      isLikelyAutocompleteField(element)
    ) {
      return fillAutocompleteField(element, suggestedValue);
    }

    if (isTextInput(element)) {
      return fillInputValue(element, suggestedValue);
    }

    if (element instanceof HTMLSelectElement) {
      const normalizedValue = suggestedValue.trim().toLowerCase();
      const normalizedBooleanValue = inferBooleanSelectValue(suggestedValue);
      const matchingOption = Array.from(element.options).find(option => {
        const optionText = option.textContent?.trim().toLowerCase() ?? '';
        const optionValue = option.value.trim().toLowerCase();
        const optionBooleanValue = inferBooleanSelectValue(
          `${option.value} ${option.textContent ?? ''}`,
        );

        return (
          (optionText.length > 0 && optionText === normalizedValue) ||
          (optionValue.length > 0 && optionValue === normalizedValue) ||
          (optionText.length > 0 && optionText.includes(normalizedValue)) ||
          (optionText.length > 0 && normalizedValue.includes(optionText)) ||
          (normalizedBooleanValue !== null &&
            optionBooleanValue === normalizedBooleanValue)
        );
      });

      if (!matchingOption) return false;

      element.value = matchingOption.value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  };

  function inferBooleanSelectValue(value: string): 'yes' | 'no' | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (
      /^(no|n|false|0)$/.test(normalized) ||
      /\bnot authorized\b/.test(normalized) ||
      /\bnot\b/.test(normalized) ||
      /\bdo not\b/.test(normalized) ||
      /\bdon't\b/.test(normalized)
    ) {
      return 'no';
    }
    if (
      /^(yes|y|true|1)$/.test(normalized) ||
      /\bauthorized\b/.test(normalized) ||
      /\bi am\b/.test(normalized)
    ) {
      return 'yes';
    }
    return null;
  }

  // Send all unmatched empty fields to /api/applications/field-answer
  // in one batched call. The endpoint runs each through the shared
  // resolver (rule → deterministic → LLM) and returns the answer per
  // field. We then apply those answers using the same fill primitives
  // as the local pattern switch.
  const fillEmptyFieldsViaResolver = async (
    fields: readonly HTMLElement[],
  ): Promise<boolean> => {
    if (fields.length === 0) return false;
    const requests: Array<{
      readonly element: HTMLElement;
      readonly question: string;
      readonly fieldType: 'text' | 'textarea' | 'select' | 'unknown';
      readonly options: readonly string[];
    }> = [];
    for (const field of fields) {
      const label = getAssociatedLabelText(field).trim();
      if (label.length < 4) continue;
      const fieldType = inferResolverFieldType(field);
      const options = collectFieldOptions(field);
      requests.push({ element: field, question: label, fieldType, options });
    }
    if (requests.length === 0) return false;

    const response = await fetch('/api/applications/field-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: requests.map(req => ({
          question: req.question,
          fieldType: req.fieldType,
          options: req.options,
          applicationUrl: activeRawUrl ?? undefined,
          jobLeadId: jobLeadId ?? undefined,
        })),
      }),
    });
    if (!response.ok) return false;
    const payload = (await response.json().catch(() => ({}))) as {
      answers?: ReadonlyArray<{
        ok?: boolean;
        answer?: string;
        confidence?: 'high' | 'medium' | 'low';
        error?: string;
      }>;
    };
    if (!Array.isArray(payload.answers)) return false;

    let filledAny = false;
    for (let i = 0; i < requests.length; i += 1) {
      const request = requests[i];
      const answer = payload.answers[i];
      if (!request || !answer || !answer.ok) continue;
      const value = (answer.answer ?? '').trim();
      if (!value) continue;
      // Strict-option fields shouldn't accept low-confidence answers —
      // typing free-form prose into a dropdown breaks the form.
      if (
        (request.fieldType === 'select' || request.options.length > 0) &&
        answer.confidence === 'low'
      ) {
        continue;
      }
      const ok = await applyResolverAnswerToField(request.element, value);
      if (ok) filledAny = true;
    }
    return filledAny;
  };

  const inferResolverFieldType = (
    element: HTMLElement,
  ): 'text' | 'textarea' | 'select' | 'unknown' => {
    if (element instanceof HTMLSelectElement) return 'select';
    if (element instanceof HTMLTextAreaElement) return 'textarea';
    if (element instanceof HTMLInputElement) {
      const type = (element.type || 'text').toLowerCase();
      if (
        type === 'text' ||
        type === 'email' ||
        type === 'tel' ||
        type === 'url' ||
        type === 'number'
      ) {
        return 'text';
      }
    }
    return 'unknown';
  };

  const collectFieldOptions = (element: HTMLElement): readonly string[] => {
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.options)
        .map(option => option.textContent?.trim() ?? '')
        .filter(text => text.length > 0 && !/^select/i.test(text));
    }
    return [];
  };

  const applyResolverAnswerToField = async (
    element: HTMLElement,
    value: string,
  ): Promise<boolean> => {
    if (element instanceof HTMLSelectElement) {
      const normalized = value.trim().toLowerCase();
      const match = Array.from(element.options).find(option => {
        const text = option.textContent?.trim().toLowerCase() ?? '';
        const optionValue = option.value.trim().toLowerCase();
        return (
          text === normalized ||
          optionValue === normalized ||
          (text.length > 0 && text.includes(normalized)) ||
          (text.length > 0 && normalized.includes(text))
        );
      });
      if (!match) return false;
      element.value = match.value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (isTextInput(element)) {
      return fillInputValue(element, value);
    }
    return false;
  };

  const fillKnownFields = async (
    root: HTMLElement,
    target: HTMLElement,
  ): Promise<boolean> => {
    const scope = getFormScope(target, root);
    const fields = Array.from(
      scope.querySelectorAll('input, textarea, select'),
    ).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );

    let filledAny = false;
    const stillEmpty: HTMLElement[] = [];
    for (const field of fields) {
      if (!isElementVisible(field) || isElementDisabled(field)) continue;
      if (isFieldElement(field) && !isFieldEmpty(field)) continue;
      const filled = await fillSuggestedField(field);
      if (filled) {
        filledAny = true;
      } else {
        stillEmpty.push(field);
      }
    }

    // Fall through to the shared LLM/rule resolver for any field whose
    // label didn't match the local pattern switch. Mirrors the desktop's
    // resolveRemainingFieldsWithLlm path so a question taught on the
    // desktop (or learned via formFieldFeedback) auto-fills here too.
    if (stillEmpty.length > 0) {
      try {
        const resolverFilled = await fillEmptyFieldsViaResolver(stillEmpty);
        if (resolverFilled) filledAny = true;
      } catch (error) {
        console.warn('[assist-mode] resolver fallback failed:', error);
      }
    }

    return filledAny;
  };

  const hasKnownFieldsToFill = (
    root: HTMLElement,
    target: HTMLElement,
  ): boolean => {
    const scope = getFormScope(target, root);
    const fields = Array.from(
      scope.querySelectorAll('input, textarea, select'),
    ).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );

    return fields.some(field => {
      if (!isElementVisible(field) || isElementDisabled(field)) return false;
      if (isFieldElement(field) && !isFieldEmpty(field)) return false;
      return Boolean(getSuggestedFieldValue(field));
    });
  };

  const fillNameFields = (root: HTMLElement, target: HTMLElement): boolean => {
    if (!userNameParts) return false;

    const scope = getFormScope(target, root);
    const fields = Array.from(scope.querySelectorAll('input, textarea')).filter(
      (element): element is HTMLInputElement | HTMLTextAreaElement => {
        return element instanceof HTMLElement && isTextInput(element);
      },
    );

    let filledAny = false;
    fields.forEach(field => {
      if (isElementDisabled(field) || !isElementVisible(field)) return;
      if (!field.value || field.value.trim() === '') {
        if (isLikelyFirstNameField(field)) {
          filledAny =
            fillInputValue(field, userNameParts.firstName) || filledAny;
          return;
        }
        if (isLikelyLastNameField(field)) {
          const fallbackLast =
            userNameParts.lastName || userNameParts.firstName;
          filledAny = fillInputValue(field, fallbackLast) || filledAny;
          return;
        }
        if (isLikelyNameField(field)) {
          filledAny =
            fillInputValue(field, userNameParts.fullName) || filledAny;
        }
      }
    });

    if (filledAny) return true;
    if (isTextInput(target) && isLikelyNameField(target)) {
      return fillInputValue(target, userNameParts.fullName);
    }
    return false;
  };

  const activateElement = (element: HTMLElement) => {
    element.focus();
    if (element instanceof HTMLInputElement) {
      const type = (element.type || '').toLowerCase();
      if (['submit', 'button', 'checkbox', 'radio'].includes(type)) {
        element.click();
        return;
      }
    }
    if (element instanceof HTMLAnchorElement) {
      const href = element.href;
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        navigateRawRef.current(href);
      }
      return;
    }
    // For buttons/divs: .click() won't work in shadow DOM since JS handlers
    // are stripped. Look for a wrapping <a> or a nearby link as fallback.
    if (
      element instanceof HTMLButtonElement ||
      element.getAttribute('role') === 'button'
    ) {
      // Check if the button is inside an anchor
      const parentAnchor = element.closest('a');
      if (parentAnchor instanceof HTMLAnchorElement) {
        const href = parentAnchor.href;
        if (href && href !== '#' && !href.startsWith('javascript:')) {
          navigateRawRef.current(href);
          return;
        }
      }
      // Check for a form action
      const form = element.closest('form');
      if (form instanceof HTMLFormElement && form.action) {
        navigateRawRef.current(form.action);
        return;
      }
      // Check for a data-href or onclick URL embedded as data attribute
      const dataHref =
        element.getAttribute('data-href') || element.getAttribute('data-url');
      if (dataHref) {
        navigateRawRef.current(dataHref);
        return;
      }
      element.click();
      return;
    }
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  };

  const navigateRaw = useCallback((url: string) => {
    setRawUrl(url);
    setRawHistory(prev => {
      const entries = prev.entries.slice(0, prev.index + 1);
      entries.push(url);
      return { entries, index: entries.length - 1 };
    });
    // Reset session state when navigating to a different form
    observationSessionIdRef.current = crypto.randomUUID();
    ignoredSelectorsRef.current = new Set();
    setFieldActionTick(0);
    recommendationFetchIdRef.current++;
  }, []);

  navigateRawRef.current = navigateRaw;

  const handleRawBack = () => {
    setRawHistory(prev => {
      if (prev.index <= 0) return prev;
      const index = prev.index - 1;
      setRawUrl(prev.entries[index]);
      return { ...prev, index };
    });
  };

  const handleRawForward = () => {
    setRawHistory(prev => {
      if (prev.index >= prev.entries.length - 1) return prev;
      const index = prev.index + 1;
      setRawUrl(prev.entries[index]);
      return { ...prev, index };
    });
  };

  useEffect(() => {
    if (!open) {
      setHtml('');
      setStyles('');
      setLoadError(null);
      setIsLoading(false);
      setSanitizedHtml('');
      setSanitizedError(null);
      setIsSanitizedLoading(false);
      setSanitizedContext(null);
      setSanitizedHistory({ entries: [], index: -1 });
      setRawUrl(null);
      setRawHistory({ entries: [], index: -1 });
      setFieldActionTick(0);
      observationSessionIdRef.current = crypto.randomUUID();
      setRawLoadCount(0);
      setAuthPromptOpen(false);
      setAuthPromptReason(null);
      autoResumeUploadAttemptRef.current = null;
      atsAiFieldFillAttemptRef.current = null;
      setAtsResumeUploaded(false);
      ignoredSelectorsRef.current = new Set();
      setRecommendation(null);
      setIsRecommendationLoading(false);
      setRecommendationError(null);
      return;
    }
    if (!applyUrl) return;
    // Initialize raw history with the initial URL
    if (!rawUrl) {
      setRawUrl(applyUrl);
      setRawHistory({ entries: [applyUrl], index: 0 });
    }
  }, [applyUrl, open]);

  useEffect(() => {
    if (!session?.user || !authPromptOpen) return;
    setAuthPromptOpen(false);
    setAuthPromptReason(null);
    setRefreshKey(prev => prev + 1);
  }, [authPromptOpen, session?.user]);

  useEffect(() => {
    if (!open || !activeRawUrl) return;
    console.info('[AssistMode] Loading URL:', activeRawUrl);
    const controller = new AbortController();
    const fetchPage = async () => {
      setIsLoading(true);
      setLoadError(null);
      setHtml('');
      setStyles('');
      try {
        const response = await fetch(
          `/api/assist-mode?url=${encodeURIComponent(activeRawUrl)}&render=1`,
          { signal: controller.signal },
        );
        if (response.status === 401) {
          handleUnauthorized();
          setLoadError(
            'Sign in to continue AI Preview without losing your progress.',
          );
          return;
        }
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data?.botProtection) {
            setLoadError('bot_protection');
            return;
          }
          throw new Error(data?.error || 'Failed to load the application');
        }
        const data = (await response.json()) as {
          atsResumeUploaded?: boolean;
          atsResumeAutofillSelector?: string;
          html?: string;
          styles?: string;
        };
        setHtml(data.html ?? '');
        setStyles(data.styles ?? '');
        setAtsResumeUploaded(data.atsResumeUploaded ?? false);
        setAtsResumeAutofillSelector(data.atsResumeAutofillSelector ?? null);
        setRawLoadCount(prev => prev + 1);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setLoadError('Unable to load the application preview.');
        setHtml('');
        setStyles('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPage();
    return () => controller.abort();
  }, [activeRawUrl, handleUnauthorized, open, refreshKey]);

  useEffect(() => {
    if (!open || !applyUrl) return;
    const initial = { url: applyUrl };
    setSanitizedContext(initial);
    setSanitizedHistory({ entries: [initial], index: 0 });
  }, [applyUrl, open]);

  const pushSanitizedContext = (next: {
    url: string;
    method?: string;
    fields?: Record<string, string | string[]>;
  }) => {
    setSanitizedHistory(prev => {
      const entries = prev.entries.slice(0, prev.index + 1);
      entries.push(next);
      return { entries, index: entries.length - 1 };
    });
    setSanitizedContext(next);
  };

  const handleBack = () => {
    setSanitizedHistory(prev => {
      if (prev.index <= 0) return prev;
      const index = prev.index - 1;
      const next = prev.entries[index];
      setSanitizedContext(next);
      return { ...prev, index };
    });
  };

  const handleForward = () => {
    setSanitizedHistory(prev => {
      if (prev.index >= prev.entries.length - 1) return prev;
      const index = prev.index + 1;
      const next = prev.entries[index];
      setSanitizedContext(next);
      return { ...prev, index };
    });
  };

  // Sanitized view disabled — locked to raw view only

  useEffect(() => {
    if (!open || !applyUrl || !html || isLoading) return;
    const controller = new AbortController();
    const fetchId = ++recommendationFetchIdRef.current;

    const fetchRecommendation = async (attempt = 0) => {
      setIsRecommendationLoading(true);
      if (attempt === 0) setRecommendationError(null);
      try {
        const response = await fetch('/api/assist-mode/recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            url: applyUrl,
            html,
            styles,
            stepIndex: fieldActionTick,
          }),
        });
        // Discard stale responses — a newer fetch has been started
        if (fetchId !== recommendationFetchIdRef.current) return;
        if (response.status === 401) {
          handleUnauthorized();
          setRecommendationError(
            'Sign in to restore AI Preview suggestions without leaving this page.',
          );
          return;
        }
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to generate recommendation');
        }
        const data = (await response.json()) as {
          selector?: string;
          reason?: string;
        };
        // Double-check staleness after JSON parsing
        if (fetchId !== recommendationFetchIdRef.current) return;
        const selector = data.selector?.trim() ?? '';
        const reason = data.reason?.trim() ?? '';
        setRecommendationError(null);
        setRecommendation({ selector, reason });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        if (fetchId !== recommendationFetchIdRef.current) return;
        // Retry once on network/server errors
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 1500));
          if (fetchId === recommendationFetchIdRef.current) {
            return fetchRecommendation(attempt + 1);
          }
          return;
        }
        setRecommendationError(
          'AI recommendation unavailable. Using fallback.',
        );
        setRecommendation(null);
      } finally {
        if (fetchId === recommendationFetchIdRef.current) {
          setIsRecommendationLoading(false);
        }
      }
    };

    fetchRecommendation();
    return () => controller.abort();
  }, [handleUnauthorized, recommendationKey]);

  useEffect(() => {
    if (!contentRef.current) return;
    if (!shadowRootRef.current) {
      shadowRootRef.current = contentRef.current.attachShadow({ mode: 'open' });
    }
    const shadowRoot = shadowRootRef.current;
    const isDark = document.documentElement.classList.contains('dark');
    const layoutNormalizationStyles = `
        .assist-root,
        .assist-root * {
          max-inline-size: 100%;
        }
        .assist-root * {
          writing-mode: horizontal-tb !important;
          text-orientation: mixed !important;
          zoom: 1 !important;
        }
        .assist-root [style*="transform"],
        .assist-root [style*="scale("],
        .assist-root [style*="matrix("] {
          transform: none !important;
          transform-origin: center top !important;
        }
        .assist-root [style*="columns"],
        .assist-root [style*="column-count"] {
          columns: auto !important;
          column-count: auto !important;
        }
        .assist-root [style*="position:fixed"],
        .assist-root [style*="position: fixed"],
        .assist-root [style*="position:sticky"],
        .assist-root [style*="position: sticky"],
        .assist-root [class*="fixed"],
        .assist-root [class*="sticky"] {
          position: static !important;
        }
        .assist-root [style*="position:absolute"],
        .assist-root [style*="position: absolute"] {
          position: absolute !important;
          clip-path: inset(0) !important;
        }
        .assist-root [style*="100vw"],
        .assist-root [style*="100vh"] {
          width: 100% !important;
          height: auto !important;
        }
        .assist-root [style*="z-index"] {
          z-index: auto !important;
        }
        a { color: ${isDark ? '#93c5fd' : '#2563eb'}; text-decoration: underline; }
      `;
    const baseStyles = `
      :host {
        display: block;
        height: 100%;
        width: 100%;
        overflow: auto;
        --assist-brand: ${isDark ? '#818cf8' : '#4f46e5'};
        --popover-bg: ${isDark ? '#1e1b4b' : '#ffffff'};
        --popover-border: ${isDark ? 'rgba(129, 140, 248, 0.3)' : 'rgba(79, 70, 229, 0.2)'};
        --popover-text: ${isDark ? '#e0e7ff' : '#1e1b4b'};
        --popover-muted: ${isDark ? '#a5b4fc' : '#6366f1'};
        --popover-btn-bg: ${isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(79, 70, 229, 0.08)'};
        --popover-btn-bg-hover: ${isDark ? 'rgba(129, 140, 248, 0.25)' : 'rgba(79, 70, 229, 0.16)'};
        --popover-btn-border: ${isDark ? 'rgba(129, 140, 248, 0.25)' : 'rgba(79, 70, 229, 0.2)'};
        --popover-btn-text: ${isDark ? '#c7d2fe' : '#4338ca'};
        --popover-primary-bg: ${isDark ? '#6366f1' : '#4f46e5'};
        --popover-primary-text: #ffffff;
        color-scheme: ${isDark ? 'dark' : 'light'};
        background: ${isDark ? '#0f0e1a' : '#f8fafc'};
        color: ${isDark ? '#e2e8f0' : '#0f172a'};
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont;
      }
      * { box-sizing: border-box; }
      .assist-root {
        position: relative;
        min-height: 100%;
        width: 100%;
        max-width: 100%;
        padding: 24px;
        background: ${isDark ? '#0f0e1a' : '#ffffff'};
        color: inherit;
        isolation: isolate;
        overflow-x: hidden;
        overflow-y: visible;
      }
      .assist-root * {
        min-width: 0;
        overflow-wrap: break-word;
        word-wrap: break-word;
      }
      .assist-root {
        min-width: min(720px, 100%);
        font-size: 16px;
        line-height: 1.5;
      }
      .assist-root :where(
        p,
        li,
        ul,
        ol,
        span,
        label,
        a,
        button,
        input,
        textarea,
        select
      ) {
        line-height: 1.4;
      }
      .assist-root :where(section, article, main, div, form, header, footer) {
        max-width: 100%;
      }
      .assist-root :where(section, article, main, div, form, header, footer, ul, ol, dl) > * {
        max-width: 100%;
      }
      .assist-root :where(label) {
        display: block !important;
        position: static !important;
        float: none !important;
        max-width: 100%;
        margin-bottom: 6px;
      }
      .assist-root :where(input, textarea, select) {
        max-width: 100%;
      }
      .assist-root :where(
        input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        textarea,
        select
      ) {
        display: block !important;
        position: static !important;
        width: 100% !important;
        min-height: 40px;
      }
      .assist-root :where(input[type="checkbox"], input[type="radio"]) {
        position: static !important;
        margin-right: 8px;
      }
      ${layoutNormalizationStyles}
      img, video { max-width: 100%; height: auto; }
      [data-assist-action="primary"] {
        position: relative;
        border-radius: 8px;
        overflow: visible !important;
      }
      [data-assist-action="primary"]:is(button, a, [role="button"]) {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
      }
      [data-assist-action="primary"]:is(button, a, [role="button"]):hover {
        border-bottom: none !important;
      }
      .assist-marching-ants-svg {
        position: absolute;
        pointer-events: none;
        z-index: 1;
        overflow: visible;
      }
      .assist-spinner-circle {
        transform-box: fill-box;
        transform-origin: center;
        animation: assist-spin 3s linear infinite;
      }
      @keyframes assist-spin {
        to { transform: rotate(360deg); }
      }
      .assist-action-popover {
        position: absolute;
        z-index: 30;
        width: fit-content;
        min-width: min(350px, calc(100vw - 48px));
        max-width: min(520px, calc(100vw - 48px));
        border-radius: 16px;
        overflow:hidden;
        // border: 4px solid rgba(255,255,255,.15);
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--popover-bg) 85%, white 15%) 0%,
          var(--popover-bg) 50%,
          color-mix(in srgb, var(--popover-bg) 86%, black 14%) 100%
        );
        box-shadow:
          0 4px 10px rgba(0, 0, 0, 0.2),
          0 18px 42px -6px rgba(0, 0, 0, 0.45),
          0 34px 70px -16px rgba(0, 0, 0, 0.55),
          inset 0 1px 0 color-mix(in srgb, white 18%, transparent),
          inset 0 -1px 0 rgba(0, 0, 0, 0.15),
          inset -1px 0 0 rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        animation:
          popoverEnter 200ms cubic-bezier(0.23, 1, 0.32, 1),
          popoverFloatShadow 3200ms ease-in-out 220ms infinite;
      }
      .assist-action-popover .assist-popover-content {
        position: relative;
        z-index: 1;
        padding: 16px;
      }
      @keyframes popoverEnter {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes popoverFloatShadow {
        0%, 100% {
          box-shadow:
            0 4px 10px rgba(0, 0, 0, 0.2),
            0 18px 42px -6px rgba(0, 0, 0, 0.45),
            0 34px 70px -16px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 color-mix(in srgb, white 18%, transparent),
            inset 0 -1px 0 rgba(0, 0, 0, 0.15),
            inset -1px 0 0 rgba(0, 0, 0, 0.1);
        }
        50% {
          box-shadow:
            0 6px 14px rgba(0, 0, 0, 0.24),
            0 24px 54px -8px rgba(0, 0, 0, 0.5),
            0 40px 82px -20px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 color-mix(in srgb, white 24%, transparent),
            inset 0 -1px 0 rgba(0, 0, 0, 0.15),
            inset -1px 0 0 rgba(0, 0, 0, 0.1);
        }
      }
      .assist-action-popover .assist-popover-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        background: color-mix(in srgb, var(--assist-brand) 15%, transparent);
        color: var(--popover-btn-text);
        flex-shrink: 0;
      }
      .assist-action-popover .assist-icon-svg {
        width: 13px;
        height: 13px;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .assist-action-popover .assist-popover-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
      }
      .assist-action-popover .assist-popover-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--popover-btn-text);
      }
      .assist-action-popover .assist-popover-type {
        margin-left: auto;
        font-size: 10px;
        letter-spacing: 0.04em;
        color: color-mix(in srgb, var(--popover-muted) 88%, white 12%);
      }
      .assist-action-popover .assist-popover-reason {
        margin: 12px 0 6px;
        font-size: 14px;
        line-height: 1.5;
        font-weight: 520;
        color: color-mix(in srgb, var(--popover-text) 96%, white 4%);
      }
      .assist-action-buttons {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 18px;
        flex-wrap: nowrap;
      }
      .assist-action-buttons button {
        border: 1px solid var(--popover-btn-border);
        background: var(--popover-btn-bg);
        color: var(--popover-btn-text);
        border-radius: 10px;
        padding: 9px 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        text-align: left;
        transition: background 120ms ease, border-color 120ms ease, transform 80ms ease, box-shadow 120ms ease;
        line-height: 1.3;
        white-space: nowrap;
        flex: 0 0 auto;
      }
      .assist-action-buttons button:hover {
        background: var(--popover-btn-bg-hover);
        border-color: color-mix(in srgb, var(--assist-brand) 40%, transparent);
        box-shadow: 0 6px 16px -8px color-mix(in srgb, var(--assist-brand) 40%, black 60%);
      }
      .assist-action-buttons button:active {
        transform: scale(0.97);
      }
      .assist-action-buttons .assist-action-button-primary {
        background: linear-gradient(to bottom right, hsl(238.7 83.5% 71%), hsl(238.7 83.5% 35%));
        color: var(--popover-primary-text);
        border-top: 1px solid rgba(255,255,255,0.4);
        border-bottom: 1px solid hsl(238.7 83.5% 28%);
        border-left: none;
        border-right: none;
        font-size: 14px;
        font-weight: 700;
        padding: 10px 16px;
        min-width: 62%;
        justify-content: flex-start;
      }
      .assist-action-buttons .assist-action-button-primary:hover {
        background: linear-gradient(to bottom right, hsl(238.7 83.5% 74%), hsl(238.7 83.5% 38%));
        border-top: 1px solid rgba(255,255,255,0.35);
        border-bottom: 1px solid hsl(238.7 83.5% 25%);
        border-left: none;
        border-right: none;
      }
      .assist-action-buttons .assist-action-button-skip {
        padding: 6px 10px;
        font-size: 11px;
        border-radius: 9px;
        opacity: 0.9;
        border-bottom: 1px solid color-mix(in srgb, var(--popover-btn-border) 100%, black 60%);
        border-left: none;
        border-right: none;
      }
      .assist-action-buttons .assist-action-button-icon {
        width: 12px;
        height: 12px;
        display: inline-block;
        vertical-align: middle;
        line-height: 1;
        flex-shrink: 0;
        margin-right: 4px;
        position: relative;
        top: -0.5px;
      }
      .assist-action-buttons .assist-action-button-primary .assist-action-button-icon {
        width: 17px;
        height: 17px;
        margin-right: 4px;
        vertical-align: middle;
        top: -0.5px;
      }
      .assist-action-buttons .assist-action-button-skip .assist-action-button-icon {
        margin-right: 0;
        margin-left: 4px;
        width: 10px;
        height: 10px;
        top: 0px;
        vertical-align: middle;
        align-self: center;
        fill: currentColor;
        stroke: none;
      }
    `;

    const contentHtml = html;
    const contentStyles = styles;

    // Sanitize CSS to prevent layout-breaking properties.
    // External stylesheets set position:fixed/sticky via class rules (not inline
    // styles), so attribute selectors alone can't catch them.
    const rewriteGlobalSelectors = (css: string) =>
      css
        .replace(/:root\b/g, ':host')
        .replace(/html\s+body\b/g, '.assist-root')
        .replace(/(^|[,{]\s*)html\b(?=[\s.:#[,{>+~]|$)/gm, '$1.assist-root')
        .replace(/(^|[,{]\s*)body\b(?=[\s.:#[,{>+~]|$)/gm, '$1.assist-root');

    const sanitizeCSS = (css: string) =>
      rewriteGlobalSelectors(css)
        .replace(
          /position\s*:\s*fixed/gi,
          'position: static; visibility: hidden; height: 0; overflow: hidden',
        )
        .replace(/position\s*:\s*sticky/gi, 'position: relative')
        .replace(/zoom\s*:\s*[^;}{]+/gi, 'zoom: 1')
        .replace(/writing-mode\s*:\s*[^;}{]+/gi, 'writing-mode: horizontal-tb')
        .replace(/text-orientation\s*:\s*[^;}{]+/gi, 'text-orientation: mixed')
        .replace(/transform\s*:\s*[^;}{]+/gi, 'transform: none')
        .replace(
          /transform-origin\s*:\s*[^;}{]+/gi,
          'transform-origin: center top',
        )
        .replace(/column-count\s*:\s*[^;}{]+/gi, 'column-count: auto')
        .replace(/columns\s*:\s*[^;}{]+/gi, 'columns: auto')
        .replace(/\b100vw\b/g, '100%')
        .replace(/\b100vh\b/g, 'auto')
        .replace(/z-index\s*:\s*\d{4,}/g, 'z-index: auto');

    let resolvedStyles = isLoading ? '' : contentStyles;
    if (resolvedStyles) {
      resolvedStyles = sanitizeCSS(resolvedStyles);
    }

    // Also sanitize <style> blocks embedded in the HTML itself
    let resolvedHtml = contentHtml;
    if (resolvedHtml) {
      resolvedHtml = resolvedHtml.replace(
        /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
        (_match, open, css, close) => `${open}${sanitizeCSS(css)}${close}`,
      );
    }

    const safeHtml = resolvedHtml
      ? `<div class="assist-root">${resolvedHtml}</div>`
      : '<div class="assist-root"></div>';

    const darkOverrides = isDark
      ? `
      <style data-dark-override>
        /* Dark mode — override external site styles (injected last to win) */
        .assist-root,
        .assist-root div:not(.assist-action-popover):not(.assist-action-popover *):not([data-assist-action]),
        .assist-root section,
        .assist-root article,
        .assist-root main,
        .assist-root header:not(.assist-action-popover *),
        .assist-root footer,
        .assist-root nav,
        .assist-root aside,
        .assist-root form,
        .assist-root fieldset,
        .assist-root details,
        .assist-root summary,
        .assist-root figure,
        .assist-root figcaption,
        .assist-root blockquote {
          background-color: transparent !important;
          color: #e2e8f0 !important;
          border-color: rgba(148, 163, 184, 0.15) !important;
        }
        [data-assist-action] {
          background-color: transparent !important;
        }
        .assist-root {
          background-color: #0f0e1a !important;
        }
        .assist-root h1, .assist-root h2, .assist-root h3,
        .assist-root h4, .assist-root h5, .assist-root h6 {
          color: #f1f5f9 !important;
        }
        .assist-root p, .assist-root span, .assist-root li,
        .assist-root label, .assist-root legend {
          color: #cbd5e1 !important;
        }
        .assist-root a { color: #93c5fd !important; }
        .assist-root strong, .assist-root b { color: #f1f5f9 !important; }
        .assist-root small { color: #94a3b8 !important; }
        .assist-root input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]),
        .assist-root textarea,
        .assist-root select {
          background-color: rgba(15, 14, 26, 0.8) !important;
          color: #e2e8f0 !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
        }
        .assist-root input::placeholder,
        .assist-root textarea::placeholder {
          color: #64748b !important;
        }
        .assist-root button:not(.assist-action-buttons button):not(.assist-action-popover *) {
          background-color: rgba(30, 27, 75, 0.6) !important;
          color: #c7d2fe !important;
          border-color: rgba(129, 140, 248, 0.2) !important;
        }
        .assist-root hr { border-color: rgba(148, 163, 184, 0.15) !important; }
        .assist-root table, .assist-root th, .assist-root td {
          border-color: rgba(148, 163, 184, 0.12) !important;
        }
        .assist-root th {
          background-color: rgba(15, 14, 26, 0.5) !important;
          color: #f1f5f9 !important;
        }
        .assist-root pre, .assist-root code {
          background-color: rgba(15, 14, 26, 0.6) !important;
          color: #e2e8f0 !important;
        }
        .assist-root img { opacity: 0.9; }
      </style>
    `
      : '';

    if (contentView === 'raw') {
      // Raw: strip external CSS, inline styles, and dark overrides — just readable content
      let rawHtml = resolvedHtml || '';
      // Remove inline style attributes from elements
      rawHtml = rawHtml.replace(/\sstyle="[^"]*"/gi, '');
      // Remove embedded <style> blocks
      rawHtml = rawHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      const rawSafeHtml = rawHtml
        ? `<div class="assist-root">${rawHtml}</div>`
        : '<div class="assist-root"></div>';
      shadowRoot.innerHTML = `<style>${baseStyles}</style>${rawSafeHtml}`;
    } else {
      shadowRoot.innerHTML = `<style>${baseStyles}</style>${resolvedStyles}${safeHtml}${darkOverrides}`;
    }
  }, [html, styles, isLoading, contentView]);

  // Post-process rendered shadow DOM to fix positioning from external CSS.
  // External <link> stylesheets load asynchronously; once applied they may set
  // position:fixed/sticky via class rules that regex sanitization can't catch.
  useEffect(() => {
    if (!shadowRootRef.current || isLoading) return;
    const shadowRoot = shadowRootRef.current;
    const rootElement = shadowRoot.querySelector('.assist-root');
    if (!(rootElement instanceof HTMLElement)) return;

    const fixLayout = () => {
      const allElements = rootElement.querySelectorAll('*');
      allElements.forEach(el => {
        if (!(el instanceof HTMLElement)) return;
        const computed = window.getComputedStyle(el);

        // Hide fixed elements (navbars, banners) - they overlap grid content
        // when converted to static. Sticky elements are safe to keep as relative.
        if (computed.position === 'fixed') {
          el.style.setProperty('position', 'static', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('height', '0', 'important');
          el.style.setProperty('overflow', 'hidden', 'important');
        } else if (computed.position === 'sticky') {
          el.style.setProperty('position', 'relative', 'important');
        }

        if (
          computed.transform !== 'none' ||
          computed.zoom !== '1' ||
          computed.writingMode !== 'horizontal-tb'
        ) {
          el.style.setProperty('transform', 'none', 'important');
          el.style.setProperty('transform-origin', 'center top', 'important');
          el.style.setProperty('zoom', '1', 'important');
          el.style.setProperty('writing-mode', 'horizontal-tb', 'important');
          el.style.setProperty('text-orientation', 'mixed', 'important');
        }

        const normalizedLineHeight = Number.parseFloat(computed.lineHeight);
        const normalizedFontSize = Number.parseFloat(computed.fontSize);
        if (
          Number.isFinite(normalizedLineHeight) &&
          Number.isFinite(normalizedFontSize) &&
          normalizedLineHeight > 0 &&
          normalizedFontSize > 0 &&
          normalizedLineHeight < normalizedFontSize * 1.15
        ) {
          el.style.setProperty('line-height', '1.4', 'important');
        }

        if (computed.columnCount !== 'auto') {
          el.style.setProperty('column-count', 'auto', 'important');
          el.style.setProperty('columns', 'auto', 'important');
        }

        const isFormLabel =
          el instanceof HTMLLabelElement ||
          (el.tagName === 'LABEL' && Boolean(el.getAttribute('for')));
        if (isFormLabel) {
          el.style.setProperty('display', 'block', 'important');
          el.style.setProperty('position', 'static', 'important');
          el.style.setProperty('float', 'none', 'important');
          el.style.setProperty('margin-bottom', '6px', 'important');
        }

        const isTextLikeField =
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement ||
          (el instanceof HTMLInputElement &&
            !['checkbox', 'radio', 'file', 'hidden'].includes(
              (el.type || '').toLowerCase(),
            ));
        if (isTextLikeField) {
          el.style.setProperty('display', 'block', 'important');
          el.style.setProperty('position', 'static', 'important');
          el.style.setProperty('width', '100%', 'important');
          el.style.setProperty('max-width', '100%', 'important');
          el.style.setProperty('min-height', '40px', 'important');
        }

        const children = Array.from(el.children);
        const hasDirectLabelChild = children.some(
          child => child instanceof HTMLLabelElement,
        );
        const hasDirectFieldChild = children.some(child => {
          return (
            child instanceof HTMLInputElement ||
            child instanceof HTMLTextAreaElement ||
            child instanceof HTMLSelectElement
          );
        });
        if (hasDirectLabelChild && hasDirectFieldChild) {
          el.style.setProperty('display', 'block', 'important');
          el.style.setProperty('position', 'static', 'important');
          el.style.setProperty('width', '100%', 'important');
        }

        // Ensure flex/grid children can shrink without clipping text
        const parent = el.parentElement;
        if (parent) {
          const parentDisplay = window.getComputedStyle(parent).display;
          const isFlexOrGrid =
            parentDisplay === 'flex' ||
            parentDisplay === 'inline-flex' ||
            parentDisplay === 'grid' ||
            parentDisplay === 'inline-grid';
          if (isFlexOrGrid) {
            el.style.setProperty('min-width', '0', 'important');
          }
          // Force grid containers to single-column when they're narrow
          // to prevent overlapping cells
          if (parentDisplay === 'grid' || parentDisplay === 'inline-grid') {
            const parentWidth = parent.getBoundingClientRect().width;
            const parentCols =
              window.getComputedStyle(parent).gridTemplateColumns;
            // If grid has multiple columns and is narrow, linearize it
            if (
              parentWidth < 600 &&
              parentCols &&
              parentCols.split(' ').length > 1
            ) {
              parent.style.setProperty('display', 'flex', 'important');
              parent.style.setProperty('flex-direction', 'column', 'important');
            }
          }
        }
      });
    };

    // Run immediately for inline styles, then again after external CSS loads
    fixLayout();
    const timerId = setTimeout(fixLayout, 500);
    const timerId2 = setTimeout(fixLayout, 1500);

    // Also watch for stylesheet loads via MutationObserver
    const observer = new MutationObserver(() => {
      requestAnimationFrame(fixLayout);
    });
    observer.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      clearTimeout(timerId);
      clearTimeout(timerId2);
      observer.disconnect();
    };
  }, [html, isLoading]);

  useEffect(() => {
    if (!shadowRootRef.current) return;
    const shadowRoot = shadowRootRef.current;
    const rootElement = shadowRoot.querySelector('.assist-root');
    if (!(rootElement instanceof HTMLElement)) return;

    if (marchingAntsFrameRef.current !== null) {
      cancelAnimationFrame(marchingAntsFrameRef.current);
      marchingAntsFrameRef.current = null;
    }

    rootElement
      .querySelectorAll('[data-assist-action="primary"]')
      .forEach(element => {
        element.removeAttribute('data-assist-action');
        element.removeAttribute('data-assist-reason');
      });

    rootElement.querySelectorAll('.assist-action-popover').forEach(element => {
      element.remove();
    });
    rootElement
      .querySelectorAll('.assist-marching-ants-svg')
      .forEach(element => {
        element.remove();
      });

    const getElementSummary = (element: HTMLElement): string => {
      const valueText =
        element instanceof HTMLInputElement
          ? element.value || element.getAttribute('value') || ''
          : '';
      const labelText = [
        element.textContent || '',
        valueText,
        getFieldHints(element),
        element.getAttribute('aria-label') || '',
      ]
        .join(' ')
        .toLowerCase();
      return labelText;
    };

    const isResumeAlreadyUploaded = (fileInput: HTMLInputElement): boolean => {
      if (fileInput.files && fileInput.files.length > 0) return true;
      // Check if surrounding context indicates a file is already present
      const container =
        fileInput.closest(
          '[class*="upload"], [class*="resume"], [class*="file"], [role="group"], fieldset',
        ) || fileInput.parentElement?.parentElement;
      if (!container) return false;
      const text = container.textContent?.toLowerCase() || '';
      return (
        /\breplace\b/.test(text) ||
        /\bremove\b/.test(text) ||
        /\bdelete\b/.test(text) ||
        /\bchange\s*file\b/.test(text) ||
        /\.pdf\b/.test(text) ||
        /\.docx?\b/.test(text)
      );
    };

    const findResumeAutofillTarget = () => {
      if (atsResumeUploaded) return null;
      if (!autofillProfile?.hasDefaultResume) return null;

      if (atsResumeAutofillSelector) {
        const autofillLayer = rootElement.querySelector(
          atsResumeAutofillSelector,
        ) as HTMLElement | null;

        if (autofillLayer) {
          const autofillButton = autofillLayer.querySelector(
            'button, [role="button"]',
          ) as HTMLElement | null;
          const autofillInput =
            (autofillLayer.querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null) ||
            (autofillLayer.parentElement?.querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null) ||
            (autofillButton
              ?.closest('label')
              ?.querySelector(
                'input[type="file"]',
              ) as HTMLInputElement | null) ||
            (autofillButton?.parentElement?.querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null);

          if (
            autofillButton &&
            autofillInput instanceof HTMLInputElement &&
            !isResumeAlreadyUploaded(autofillInput)
          ) {
            return {
              actionElement: autofillInput,
              element: autofillButton,
              reason:
                'Upload your default resume first so the application can autofill the form.',
            };
          }
        }
      }

      const resumeAutofillPhrases = [
        'autofill from resume',
        'auto fill from resume',
        'autofill with resume',
        'auto fill with resume',
        'resume autofill',
        'upload your resume here to autofill',
        'upload your resume',
        'upload resume',
        'autofill key application fields',
        'fill application fields from resume',
      ];
      const autofillContainers = Array.from(rootElement.querySelectorAll('*'))
        .filter(
          (element): element is HTMLElement => element instanceof HTMLElement,
        )
        .filter(element => {
          const text = element.textContent?.toLowerCase() || '';
          const hasAutofillPhrase = resumeAutofillPhrases.some(phrase =>
            text.includes(phrase),
          );
          const hasResumeAutofillWords =
            text.includes('resume') &&
            (text.includes('autofill') ||
              text.includes('auto fill') ||
              text.includes('application fields'));
          return hasAutofillPhrase || hasResumeAutofillWords;
        })
        .sort((left, right) => {
          const leftText = left.textContent?.length || 0;
          const rightText = right.textContent?.length || 0;
          return leftText - rightText;
        });

      for (const container of autofillContainers) {
        const scopedInput = container.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement | null;
        const nearbyInput =
          scopedInput ||
          (container.parentElement?.querySelector(
            'input[type="file"]',
          ) as HTMLInputElement | null);

        const uploadButton =
          (container.querySelector(
            'button, [role="button"], [data-testid*="upload"], [class*="upload"], label',
          ) as HTMLElement | null) ||
          (container.parentElement?.querySelector(
            'button, [role="button"], [data-testid*="upload"], [class*="upload"], label',
          ) as HTMLElement | null);

        if (
          nearbyInput instanceof HTMLInputElement &&
          !isResumeAlreadyUploaded(nearbyInput)
        ) {
          return {
            actionElement: nearbyInput,
            element: uploadButton || container,
            reason:
              'Upload your default resume first so the application can autofill the form.',
          };
        }

        if (uploadButton) {
          const linkedInput =
            (uploadButton.parentElement?.querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null) ||
            (uploadButton
              .closest('label')
              ?.querySelector(
                'input[type="file"]',
              ) as HTMLInputElement | null) ||
            (uploadButton.previousElementSibling instanceof HTMLInputElement &&
            uploadButton.previousElementSibling.type === 'file'
              ? uploadButton.previousElementSibling
              : null) ||
            (uploadButton.nextElementSibling instanceof HTMLInputElement &&
            uploadButton.nextElementSibling.type === 'file'
              ? uploadButton.nextElementSibling
              : null) ||
            (container.parentElement?.parentElement?.querySelector(
              'input[type="file"]',
            ) as HTMLInputElement | null);

          if (
            linkedInput instanceof HTMLInputElement &&
            !isResumeAlreadyUploaded(linkedInput)
          ) {
            return {
              actionElement: linkedInput,
              element: uploadButton,
              reason:
                'Upload your default resume first so the application can autofill the form.',
            };
          }
        }
      }

      const resumeInput = Array.from(
        rootElement.querySelectorAll('input[type="file"]'),
      ).find(
        element =>
          element instanceof HTMLInputElement &&
          !isResumeAlreadyUploaded(element) &&
          (getApplicationFieldPattern(element)?.label === 'resume' ||
            element.closest('[class*="autofill"]') !== null),
      );

      if (!(resumeInput instanceof HTMLInputElement)) return null;

      const visualTarget =
        (resumeInput.closest(
          'button, [role="button"], [class*="autofill"], [role="presentation"]',
        ) as HTMLElement | null) ?? resumeInput;

      return {
        actionElement: resumeInput,
        element: visualTarget,
        reason:
          'Upload your default resume first so the application can autofill the form.',
      };
    };

    const getElementFingerprint = (el: HTMLElement): string => {
      const tag = el.tagName.toLowerCase();
      const id = el.id;
      const name = el.getAttribute('name');
      const ariaLabel = el.getAttribute('aria-label');
      const text = el.textContent?.trim().slice(0, 40) ?? '';
      if (id) return `${tag}#${id}`;
      if (name) return `${tag}[name="${name}"]`;
      if (ariaLabel) return `${tag}[aria-label="${ariaLabel}"]`;
      return `${tag}:${text}`;
    };

    const isSkippedActionElement = (element: HTMLElement) =>
      element.getAttribute('data-assist-skipped') === 'true' ||
      ignoredSelectorsRef.current.has(getElementFingerprint(element));

    const isSiteChrome = (el: HTMLElement): boolean => {
      let node: HTMLElement | null = el;
      while (node && node !== rootElement) {
        const tag = node.tagName?.toLowerCase();
        const role = node.getAttribute('role')?.toLowerCase();
        if (
          tag === 'nav' ||
          tag === 'header' ||
          tag === 'footer' ||
          role === 'navigation' ||
          role === 'banner' ||
          role === 'contentinfo'
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const isSearchField = (el: HTMLElement): boolean => {
      if (!(el instanceof HTMLInputElement)) return false;
      const type = (el.type || 'text').toLowerCase();
      if (type === 'search') return true;
      const name = (el.name || '').toLowerCase();
      const placeholder = (el.placeholder || '').toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const searchTerms =
        /\b(search|find\s*jobs?|job\s*title|keyword|company|where|what)\b/i;
      return (
        searchTerms.test(name) ||
        searchTerms.test(placeholder) ||
        searchTerms.test(ariaLabel)
      );
    };

    const getFallbackTarget = () => {
      const resumeAutofillTarget = findResumeAutofillTarget();
      if (resumeAutofillTarget) return resumeAutofillTarget;

      const hasRecommendationSelector = Boolean(
        recommendation?.selector?.trim(),
      );
      const selector = hasRecommendationSelector
        ? [
            'button',
            'a[href]',
            'input',
            'select',
            'textarea',
            '[role="button"]',
          ].join(',')
        : ['input', 'select', 'textarea'].join(',');

      const candidates = Array.from(rootElement.querySelectorAll(selector))
        .filter(
          (element): element is HTMLElement => element instanceof HTMLElement,
        )
        .filter(
          element =>
            isElementVisible(element) &&
            !isElementDisabled(element) &&
            !isSkippedActionElement(element),
        );

      const ranked = candidates
        .map((element, index) => {
          const summary = getElementSummary(element);
          let score = 0;
          let reason = 'Suggested next action.';

          // Skip site chrome and search fields entirely
          if (isSiteChrome(element) || isSearchField(element)) {
            return { actionElement: element, element, index, reason, score: 0 };
          }

          if (
            element instanceof HTMLInputElement &&
            (element.type || '').toLowerCase() === 'file' &&
            getApplicationFieldPattern(element)?.label === 'resume'
          ) {
            if (atsResumeUploaded) {
              score = 0;
            } else {
              score = 220;
              reason = autofillProfile?.hasDefaultResume
                ? 'Upload your default resume first so the application can autofill the form.'
                : 'Upload your resume first so the application can autofill the form.';
            }
          } else if (
            isFieldElement(element) &&
            isFieldRequired(element) &&
            isFieldEmpty(element)
          ) {
            const label = getFieldLabel(element);
            score = 160;
            reason = `Complete ${label} before submitting the application.`;
          } else if (
            userNameParts &&
            isTextInput(element) &&
            isLikelyNameField(element) &&
            isFieldElement(element) &&
            isFieldEmpty(element)
          ) {
            score = 140;
            reason = 'Fill your name to move to the next step.';
          } else if (
            /(apply|continue|next|submit|start|proceed|finish|save)/i.test(
              summary,
            )
          ) {
            const visibleRequiredFields = getVisibleRequiredEmptyFields(
              getFormScope(element, rootElement),
            );
            const emptyApplicationFields = getVisibleEmptyApplicationFields(
              getFormScope(element, rootElement),
            );

            if (visibleRequiredFields.length > 0) {
              const firstField = visibleRequiredFields[0];
              score = 20;
              reason = `Complete ${getFieldLabel(firstField)} before submitting the application.`;
            } else if (emptyApplicationFields.length > 0) {
              const firstField = emptyApplicationFields[0].element;
              score = 30;
              reason = `Fill ${getFieldLabel(firstField)} before continuing the application.`;
            } else {
              score = 180;
              reason = 'Continue the application flow with this action.';
            }
          } else if (isFieldElement(element) && isFieldRequired(element)) {
            score = 95;
            reason = 'Required field to continue the application.';
          } else if (
            element instanceof HTMLButtonElement ||
            element instanceof HTMLAnchorElement ||
            element.getAttribute('role') === 'button'
          ) {
            score = 30;
            reason = 'Interactive element on this screen.';
          } else if (isTextInput(element)) {
            score = 60;
            reason = 'Start with this field to progress.';
          }

          return { actionElement: element, element, index, reason, score };
        })
        .filter(item => item.score > 0)
        .sort((left, right) => {
          const leftIsField = isFieldElement(left.element);
          const rightIsField = isFieldElement(right.element);
          // Among form fields, use DOM order unless score difference is large
          // (e.g. resume upload at 220 vs regular field at 120)
          if (leftIsField && rightIsField) {
            if (Math.abs(left.score - right.score) > 30) {
              return right.score - left.score;
            }
            return left.index - right.index;
          }
          // Otherwise (buttons, links, mixed) sort by score
          if (right.score !== left.score) return right.score - left.score;
          return left.index - right.index;
        });

      if (ranked.length === 0) return null;
      return ranked[0];
    };

    const hasBlockingRequiredNonResumeField = getVisibleRequiredEmptyFields(
      rootElement,
    ).some(element => {
      const isResumeInput =
        element instanceof HTMLInputElement &&
        (element.type || '').toLowerCase() === 'file' &&
        getApplicationFieldPattern(element)?.label === 'resume';
      return !isResumeInput && !isSkippedActionElement(element);
    });

    let target: HTMLElement | null = null;
    let actionTarget: HTMLElement | null = null;
    let reason = recommendation?.reason?.trim() || 'Suggested next action.';
    const resumeAutofillTarget = hasBlockingRequiredNonResumeField
      ? null
      : findResumeAutofillTarget();

    if (resumeAutofillTarget) {
      target = resumeAutofillTarget.element;
      actionTarget = resumeAutofillTarget.actionElement;
      reason = resumeAutofillTarget.reason;
    } else if (recommendation?.selector) {
      try {
        const selected = rootElement.querySelector(recommendation.selector);
        if (
          selected instanceof HTMLElement &&
          isElementVisible(selected) &&
          !isElementDisabled(selected) &&
          !isSkippedActionElement(selected) &&
          !isSiteChrome(selected) &&
          !isSearchField(selected)
        ) {
          // Check for required empty fields above the AI's pick (DOM order)
          const allEmptyFields = Array.from(
            rootElement.querySelectorAll('input, textarea, select'),
          )
            .filter((el): el is HTMLElement => el instanceof HTMLElement)
            .filter(
              el =>
                isFieldElement(el) &&
                isElementVisible(el) &&
                !isElementDisabled(el) &&
                !isSkippedActionElement(el) &&
                !isSiteChrome(el) &&
                !isSearchField(el) &&
                isFieldEmpty(el),
            );

          const selectedPos = allEmptyFields.indexOf(selected as HTMLElement);
          const higherRequiredField =
            selectedPos > 0
              ? allEmptyFields
                  .slice(0, selectedPos)
                  .find(f => isFieldRequired(f))
              : null;

          if (higherRequiredField) {
            target = higherRequiredField;
            actionTarget = higherRequiredField;
            reason = `Complete ${getFieldLabel(higherRequiredField as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)} first.`;
          } else {
            target = selected;
            actionTarget = selected;
          }
        } else {
          // Report rule failure — selector didn't match a visible element
          try {
            const hostname = new URL(activeRawUrl ?? '').hostname;
            fetch('/api/assist-mode/rule-failure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              keepalive: true,
              body: JSON.stringify({
                hostname,
                selector: recommendation.selector,
                stepIndex: fieldActionTick,
              }),
            }).catch(() => {});
          } catch {}
        }
      } catch (selectorError) {
        console.warn(
          '[Assist] Invalid CSS selector from recommendation:',
          recommendation.selector,
          selectorError,
        );
        target = null;
        actionTarget = null;
      }
    }

    if (!target) {
      const fallback = getFallbackTarget();
      if (!fallback) return;
      target = fallback.element;
      actionTarget = fallback.actionElement;
      reason = fallback.reason;
    }

    if (!actionTarget) {
      actionTarget = target;
    }

    const isResumeAutofillAction =
      Boolean(resumeAutofillTarget) &&
      actionTarget instanceof HTMLInputElement &&
      (actionTarget.type || '').toLowerCase() === 'file' &&
      Boolean(autofillProfile?.hasDefaultResume);

    const targetScope = getFormScope(target, rootElement);
    const isUploadedResumeInput = (element: HTMLElement) =>
      atsResumeUploaded &&
      element instanceof HTMLInputElement &&
      (element.type || '').toLowerCase() === 'file' &&
      getApplicationFieldPattern(element)?.label === 'resume';
    const visibleRequiredFields = getVisibleRequiredEmptyFields(
      targetScope,
    ).filter(
      element =>
        !isUploadedResumeInput(element) && !isSkippedActionElement(element),
    );
    const emptyApplicationFields = getVisibleEmptyApplicationFields(
      targetScope,
    ).filter(
      entry =>
        !isUploadedResumeInput(entry.element) &&
        !isSkippedActionElement(entry.element),
    );
    const visibleEmptyTextFields = Array.from(
      rootElement.querySelectorAll('input, textarea'),
    )
      .filter(
        (element): element is HTMLInputElement | HTMLTextAreaElement =>
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement,
      )
      .filter(
        element =>
          isElementVisible(element) &&
          !isElementDisabled(element) &&
          isTextInput(element) &&
          isFieldEmpty(element) &&
          !isSkippedActionElement(element),
      );
    if (
      !isResumeAutofillAction &&
      visibleRequiredFields.length > 0 &&
      !visibleRequiredFields.includes(
        target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
      )
    ) {
      target = visibleRequiredFields[0];
      reason = `Complete ${getFieldLabel(target)} before submitting the application.`;
    } else if (
      !isResumeAutofillAction &&
      emptyApplicationFields.length > 0 &&
      !(isFieldElement(target) && isFieldEmpty(target))
    ) {
      target = emptyApplicationFields[0].element;
      reason = `Fill ${getFieldLabel(target)} before continuing the application.`;
    } else if (
      !isResumeAutofillAction &&
      !isFieldElement(target) &&
      visibleEmptyTextFields.length > 0
    ) {
      target = visibleEmptyTextFields[0];
      reason = `Fill ${getFieldLabel(target)} before continuing the application.`;
    }

    target.setAttribute('data-assist-action', 'primary');
    target.setAttribute('data-assist-reason', reason);

    // SVG marching ants — works in shadow DOM unlike CSS @property
    const gap = 16;
    const radius = 14;
    const strokeWidth = 2;
    const targetRect = target.getBoundingClientRect();
    const rootRect = rootElement.getBoundingClientRect();
    const glowPad = 12; // extra padding so glow filter isn't clipped
    const svgW = targetRect.width + gap * 2 + glowPad * 2;
    const svgH = targetRect.height + gap * 2 + glowPad * 2;
    const svgX =
      targetRect.left - rootRect.left + rootElement.scrollLeft - gap - glowPad;
    const svgY =
      targetRect.top - rootRect.top + rootElement.scrollTop - gap - glowPad;
    const ns = 'http://www.w3.org/2000/svg';
    const antsSvg = document.createElementNS(ns, 'svg');
    antsSvg.setAttribute('class', 'assist-marching-ants-svg');
    antsSvg.setAttribute('width', String(svgW));
    antsSvg.setAttribute('height', String(svgH));
    antsSvg.style.left = `${svgX}px`;
    antsSvg.style.top = `${svgY}px`;
    // Glow filter for individual ant dashes
    const defs = document.createElementNS(ns, 'defs');
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', 'ants-glow');
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    const blur = document.createElementNS(ns, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '3');
    filter.appendChild(blur);
    defs.appendChild(filter);
    // Heavier glow filter for the spinner circle
    const spinFilter = document.createElementNS(ns, 'filter');
    spinFilter.setAttribute('id', 'spinner-glow');
    spinFilter.setAttribute('x', '-100%');
    spinFilter.setAttribute('y', '-100%');
    spinFilter.setAttribute('width', '300%');
    spinFilter.setAttribute('height', '300%');
    const spinBlur = document.createElementNS(ns, 'feGaussianBlur');
    spinBlur.setAttribute('in', 'SourceGraphic');
    spinBlur.setAttribute('stdDeviation', '5');
    spinFilter.appendChild(spinBlur);
    defs.appendChild(spinFilter);
    antsSvg.appendChild(defs);

    // Build a rounded-rect path starting at mid-top to avoid corner seam
    // Path occupies the center of the SVG; glowPad provides bleed room
    const inset = glowPad + strokeWidth / 2;
    const rw = svgW - glowPad * 2 - strokeWidth;
    const rh = svgH - glowPad * 2 - strokeWidth;
    const r = Math.min(radius, rw / 2, rh / 2);
    const midX = inset + rw / 2;
    // Compute total perimeter to set dasharray that divides evenly
    const straightH = rw - 2 * r;
    const straightV = rh - 2 * r;
    const cornerArc = (Math.PI * r) / 2;
    const totalPerimeter = 2 * straightH + 2 * straightV + 4 * cornerArc;
    const dashUnit = 8;
    const gapUnit = 6;
    const dashCycle = dashUnit + gapUnit;
    const numDashes = Math.round(totalPerimeter / dashCycle);
    const adjustedCycle = totalPerimeter / numDashes;
    const adjustedDash = adjustedCycle * (dashUnit / dashCycle);
    const adjustedGap = adjustedCycle - adjustedDash;
    const dashArray = `${adjustedDash.toFixed(2)} ${adjustedGap.toFixed(2)}`;

    const roundedRectPath = [
      `M ${midX} ${inset}`,
      `L ${inset + rw - r} ${inset}`,
      `A ${r} ${r} 0 0 1 ${inset + rw} ${inset + r}`,
      `L ${inset + rw} ${inset + rh - r}`,
      `A ${r} ${r} 0 0 1 ${inset + rw - r} ${inset + rh}`,
      `L ${inset + r} ${inset + rh}`,
      `A ${r} ${r} 0 0 1 ${inset} ${inset + rh - r}`,
      `L ${inset} ${inset + r}`,
      `A ${r} ${r} 0 0 1 ${inset + r} ${inset}`,
      `L ${midX} ${inset}`,
    ].join(' ');

    // Glow layer (blurred copy behind)
    const glowPath = document.createElementNS(ns, 'path');
    glowPath.setAttribute('d', roundedRectPath);
    glowPath.setAttribute('fill', 'none');
    glowPath.setAttribute('stroke', 'hsl(238.7 83.5% 66.9%)');
    glowPath.setAttribute('stroke-width', String(strokeWidth + 2));
    glowPath.setAttribute('stroke-dasharray', dashArray);
    glowPath.setAttribute('opacity', '0.5');
    glowPath.setAttribute('filter', 'url(#ants-glow)');
    antsSvg.appendChild(glowPath);

    // Crisp ant dashes on top
    const antsPath = document.createElementNS(ns, 'path');
    antsPath.setAttribute('d', roundedRectPath);
    antsPath.setAttribute('fill', 'none');
    antsPath.setAttribute('stroke', 'hsl(238.7 83.5% 66.9%)');
    antsPath.setAttribute('stroke-width', String(strokeWidth));
    antsPath.setAttribute('stroke-dasharray', dashArray);
    antsSvg.appendChild(antsPath);

    // Small spinning circle centered on the top-left corner of the target element
    const spinR = 6;
    const spinCx = glowPad + gap;
    const spinCy = glowPad + gap;
    const spinPerimeter = 2 * Math.PI * spinR;
    // Multiple short dashes (3 segments with gaps)
    const spinDash = spinPerimeter / 6; // each dash ~1/6 of circle
    const spinGap = spinPerimeter / 6; // equal gaps
    const spinDashArray = `${spinDash.toFixed(2)} ${spinGap.toFixed(2)}`;

    // Outer glow — wide, soft bloom
    const spinGlow3 = document.createElementNS(ns, 'circle');
    spinGlow3.setAttribute('cx', String(spinCx));
    spinGlow3.setAttribute('cy', String(spinCy));
    spinGlow3.setAttribute('r', String(spinR));
    spinGlow3.setAttribute('fill', 'none');
    spinGlow3.setAttribute('stroke', 'hsl(238.7 83.5% 66.9%)');
    spinGlow3.setAttribute('stroke-width', '8');
    spinGlow3.setAttribute('stroke-dasharray', spinDashArray);
    spinGlow3.setAttribute('stroke-linecap', 'round');
    spinGlow3.setAttribute('opacity', '0.3');
    spinGlow3.setAttribute('filter', 'url(#spinner-glow)');
    spinGlow3.classList.add('assist-spinner-circle');
    antsSvg.appendChild(spinGlow3);

    // Mid glow
    const spinGlow2 = document.createElementNS(ns, 'circle');
    spinGlow2.setAttribute('cx', String(spinCx));
    spinGlow2.setAttribute('cy', String(spinCy));
    spinGlow2.setAttribute('r', String(spinR));
    spinGlow2.setAttribute('fill', 'none');
    spinGlow2.setAttribute('stroke', 'hsl(238.7 83.5% 66.9%)');
    spinGlow2.setAttribute('stroke-width', '4');
    spinGlow2.setAttribute('stroke-dasharray', spinDashArray);
    spinGlow2.setAttribute('stroke-linecap', 'round');
    spinGlow2.setAttribute('opacity', '0.5');
    spinGlow2.setAttribute('filter', 'url(#ants-glow)');
    spinGlow2.classList.add('assist-spinner-circle');
    antsSvg.appendChild(spinGlow2);

    // Inner glow — tight, bright
    const spinGlow1 = document.createElementNS(ns, 'circle');
    spinGlow1.setAttribute('cx', String(spinCx));
    spinGlow1.setAttribute('cy', String(spinCy));
    spinGlow1.setAttribute('r', String(spinR));
    spinGlow1.setAttribute('fill', 'none');
    spinGlow1.setAttribute('stroke', 'hsl(238.7 83.5% 70%)');
    spinGlow1.setAttribute('stroke-width', '2.5');
    spinGlow1.setAttribute('stroke-dasharray', spinDashArray);
    spinGlow1.setAttribute('stroke-linecap', 'round');
    spinGlow1.setAttribute('opacity', '0.65');
    spinGlow1.setAttribute('filter', 'url(#ants-glow)');
    spinGlow1.classList.add('assist-spinner-circle');
    antsSvg.appendChild(spinGlow1);

    // Crisp spinner on top
    const spinCircle = document.createElementNS(ns, 'circle');
    spinCircle.setAttribute('cx', String(spinCx));
    spinCircle.setAttribute('cy', String(spinCy));
    spinCircle.setAttribute('r', String(spinR));
    spinCircle.setAttribute('fill', 'none');
    spinCircle.setAttribute('stroke', 'hsl(238.7 83.5% 66.9%)');
    spinCircle.setAttribute('stroke-width', '1.5');
    spinCircle.setAttribute('stroke-dasharray', spinDashArray);
    spinCircle.setAttribute('stroke-linecap', 'round');
    spinCircle.classList.add('assist-spinner-circle');
    antsSvg.appendChild(spinCircle);

    rootElement.appendChild(antsSvg);

    let dashOffset = 0;
    const animateAnts = () => {
      dashOffset = (dashOffset - 0.15) % totalPerimeter;
      antsPath.setAttribute('stroke-dashoffset', String(dashOffset));
      glowPath.setAttribute('stroke-dashoffset', String(dashOffset));
      marchingAntsFrameRef.current = requestAnimationFrame(animateAnts);
    };
    marchingAntsFrameRef.current = requestAnimationFrame(animateAnts);

    const popover = document.createElement('div');
    popover.className = 'assist-action-popover';

    const content = document.createElement('div');
    content.className = 'assist-popover-content';

    const isTextEntryAction =
      (target instanceof HTMLInputElement &&
        (target.type || '').toLowerCase() !== 'file') ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
    const pointerIconSvg =
      '<svg class="assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4.1 12 6"></path><path d="m5.1 8-2.9-.8"></path><path d="m6 12-1.9 2"></path><path d="M7.2 2.2 8 5.1"></path><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"></path></svg>';
    const textInputIconSvg =
      '<svg class="assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6"></path><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"></path><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"></path><path d="M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"></path><path d="M9 6v12"></path></svg>';
    const buttonPointerIconSvg =
      '<svg class="assist-action-button-icon assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4.1 12 6"></path><path d="m5.1 8-2.9-.8"></path><path d="m6 12-1.9 2"></path><path d="M7.2 2.2 8 5.1"></path><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"></path></svg>';
    const buttonTextInputIconSvg =
      '<svg class="assist-action-button-icon assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6"></path><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"></path><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"></path><path d="M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"></path><path d="M9 6v12"></path></svg>';
    const closeIconSvg =
      '<svg class="assist-action-button-icon assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    const buttonAttachIconSvg =
      '<svg class="assist-action-button-icon assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
    const buttonAutofillIconSvg =
      '<svg class="assist-action-button-icon assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72"></path><path d="m14 7 3 3"></path><path d="M5 6v4"></path><path d="M19 14v4"></path><path d="M10 2v2"></path><path d="M7 8H3"></path><path d="M21 16h-4"></path><path d="M11 3H9"></path></svg>';
    const skipIconSvg =
      '<svg class="assist-action-button-icon assist-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.029 4.285A2 2 0 0 0 7 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"></path><path d="M3 4v16"></path></svg>';

    const header = document.createElement('div');
    header.className = 'assist-popover-header';
    const icon = document.createElement('span');
    icon.className = 'assist-popover-icon';
    icon.textContent = '✦';
    header.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'assist-popover-label';
    label.textContent = 'Suggested Action';
    header.appendChild(label);
    content.appendChild(header);

    const reasonText = document.createElement('p');
    reasonText.className = 'assist-popover-reason';
    reasonText.textContent = reason;
    content.appendChild(reasonText);

    const buttons = document.createElement('div');
    buttons.className = 'assist-action-buttons';

    const canUploadDefaultResume = isResumeAutofillAction;
    const autoResumeUploadKey =
      activeRawUrl && rawLoadCount > 0
        ? `${activeRawUrl}:${rawLoadCount}`
        : null;
    function centerTarget(behavior: ScrollBehavior = 'smooth') {
      target?.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
    }

    if (
      canUploadDefaultResume &&
      actionTarget instanceof HTMLInputElement &&
      autoResumeUploadKey &&
      autoResumeUploadAttemptRef.current !== autoResumeUploadKey
    ) {
      autoResumeUploadAttemptRef.current = autoResumeUploadKey;
      centerTarget('auto');
      void uploadDefaultResume(actionTarget).then(filled => {
        if (filled) {
          setFieldActionTick(prev => prev + 1);
        }
      });
    }

    const isDeadEnd =
      /no longer available|expired|not found|been removed|been closed|does not exist|is unavailable/i.test(
        reason,
      );
    const suggestedFieldValue = getSuggestedFieldValue(target);
    const targetFieldLabel = isFieldElement(target)
      ? getFieldLabel(target).toLowerCase()
      : 'value';
    const primaryActionLabel = isDeadEnd
      ? 'Close'
      : canUploadDefaultResume
        ? 'Attach resume'
        : isTextEntryAction && suggestedFieldValue
          ? `Autofill ${suggestedFieldValue}`
          : isTextEntryAction
            ? `Enter ${targetFieldLabel}`
            : 'Click';

    const recordObservation = (
      action: 'continue' | 'ignore',
      actionType: string,
      success: boolean,
      valueFilled?: string,
    ) => {
      try {
        const url = activeRawUrl ? new URL(activeRawUrl) : null;
        if (!url) return;
        const el = target;
        fetch('/api/assist-mode/field-observation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            hostname: url.hostname,
            pathname: url.pathname,
            selector: recommendation?.selector || '',
            tagName: el.tagName,
            inputType: el instanceof HTMLInputElement ? el.type : undefined,
            fieldName: el.getAttribute('name') || undefined,
            fieldId: el.id || undefined,
            fieldLabel: isFieldElement(el) ? getFieldLabel(el) : undefined,
            ariaLabel: el.getAttribute('aria-label') || undefined,
            placeholder: el.getAttribute('placeholder') || undefined,
            autocomplete: el.getAttribute('autocomplete') || undefined,
            role: el.getAttribute('role') || undefined,
            action,
            actionType,
            aiReason: reason,
            valueFilled,
            success,
            stepIndex: fieldActionTick,
            sessionId: observationSessionIdRef.current,
          }),
        }).catch(() => {});
      } catch {}
    };

    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.innerHTML = `${isDeadEnd ? closeIconSvg : canUploadDefaultResume ? buttonAttachIconSvg : isTextEntryAction && suggestedFieldValue ? buttonAutofillIconSvg : isTextEntryAction ? buttonTextInputIconSvg : buttonPointerIconSvg}${primaryActionLabel}`;
    completeButton.className = 'assist-action-button-primary';
    completeButton.addEventListener('click', async () => {
      if (isDeadEnd) {
        onClose();
        return;
      }
      // Re-validate target is still in the DOM before acting
      if (!target.isConnected) {
        setFieldActionTick(prev => prev + 1);
        return;
      }
      centerTarget();
      let filled = false;
      let actionType = 'activate';
      let valueFilled: string | undefined;
      if (canUploadDefaultResume && actionTarget instanceof HTMLInputElement) {
        filled = await uploadDefaultResume(actionTarget);
        if (filled) actionType = 'upload';
      }
      const getTargetValue = () =>
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
          ? target.value
          : undefined;
      if (!filled) {
        filled = await fillSuggestedField(target);
        if (filled) {
          actionType = 'fill';
          valueFilled = getTargetValue();
        }
      }
      if (!filled) {
        activateElement(target);
        actionType = 'click';
      }
      setFieldActionTick(prev => prev + 1);
      saveFieldValueToProfile(target);
      recordObservation('continue', actionType, true, valueFilled);
    });
    const skipButton = document.createElement('button');
    skipButton.type = 'button';
    skipButton.innerHTML = `Ignore${skipIconSvg}`;
    skipButton.className = 'assist-action-button-skip';
    skipButton.addEventListener('click', () => {
      saveFieldValueToProfile(target);
      recordObservation('ignore', 'ignore', true);
      ignoredSelectorsRef.current.add(getElementFingerprint(target));
      target.setAttribute('data-assist-skipped', 'true');
      target.removeAttribute('data-assist-action');
      setFieldActionTick(prev => prev + 1);
    });
    buttons.appendChild(skipButton);
    buttons.appendChild(completeButton);

    content.appendChild(buttons);
    popover.appendChild(content);
    rootElement.appendChild(popover);

    // Sync suggestion to React header for quick-action bar
    setHeaderSuggestion({ reason, buttonLabel: primaryActionLabel });
    headerActionRef.current = () => completeButton.click();

    const positionPopover = () => {
      if (!target || !popover.isConnected) return;
      const rootRect = rootElement.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const availableWidth = Math.max(220, rootRect.width - 24);
      const minPopoverWidth = Math.min(320, availableWidth);
      const maxPopoverWidth = Math.min(520, availableWidth);
      popover.style.width = 'auto';
      const measuredWidth = popover.scrollWidth;
      const popoverWidth = Math.min(
        maxPopoverWidth,
        Math.max(minPopoverWidth, measuredWidth),
      );
      popover.style.width = `${popoverWidth}px`;
      const popoverHeight = popover.offsetHeight || 180;
      const popoverGap = 8;
      const antsTop =
        targetRect.top - rootRect.top + rootElement.scrollTop - gap;
      const antsBottom =
        targetRect.bottom - rootRect.top + rootElement.scrollTop + gap;
      const antsLeft =
        targetRect.left - rootRect.left + rootElement.scrollLeft - gap;

      // Prefer above the target, left-aligned with the marching ants
      const aboveTop = antsTop - popoverHeight - popoverGap;
      const leftAligned = Math.max(
        12,
        Math.min(antsLeft, rootRect.width - popoverWidth - 12),
      );

      if (aboveTop >= 12) {
        popover.style.top = `${aboveTop}px`;
        popover.style.left = `${leftAligned}px`;
      } else {
        // Fallback: below the target
        popover.style.top = `${antsBottom + popoverGap}px`;
        popover.style.left = `${leftAligned}px`;
      }
    };

    centerTarget('smooth');
    positionPopover();
    const host = contentRef.current;
    host?.addEventListener('scroll', positionPopover, { passive: true });
    rootElement.addEventListener('scroll', positionPopover, { passive: true });
    window.addEventListener('resize', positionPopover);

    return () => {
      host?.removeEventListener('scroll', positionPopover);
      rootElement.removeEventListener('scroll', positionPopover);
      window.removeEventListener('resize', positionPopover);
    };
  }, [
    activeRawUrl,
    atsResumeAutofillSelector,
    atsResumeUploaded,
    autofillProfile,
    fieldActionTick,
    rawLoadCount,
    recommendation,
    uploadDefaultResume,
    userNameParts,
    onClose,
  ]);

  useEffect(() => {
    if (!atsResumeUploaded || !activeRawUrl || rawLoadCount === 0) return;
    const aiKey = `${activeRawUrl}:${rawLoadCount}`;
    if (atsAiFieldFillAttemptRef.current === aiKey) return;

    if (!shadowRootRef.current) return;
    const shadowRoot = shadowRootRef.current;
    const rootElement = shadowRoot.querySelector('.assist-root');
    if (!(rootElement instanceof HTMLElement)) return;

    const emptyTextareas = Array.from(rootElement.querySelectorAll('textarea'))
      .filter(
        (el): el is HTMLTextAreaElement => el instanceof HTMLTextAreaElement,
      )
      .filter(
        el =>
          isElementVisible(el) &&
          !isElementDisabled(el) &&
          isFieldEmpty(el) &&
          !getApplicationFieldPattern(el),
      );

    if (emptyTextareas.length === 0) return;
    atsAiFieldFillAttemptRef.current = aiKey;

    const pageText = rootElement.textContent || '';
    const titleMatch = pageText.match(
      /(?:apply|application)\s+(?:for|to)\s+(.+?)(?:\s+at\s+|\s*[-–|]\s*)/i,
    );
    const companyMatch = pageText.match(
      /(?:at|join)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\.|,|\s*[-–|]|\s*$)/,
    );

    const fields = emptyTextareas.map(el => ({
      label: getAssociatedLabelText(el) || el.placeholder || 'Unknown field',
      placeholder: el.placeholder || undefined,
    }));

    void (async () => {
      try {
        const response = await fetch('/api/assist-mode/field-answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields,
            jobTitle: titleMatch?.[1]?.trim(),
            company: companyMatch?.[1]?.trim(),
          }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          answers: Array<{ label: string; value: string }>;
        };
        if (!data.answers) return;

        emptyTextareas.forEach((el, i) => {
          const answer = data.answers[i];
          if (!answer?.value) return;
          if (!isFieldEmpty(el)) return;
          fillInputValue(el, answer.value);
        });
        setFieldActionTick(prev => prev + 1);
      } catch {
        // Silently fail — user can still fill manually
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atsResumeUploaded, activeRawUrl, rawLoadCount, fieldActionTick]);

  // Scan shadow DOM fields to build checklist
  useEffect(() => {
    if (!shadowRootRef.current || isLoading || !html) {
      setFieldChecklist([]);
      return;
    }
    const timerId = setTimeout(() => {
      const root = shadowRootRef.current?.querySelector('.assist-root');
      if (!(root instanceof HTMLElement)) return;

      const isChromeEl = (el: HTMLElement): boolean => {
        let node: HTMLElement | null = el;
        while (node && node !== root) {
          const tag = node.tagName?.toLowerCase();
          const role = node.getAttribute('role')?.toLowerCase();
          if (
            tag === 'nav' ||
            tag === 'header' ||
            tag === 'footer' ||
            role === 'navigation' ||
            role === 'banner' ||
            role === 'contentinfo'
          )
            return true;
          node = node.parentElement;
        }
        return false;
      };
      const isSearchEl = (el: HTMLElement): boolean => {
        if (!(el instanceof HTMLInputElement)) return false;
        if ((el.type || 'text').toLowerCase() === 'search') return true;
        const hints = [el.name, el.placeholder, el.getAttribute('aria-label')]
          .join(' ')
          .toLowerCase();
        return /\b(search|find.?jobs?|job.?title|keyword|company|where|what)\b/.test(
          hints,
        );
      };
      const fp = (el: HTMLElement): string => {
        const tag = el.tagName.toLowerCase();
        if (el.id) return `${tag}#${el.id}`;
        const name = el.getAttribute('name');
        if (name) return `${tag}[name="${name}"]`;
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return `${tag}[aria-label="${ariaLabel}"]`;
        return `${tag}:${el.textContent?.trim().slice(0, 40) ?? ''}`;
      };

      const fields = Array.from(
        root.querySelectorAll('input, textarea, select'),
      )
        .filter(
          (
            el,
          ): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
            el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement ||
            el instanceof HTMLSelectElement,
        )
        .filter(el => {
          if (el instanceof HTMLInputElement) {
            const type = (el.type || 'text').toLowerCase();
            if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type))
              return false;
          }
          return true;
        })
        .filter(
          el =>
            isFieldElement(el) &&
            el.offsetParent !== null &&
            !isChromeEl(el) &&
            !isSearchEl(el),
        );

      const checklist: ChecklistField[] = fields.map(el => {
        const fingerprint = fp(el);
        const isSkipped =
          ignoredSelectorsRef.current.has(fingerprint) ||
          el.getAttribute('data-assist-skipped') === 'true';
        return {
          fingerprint,
          label: getFieldLabel(el),
          required: isFieldRequired(el),
          status: isSkipped
            ? 'skipped'
            : !isFieldEmpty(el)
              ? 'filled'
              : 'empty',
        };
      });

      setFieldChecklist(checklist);
    }, 250);
    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, isLoading, fieldActionTick]);

  // Sanitized view click/submit handler disabled — locked to raw view only

  useEffect(() => {
    if (!shadowRootRef.current) return;
    const shadowRoot = shadowRootRef.current;
    const rootElement = shadowRoot.querySelector('.assist-root');
    if (!(rootElement instanceof HTMLElement)) return;

    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;
      const href = anchor.href;
      if (href === '#' || href.startsWith('javascript:')) return;
      event.preventDefault();
      event.stopPropagation();
      navigateRawRef.current(href);
    };

    rootElement.addEventListener('click', handleClick, true);
    return () => {
      rootElement.removeEventListener('click', handleClick, true);
    };
  }, [html]);

  return (
    <>
      <Modal open={authPromptOpen} onOpenChange={setAuthPromptOpen}>
        <ModalContent size="md" className="p-0">
          <ModalHeader className="border-b border-border/50 px-6 py-4">
            <ModalTitle>Sign in to continue AI Preview</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4 px-6 py-5">
            <p className="text-sm text-muted-foreground">
              {authPromptReason ??
                'Your session expired. Sign back in here and AI Preview will continue from this page.'}
            </p>
            <LoginForm isLoggedIn={Boolean(session?.user)} />
          </ModalBody>
          <ModalFooter className="border-t border-border/50 px-6 py-4">
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                If the modal sign-in fails, open the full login page and you
                will return here afterward.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/login?redirect_url=${encodeURIComponent(returnUrl)}`}
                >
                  Open full login
                </Link>
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={open} onOpenChange={handleAssistModalOpenChange}>
        <ModalContent
          className="flex h-full flex-col overflow-hidden rounded-xl p-0 sm:rounded-xl **:data-close-wrapper:right-2.5 **:data-close-wrapper:top-2.5"
          size="4xl"
          style={{ width: '90vw', height: '85vh', maxWidth: 'none' }}
        >
          <VisuallyHidden>
            <ModalTitle>AI Preview</ModalTitle>
          </VisuallyHidden>
          <ModalHeader className="flex flex-row items-center gap-3 border-b border-border/50 bg-muted/40 px-2.5 py-2.5 pr-14">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleRawBack}
                disabled={rawHistory.index <= 0}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleRawForward}
                disabled={rawHistory.index >= rawHistory.entries.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Forward</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setRefreshKey(prev => prev + 1)}
              >
                <RefreshCcw className="h-4 w-4" />
                <span className="sr-only">Refresh</span>
              </Button>
              <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-border/60 bg-background px-3 text-xs text-muted-foreground">
                <input
                  className="w-full bg-transparent outline-none truncate text-xs text-muted-foreground"
                  key={displayUrl}
                  defaultValue={displayUrl}
                  onBlur={e => {
                    e.currentTarget.value = displayUrl;
                  }}
                  onFocus={e => {
                    const input = e.currentTarget;
                    input.value = activeRawUrl || '';
                    requestAnimationFrame(() => input.select());
                  }}
                  readOnly
                  type="text"
                />
              </div>
              <Tabs
                value={contentView}
                onValueChange={v => setContentView(v as 'adapted' | 'raw')}
                className="shrink-0"
              >
                <TabsList className="h-7 rounded-md p-0.5">
                  <TabsTrigger
                    value="adapted"
                    className="h-6 rounded px-2.5 text-[11px]"
                  >
                    Adapted
                  </TabsTrigger>
                  <TabsTrigger
                    value="raw"
                    className="h-6 rounded px-2.5 text-[11px]"
                  >
                    Raw
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </ModalHeader>

          <AnimatePresence>
            {headerSuggestion && !isLoading && !loadError ? (
              <motion.div
                className="flex items-center justify-center border-b border-primary/25 bg-primary/4 p-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              >
                <motion.div
                  key={headerSuggestion.reason}
                  className="flex items-center gap-2 rounded-full border border-primary/20 bg-background/75 px-2.5 py-1 shadow-sm backdrop-blur"
                  initial={{ opacity: 0.5, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  layout
                  transition={{
                    layout: { type: 'spring', stiffness: 400, damping: 30 },
                  }}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[10px] text-primary">
                    ✦
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-[11px] text-foreground/75">
                    {headerSuggestion.reason}
                  </p>
                  <Button
                    size="sm"
                    className="h-6 shrink-0 rounded-full px-2.5 text-[11px] font-semibold"
                    onClick={() => headerActionRef.current?.()}
                  >
                    {headerSuggestion.buttonLabel === 'Click' ? (
                      <MousePointerClick className="-mr-1 h-3 w-3" />
                    ) : null}
                    {headerSuggestion.buttonLabel}
                  </Button>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <ModalBody className="flex-1 overflow-hidden bg-background/60">
            <div className="flex h-full w-full">
              {applyUrl ? (
                <>
                  <div className="relative flex h-full min-w-0 flex-1 overflow-auto">
                    <div
                      ref={contentRef}
                      className="h-full w-full overflow-auto"
                    />
                    {isLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
                        Loading application preview…
                      </div>
                    ) : null}
                    {loadError === 'bot_protection' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center">
                        <p className="text-sm font-medium">
                          This site has bot protection
                        </p>
                        <p className="max-w-sm text-xs text-muted-foreground">
                          Cloudflare or similar protection blocked the page from
                          loading. Open the application directly in a new tab
                          instead.
                        </p>
                        <a
                          href={activeRawUrl ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          Open application
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    ) : loadError ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
                        {loadError}
                      </div>
                    ) : null}
                    {recommendationError ? (
                      <div className="absolute right-4 top-4 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                        {recommendationError}
                      </div>
                    ) : null}
                    <AnimatePresence>
                      {isRecommendationLoading ? (
                        <motion.div
                          className="absolute inset-0 z-10 flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/90 backdrop-blur-[2px]" />
                          <div className="relative z-10 flex flex-col items-center gap-4">
                            <div className="relative h-12 w-12">
                              <div
                                className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                                style={{ animationDuration: '1.2s' }}
                              />
                              <div
                                className="absolute inset-1.5 animate-spin rounded-full border-2 border-transparent border-b-primary/40"
                                style={{
                                  animationDuration: '1.8s',
                                  animationDirection: 'reverse',
                                }}
                              />
                            </div>
                            <div className="flex flex-col items-center gap-1.5">
                              <p className="text-sm font-medium text-foreground/90">
                                Analyzing application&hellip;
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Finding the best next action for you
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                  {fieldChecklist.length > 0 && !isLoading && (
                    <div className="flex h-full w-56 shrink-0 flex-col border-l border-border/50 bg-muted/20">
                      <div className="border-b border-border/40 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Fields
                          </h3>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {
                              fieldChecklist.filter(f => f.status === 'filled')
                                .length
                            }
                            /{fieldChecklist.length}
                          </span>
                        </div>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${(fieldChecklist.filter(f => f.status === 'filled').length / fieldChecklist.length) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto px-2 py-2">
                        {fieldChecklist.map(field => (
                          <div
                            key={field.fingerprint}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors',
                              field.status === 'filled' &&
                                'text-muted-foreground',
                              field.status === 'empty' && 'text-foreground',
                              field.status === 'skipped' &&
                                'text-muted-foreground/50 line-through',
                            )}
                          >
                            {field.status === 'filled' ? (
                              <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                                <svg
                                  className="h-2 w-2"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              </div>
                            ) : field.status === 'skipped' ? (
                              <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/50">
                                <svg
                                  className="h-2 w-2"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                >
                                  <path d="m6 6 12 12M18 6 6 18" />
                                </svg>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px]',
                                  field.required
                                    ? 'border-primary/60'
                                    : 'border-border',
                                )}
                              />
                            )}
                            <span className="truncate capitalize">
                              {field.label}
                            </span>
                            {field.required && field.status === 'empty' && (
                              <span className="ml-auto shrink-0 text-[9px] font-medium text-primary/70">
                                *
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="m-6 flex w-full items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/50 px-6 py-10 text-center text-sm text-muted-foreground">
                  No application URL found for this job.
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter className="border-t border-border/50 px-6 py-4">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AssistPreviewSubmitBanner className="flex-1" />
              {applyUrl ? (
                <Button
                  asChild
                  className="shrink-0"
                  size="sm"
                  variant="outline"
                >
                  <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                    Open in Browser
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

AssistModeModal.displayName = 'AssistModeModal';

export { AssistModeModal };
