# Rate Limiting

Config-driven rate limiting for APIs and server actions using Vercel KV (Redis).

## Features

- **Config-driven**: All presets defined in `applab.config.ts`
- **Multiple storage backends**: KV (Redis), memory, or database
- **Flexible identification**: User-based or IP-based
- **Standard headers**: Returns proper rate limit headers (`X-RateLimit-*`)
- **Graceful degradation**: Fails open if storage is unavailable
- **TypeScript**: Fully typed for safety

## Setup

### 1. Add Redis URL Environment Variable

Your Redis URL is already configured in `.env`:

```bash
# Redis for rate limiting
REDIS_URL="redis://default:password@host:port"
```

The system will automatically use this Redis instance for distributed rate limiting.

### 2. Configure in applab.config.ts

All rate limit presets are defined in `applab.config.ts`:

```typescript
rateLimit: {
  enabled: true,
  storage: 'kv', // 'kv' | 'database' | 'memory'
  presets: {
    linkedinSearch: { limit: 10, window: 60, key: 'api:linkedin:search' },
    aiResumeAnalysis: { limit: 5, window: 60, key: 'ai:resume:analysis' },
    // ... more presets
  },
}
```

## Usage

### API Routes

```typescript
import { withRateLimit } from '@/lib/rate-limit/middleware';

export async function GET(request: NextRequest) {
  // Using a preset from config
  const rateLimitError = await withRateLimit(request, {
    preset: 'linkedinSearch',
    message: 'Too many LinkedIn searches. Please wait.',
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  // ... rest of your API logic
}
```

### Custom Rate Limits

```typescript
import { withRateLimit } from '@/lib/rate-limit/middleware';

export async function POST(request: NextRequest) {
  // Custom rate limit (not using a preset)
  const rateLimitError = await withRateLimit(request, {
    key: 'api:custom:endpoint',
    limit: 50,
    window: 3600, // 1 hour in seconds
    useUserId: true, // Use user ID (default) or IP
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  // ... rest of your API logic
}
```

### IP-Based Rate Limiting (Public Endpoints)

```typescript
import { withIpRateLimit } from '@/lib/rate-limit/middleware';

export async function POST(request: NextRequest) {
  // Rate limit by IP address (for public endpoints)
  const rateLimitError = await withIpRateLimit(request, {
    preset: 'publicSignup',
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  // ... rest of your API logic
}
```

### Server Actions

```typescript
'use server';

import { rateLimitServerAction, RateLimitError } from '@/lib/rate-limit/server-actions';

export async function createResume(data: FormData) {
  try {
    // Rate limit the server action
    await rateLimitServerAction({
      preset: 'createResume',
    });

    // ... rest of your logic
    return { success: true };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: error.message,
        retryAfter: error.retryAfter,
      };
    }
    throw error;
  }
}
```

### Server Actions with Wrapper

```typescript
'use server';

import { withRateLimit } from '@/lib/rate-limit/server-actions';

export const createResume = withRateLimit(
  { preset: 'createResume' },
  async (data: FormData) => {
    // ... implementation
    return { success: true };
  }
);
```

### Multiple Rate Limits

```typescript
import { rateLimitMultiple, getPresetWithIdentifier } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/user';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Apply both per-minute and per-hour limits
  const result = await rateLimitMultiple([
    getPresetWithIdentifier('aiResumeAnalysis', user.id), // 5/minute
    { key: 'ai:resume:analysis:hourly', limit: 50, window: 3600, identifier: user.id }, // 50/hour
  ]);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: result.retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': result.retryAfter?.toString() || '60',
        },
      }
    );
  }

  // ... rest of your logic
}
```

## Available Presets

See `applab.config.ts` for all available presets:

- **LinkedIn**: `linkedinSearch`, `linkedinApply`, `linkedinProfile`, `linkedinConnection`
- **AI**: `aiResumeAnalysis`, `aiCoverLetter`, `aiInterviewPrep`, `aiJobFit`
- **Database**: `createResume`, `updateProfile`, `createApplication`
- **Uploads**: `uploadResume`, `uploadDocument`
- **API**: `apiGeneral`, `apiStrict`, `apiAuth`
- **Public**: `publicApi`, `publicSignup`, `publicLogin`
- **Automation**: `automationCron`, `automationSchedule`
- **SerpAPI**: `serpApiSearch`, `serpApiSearchStrict`, `serpApiSearchHourly`, `serpApiBatch`

## Response Format

### Successful Request

The middleware returns `null` and the request proceeds normally. Rate limit headers are included:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
```

### Rate Limited Request

Returns 429 status with:

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 45,
  "limit": 10,
  "reset": "2024-01-15T10:30:00.000Z"
}
```

Headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
Retry-After: 45
```

## Storage Options

### Vercel KV (Recommended)

Best for production. Distributed across all instances.

```typescript
rateLimit: {
  storage: 'kv',
}
```

### Memory (Development/Fallback)

Good for development or as a fallback. **Not distributed** - each instance has its own store.

```typescript
rateLimit: {
  storage: 'memory',
}
```

### Database (Not Implemented)

Can be implemented if needed using Prisma.

## Disabling Rate Limiting

To disable rate limiting globally:

```typescript
rateLimit: {
  enabled: false,
}
```

## Manual Operations

### Reset Rate Limit

```typescript
import { resetRateLimit } from '@/lib/rate-limit';

// Reset a specific user's rate limit
await resetRateLimit('api:linkedin:search', userId);
```

### Check Rate Limit Status

```typescript
import { rateLimit, getPresetWithIdentifier } from '@/lib/rate-limit';

const result = await rateLimit(
  getPresetWithIdentifier('linkedinSearch', userId)
);

console.log(`Remaining: ${result.remaining}/${result.limit}`);
console.log(`Resets at: ${new Date(result.reset)}`);
```

## Best Practices

1. **Use presets**: Define all rate limits in `applab.config.ts` for consistency
2. **Conservative limits**: Start strict, loosen as needed
3. **External APIs**: Be extra conservative (LinkedIn, OpenAI, etc.)
4. **User feedback**: Use clear error messages with `retryAfter`
5. **Monitor**: Watch for rate limit hits in production
6. **Public endpoints**: Always use IP-based rate limiting
7. **Multiple limits**: Combine minute/hour limits for burst protection

## Troubleshooting

### Rate limiting always allows requests

- Check `config.rateLimit.enabled` is `true`
- Verify KV environment variables are set
- Check storage option in config

### KV connection errors

- Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are correct
- Check Vercel dashboard for KV status
- System will fail open (allow requests) if KV is down

### Different behavior in development vs production

- Memory storage is not distributed
- Use KV in both environments for consistency
- Check `config.rateLimit.storage` setting

## Advanced: Creating New Presets

Add new presets to `applab.config.ts`:

```typescript
rateLimit: {
  presets: {
    myCustomEndpoint: {
      limit: 30,       // Max 30 requests
      window: 60,      // Per 60 seconds (1 minute)
      key: 'api:my:endpoint', // Unique identifier
    },
  },
}
```

Then use it:

```typescript
const rateLimitError = await withRateLimit(request, {
  preset: 'myCustomEndpoint',
});
```
