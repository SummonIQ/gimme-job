import { load } from 'cheerio';
import { type NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';

import { generateAIObject } from '@/lib/ai';
import { getServerAiProvider } from '@/lib/ai/provider';
import { detectClosedPostingMessageDetailed } from '@/lib/applications/closed-posting-detection';
import { recordClosedPostingPhrase } from '@/lib/applications/closed-posting-learning';
import { db } from '@/lib/db/client';
import { ensureKnowledgeInitialized } from '@/lib/user/knowledge';
import { getCurrentUser } from '@/lib/user/query';

import { classifyPage, type PageClassification } from '../_lib/page-classifier';

const MAX_HTML_CHARS = 120000;
const MAX_STYLE_CHARS = 20000;
const MAX_FIELD_HINTS_CHARS = 4000;
const MIN_ACTIONABLE_RULE_CONFIDENCE = 0.6;

const recommendationSchema = z.object({
  reason: z.string(),
  selector: z.string(),
});

interface RecommendationSource {
  blockedSignalStrength?: number;
  confidence?: number;
  confirmationSignalStrength?: number;
  flowStatus?: string;
  flowVersion?: number;
  kind:
    | 'ai'
    | 'classification'
    | 'deterministic'
    | 'rule'
    | 'rule_fallback';
  label: string;
  ruleActionType?: string;
  ruleStepIndex?: number;
  submitAwareStep?: boolean;
  trainingReviewApproved?: boolean;
  trainingReviewStatus?: string;
  trustPolicyReason?: string;
  trustedSubmitPath?: boolean;
  trustedSubmitSuppressed?: boolean;
}

interface RecommendationResponse {
  reason: string;
  selectOptions?: string[];
  selector: string;
  source: RecommendationSource;
}

interface ATSRuleRecord {
  action: string;
  actionType: string;
  confidence: number;
  fieldLabel: string | null;
  reason: string | null;
  stableSelector: string;
  stepIndex: number;
}

interface ApplicationFlowStepRecord {
  averageConfidence: number;
  metadata?: {
    isSubmitLike?: boolean;
    submitLikeRuleCount?: number;
  } | null;
  primarySelector: string | null;
  selectors: string[];
  stepIndex: number;
  stepLabel: string | null;
}

interface ApplicationFlowRecord {
  compiledFromRuleCount: number;
  confidence: number;
  hostname: string;
  metadata?: {
    confirmationEvents?: number;
    confirmationSignalCounts?: Record<string, number>;
    submitBlockedSignalCounts?: Record<string, number>;
    trustedSubmitControl?: {
      disabled?: boolean;
      disabledAt?: string;
      restoredAt?: string;
      source?: string;
    };
  } | null;
  status: string;
  steps: ApplicationFlowStepRecord[];
  version: number;
}

function buildRecommendationResponse(input: {
  reason: string;
  selectOptions?: string[];
  selector: string;
  source: RecommendationSource;
}): RecommendationResponse {
  return {
    reason: input.reason,
    selectOptions: input.selectOptions,
    selector: input.selector,
    source: input.source,
  };
}

interface AssistJobContext {
  company?: string | null;
  jobId?: string | null;
  jobLeadId?: string | null;
  title?: string | null;
}

function normalizeStableSelector(selector: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return '';

  const idMatch = trimmed.match(/#([A-Za-z_][\\w-]*)/);
  if (idMatch && idMatch[1]) {
    return `#${idMatch[1]}`;
  }

  return trimmed.replace(/^\\w+/, '').trim() || trimmed;
}

async function getFieldHints(hostname: string): Promise<string> {
  const observations = await db.aTSFieldObservation.groupBy({
    _count: { id: true },
    by: [
      'tagName',
      'fieldName',
      'fieldId',
      'fieldLabel',
      'ariaLabel',
      'action',
      'actionType',
    ],
    orderBy: { _count: { id: 'desc' } },
    take: 30,
    where: { hostname },
  });

  if (observations.length === 0) return '';

  const lines = observations.map(obs => {
    const identifier = obs.fieldName
      ? `${obs.tagName.toLowerCase()}[name="${obs.fieldName}"]`
      : obs.fieldId
        ? `${obs.tagName.toLowerCase()}#${obs.fieldId}`
        : obs.ariaLabel
          ? `${obs.tagName.toLowerCase()}[aria-label="${obs.ariaLabel}"]`
          : obs.tagName.toLowerCase();
    const label = obs.fieldLabel ? ` (${obs.fieldLabel})` : '';
    const verb = obs.action === 'continue' ? obs.actionType : 'ignored';
    return `- ${identifier}${label}: ${verb} ${obs._count.id}x`;
  });

  return lines.join('\n').slice(0, MAX_FIELD_HINTS_CHARS);
}

async function getRules(hostname: string): Promise<ATSRuleRecord[]> {
  try {
    // Try hostname-specific first, fall back to ATS-level rules so one
    // good training run unlocks all hostnames for the same ATS.
    const hostnameRules = await db.aTSRule.findMany({
      orderBy: { stepIndex: 'asc' },
      select: {
        action: true,
        actionType: true,
        confidence: true,
        fieldLabel: true,
        reason: true,
        stableSelector: true,
        stepIndex: true,
      },
      where: { enabled: true, hostname },
    });
    if (hostnameRules.length > 0) return hostnameRules;

    // No hostname rules — check if this hostname belongs to a known ATS
    // and use rules from any hostname under that ATS.
    const atsSystem = await db.aTSSystem.findFirst({
      select: { id: true },
      where: {
        OR: [
          { detectedDomain: hostname },
          { domainPatterns: { has: hostname } },
        ],
      },
    });
    if (!atsSystem) return [];

    return await db.aTSRule.findMany({
      orderBy: [{ confidence: 'desc' }, { stepIndex: 'asc' }],
      select: {
        action: true,
        actionType: true,
        confidence: true,
        fieldLabel: true,
        reason: true,
        stableSelector: true,
        stepIndex: true,
      },
      take: 50,
      where: { enabled: true, atsSystemId: atsSystem.id },
    });
  } catch {
    return [];
  }
}

async function getFlowDefinition(
  hostname: string,
): Promise<ApplicationFlowRecord | null> {
  try {
    return (await db.applicationFlowDefinition.findFirst({
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
      select: {
        compiledFromRuleCount: true,
        confidence: true,
        hostname: true,
        metadata: true,
        status: true,
        steps: {
          orderBy: { stepIndex: 'asc' },
          select: {
            averageConfidence: true,
            metadata: true,
            primarySelector: true,
            selectors: true,
            stepIndex: true,
            stepLabel: true,
          },
        },
        version: true,
      },
      where: {
        hostname,
        status: 'ACTIVE',
      },
    })) as ApplicationFlowRecord | null;
  } catch {
    return null;
  }
}

function getDominantSignalCount(value: unknown): number {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  let dominantCount = 0;

  for (const count of Object.values(value as Record<string, unknown>)) {
    if (typeof count === 'number' && count > dominantCount) {
      dominantCount = count;
    }
  }

  return dominantCount;
}

function getFlowSignalProfile(flow: ApplicationFlowRecord | null): {
  confirmationEvents: number;
  dominantConfirmationSignalCount: number;
  dominantSubmitBlockedSignalCount: number;
  hasStableConfirmationSignal: boolean;
  hasStableSubmitBlockedSignal: boolean;
} {
  const metadata =
    flow?.metadata && typeof flow.metadata === 'object'
      ? flow.metadata
      : null;
  const confirmationEvents =
    typeof metadata?.confirmationEvents === 'number'
      ? metadata.confirmationEvents
      : 0;
  const dominantConfirmationSignalCount = getDominantSignalCount(
    metadata?.confirmationSignalCounts,
  );
  const dominantSubmitBlockedSignalCount = getDominantSignalCount(
    metadata?.submitBlockedSignalCounts,
  );

  return {
    confirmationEvents,
    dominantConfirmationSignalCount,
    dominantSubmitBlockedSignalCount,
    hasStableConfirmationSignal:
      dominantConfirmationSignalCount >= 2 || confirmationEvents >= 3,
    hasStableSubmitBlockedSignal: dominantSubmitBlockedSignalCount >= 2,
  };
}

function getRuntimeTrustSourceMeta(value: unknown): {
  trainingReviewApproved?: boolean;
  trainingReviewStatus?: string;
  trustPolicyReason?: string;
} {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const runtimeMetadata = value as {
    trustPolicy?: {
      metrics?: {
        trainingReviewApproved?: unknown;
        trainingReviewStatus?: unknown;
      };
      reason?: unknown;
    };
  };

  return {
    trainingReviewApproved:
      runtimeMetadata.trustPolicy?.metrics?.trainingReviewApproved === true,
    trainingReviewStatus:
      typeof runtimeMetadata.trustPolicy?.metrics?.trainingReviewStatus ===
      'string'
        ? runtimeMetadata.trustPolicy.metrics.trainingReviewStatus
        : undefined,
    trustPolicyReason:
      typeof runtimeMetadata.trustPolicy?.reason === 'string'
        ? runtimeMetadata.trustPolicy.reason
        : undefined,
  };
}

function findPrimaryApplyActionWithReason(
  html: string,
): { reason: string, selector: string; } | null {
  try {
    const $ = load(html);

    const buildSelector = (
      element: ReturnType<typeof $>['0'] | undefined,
    ): string => {
      if (!element) return '';
      const tagName = String($(element).prop('tagName') ?? '').toLowerCase();
      const id = $(element).attr('id');
      const dataTestId = $(element).attr('data-testid');
      const ariaLabel = $(element).attr('aria-label');
      const name = $(element).attr('name');

      if (id) return `${tagName}#${id}`;
      if (dataTestId) return `${tagName}[data-testid="${dataTestId}"]`;
      if (ariaLabel) return `${tagName}[aria-label="${ariaLabel}"]`;
      if (name) return `${tagName}[name="${name}"]`;
      return '';
    };

    const candidates = $('a, button, [role="button"]')
      .toArray()
      .filter(
        el =>
          $(el).closest(
            'header, nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"]',
          ).length === 0,
      )
      .map(el => {
        const text = [
          $(el).text() ?? '',
          $(el).attr('aria-label') ?? '',
          $(el).attr('title') ?? '',
          $(el).attr('data-testid') ?? '',
          $(el).attr('id') ?? '',
          $(el).attr('class') ?? '',
        ]
          .join(' ')
          .toLowerCase();
        const href = ($(el).attr('href') ?? '').toLowerCase();

        let score = 0;
        if (
          /\b(apply\s*now|quick\s*apply|easy\s*apply|apply\s*on\s*company\s*site|start\s*application|submit\s*application|continue\s*application)\b/.test(
            text,
          )
        ) {
          score += 250;
        }
        if (/\bapply\b/.test(text)) score += 140;
        if (/\/apply|\/application|greenhouse|lever|workday/.test(href))
          score += 30;
        if (
          /\b(view\s+more\s+jobs?|find\s+similar\s+jobs?|search)\b/.test(text)
        ) {
          score -= 240;
        }

        return { el, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    if (!best) return null;

    const selector = buildSelector(best.el);
    if (!selector) return null;

    return {
      reason: 'Open the job-specific application path with this Apply action.',
      selector,
    };
  } catch {
    return null;
  }
}

function hasLikelyApplicationFields(html: string): boolean {
  try {
    const $ = load(html);
    const candidateFields = $('input, textarea, select')
      .toArray()
      .filter(el => {
        const tag = String($(el).prop('tagName') ?? '').toLowerCase();
        if (tag === 'input') {
          const type = ($(el).attr('type') ?? 'text').toLowerCase();
          if (
            ['hidden', 'submit', 'button', 'image', 'reset', 'search'].includes(
              type,
            )
          ) {
            return false;
          }
        }
        if (
          $(el).closest(
            'header, nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"]',
          ).length > 0
        ) {
          return false;
        }
        const hints = [
          $(el).attr('name') ?? '',
          $(el).attr('id') ?? '',
          $(el).attr('placeholder') ?? '',
          $(el).attr('aria-label') ?? '',
          $(el).attr('autocomplete') ?? '',
          $(el).closest('label').text() ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (
          /\b(search|keyword|job\s*title|find\s*jobs?|location|where|what)\b/.test(
            hints,
          )
        ) {
          return false;
        }
        return /\b(first\s*name|last\s*name|full\s*name|email|phone|resume|cv|cover\s*letter|work\s*authorization|linkedin|portfolio|password|address|city|state|zip)\b/.test(
          hints,
        );
      });

    return candidateFields.length > 0;
  } catch {
    return false;
  }
}

function formatRulesForPrompt(rules: ATSRuleRecord[]): string {
  if (rules.length === 0) return '';

  const lines = rules.map(rule => {
    const label = rule.fieldLabel ? ` (${rule.fieldLabel})` : '';
    const verb = rule.action === 'continue' ? rule.actionType : 'IGNORE';
    const conf =
      rule.confidence < 1.0
        ? ` [${Math.round(rule.confidence * 100)}% confident]`
        : '';
    return `- Step ${rule.stepIndex}: ${verb} ${rule.stableSelector}${label}${conf}`;
  });

  return lines.join('\n');
}

function getPromptEligibleRules(
  rules: ATSRuleRecord[],
  html: string,
): ATSRuleRecord[] {
  return rules.filter(rule => {
    if (rule.action === 'ignore') return true;
    if (rule.action !== 'continue') return false;
    if (rule.confidence < MIN_ACTIONABLE_RULE_CONFIDENCE) return false;
    return isRuleSelectorActionableInHtml(html, rule.stableSelector);
  });
}

function isRuleSelectorActionableInHtml(
  html: string,
  selector: string,
): boolean {
  if (!selector.trim()) return false;

  try {
    const $ = load(html);
    const element = $(selector).first();
    if (element.length === 0) return false;

    const tagName = String(element.prop('tagName') ?? '').toLowerCase();
    const role = (element.attr('role') ?? '').toLowerCase();

    if (role === 'button') return true;
    if (['button', 'select', 'textarea', 'a'].includes(tagName)) return true;

    if (tagName === 'input') {
      const inputType = (element.attr('type') ?? 'text').toLowerCase();
      return inputType !== 'hidden';
    }

    return false;
  } catch {
    return false;
  }
}

function isNavigationLikeSelectorInHtml(
  html: string,
  selector: string,
): boolean {
  if (!selector.trim()) return false;

  try {
    const $ = load(html);
    const element = $(selector).first();
    if (element.length === 0) return false;

    const tagName = String(element.prop('tagName') ?? '').toLowerCase();
    const role = (element.attr('role') ?? '').toLowerCase();
    return (
      tagName === 'a' ||
      tagName === 'button' ||
      role === 'button' ||
      role === 'tab'
    );
  } catch {
    return false;
  }
}

/**
 * Deterministic first-empty-field finder.
 * Returns the first empty application field in DOM order without calling AI.
 * Skips resume/file upload fields.
 */
function findFirstEmptyFieldWithReason(
  html: string,
): { reason: string; selectOptions?: string[], selector: string; } | null {
  try {
    const $ = load(html);

    const buildSelector = (
      element: ReturnType<typeof $>['0'] | undefined,
    ): string => {
      if (!element) return '';
      const tagName = String($(element).prop('tagName') ?? '').toLowerCase();
      const id = $(element).attr('id');
      const name = $(element).attr('name');
      const ariaLabel = $(element).attr('aria-label');
      const type = $(element).attr('type');
      const placeholder = $(element).attr('placeholder');
      const dataTestId = $(element).attr('data-testid');
      const autocomplete = $(element).attr('autocomplete');

      // Prefer ID — most specific
      if (id) return `${tagName}#${id}`;
      // data-testid is stable across renders
      if (dataTestId) return `${tagName}[data-testid="${dataTestId}"]`;
      // name + type combo for extra specificity
      if (name && type) return `${tagName}[name="${name}"][type="${type}"]`;
      if (name) return `${tagName}[name="${name}"]`;
      // autocomplete attribute is semantic and stable
      if (autocomplete && autocomplete !== 'off')
        return `${tagName}[autocomplete="${autocomplete}"]`;
      if (ariaLabel) return `${tagName}[aria-label="${ariaLabel}"]`;
      if (placeholder) return `${tagName}[placeholder="${placeholder}"]`;
      return '';
    };

    const getLabel = (el: ReturnType<typeof $>['0']): string => {
      const id = $(el).attr('id');
      if (id) {
        const label = $(`label[for="${id}"]`).first().text().trim();
        if (label) return label;
      }
      const parentLabel = $(el).closest('label').text().trim();
      if (parentLabel) return parentLabel;
      const ariaLabel = $(el).attr('aria-label')?.trim();
      if (ariaLabel) return ariaLabel;
      const placeholder = $(el).attr('placeholder')?.trim();
      if (placeholder) return placeholder;
      const name = $(el).attr('name')?.trim();
      if (name) return name;
      return 'field';
    };

    // All fillable fields excluding file inputs and resume uploads
    const fieldQuery =
      'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="search"]), textarea, select';

    const isChrome = (el: ReturnType<typeof $>['0']) =>
      $(el).closest('nav, header, footer, [role="navigation"], [role="banner"]')
        .length > 0;

    const isSearch = (el: ReturnType<typeof $>['0']) => {
      const hints = [
        $(el).attr('name') ?? '',
        $(el).attr('placeholder') ?? '',
        $(el).attr('aria-label') ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return /\b(search|find.?jobs?|job.?title|keyword|company|where|what)\b/.test(
        hints,
      );
    };

    const isEmpty = (el: ReturnType<typeof $>['0']) => {
      const tagName = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
      const type = ($(el).attr('type') ?? 'text').toLowerCase();
      if (type === 'radio' || type === 'checkbox') {
        return !$(el).is('[checked]');
      }
      // For <select>, check if an option with a real value is selected
      if (tagName === 'select') {
        const selectedOption = $(el).find('option[selected]');
        if (selectedOption.length === 0) return true;
        const selectedValue = (selectedOption.attr('value') ?? '').trim();
        const selectedText = (selectedOption.text() ?? '').trim().toLowerCase();
        // Placeholder options often have empty value or text like "Select..."
        return !selectedValue || /^select|^choose|^--/i.test(selectedText);
      }
      const val = ($(el).attr('value') ?? $(el).text() ?? '').trim();
      return val === '';
    };

    // For radio buttons, track seen groups and their checked values
    const seenRadioGroups = new Set<string>();
    const radioGroupValues = new Map<string, string>();

    // Pre-scan radio groups to know their selected values
    $('input[type="radio"][checked]').each((_, el) => {
      const name = $(el).attr('name') ?? '';
      const label =
        $(el).closest('label')?.text()?.trim() ?? $(el).attr('value') ?? '';
      if (name) radioGroupValues.set(name, label.toLowerCase());
    });

    // Check if a field is conditional on a preceding answer (e.g. "If YES...")
    const isConditionalAndIrrelevant = (
      el: ReturnType<typeof $>['0'],
    ): boolean => {
      const label = getLabel(el).toLowerCase();
      const conditionalMatch = label.match(
        /^if\s*["""]?\s*(yes|no|true|selected)/i,
      );
      if (!conditionalMatch) return false;
      const requiredAnswer = conditionalMatch[1].toLowerCase();

      // Find the nearest preceding radio group and check if its value matches
      const prevRadios = $(el).prevAll('input[type="radio"]').first();
      const prevGroupName = prevRadios.attr('name');
      if (prevGroupName && radioGroupValues.has(prevGroupName)) {
        const selectedValue = radioGroupValues.get(prevGroupName)!;
        // If the condition is "If YES" but user selected "No" (or vice versa), skip
        if (requiredAnswer === 'yes' && !selectedValue.includes('yes'))
          return true;
        if (requiredAnswer === 'no' && !selectedValue.includes('no'))
          return true;
      }
      // If the preceding radio group hasn't been answered yet, also skip —
      // the user should answer the radio first
      if (prevGroupName && !radioGroupValues.has(prevGroupName)) return true;
      return false;
    };

    const allFields = $(fieldQuery)
      .toArray()
      .filter(el => !isChrome(el) && !isSearch(el));

    for (const el of allFields) {
      const type = ($(el).attr('type') ?? 'text').toLowerCase();

      // Group radios — only process first radio per group
      if (type === 'radio') {
        const name = $(el).attr('name') ?? '';
        if (!name || seenRadioGroups.has(name)) continue;
        seenRadioGroups.add(name);
        const anyChecked =
          $(`input[type="radio"][name="${name}"][checked]`).length > 0;
        if (anyChecked) continue;
        const selector = buildSelector(el);
        if (!selector) continue;
        const label = getLabel(el);
        return { reason: `Select an option for "${label.replace(/\*+/g, '').trim()}".`, selector };
      }

      if (!isEmpty(el)) continue;
      // Skip conditional fields where the condition isn't met
      if (isConditionalAndIrrelevant(el)) continue;
      const selector = buildSelector(el);
      if (!selector) continue;
      const label = getLabel(el);
      const tagName = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
      if (tagName === 'select') {
        const options = $(el)
          .find('option')
          .toArray()
          .map(opt => ($(opt).text() ?? '').trim())
          .filter(t => t && !/^select|^choose|^--/i.test(t));
        return {
          reason: `Select an option for "${label.replace(/\*+/g, '').trim()}".`,
          selectOptions: options.length > 0 ? options : undefined,
          selector,
        };
      }
      const cleanLabel = label.replace(/\*+/g, '').trim();
      // Detect yes/no or boolean questions
      const isYesNoQuestion = /\b(have you|do you|are you|will you|can you|did you|would you|is there|were you|has your)\b/i.test(cleanLabel) ||
        /\?$/.test(cleanLabel);
      if (isYesNoQuestion) {
        return { reason: `Answer "${cleanLabel}"`, selector };
      }
      return { reason: `Fill in the "${cleanLabel}" field.`, selector };
    }

    // Check for submit/continue buttons if all fields are filled
    const submitBtn = $(
      'button[type="submit"], input[type="submit"], button:contains("Submit"), button:contains("Apply"), button:contains("Continue"), button:contains("Next")',
    ).first();
    if (submitBtn.length > 0) {
      const selector = buildSelector(submitBtn.get(0));
      if (selector) {
        const btnLabel = (submitBtn.text() ?? '').trim().replace(/\s+/g, ' ');
        const isApplyButton = /\bapply\b/i.test(btnLabel);
        const reason = isApplyButton
          ? btnLabel
            ? `Click "${btnLabel}" to start the application.`
            : 'Click the apply button to start the application.'
          : btnLabel
            ? `All fields filled. Click "${btnLabel}".`
            : 'All fields filled. Submit the application.';
        return {
          reason,
          selector,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function findFirstFillableFieldSelector(html: string): string {
  try {
    const $ = load(html);

    const buildSelector = (
      element: ReturnType<typeof $>['0'] | undefined,
    ): string => {
      if (!element) return '';
      const tagName = String($(element).prop('tagName') ?? '').toLowerCase();
      const id = $(element).attr('id');
      const name = $(element).attr('name');
      const ariaLabel = $(element).attr('aria-label');

      if (id) return `${tagName}#${id}`;
      if (name) return `${tagName}[name="${name}"]`;
      if (ariaLabel) return `${tagName}[aria-label="${ariaLabel}"]`;
      return '';
    };

    const fieldQuery =
      'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"]):not([type="search"]), textarea, select';
    const isChromeOrSearch = (_: number, el: ReturnType<typeof $>['0']) => {
      // Skip fields inside nav/header/footer
      if (
        $(el).closest(
          'nav, header, footer, [role="navigation"], [role="banner"]',
        ).length > 0
      )
        return true;
      const name = ($(el).attr('name') ?? '').toLowerCase();
      const placeholder = ($(el).attr('placeholder') ?? '').toLowerCase();
      const ariaLabel = ($(el).attr('aria-label') ?? '').toLowerCase();
      const searchTerms =
        /\b(search|find.?jobs?|job.?title|keyword|company|where|what)\b/i;
      return (
        searchTerms.test(name) ||
        searchTerms.test(placeholder) ||
        searchTerms.test(ariaLabel)
      );
    };
    const isEmpty = (el: ReturnType<typeof $>['0']) => {
      const val = ($(el).attr('value') ?? $(el).text() ?? '').trim();
      return val === '';
    };
    const requiredFields = $(fieldQuery).filter(
      (i, el) =>
        $(el).is('[required]') && !isChromeOrSearch(i, el) && isEmpty(el),
    );
    const allFields = $(fieldQuery).filter(
      (i, el) => !isChromeOrSearch(i, el) && isEmpty(el),
    );

    const requiredSelector = buildSelector(requiredFields.first().get(0));
    if (requiredSelector) return requiredSelector;

    const fallbackSelector = buildSelector(allFields.first().get(0));
    return fallbackSelector;
  } catch {
    return '';
  }
}

function getPreferredRuleForStep(
  rules: ATSRuleRecord[],
  stepIndex: number,
  html: string,
): ATSRuleRecord | null {
  const actionableContinueRules = rules.filter(
    rule =>
      rule.action === 'continue' &&
      rule.confidence >= MIN_ACTIONABLE_RULE_CONFIDENCE &&
      isRuleSelectorActionableInHtml(html, rule.stableSelector),
  );

  const exactStepRule = actionableContinueRules
    .filter(rule => rule.stepIndex === stepIndex)
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (exactStepRule) return exactStepRule;

  const nextStepRule = actionableContinueRules
    .filter(rule => rule.stepIndex > stepIndex)
    .sort((a, b) => {
      if (a.stepIndex !== b.stepIndex) {
        return a.stepIndex - b.stepIndex;
      }
      return b.confidence - a.confidence;
    })[0];

  return nextStepRule ?? null;
}

function getPreferredFlowStepForIndex(
  flow: ApplicationFlowRecord | null,
  stepIndex: number,
  html: string,
): ApplicationFlowStepRecord | null {
  if (!flow || flow.steps.length === 0) {
    return null;
  }

  const findActionableStep = (
    steps: ApplicationFlowStepRecord[],
  ): ApplicationFlowStepRecord | null => {
    for (const step of steps) {
      const selectors = [
        step.primarySelector,
        ...step.selectors.filter(
          selector => selector && selector !== step.primarySelector,
        ),
      ].filter(Boolean) as string[];

      if (
        selectors.some(selector => isRuleSelectorActionableInHtml(html, selector))
      ) {
        return step;
      }
    }

    return null;
  };

  const exactStep = findActionableStep(
    flow.steps.filter(step => step.stepIndex === stepIndex),
  );
  if (exactStep) {
    return exactStep;
  }

  return findActionableStep(
    flow.steps.filter(step => step.stepIndex > stepIndex),
  );
}

function getPreferredSelectorForFlowStep(
  step: ApplicationFlowStepRecord,
  html: string,
): string {
  const selectors = [
    step.primarySelector,
    ...step.selectors.filter(
      selector => selector && selector !== step.primarySelector,
    ),
  ].filter(Boolean) as string[];

  return (
    selectors.find(selector => isRuleSelectorActionableInHtml(html, selector)) ??
    ''
  );
}

function isSubmitLikeSelectorInHtml(html: string, selector: string): boolean {
  if (!selector.trim()) {
    return false;
  }

  try {
    const $ = load(html);
    const element = $(selector).first();
    if (element.length === 0) {
      return false;
    }

    const content = [
      element.text() ?? '',
      element.attr('aria-label') ?? '',
      element.attr('value') ?? '',
      element.attr('title') ?? '',
      element.attr('id') ?? '',
      element.attr('name') ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return /\b(submit|apply|finish|complete\s+application|send\s+application)\b/.test(
      content,
    );
  } catch {
    return false;
  }
}

function isSubmitLikeFlowStep(
  step: ApplicationFlowStepRecord,
  html: string,
  selector: string,
): boolean {
  if (step.metadata?.isSubmitLike) {
    return true;
  }

  return isSubmitLikeSelectorInHtml(html, selector);
}

const buildPrompt = ({
  url,
  html,
  styles,
  fieldHints,
  jobContext,
  rules,
  stepIndex,
  visionContext,
}: {
  fieldHints: string;
  html: string;
  jobContext?: AssistJobContext;
  rules: string;
  stepIndex: number;
  styles: string;
  url: string;
  visionContext?: string;
}) => `You are assisting a job applicant filling out a job application. Analyze the HTML and pick the single best next step.

APPLICATION INTENT:
- The user launched Assist Mode from a specific job lead/job detail view.
- Assume there is a path to apply for THIS specific job on this page.
- If this page is not yet the form, pick the best job-specific Apply action to enter/continue the application flow.

CRITICAL: Only target elements that are part of the JOB APPLICATION form or flow. NEVER target:
- Site navigation links (Home, Company reviews, Find salaries, etc.)
- Site search bars or job search fields (e.g. "Job title, keywords, or company", "Where")
- Header/footer navigation elements
- Social media links, login/signup buttons unrelated to the application
- Elements inside <nav>, <header>, or <footer> unless they are clearly part of the application form

PAGE PURPOSE:
- Treat account-creation/signup pages as a separate prerequisite step, not the actual application form.
- If the page is for account creation, choose the first empty account setup field (email, password, confirm password) or the continue/create-account button after those fields are filled.

CRITICAL RULES:
- NEVER select a field that already has a value. If an input has a non-empty value="" attribute, or a textarea contains text, or a radio/checkbox is checked, SKIP it.
- ALWAYS traverse the form from TOP TO BOTTOM in DOM order. Pick the FIRST empty required field, not a random one.
- Be aware of CONDITIONAL FIELDS: if a field says "If YES..." or "If you selected...", check whether the preceding field's answer makes it relevant. If the condition is not met (e.g. user answered "No" but the field asks "If YES..."), SKIP the conditional field.
- Prefer semantic signals over guesswork: associated labels, accessible names, fieldset and legend group labels, aria-describedby, autocomplete, input type, name, and id.

Priority order:
1. If this is a listing/landing page (not yet an application form), choose the best job-specific "Apply" action first.
2. Otherwise, find the FIRST (topmost in the page) visible required APPLICATION field that is EMPTY. Go in document order — do not skip ahead. Skip resume upload fields — the user will handle those manually.
3. If no required fields are empty, choose the first empty optional field (but NOT resume uploads).
4. Do NOT select resume upload controls, "autofill from resume" buttons, or file inputs for resumes.
5. Only if ALL visible fields are filled, choose an application action button like "Continue", "Next", "Submit", or "Save".
${
  rules
    ? `
LEARNED RULES for this site (from previous successful interactions):
${rules}

Current step index: ${stepIndex}
- Follow the learned step sequence when applicable.
- If a rule says IGNORE an element, do NOT select that element.
- If a rule says to click/fill at this step index, prefer that element.
`
    : ''
}
Return:
- selector: a CSS selector that uniquely targets the element in the provided HTML.
  - Use IDs, name, aria-label, data-*, role, or type attributes.
  - Do NOT use :contains or other non-standard selectors.
- reason: a short explanation (<= 120 chars) describing why this step is recommended.

If no clear action exists, return an empty selector and reason.
${
  jobContext
    ? `\nSPECIFIC JOB CONTEXT:\n- jobId: ${jobContext.jobId ?? ''}\n- jobLeadId: ${jobContext.jobLeadId ?? ''}\n- title: ${jobContext.title ?? ''}\n- company: ${jobContext.company ?? ''}\n`
    : ''
}
${visionContext ? `\nVISION PRE-ANALYSIS (from AI page review — use this to understand the page context):\n${visionContext}\n` : ''}
${fieldHints ? `\nField hints from previous interactions on this site:\n${fieldHints}\n` : ''}
URL: ${url}

Styles (context):
${styles}

HTML:
${html}
`;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const body = (await request.json()) as {
      html?: string;
      jobContext?: AssistJobContext;
      runtimeSessionId?: string;
      screenshot?: string;
      stepIndex?: number;
      styles?: string;
      url?: string;
    };

    if (!body.url || !body.html) {
      return NextResponse.json(
        { error: 'URL and HTML are required' },
        { status: 400 },
      );
    }

    // Ensure resume knowledge is extracted (no-op after first run)
    void ensureKnowledgeInitialized(user.id);

    const html = body.html.slice(0, MAX_HTML_CHARS);
    const styles = (body.styles ?? '').slice(0, MAX_STYLE_CHARS);
    const stepIndex = body.stepIndex ?? 0;
    const jobContext = body.jobContext;
    const hasSpecificJobIntent = Boolean(
      jobContext?.jobId ||
      jobContext?.jobLeadId ||
      jobContext?.title ||
      jobContext?.company,
    );

    const closedPostingDetail = detectClosedPostingMessageDetailed(html);
    if (closedPostingDetail) {
      try {
        const detectedHostname = new URL(body.url).hostname;
        void recordClosedPostingPhrase({
          hostname: detectedHostname,
          phrase: closedPostingDetail.contextSnippet,
          detectorReason: closedPostingDetail.reason,
          exampleUrl: body.url,
        });
      } catch {
        // URL parse failure — skip capture silently.
      }
      return NextResponse.json(
        buildRecommendationResponse({
          reason: closedPostingDetail.reason,
          selector: '',
          source: {
            kind: 'classification',
            label: 'Closed posting detection',
          },
        }),
      );
    }

    let hostname = '';
    try {
      hostname = new URL(body.url).hostname;
    } catch {}

    // Fetch rules and field hints in parallel (needed by multiple code paths)
    const [fieldHints, flow, rules, runtimeSession]: [
      string,
      ApplicationFlowRecord | null,
      ATSRuleRecord[],
      { runtimeMetadata: Record<string, unknown> | null } | null,
    ] = await Promise.all([
      hostname ? getFieldHints(hostname) : Promise.resolve<string>(''),
      hostname
        ? getFlowDefinition(hostname)
        : Promise.resolve<ApplicationFlowRecord | null>(null),
      hostname ? getRules(hostname) : Promise.resolve<ATSRuleRecord[]>([]),
      body.runtimeSessionId
        ? (db.applicationRuntimeSession.findFirst({
            select: {
              runtimeMetadata: true,
            },
            where: {
              id: body.runtimeSessionId,
              userId: user.id,
            },
          }) as Promise<{
            runtimeMetadata: Record<string, unknown> | null;
          } | null>)
        : Promise.resolve(null),
    ]);

    const flowSignalProfile = getFlowSignalProfile(flow);
    const flowTrustedSubmitControl =
      flow?.metadata?.trustedSubmitControl &&
      typeof flow.metadata.trustedSubmitControl === 'object'
        ? (flow.metadata.trustedSubmitControl as Record<string, unknown>)
        : undefined;
    const trustedSubmitControl =
      runtimeSession?.runtimeMetadata &&
      typeof runtimeSession.runtimeMetadata === 'object'
        ? ((runtimeSession.runtimeMetadata as Record<string, unknown>)
            .trustedSubmitControl as Record<string, unknown> | undefined)
        : undefined;
    const isTrustedSubmitSuppressed =
      trustedSubmitControl?.disabled === true ||
      flowTrustedSubmitControl?.disabled === true;
    const runtimeTrustSourceMeta = getRuntimeTrustSourceMeta(
      runtimeSession?.runtimeMetadata,
    );
    const compiledFlowStep = getPreferredFlowStepForIndex(flow, stepIndex, html);

    if (compiledFlowStep) {
      const selector = getPreferredSelectorForFlowStep(compiledFlowStep, html);
      const isSubmitLikeSelector = selector
        ? isSubmitLikeFlowStep(compiledFlowStep, html, selector)
        : false;
      const canUseCompiledFlowSelector =
        selector &&
        (!isSubmitLikeSelector ||
          (flowSignalProfile.hasStableConfirmationSignal &&
            !flowSignalProfile.hasStableSubmitBlockedSignal));

      if (canUseCompiledFlowSelector && selector) {
        const trustedSubmitPath =
          isSubmitLikeSelector &&
          flowSignalProfile.hasStableConfirmationSignal &&
          !flowSignalProfile.hasStableSubmitBlockedSignal &&
          !isTrustedSubmitSuppressed;
        const label = isSubmitLikeSelector
          ? 'Compiled flow (trusted submit)'
          : 'Compiled flow';
        return NextResponse.json(
          buildRecommendationResponse({
            reason:
              compiledFlowStep.stepLabel?.trim() ||
              `Following compiled flow step ${compiledFlowStep.stepIndex}.`,
            selector,
            source: {
              ...runtimeTrustSourceMeta,
              blockedSignalStrength:
                flowSignalProfile.dominantSubmitBlockedSignalCount,
              confidence: compiledFlowStep.averageConfidence,
              confirmationSignalStrength:
                flowSignalProfile.dominantConfirmationSignalCount,
              flowStatus: flow?.status,
              flowVersion: flow?.version,
              kind: 'rule',
              label,
              ruleStepIndex: compiledFlowStep.stepIndex,
              submitAwareStep: isSubmitLikeSelector,
              trustedSubmitPath,
              trustedSubmitSuppressed: isTrustedSubmitSuppressed,
            },
          }),
        );
      }
    }

    // --- Fast path: deterministic rule match (zero AI calls) ---
    const deterministicRule = getPreferredRuleForStep(rules, stepIndex, html);
    if (deterministicRule) {
      return NextResponse.json(
        buildRecommendationResponse({
          reason:
            deterministicRule.reason?.trim() ||
            `Following learned step ${deterministicRule.stepIndex} rule.`,
          selector: deterministicRule.stableSelector,
          source: {
            ...runtimeTrustSourceMeta,
            confidence: deterministicRule.confidence,
            flowStatus: flow?.status,
            flowVersion: flow?.version,
            kind: 'rule',
            label: 'Learned rule',
            ruleActionType: deterministicRule.actionType,
            ruleStepIndex: deterministicRule.stepIndex,
          },
        }),
      );
    }

    // --- Fast path: deterministic first-empty-field (zero AI calls) ---
    // Try this for ALL steps — it's free and handles most form-filling cases.
    // Only skip on step 0 when we don't have rules (need to classify the page first).
    const hasExistingRules = rules.length > 0;
    if (stepIndex > 0 || hasExistingRules) {
      const firstEmptyField = findFirstEmptyFieldWithReason(html);
      if (firstEmptyField) {
        return NextResponse.json(
          buildRecommendationResponse({
            ...firstEmptyField,
            source: {
              ...runtimeTrustSourceMeta,
              kind: 'deterministic',
              label: 'Deterministic fallback',
            },
          }),
        );
      }
    }

    // --- Vision pre-analysis (only when needed) ---
    // Skip classification when we have rules for this hostname — we already
    // know it's a valid application site and classification is expensive.
    let pageClassification: PageClassification | null = null;
    if (!hasExistingRules && (stepIndex === 0 || body.screenshot)) {
      try {
        const classificationProvider = await getServerAiProvider();
        pageClassification = await classifyPage(
          html,
          body.url,
          body.screenshot ?? null,
          { aiProvider: classificationProvider },
        );

        // Short-circuit for non-application pages
        if (
          pageClassification.pageType === 'job_search' &&
          pageClassification.confidence >= 0.6
        ) {
          if (hasSpecificJobIntent) {
            const applyEntryAction = findPrimaryApplyActionWithReason(html);
            if (applyEntryAction) {
              return NextResponse.json(
                buildRecommendationResponse({
                  ...applyEntryAction,
                  source: {
                    ...runtimeTrustSourceMeta,
                    confidence: pageClassification.confidence,
                    kind: 'classification',
                    label: 'Vision classification',
                  },
                }),
              );
            }
          }
          return NextResponse.json(
            buildRecommendationResponse({
              reason:
                'This appears to be a job search page, not an application form. Navigate to a specific job listing and click Apply to start.',
              selector: '',
              source: {
                ...runtimeTrustSourceMeta,
                confidence: pageClassification.confidence,
                kind: 'classification',
                label: 'Vision classification',
              },
            }),
          );
        }
        if (
          pageClassification.pageType === 'error' &&
          pageClassification.confidence >= 0.6
        ) {
          return NextResponse.json(
            buildRecommendationResponse({
              reason:
                pageClassification.reasoning ||
                'This job posting may no longer be available.',
              selector: '',
              source: {
                ...runtimeTrustSourceMeta,
                confidence: pageClassification.confidence,
                kind: 'classification',
                label: 'Vision classification',
              },
            }),
          );
        }
        if (
          pageClassification.pageType === 'confirmation' &&
          pageClassification.confidence >= 0.6
        ) {
          return NextResponse.json(
            buildRecommendationResponse({
              reason:
                'Application submitted successfully! You can close this window.',
              selector: '',
              source: {
                ...runtimeTrustSourceMeta,
                blockedSignalStrength:
                  flowSignalProfile.dominantSubmitBlockedSignalCount,
                confidence: pageClassification.confidence,
                confirmationSignalStrength:
                  flowSignalProfile.dominantConfirmationSignalCount,
                kind:
                  flowSignalProfile.hasStableConfirmationSignal &&
                  !flowSignalProfile.hasStableSubmitBlockedSignal &&
                  !isTrustedSubmitSuppressed
                    ? 'rule_fallback'
                    : 'classification',
                label:
                  flowSignalProfile.hasStableConfirmationSignal &&
                  !flowSignalProfile.hasStableSubmitBlockedSignal &&
                  !isTrustedSubmitSuppressed
                    ? 'Learned confirmation profile'
                    : 'Vision classification',
                trustedSubmitPath:
                  flowSignalProfile.hasStableConfirmationSignal &&
                  !flowSignalProfile.hasStableSubmitBlockedSignal &&
                  !isTrustedSubmitSuppressed,
                trustedSubmitSuppressed: isTrustedSubmitSuppressed,
              },
            }),
          );
        }
      } catch (classifyError) {
        console.error(
          '[Assist] Page classification failed, continuing with standard analysis:',
          classifyError,
        );
      }
    }

    const hasClassifiedApplicationField = Boolean(
      pageClassification?.applicationFields?.some(
        field => field.isApplicationField,
      ),
    );
    const isLikelyEntryPage =
      !hasClassifiedApplicationField && !hasLikelyApplicationFields(html);
    if (hasSpecificJobIntent && isLikelyEntryPage) {
      const applyEntryAction = findPrimaryApplyActionWithReason(html);
      if (applyEntryAction) {
        return NextResponse.json(
          buildRecommendationResponse({
            ...applyEntryAction,
            source: {
              ...runtimeTrustSourceMeta,
              kind: 'deterministic',
              label: 'Deterministic fallback',
            },
          }),
        );
      }
    }

    // Step 0 without rules: try deterministic field match now (after classification)
    if (stepIndex === 0 && !hasExistingRules) {
      const firstEmptyField = findFirstEmptyFieldWithReason(html);
      if (firstEmptyField) {
        return NextResponse.json(
          buildRecommendationResponse({
            ...firstEmptyField,
            source: {
              ...runtimeTrustSourceMeta,
              kind: 'deterministic',
              label: 'Deterministic fallback',
            },
          }),
        );
      }
    }

    const promptRules = getPromptEligibleRules(rules, html);
    const formattedRules = formatRulesForPrompt(promptRules);

    let result: z.infer<typeof recommendationSchema> = {
      reason: '',
      selector: '',
    };
    try {
      // Build vision context string from page classification
      const visionContext = pageClassification
        ? [
            `Page type: ${pageClassification.pageType} (${Math.round(pageClassification.confidence * 100)}% confidence)`,
            `Analysis: ${pageClassification.reasoning}`,
            pageClassification.nonApplicationElements?.length
              ? `NON-APPLICATION elements to IGNORE: ${pageClassification.nonApplicationElements.join(', ')}`
              : '',
            pageClassification.suggestedNextActionSelector
              ? `Vision suggested next action: ${pageClassification.suggestedNextActionType} on "${pageClassification.suggestedNextActionSelector}" — ${pageClassification.suggestedNextActionReason}`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : undefined;

      const aiProvider = await getServerAiProvider();
      result = await generateAIObject(
        buildPrompt({
          fieldHints,
          html,
          jobContext,
          rules: formattedRules,
          stepIndex,
          styles,
          url: body.url,
          visionContext,
        }),
        recommendationSchema,
        { aiProvider, temperature: 0.2 },
      );
    } catch (aiError) {
      console.error(
        'Assist mode recommendation AI generation failed:',
        aiError,
      );
      const deterministicFallback = findFirstEmptyFieldWithReason(html);
      if (deterministicFallback) {
        return NextResponse.json(
          buildRecommendationResponse({
            ...deterministicFallback,
            source: {
              kind: 'deterministic',
              label: 'Deterministic fallback',
            },
          }),
        );
      }
      const fallbackSelector = findFirstFillableFieldSelector(html);
      return NextResponse.json(
        buildRecommendationResponse({
          reason: fallbackSelector
            ? 'Fill the first required field before continuing.'
            : '',
          selector: fallbackSelector || '',
          source: {
            ...runtimeTrustSourceMeta,
            kind: 'deterministic',
            label: 'Deterministic fallback',
          },
        }),
      );
    }

    let selector = result.selector?.trim() ?? '';
    let reason = result.reason?.trim() ?? '';

    // Clean up verbose AI reasons — use simple field label when targeting a form field
    if (selector && reason) {
      try {
        const $r = load(html);
        const targetEl = $r(selector).first();
        if (targetEl.length > 0) {
          const tag = String(targetEl.prop('tagName') ?? '').toLowerCase();
          if (['input', 'textarea', 'select'].includes(tag)) {
            const id = targetEl.attr('id');
            const labelEl = id ? $r(`label[for="${id}"]`).first().text().trim() : '';
            const fieldLabel =
              labelEl ||
              targetEl.attr('aria-label')?.trim() ||
              targetEl.attr('placeholder')?.trim() ||
              targetEl.attr('name')?.trim() ||
              '';
            if (fieldLabel) {
              const cleanLabel = fieldLabel.replace(/\*+/g, '').trim();
              reason = `Fill in the "${cleanLabel}" field.`;
            }
          }
        }
      } catch {
        // Keep AI-generated reason as fallback
      }
    }

    if (selector && !isRuleSelectorActionableInHtml(html, selector)) {
      selector = '';
    }

    const normalizedSelector = normalizeStableSelector(selector);

    const matchedLowConfidenceContinueRule = rules.find(
      rule =>
        rule.action === 'continue' &&
        normalizeStableSelector(rule.stableSelector) === normalizedSelector &&
        rule.confidence < MIN_ACTIONABLE_RULE_CONFIDENCE,
    );
    if (matchedLowConfidenceContinueRule) {
      const fallbackRule = getPreferredRuleForStep(rules, stepIndex, html);
      selector = fallbackRule?.stableSelector ?? '';
      if (fallbackRule) {
        reason =
          fallbackRule.reason?.trim() ||
          `Following learned step ${fallbackRule.stepIndex} rule.`;
      } else if (compiledFlowStep) {
        selector = getPreferredSelectorForFlowStep(compiledFlowStep, html);
        reason =
          compiledFlowStep.stepLabel?.trim() ||
          `Following compiled flow step ${compiledFlowStep.stepIndex}.`;
      }
    }

    const matchedSkipRule = rules.find(
      rule =>
        rule.action === 'ignore' &&
        normalizeStableSelector(rule.stableSelector) === normalizedSelector &&
        rule.stepIndex <= stepIndex,
    );
    if (matchedSkipRule) {
      const fallbackRule = getPreferredRuleForStep(rules, stepIndex, html);
      if (fallbackRule) {
        selector = fallbackRule.stableSelector;
        reason =
          fallbackRule.reason?.trim() ||
          `Following learned step ${fallbackRule.stepIndex} rule.`;
      } else if (compiledFlowStep) {
        selector = getPreferredSelectorForFlowStep(compiledFlowStep, html);
        reason =
          compiledFlowStep.stepLabel?.trim() ||
          `Following compiled flow step ${compiledFlowStep.stepIndex}.`;
      } else {
        selector = '';
      }
    }

    const deterministicFallback = findFirstEmptyFieldWithReason(html);
    const fallbackFieldSelector =
      deterministicFallback?.selector || findFirstFillableFieldSelector(html);
    const applyEntryAction = hasSpecificJobIntent
      ? findPrimaryApplyActionWithReason(html)
      : null;
    if (
      selector &&
      isNavigationLikeSelectorInHtml(html, selector) &&
      !/\b(apply(\s*now)?|quick\s*apply|easy\s*apply|start\s*application|submit\s*application)\b/i.test(
        reason,
      )
    ) {
      if (applyEntryAction) {
        selector = applyEntryAction.selector;
        reason = applyEntryAction.reason;
      } else if (fallbackFieldSelector) {
        selector = fallbackFieldSelector;
        reason = 'Fill the first required field before navigating further.';
      }
    }

    if (!selector) {
      if (applyEntryAction) {
        selector = applyEntryAction.selector;
        reason = applyEntryAction.reason;
      } else if (deterministicFallback) {
        selector = deterministicFallback.selector;
        reason = deterministicFallback.reason;
      } else if (fallbackFieldSelector) {
        selector = fallbackFieldSelector;
        reason = 'Fill the first required field before continuing.';
      }
    }

    const matchedRule = rules.find(
      rule =>
        normalizeStableSelector(rule.stableSelector) ===
          normalizeStableSelector(selector) && rule.action === 'continue',
    );

    return NextResponse.json(
      buildRecommendationResponse({
        reason,
        selectOptions:
          deterministicFallback &&
          selector === deterministicFallback.selector &&
          deterministicFallback.selectOptions
            ? deterministicFallback.selectOptions
            : undefined,
        selector,
        source: matchedRule
          ? {
              ...runtimeTrustSourceMeta,
              confidence: matchedRule.confidence,
              flowStatus: flow?.status,
              flowVersion: flow?.version,
              kind: 'rule_fallback',
              label: 'Learned rule fallback',
              ruleActionType: matchedRule.actionType,
              ruleStepIndex: matchedRule.stepIndex,
            }
          : compiledFlowStep && selector
            ? {
                ...runtimeTrustSourceMeta,
                blockedSignalStrength:
                  flowSignalProfile.dominantSubmitBlockedSignalCount,
                confidence: compiledFlowStep.averageConfidence,
                confirmationSignalStrength:
                  flowSignalProfile.dominantConfirmationSignalCount,
                flowStatus: flow?.status,
                flowVersion: flow?.version,
                kind: 'rule_fallback',
                label:
                  isSubmitLikeFlowStep(compiledFlowStep, html, selector) &&
                  flowSignalProfile.hasStableConfirmationSignal &&
                  !flowSignalProfile.hasStableSubmitBlockedSignal
                    ? 'Compiled flow submit fallback'
                    : 'Compiled flow fallback',
                ruleStepIndex: compiledFlowStep.stepIndex,
                submitAwareStep: isSubmitLikeFlowStep(
                  compiledFlowStep,
                  html,
                  selector,
                ),
                trustedSubmitPath:
                  isSubmitLikeFlowStep(compiledFlowStep, html, selector) &&
                  flowSignalProfile.hasStableConfirmationSignal &&
                  !flowSignalProfile.hasStableSubmitBlockedSignal &&
                  !isTrustedSubmitSuppressed,
                trustedSubmitSuppressed: isTrustedSubmitSuppressed,
              }
          : {
              ...runtimeTrustSourceMeta,
              kind: 'ai',
              label: 'AI recommendation',
            },
      }),
    );
  } catch (error) {
    console.error('Assist mode recommendation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendation' },
      { status: 500 },
    );
  }
}
