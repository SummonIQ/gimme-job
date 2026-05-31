import { generateObject, generateText, streamText } from 'ai';
import { z } from 'zod';

import { getModels, type AiProvider } from './models';
import { models } from './models';

// Export raw OpenAI client for direct API usage (portfolio features)
export { openai } from './openai';

// Re-export models for direct use
export { models } from './models';
export { getModels, type AiProvider } from './models';

export const ai = models.primary;

interface BaseAiOptions {
  readonly aiProvider?: AiProvider;
  readonly temperature?: number;
}

interface ScopedAiOptions extends BaseAiOptions {
  readonly system?: string;
  readonly tier?: 'fast' | 'primary' | 'strong';
}

function pickModel(options?: ScopedAiOptions) {
  const tier = options?.tier ?? 'primary';
  const provider = options?.aiProvider ?? 'openai';
  return getModels(provider)[tier];
}

export async function generateAIText(
  prompt: string,
  options?: ScopedAiOptions,
) {
  const result = await generateText({
    model: pickModel(options),
    prompt,
    system: options?.system,
    temperature: options?.temperature ?? 0.7,
  });

  return result.text;
}

export async function generateAIObject<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: ScopedAiOptions,
): Promise<T> {
  const result = await generateObject({
    model: pickModel(options),
    prompt,
    schema,
    system: options?.system,
    temperature: options?.temperature ?? 0.7,
  });

  return result.object;
}

interface GenerateVisionObjectInput<T> {
  readonly aiProvider?: AiProvider;
  readonly imageBase64: string;
  readonly maxTokens?: number;
  readonly model?: keyof typeof models;
  readonly schema: z.ZodSchema<T>;
  readonly systemPrompt: string;
  readonly temperature?: number;
  readonly userText: string;
}

export async function generateVisionObject<T>({
  aiProvider,
  imageBase64,
  maxTokens,
  model = 'fast',
  schema,
  systemPrompt,
  temperature = 0.1,
  userText,
}: GenerateVisionObjectInput<T>): Promise<T> {
  // Default Ollama models (llama3.1, qwen2.5) cannot accept image inputs.
  // Vision-capable local models (e.g. qwen2.5-vl, llama3.2-vision) need to be
  // explicitly opted in via OLLAMA_MODEL_VISION env. Fall back to OpenAI when
  // the active provider can't see images, since vision tasks would otherwise
  // silently degrade.
  const provider: AiProvider =
    aiProvider === 'ollama' && !process.env.OLLAMA_MODEL_VISION
      ? 'openai'
      : (aiProvider ?? 'openai');
  const trio = getModels(provider);
  const request = {
    maxOutputTokens: maxTokens,
    messages: [
      {
        content: [
          { text: userText, type: 'text' },
          {
            image: `data:image/png;base64,${imageBase64}`,
            type: 'image',
          },
        ],
        role: 'user',
      },
    ],
    model: trio[model],
    schema,
    system: systemPrompt,
    temperature,
  } as Parameters<typeof generateObject>[0];
  const result = await generateObject(request);
  return result.object as T;
}

interface GenerateVisionTextInput {
  readonly aiProvider?: AiProvider;
  readonly imageUrl: string;
  readonly maxTokens?: number;
  readonly model?: keyof typeof models;
  readonly systemPrompt: string;
  readonly temperature?: number;
  readonly userText: string;
}

export async function generateVisionText({
  aiProvider,
  imageUrl,
  maxTokens,
  model = 'fast',
  systemPrompt,
  temperature = 0.3,
  userText,
}: GenerateVisionTextInput): Promise<string> {
  // Mirror the fallback logic from generateVisionObject — Ollama needs a
  // vision-capable model explicitly opted in; otherwise route to OpenAI.
  const provider: AiProvider =
    aiProvider === 'ollama' && !process.env.OLLAMA_MODEL_VISION
      ? 'openai'
      : (aiProvider ?? 'openai');
  const trio = getModels(provider);
  const result = await generateText({
    maxOutputTokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image', image: imageUrl },
        ],
      },
    ],
    model: trio[model],
    system: systemPrompt,
    temperature,
  });
  return result.text;
}

export async function streamAIText(prompt: string, options?: ScopedAiOptions) {
  return streamText({
    model: pickModel(options),
    prompt,
    temperature: options?.temperature ?? 0.7,
  });
}

// Common AI prompts and schemas
export const commonSchemas = {
  interviewQuestions: z.object({
    questions: z.array(
      z.object({
        difficulty: z.enum(['easy', 'medium', 'hard']),
        question: z.string(),
        tips: z.array(z.string()),
        type: z.enum(['behavioral', 'technical', 'situational', 'general']),
      }),
    ),
  }),

  jobAnalysis: z.object({
    fitScore: z.number().min(0).max(100),
    gaps: z.array(z.string()),
    recommendations: z.array(z.string()),
    strengths: z.array(z.string()),
  }),

  skillsAnalysis: z.object({
    recommendations: z.array(z.string()),
    skills: z.array(
      z.object({
        category: z.string(),
        level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
        name: z.string(),
        relevance: z.number().min(0).max(1),
      }),
    ),
  }),
};
