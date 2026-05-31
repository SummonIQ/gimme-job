import type { Context, MiddlewareHandler } from 'hono';
import { config } from './config.js';

const PLAN_LIMITS: Record<string, number> = {
  basic: 25,
  enterprise: 500,
  free: 10,
  mega: 500,
  pro: 100,
  ultra: 250,
};

export interface ConsumerContext {
  limitCap: number;
  plan: string;
  user?: string | undefined;
}

export const rapidApiGuard: MiddlewareHandler = async (context, next) => {
  const expectedSecret = config.rapidApiProxySecret;

  if (expectedSecret) {
    const providedSecret = context.req.header('x-rapidapi-proxy-secret');
    if (providedSecret !== expectedSecret) {
      return context.json(
        {
          error: {
            code: 'unauthorized',
            message: 'Invalid RapidAPI proxy secret.',
          },
        },
        401,
      );
    }
  }

  await next();
};

export const getConsumer = (context: Context): ConsumerContext => {
  const rawPlan =
    context.req.header('x-rapidapi-subscription') ||
    context.req.header('x-rapidapi-plan') ||
    'direct';
  const plan = rawPlan.trim().toLowerCase();

  return {
    limitCap: Math.min(PLAN_LIMITS[plan] ?? 100, config.hardMaxLimit),
    plan,
    user: context.req.header('x-rapidapi-user') || undefined,
  };
};

export const resolveLimit = (requested: string | null, cap: number): number => {
  const parsed = requested ? Number.parseInt(requested, 10) : config.defaultLimit;
  const positive = Number.isFinite(parsed) && parsed > 0 ? parsed : config.defaultLimit;

  return Math.max(1, Math.min(positive, cap, config.hardMaxLimit));
};
