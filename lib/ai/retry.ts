import { generateObject, generateText, streamText } from "ai";
import { z } from "zod";

import { models } from "./models";
import { AppError, createAIServiceError, ErrorCode, logError } from "../errors";

// Configuration for retry logic
const RETRY_CONFIG = {
  // 10 seconds
backoffMultiplier: 2,
  
initialDelay: 1000, 
  
// 1 second
maxDelay: 10000, 
  
maxRetries: 3,
  retryableErrors: [
    'rate_limit_exceeded',
    'timeout',
    'connection_error',
    'service_unavailable',
  ],
};

// Circuit breaker configuration
interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakerStates = new Map<string, CircuitBreakerState>();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  // 1 minute
halfOpenRequests: 3, 
  resetTimeout: 60000,
};

// Helper to check if error is retryable
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return RETRY_CONFIG.retryableErrors.some(retryableError => 
      message.includes(retryableError)
    );
  }
  return false;
}

// Sleep helper for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Circuit breaker helper
function getCircuitBreakerState(service: string): CircuitBreakerState {
  if (!circuitBreakerStates.has(service)) {
    circuitBreakerStates.set(service, {
      failures: 0,
      lastFailure: null,
      state: 'closed',
    });
  }
  return circuitBreakerStates.get(service)!;
}

function updateCircuitBreaker(service: string, success: boolean) {
  const state = getCircuitBreakerState(service);
  
  if (success) {
    // Reset on success
    state.failures = 0;
    state.state = 'closed';
  } else {
    // Increment failures
    state.failures++;
    state.lastFailure = new Date();
    
    // Open circuit if threshold reached
    if (state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      state.state = 'open';
    }
  }
}

function canMakeRequest(service: string): boolean {
  const state = getCircuitBreakerState(service);
  
  if (state.state === 'closed') {
    return true;
  }
  
  if (state.state === 'open' && state.lastFailure) {
    const timeSinceFailure = Date.now() - state.lastFailure.getTime();
    if (timeSinceFailure > CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      state.state = 'half-open';
      return true;
    }
  }
  
  return state.state === 'half-open';
}

// Retry wrapper for AI operations
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, unknown>
): Promise<T> {
  let lastError: unknown;
  let delay = RETRY_CONFIG.initialDelay;
  
  // Check circuit breaker
  if (!canMakeRequest('openai')) {
    throw new AppError({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      context: { ...context, circuitBreaker: true },
      message: 'AI service is temporarily unavailable due to repeated failures',
      retryable: true,
      userMessage: 'AI service is temporarily unavailable. Please try again in a few minutes.',
    });
  }
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await operation();
      updateCircuitBreaker('openai', true);
      return result;
    } catch (error) {
      lastError = error;
      
      logError(error instanceof Error ? error : new Error(String(error)), {
        ...context,
        attempt,
        operationName,
      });
      
      // Don't retry if it's not a retryable error or we've exhausted retries
      if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
        updateCircuitBreaker('openai', false);
        break;
      }
      
      // Wait before retrying with exponential backoff
      await sleep(Math.min(delay, RETRY_CONFIG.maxDelay));
      delay *= RETRY_CONFIG.backoffMultiplier;
    }
  }
  
  // All retries failed
  throw createAIServiceError(lastError, {
    ...context,
    operationName,
    retriesExhausted: true,
  });
}

// Export AI instance
export const ai = models.primary;

// Enhanced AI text generation with retry
export async function generateAIText(
  prompt: string, 
  options?: {
    maxTokens?: number;
    model?: string;
    temperature?: number;
  }
): Promise<string> {
  return withRetry(
    async () => {
      const result = await generateText({
        abortSignal: AbortSignal.timeout(30000),
        model: ai,
        prompt,
        temperature: options?.temperature || 0.7, // 30 second timeout
      });
      return result.text;
    },
    'generateAIText',
    { options, prompt: prompt.slice(0, 100) }
  );
}

// Enhanced AI object generation with retry
export async function generateAIObject<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: {
    maxTokens?: number;
    model?: string;
    temperature?: number;
  }
): Promise<T> {
  return withRetry(
    async () => {
      const result = await generateObject({
        abortSignal: AbortSignal.timeout(30000),
        maxTokens: options?.maxTokens || 1000,
        model: ai,
        prompt,
        schema,
        temperature: options?.temperature || 0.7, // 30 second timeout
      });
      return result.object;
    },
    'generateAIObject',
    { options, prompt: prompt.slice(0, 100) }
  );
}

// Enhanced AI streaming with retry
export async function streamAIText(
  prompt: string, 
  options?: {
    maxTokens?: number;
    model?: string;
    temperature?: number;
  }
) {
  // Note: Streaming doesn't support full retry logic due to its nature
  // But we can at least check circuit breaker
  if (!canMakeRequest('openai')) {
    throw new AppError({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'AI service is temporarily unavailable',
      retryable: true,
      userMessage: 'AI service is temporarily unavailable. Please try again in a few minutes.',
    });
  }
  
  try {
    const result = await streamText({
      abortSignal: AbortSignal.timeout(60000),
      model: ai,
      prompt,
      temperature: options?.temperature || 0.7, // 60 second timeout for streams
    });
    updateCircuitBreaker('openai', true);
    return result;
  } catch (error) {
    updateCircuitBreaker('openai', false);
    throw createAIServiceError(error, { 
      options, 
      prompt: prompt.slice(0, 100),
      streaming: true 
    });
  }
}

// Fallback response generators for when AI is unavailable
export const fallbackResponses = {
  generateDefaultInterviewQuestions: () => ({
    questions: [
      {
        difficulty: "easy" as const,
        question: "Tell me about yourself and your background.",
        tips: ["Keep it concise and relevant to the role"],
        type: "general" as const,
      },
      {
        difficulty: "easy" as const,
        question: "Why are you interested in this position?",
        tips: ["Show enthusiasm and knowledge about the company"],
        type: "general" as const,
      },
      {
        difficulty: "medium" as const,
        question: "What are your greatest strengths?",
        tips: ["Provide specific examples"],
        type: "behavioral" as const,
      },
    ],
  }),
  
  generateDefaultJobAnalysis: () => ({
    fitScore: 0,
    gaps: ["Analysis unavailable"],
    recommendations: [
      "AI analysis is temporarily unavailable.",
      "Please try again in a few minutes or proceed with manual review.",
    ],
    strengths: ["Analysis unavailable"],
  }),
  
  generateDefaultSkillsAnalysis: () => ({
    recommendations: [
      "Unable to analyze skills at this time. Please try again later.",
      "Consider manually reviewing the job requirements against your resume.",
    ],
    skills: [],
  }),
};

// Export schemas from index file
export { commonSchemas } from './index';