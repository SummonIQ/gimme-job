import { load } from 'cheerio';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { rejectNonReconstructionSource } from '@/app/api/_lib/reconstruction-source-guard';
import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import { analyzePageWithVision } from '@/lib/assist-training/vision-analyzer';
import { embedRule } from '@/lib/ai/embeddings';
import { db } from '@/lib/db/client';
import { upsertFlowNode } from '@/lib/flow-state/upsert-node';
import { upsertATSFieldObservation } from '@/lib/runtime-provenance';
import { getCurrentUser } from '@/lib/user/query';

const analyzeStepSchema = z.object({
  html: z.string().min(10),
  source: z.unknown().optional(),
  url: z.string().url(),
  stepIndex: z.number().int().min(0),
});

/**
 * Client-driven training step. The client (embedded browser view) sends
 * the rendered HTML here. We parse it with cheerio to detect fields —
 * no AI vision call, no GPT credits burned. Just structural HTML parsing.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;
    const body = analyzeStepSchema.parse(await request.json());

    const forbiddenSource = rejectNonReconstructionSource(body.source);
    if (forbiddenSource) return forbiddenSource;

    const session = await db.assistTrainingSession.findFirst({
      where: { id: sessionId, userId: user.id },
      select: {
        id: true,
        hostname: true,
        atsSystemId: true,
        completedSteps: true,
        totalSteps: true,
        observationsCreated: true,
        rulesPromoted: true,
        stepLogs: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      );
    }

    // Parse HTML with cheerio to detect fields — same approach as field-plan
    const $ = load(body.html);
    const fieldQuery =
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), textarea, select';

    const fields: Array<{
      selector: string;
      label: string;
      tagName: string;
      inputType: string | null;
      fieldName: string | null;
      ariaLabel: string | null;
      placeholder: string | null;
      autocomplete: string | null;
      required: boolean;
      isEmpty: boolean;
    }> = [];

    const seenSelectors = new Set<string>();

    $(fieldQuery).each((_, el) => {
      const $el = $(el);
      const tagName = String($el.prop('tagName') ?? '').toLowerCase();
      const type = ($el.attr('type') ?? '').toLowerCase();

      // Skip hidden/disabled
      const style = ($el.attr('style') ?? '').toLowerCase();
      if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(style)) return;
      if ($el.attr('disabled') !== undefined) return;
      if ($el.attr('aria-hidden') === 'true') return;

      // Build selector
      const id = $el.attr('id');
      const name = $el.attr('name');
      const ariaLabel = $el.attr('aria-label')?.trim() ?? null;
      let selector = '';
      if (id) selector = `${tagName}#${id}`;
      else if (name) selector = `${tagName}[name="${name}"]`;
      else if (ariaLabel) selector = `${tagName}[aria-label="${ariaLabel}"]`;
      else return; // Can't build a stable selector

      if (seenSelectors.has(selector)) return;
      seenSelectors.add(selector);

      // Get label
      let label = '';
      if (id) {
        label = $(`label[for="${id}"]`).first().text().trim();
      }
      if (!label) label = $el.closest('label').text().trim();
      if (!label && ariaLabel) label = ariaLabel;
      if (!label) label = $el.attr('placeholder')?.trim() ?? '';
      if (!label && name) label = name;
      if (!label) label = tagName;

      // Check emptiness
      const val = ($el.attr('value') ?? $el.text() ?? '').trim();
      const isEmpty = tagName === 'select'
        ? !val || /^select/i.test(val)
        : val === '';

      fields.push({
        selector,
        label,
        tagName,
        inputType: tagName === 'input' ? type || 'text' : null,
        fieldName: name ?? null,
        ariaLabel,
        placeholder: $el.attr('placeholder')?.trim() ?? null,
        autocomplete: $el.attr('autocomplete')?.trim() ?? null,
        required: $el.is('[required]') || $el.attr('aria-required') === 'true',
        isEmpty,
      });
    });

    // Also detect submit/apply/continue buttons
    const buttons: Array<{ selector: string; label: string }> = [];
    $('button, input[type="submit"], a').each((_, el) => {
      const $el = $(el);
      const text = ($el.text() ?? '').trim().replace(/\s+/g, ' ');
      if (!text) return;
      if (!/\b(apply|submit|continue|next|save)\b/i.test(text)) return;
      const id = $el.attr('id');
      const selector = id
        ? `#${id}`
        : $el.attr('data-testid')
          ? `[data-testid="${$el.attr('data-testid')}"]`
          : '';
      if (selector) {
        buttons.push({ selector, label: text });
      }
    });

    // Determine page type from cheerio
    const isJobListing = fields.length <= 2 &&
      $('a, button').filter((_, el) =>
        /\bapply\b/i.test($(el).text() ?? ''),
      ).length > 0;
    let pageType = isJobListing
      ? 'job_listing'
      : fields.length > 0
        ? 'application_form'
        : 'other';

    // Also run AI analysis on the HTML for deeper insights — page type
    // classification, next-action detection, field labeling that cheerio
    // can't do (e.g. detecting which field is "First Name" vs "Last Name"
    // from context). AI supplements cheerio, doesn't replace it.
    let aiAnalysis: Awaited<ReturnType<typeof analyzePageWithVision>> | null = null;
    try {
      aiAnalysis = await analyzePageWithVision('', body.html, body.url);
      // Let AI override page type if it has a stronger opinion
      if (aiAnalysis.pageType && aiAnalysis.pageType !== 'other') {
        pageType = aiAnalysis.pageType;
      }
      // Merge any AI-detected fields that cheerio missed (e.g. custom
      // web components, shadow DOM inputs, JS-rendered fields)
      for (const aiField of aiAnalysis.fields) {
        if (!seenSelectors.has(aiField.selector)) {
          seenSelectors.add(aiField.selector);
          fields.push({
            selector: aiField.selector,
            label: aiField.label || aiField.fieldDisplayName || '',
            tagName: aiField.fieldType === 'select' ? 'select' : aiField.fieldType === 'textarea' ? 'textarea' : 'input',
            inputType: aiField.fieldType === 'select' || aiField.fieldType === 'textarea' ? null : aiField.fieldType,
            fieldName: null,
            ariaLabel: null,
            placeholder: null,
            autocomplete: null,
            required: aiField.isRequired,
            isEmpty: aiField.isEmpty,
          });
        }
      }
    } catch (err) {
      console.warn('[AnalyzeStep] AI analysis failed, continuing with cheerio results:', err);
    }

    // Upsert flow node
    let flowNodeId: string | null = null;
    try {
      const node = await upsertFlowNode({
        atsSystemId: session.atsSystemId ?? null,
        hostname: session.hostname,
        html: body.html,
        nodeLabel: pageType,
      });
      flowNodeId = node.id;
    } catch {
      // Non-fatal
    }

    // Record observations for each field
    let observationsCreated = session.observationsCreated;
    let rulesPromoted = session.rulesPromoted;
    const pathname = new URL(body.url).pathname;

    for (const field of fields) {
      try {
        const actionType = field.tagName === 'select' ? 'fill' : 'fill';
        const observation = await upsertATSFieldObservation({
          where: {
            unique_observation: {
              hostname: session.hostname,
              stableSelector: field.selector,
              action: 'continue',
              actionType,
            },
          },
          update: {
            observationCount: { increment: 1 },
            pathname,
            fieldDisplayName: field.label || undefined,
            success: true,
            stepIndex: body.stepIndex,
            sessionId,
          },
          create: {
            userId: user.id,
            hostname: session.hostname,
            pathname,
            atsSystemId: session.atsSystemId,
            selector: field.selector,
            stableSelector: field.selector,
            tagName: field.tagName,
            inputType: field.inputType,
            fieldName: field.fieldName,
            fieldLabel: field.label || null,
            fieldDisplayName: field.label || null,
            ariaLabel: field.ariaLabel,
            placeholder: field.placeholder,
            autocomplete: field.autocomplete,
            stepIndex: body.stepIndex,
            sessionId,
            source: ApplicationRuntimeSource.RECONSTRUCTION,
            action: 'continue',
            actionType,
            success: true,
          },
        });

        observationsCreated++;

        // Auto-promote to rule at threshold
        if (observation.observationCount >= 4 && field.selector) {
          const rule = await db.aTSRule.upsert({
            where: {
              unique_rule: {
                hostname: session.hostname,
                stableSelector: field.selector,
                action: 'continue',
              },
            },
            update: {
              observationCount: observation.observationCount,
              stepIndex: body.stepIndex,
              confidence: Math.min(1.0, observation.observationCount / 10),
            },
            create: {
              hostname: session.hostname,
              atsSystemId: session.atsSystemId,
              action: 'continue',
              actionType,
              stableSelector: field.selector,
              tagName: field.tagName,
              fieldLabel: field.label || null,
              stepIndex: body.stepIndex,
              observationCount: observation.observationCount,
              confidence: Math.min(1.0, observation.observationCount / 10),
            },
            select: { id: true },
          });
          void embedRule(rule.id).catch(error => {
            console.warn('[analyze-step] embed rule failed', error);
          });
          rulesPromoted++;
        }
      } catch (err) {
        console.warn('[AnalyzeStep] Observation error:', err);
      }
    }

    // Build step log
    const stepLog = {
      stepIndex: body.stepIndex,
      timestamp: new Date().toISOString(),
      url: body.url,
      pageType,
      fieldsDetected: fields.length,
      buttonsDetected: buttons.length,
      actionsPerformed: fields.map(f => ({
        selector: f.selector,
        action: 'fill',
        actionType: 'fill',
        label: f.label,
        value: '',
        success: true,
        confidence: 1,
      })),
      observationsRecorded: fields.length,
    };

    // Detect if this page has a submit/apply button (terminal state)
    const hasSubmitButton = buttons.some(b =>
      /\b(submit|apply\s*(now)?|send\s*application)\b/i.test(b.label),
    );

    // Update session — don't auto-complete unless a submit button is found.
    // The client controls when to mark the session as complete.
    const existingLogs = (session.stepLogs ?? []) as Record<string, unknown>[];
    await db.assistTrainingSession.update({
      where: { id: sessionId },
      data: {
        ...(hasSubmitButton
          ? { status: 'completed', completedAt: new Date(), progress: 100 }
          : { progress: Math.min(99, ((body.stepIndex + 1) / session.totalSteps) * 100) }),
        completedSteps: body.stepIndex + 1,
        observationsCreated,
        rulesPromoted,
        stepLogs: [...existingLogs, stepLog] as unknown as import('@/generated/prisma/browser').Prisma.InputJsonValue[],
      },
    });

    return NextResponse.json({
      pageType,
      fieldsDetected: fields.length,
      buttonsDetected: buttons.length,
      observationsCreated: fields.length,
      rulesPromoted: rulesPromoted - session.rulesPromoted,
      flowNodeId,
      fields: fields.map(f => ({
        selector: f.selector,
        label: f.label,
        type: f.inputType ?? f.tagName,
        required: f.required,
        isEmpty: f.isEmpty,
      })),
      buttons,
    });
  } catch (error) {
    console.error('[AnalyzeStep] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? 'Invalid request body'
            : 'Failed to analyze step',
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
