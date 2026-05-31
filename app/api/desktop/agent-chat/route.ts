import { NextResponse } from 'next/server';
import { generateText, stepCountIs, tool, type ModelMessage } from 'ai';
import { z } from 'zod';

import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';
import { validateToken } from '@/lib/desktop-tokens';
import { embedFormFieldFeedback } from '@/lib/ai/embeddings';
import { getModels, type AiProvider } from '@/lib/ai/models';
import { upsertRulePromotionCandidate } from '@/lib/runtime-learning';

const TRAINING_CORRECTION_ACTIONS = {
  FILL: 'fill',
  SELECT: 'select',
} as const;

const chatMessageSchema = z.object({
  content: z.string().min(1).max(8_000),
  role: z.enum(['assistant', 'user']),
});

const fieldSchema = z
  .object({
    ariaLabel: z.string().nullable().optional(),
    checked: z.boolean().nullable().optional(),
    disabled: z.boolean().optional(),
    inputType: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    selector: z.string(),
    tagName: z.string(),
    value: z.string().nullable().optional(),
    visible: z.boolean().optional(),
    wasAutofilled: z
      .object({
        action: z.string(),
        ok: z.boolean(),
        reason: z.string().optional(),
        value: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const issueSchema = z
  .object({
    fieldSelector: z.string().optional(),
    message: z.string(),
    severity: z.enum(['info', 'warning']),
  })
  .passthrough();

const contextSchema = z
  .object({
    capturedAt: z.string(),
    fields: z.array(fieldSchema),
    issues: z.array(issueSchema),
    lastSubmitResult: z.unknown().nullable(),
    screenshotDataUrl: z.string().nullable(),
    title: z.string(),
    url: z.string(),
  })
  .passthrough();

const requestSchema = z.object({
  aiProvider: z.enum(['openai', 'ollama']).optional(),
  allowTrainingWrite: z.boolean().default(false),
  context: contextSchema,
  messages: z.array(chatMessageSchema).min(1).max(20),
});

interface DesktopAgentChatMutation {
  readonly message: string;
  readonly selector?: string;
  readonly type: 'training_correction';
}

export async function POST(request: Request) {
  const rawToken = readBearerToken(request);

  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  const parsedRequest = requestSchema.safeParse(await request.json());
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: parsedRequest.error.issues[0]?.message ?? 'Invalid payload' },
      { status: 400 },
    );
  }

  const body = parsedRequest.data;
  const hostname = readHostname(body.context.url);
  const mutations: DesktopAgentChatMutation[] = [];

  const system = buildSystemPrompt({
    allowTrainingWrite: body.allowTrainingWrite,
    hostname,
  });
  const tools = createAgentTools({
    allowTrainingWrite: body.allowTrainingWrite,
    context: body.context,
    hostname,
    mutations,
    userId: validation.token.userId,
  });
  const provider: AiProvider = body.aiProvider ?? 'openai';
  const result = await generateAgentText({
    context: body.context,
    messages: body.messages,
    provider,
    system,
    tools,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: `Desktop agent chat failed: ${result.error}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    content: result.text || 'I checked the current page context.',
    mutations,
  });
}

function createAgentTools(input: {
  readonly allowTrainingWrite: boolean;
  readonly context: z.infer<typeof contextSchema>;
  readonly hostname: string | null;
  readonly mutations: DesktopAgentChatMutation[];
  readonly userId: string;
}) {
  return {
    recordTrainingCorrection: tool({
      description:
        'Record a user-approved correction for the job application automation training data. Use only when the user explicitly asks to fix, correct, remember, or train a field behavior.',
      inputSchema: z.object({
        expectedValue: z.string().optional(),
        fieldLabel: z.string().optional(),
        fieldName: z.string().optional(),
        observedValue: z.string().optional(),
        reason: z.string().min(1),
        selector: z.string().min(1),
        action: z
          .enum([
            TRAINING_CORRECTION_ACTIONS.FILL,
            TRAINING_CORRECTION_ACTIONS.SELECT,
          ])
          .optional(),
      }),
      execute: async toolInput => {
        if (!input.allowTrainingWrite) {
          return {
            saved: false,
            reason: 'Training writes are disabled for this chat turn.',
          };
        }

        if (!input.hostname) {
          return {
            saved: false,
            reason: 'The current ATS page URL does not have a valid hostname.',
          };
        }

        const matchingField = findContextField(
          input.context,
          toolInput.selector,
        );
        const correctionLabel =
          toolInput.fieldLabel ?? matchingField?.label ?? null;
        const correctionValue =
          toolInput.expectedValue ?? matchingField?.value ?? null;
        const correctionHostname = normalizeHostname(input.hostname);
        await upsertRulePromotionCandidate({
          actionType: 'user_override',
          fieldLabel: correctionLabel,
          fieldName: toolInput.fieldName ?? matchingField?.name ?? null,
          hostname: correctionHostname,
          reason: buildCorrectionReason(toolInput),
          selector: toolInput.selector,
          source: ApplicationRuntimeSource.OWNER_OVERRIDE,
          success: false,
          userId: input.userId,
        });

        // Closing the loop: also persist this correction as a user-scoped
        // formFieldFeedback row. The LLM resolver (loadFieldFeedback) reads
        // these on every field-answer call and inlines them into the
        // prompt — so a chat-driven "always answer X with Y" instantly
        // shapes future runs without needing the rule-promotion pipeline.
        if (
          correctionLabel &&
          correctionLabel.trim().length >= 4 &&
          correctionValue &&
          correctionValue.trim().length > 0
        ) {
          try {
            const existingFeedback = await db.formFieldFeedback.findFirst({
              where: {
                userId: input.userId,
                hostname: correctionHostname,
                fieldLabel: correctionLabel,
              },
              orderBy: { updatedAt: 'desc' },
              select: { id: true },
            });
            const feedbackData = {
              feedback: 'chat_training_correction',
              fieldType: matchingField?.fieldType ?? null,
              filledValue: correctionValue,
              rejectReason:
                toolInput.observedValue && toolInput.observedValue.trim()
                  ? `Replaced "${toolInput.observedValue.trim()}" via chat correction`
                  : null,
              status: 'approved' as const,
            };
            if (existingFeedback) {
              await db.formFieldFeedback.update({
                data: feedbackData,
                where: { id: existingFeedback.id },
              });
              void embedFormFieldFeedback(existingFeedback.id).catch(
                error => {
                  console.warn('[agent-chat] embed failed', error);
                },
              );
            } else {
              const createdFeedback = await db.formFieldFeedback.create({
                data: {
                  ...feedbackData,
                  fieldLabel: correctionLabel,
                  hostname: correctionHostname,
                  userId: input.userId,
                },
                select: { id: true },
              });
              void embedFormFieldFeedback(createdFeedback.id).catch(
                error => {
                  console.warn('[agent-chat] embed failed', error);
                },
              );
            }
          } catch (error) {
            console.warn(
              '[agent-chat] formFieldFeedback write from training correction failed:',
              error,
            );
          }
        }

        const mutation = {
          message: `Recorded correction for ${toolInput.fieldLabel ?? toolInput.selector}.`,
          selector: toolInput.selector,
          type: 'training_correction' as const,
        };
        input.mutations.push(mutation);

        return { saved: true, ...mutation };
      },
    }),
  };
}

function findContextField(
  context: z.infer<typeof contextSchema>,
  selector: string,
): z.infer<typeof fieldSchema> | null {
  return context.fields.find(field => field.selector === selector) ?? null;
}

async function generateAgentText(input: {
  readonly context: z.infer<typeof contextSchema>;
  readonly messages: readonly z.infer<typeof chatMessageSchema>[];
  readonly provider: AiProvider;
  readonly system: string;
  readonly tools: ReturnType<typeof createAgentTools>;
}): Promise<
  | { readonly ok: true; readonly text: string }
  | { readonly error: string; readonly ok: false }
> {
  const model = getModels(input.provider).primary;
  const modelLabel = describeModel(input.provider, model);
  const commonOptions = {
    maxOutputTokens: 900,
    model,
    stopWhen: stepCountIs(3),
    system: input.system,
    temperature: 0.2,
    tools: input.tools,
  };

  // Default Ollama models (llama3.1, qwen2.5) don't accept image inputs. Skip
  // the screenshot leg for ollama — the model would either reject the request
  // or silently ignore the image.
  const canUseScreenshot = input.provider !== 'ollama';

  if (canUseScreenshot) {
    try {
      const result = await generateText({
        ...commonOptions,
        messages: buildModelMessages(input.messages, input.context, {
          includeScreenshot: true,
        }),
      });
      return { ok: true, text: result.text };
    } catch (error) {
      if (!input.context.screenshotDataUrl) {
        return { error: formatModelError(modelLabel, error), ok: false };
      }
    }
  }

  try {
    const result = await generateText({
      ...commonOptions,
      messages: buildModelMessages(input.messages, input.context, {
        includeScreenshot: false,
      }),
    });
    return { ok: true, text: result.text };
  } catch (error) {
    return { error: formatModelError(modelLabel, error), ok: false };
  }
}

function describeModel(provider: AiProvider, model: unknown): string {
  if (typeof model === 'string') return `${provider}:${model}`;
  const modelId =
    model && typeof model === 'object' && 'modelId' in model
      ? String((model as { modelId?: unknown }).modelId ?? 'unknown')
      : 'unknown';
  return `${provider}:${modelId}`;
}

function formatModelError(modelLabel: string, error: unknown): string {
  const base = readErrorMessage(error);
  // P17.19 — surface the provider+model whenever the upstream error is
  // opaque (e.g. a bare "Not Found" from Ollama when the configured model
  // isn't pulled, or from OpenAI when the model id is wrong). The label
  // tells the user exactly which knob to turn.
  return base.includes(modelLabel) ? base : `[${modelLabel}] ${base}`;
}

function buildSystemPrompt(input: {
  readonly allowTrainingWrite: boolean;
  readonly hostname: string | null;
}): string {
  return [
    'You are the Gimme Job desktop application chat agent.',
    'You help diagnose job application autofill and submission issues from the current ATS page context.',
    'Use the supplied DOM field values, recent autofill attempts, submit result, detected issues, and screenshot. Mention concrete field labels/selectors when useful.',
    'Do not claim you clicked, submitted, or changed the live page. This chat can only explain issues and, when allowed, record training corrections.',
    input.allowTrainingWrite
      ? 'Training correction writes are enabled. If the user explicitly asks you to correct/teach/fix automation behavior, call recordTrainingCorrection for the single most relevant field.'
      : 'Training correction writes are disabled. If the user asks for a correction write, explain that the Allow training corrections control must be enabled first.',
    input.hostname ? `Current hostname: ${input.hostname}.` : '',
    'Keep replies concise and action-oriented.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildModelMessages(
  messages: readonly z.infer<typeof chatMessageSchema>[],
  context: z.infer<typeof contextSchema>,
  options: { readonly includeScreenshot: boolean },
): ModelMessage[] {
  const previousMessages = messages.slice(0, -1).map(message => ({
    content: message.content,
    role: message.role,
  })) satisfies ModelMessage[];
  const latestMessage = messages[messages.length - 1];
  const contextText = [
    'Current desktop ATS context:',
    summarizeContext(context),
    '',
    `User message: ${latestMessage.content}`,
  ].join('\n');

  return [
    ...previousMessages,
    options.includeScreenshot && context.screenshotDataUrl
      ? {
          content: [
            { text: contextText, type: 'text' },
            {
              image: context.screenshotDataUrl,
              mediaType: 'image/png',
              type: 'image',
            },
          ],
          role: 'user',
        }
      : {
          content: contextText,
          role: 'user',
        },
  ] satisfies ModelMessage[];
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown model error';
}

function summarizeContext(context: z.infer<typeof contextSchema>): string {
  const visibleFields = context.fields.filter(field => field.visible !== false);
  const fieldLines = visibleFields.slice(0, 80).map((field, index) => {
    const value = field.value?.trim()
      ? `"${truncate(field.value, 160)}"`
      : '(empty)';
    const autofill = field.wasAutofilled
      ? ` autofilled=${field.wasAutofilled.action}:${field.wasAutofilled.ok ? 'ok' : 'failed'} value="${truncate(field.wasAutofilled.value ?? '', 120)}"`
      : '';

    return [
      `${index + 1}.`,
      field.label ?? field.name ?? field.ariaLabel ?? '(unlabeled)',
      `selector=${field.selector}`,
      `type=${field.tagName}${field.inputType ? `/${field.inputType}` : ''}`,
      `required=${field.required === true}`,
      `disabled=${field.disabled === true}`,
      `value=${value}`,
      field.options?.length
        ? `options=${field.options.slice(0, 12).join(' | ')}`
        : '',
      autofill,
    ]
      .filter(Boolean)
      .join(' ');
  });

  const issueLines = context.issues.map(
    issue =>
      `- ${issue.severity}: ${issue.message}${
        issue.fieldSelector ? ` (${issue.fieldSelector})` : ''
      }`,
  );

  return [
    `URL: ${context.url}`,
    `Title: ${context.title}`,
    `Captured at: ${context.capturedAt}`,
    `Detected issues:\n${issueLines.length ? issueLines.join('\n') : '- none detected locally'}`,
    `Visible fields:\n${fieldLines.length ? fieldLines.join('\n') : '- none detected'}`,
    `Last submit result:\n${truncate(safeJson(context.lastSubmitResult), 5_000)}`,
  ].join('\n\n');
}

function buildCorrectionReason(input: {
  readonly expectedValue?: string;
  readonly observedValue?: string;
  readonly reason: string;
}): string {
  const details = [
    input.reason,
    input.observedValue ? `Observed: ${input.observedValue}` : null,
    input.expectedValue ? `Expected: ${input.expectedValue}` : null,
  ].filter(Boolean);

  return `Desktop chat correction: ${details.join(' | ')}`;
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}

function readHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '(unavailable)';
  }
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1)}...`
    : value;
}
