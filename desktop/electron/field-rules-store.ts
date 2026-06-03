/**
 * Field-rules store. Persists per-question answer overrides the user has
 * either explicitly set ("when you see X, answer Y") or implicitly taught
 * the agent by manually correcting a field in the State tab. The submit
 * runtime checks this store before calling the LLM resolver, so saved
 * rules turn into instant fills with no model spend.
 *
 * Rules are stored in `userData/field-rules.json` as a flat list — the
 * file is small (one row per teaching moment) and trivial to inspect or
 * hand-edit. Pattern matching is case-insensitive substring on the
 * question text, optionally scoped to a hostname so e.g. "are you
 * currently authorized?" can have different answers on different ATSes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { app } from 'electron';

const RULES_FILE = 'field-rules.json';
const PROMOTION_HOSTNAME_THRESHOLD = 3;

export interface FieldRule {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly hostname: string | null;
  readonly source: 'manual' | 'state-tab' | 'chat';
  readonly createdAt: string;
}

let cache: FieldRule[] | null = null;

// Optional callback for syncing rule writes to the server. Set by
// main.ts at boot once the submitClient is available; nullable so
// tests / preflight can construct rules without a network dependency.
type RuleSyncFn = (rule: FieldRule) => Promise<void>;
let syncFn: RuleSyncFn | null = null;
type RuleDeleteFn = (id: string, hostname: string | null, question: string) => Promise<void>;
let deleteFn: RuleDeleteFn | null = null;

export function configureFieldRuleSync(
  sync: RuleSyncFn | null,
  remove: RuleDeleteFn | null = null,
): void {
  syncFn = sync;
  deleteFn = remove;
}

function rulesFilePath(): string {
  return path.join(app.getPath('userData'), RULES_FILE);
}

function loadFromDisk(): FieldRule[] {
  try {
    const raw = fs.readFileSync(rulesFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        if (
          !item ||
          typeof item !== 'object' ||
          typeof item.id !== 'string' ||
          typeof item.question !== 'string' ||
          typeof item.answer !== 'string'
        ) {
          return null;
        }
        const record = item as Record<string, unknown>;
        return {
          id: record.id as string,
          question: record.question as string,
          answer: record.answer as string,
          hostname:
            typeof record.hostname === 'string' ? record.hostname : null,
          source:
            record.source === 'state-tab' || record.source === 'chat'
              ? record.source
              : 'manual',
          createdAt:
            typeof record.createdAt === 'string'
              ? record.createdAt
              : new Date().toISOString(),
        } satisfies FieldRule;
      })
      .filter((rule): rule is FieldRule => rule !== null);
  } catch {
    return [];
  }
}

function persistToDisk(rules: readonly FieldRule[]): void {
  try {
    fs.writeFileSync(
      rulesFilePath(),
      JSON.stringify(rules, null, 2),
      'utf8',
    );
  } catch (error) {
    console.warn('[field-rules] write failed:', error);
  }
}

export function getAllFieldRules(): readonly FieldRule[] {
  if (!cache) cache = loadFromDisk();
  return cache;
}

export function findMatchingFieldRule(
  question: string,
  hostname: string | null,
): FieldRule | null {
  const rules = getAllFieldRules();
  if (rules.length === 0) return null;
  const normalized = question.trim().toLowerCase();
  if (!normalized) return null;

  // Prefer hostname-scoped exact-question matches, then global exact, then
  // hostname-scoped substring, then global substring. Stops at the first
  // bucket with a hit so per-host overrides shadow global rules.
  const buckets: ((rule: FieldRule) => boolean)[] = [
    rule =>
      rule.hostname === hostname &&
      rule.question.trim().toLowerCase() === normalized,
    rule => !rule.hostname && rule.question.trim().toLowerCase() === normalized,
    rule =>
      rule.hostname === hostname &&
      normalized.includes(rule.question.trim().toLowerCase()),
    rule =>
      !rule.hostname &&
      normalized.includes(rule.question.trim().toLowerCase()),
  ];
  for (const predicate of buckets) {
    const match = rules.find(predicate);
    if (match) return match;
  }
  return null;
}

export function addFieldRule(input: {
  question: string;
  answer: string;
  hostname?: string | null;
  source?: FieldRule['source'];
}): FieldRule {
  const rules = [...getAllFieldRules()];
  const trimmedQuestion = input.question.trim();
  const trimmedAnswer = input.answer.trim();
  const hostname = input.hostname?.trim() || null;

  // Replace any prior rule for the same (question, hostname) — newest wins.
  const filtered = rules.filter(
    rule =>
      !(
        rule.question.trim().toLowerCase() === trimmedQuestion.toLowerCase() &&
        rule.hostname === hostname
      ),
  );

  const rule: FieldRule = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: trimmedQuestion,
    answer: trimmedAnswer,
    hostname,
    source: input.source ?? 'manual',
    createdAt: new Date().toISOString(),
  };
  filtered.unshift(rule);
  cache = filtered;
  persistToDisk(filtered);
  promoteFieldRules();
  // Best-effort server sync — we never block the local write on it,
  // and a network failure here just means the rule is desktop-local
  // until the next add (the server has its own dedupe).
  if (syncFn && getAllFieldRules().some(current => current.id === rule.id)) {
    void syncFn(rule).catch(error => {
      console.warn('[field-rules] server sync failed:', error);
    });
  }
  return rule;
}

export function promoteFieldRules(): void {
  const rules = [...getAllFieldRules()];
  const promotions = findPromotions(rules);
  if (promotions.length === 0) return;

  const promotedQuestionKeys = new Set(
    promotions.map(promotion => promotion.questionKey),
  );
  const removedScopedRules = rules.filter(
    rule =>
      rule.hostname && promotedQuestionKeys.has(normalizeRuleText(rule.question)),
  );
  const existingPromotedGlobals = new Set(
    rules
      .filter(rule => !rule.hostname)
      .map(
        rule =>
          `${normalizeRuleText(rule.question)}\n${normalizeRuleText(rule.answer)}`,
      ),
  );
  const createdGlobals = promotions
    .filter(
      promotion =>
        !existingPromotedGlobals.has(
          `${promotion.questionKey}\n${promotion.answerKey}`,
        ),
    )
    .map(promotion => createPromotedGlobalRule(promotion.template));
  const createdGlobalKeys = new Set(
    createdGlobals.map(
      rule =>
        `${normalizeRuleText(rule.question)}\n${normalizeRuleText(rule.answer)}`,
    ),
  );
  const nextRules = [
    ...createdGlobals,
    ...rules.filter(rule => {
      if (
        rule.hostname &&
        promotedQuestionKeys.has(normalizeRuleText(rule.question))
      ) {
        return false;
      }
      if (!rule.hostname) {
        const key = `${normalizeRuleText(rule.question)}\n${normalizeRuleText(
          rule.answer,
        )}`;
        return !createdGlobalKeys.has(key);
      }
      return true;
    }),
  ];

  cache = nextRules;
  persistToDisk(nextRules);
  for (const rule of createdGlobals) {
    if (syncFn) {
      void syncFn(rule).catch(error => {
        console.warn('[field-rules] promoted rule sync failed:', error);
      });
    }
  }
  if (deleteFn) {
    for (const rule of removedScopedRules) {
      void deleteFn(rule.id, rule.hostname, rule.question).catch(error => {
        console.warn('[field-rules] promoted rule delete failed:', error);
      });
    }
  }
}

export function removeFieldRule(id: string): boolean {
  const rules = getAllFieldRules();
  const removed = rules.find(rule => rule.id === id) ?? null;
  const next = rules.filter(rule => rule.id !== id);
  if (next.length === rules.length) return false;
  cache = next;
  persistToDisk(next);
  if (removed && deleteFn) {
    void deleteFn(removed.id, removed.hostname, removed.question).catch(
      error => {
        console.warn('[field-rules] server delete failed:', error);
      },
    );
  }
  return true;
}

// Hydrate the local rule cache from the server. Called at desktop boot
// so a rule taught on a different desktop install (or via the web)
// becomes available without an explicit re-teach.
export function hydrateRulesFromServer(rules: readonly FieldRule[]): void {
  if (!Array.isArray(rules)) return;
  // Merge: prefer existing local entries on tie (newest wins) but pull
  // in any server rules we don't have locally.
  const existing = getAllFieldRules();
  const seen = new Set<string>();
  const merged: FieldRule[] = [];
  for (const rule of [...existing, ...rules]) {
    const key = `${rule.hostname ?? '*'}\n${rule.question.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(rule);
  }
  cache = merged;
  persistToDisk(merged);
}

interface FieldRulePromotion {
  readonly answerKey: string;
  readonly questionKey: string;
  readonly template: FieldRule;
}

function findPromotions(rules: readonly FieldRule[]): FieldRulePromotion[] {
  const scopedByQuestion = new Map<string, FieldRule[]>();
  for (const rule of rules) {
    if (!rule.hostname) continue;
    const questionKey = normalizeRuleText(rule.question);
    const answerKey = normalizeRuleText(rule.answer);
    if (!questionKey || !answerKey) continue;
    scopedByQuestion.set(questionKey, [
      ...(scopedByQuestion.get(questionKey) ?? []),
      rule,
    ]);
  }

  const promotions: FieldRulePromotion[] = [];
  for (const [questionKey, scopedRules] of scopedByQuestion) {
    const answerKeys = new Set(
      scopedRules.map(rule => normalizeRuleText(rule.answer)),
    );
    if (answerKeys.size !== 1) continue;

    const hostnames = new Set(
      scopedRules
        .map(rule => rule.hostname?.trim().toLowerCase() ?? '')
        .filter(Boolean),
    );
    if (hostnames.size < PROMOTION_HOSTNAME_THRESHOLD) continue;

    const answerKey = [...answerKeys][0];
    const existingGlobal = rules.find(
      rule =>
        !rule.hostname &&
        normalizeRuleText(rule.question) === questionKey &&
        normalizeRuleText(rule.answer) !== answerKey,
    );
    if (existingGlobal) continue;

    promotions.push({
      answerKey,
      questionKey,
      template: scopedRules[0],
    });
  }
  return promotions;
}

function createPromotedGlobalRule(template: FieldRule): FieldRule {
  return {
    ...template,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    hostname: null,
    createdAt: new Date().toISOString(),
  };
}

function normalizeRuleText(value: string): string {
  return value.trim().toLowerCase();
}
