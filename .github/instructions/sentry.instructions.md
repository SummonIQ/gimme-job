---
applyTo: "**/*.ts,**/*.tsx"
---
# Sentry Integration Instructions

Use `import * as Sentry from "@sentry/nextjs"` to reference Sentry functionality.

## Configuration Files
- **Client**: `instrumentation-client.ts`
- **Server**: `sentry.server.config.ts`
- **Edge**: `sentry.edge.config.ts`

Initialization only needs to happen in these files.

## Exception Catching
```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

## Tracing - UI Actions
```typescript
function TestComponent() {
  const handleTestButtonClick = () => {
    Sentry.startSpan(
      {
        op: 'ui.click',
        name: 'Test Button Click',
      },
      span => {
        span.setAttribute('config', 'some value');
        span.setAttribute('metric', 'some metric');
        doSomething();
      },
    );
  };
  
  return (
    <button type="button" onClick={handleTestButtonClick}>
      Test Sentry
    </button>
  );
}
```

## Tracing - API Calls
```typescript
async function fetchUserData(userId: string) {
  return Sentry.startSpan(
    {
      op: 'http.client',
      name: `GET /api/users/${userId}`,
    },
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      return data;
    },
  );
}
```

## Logging

Enable logging in Sentry initialization:
```typescript
Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  enableLogs: true,
});
```

Logger usage with `logger.fmt` for structured logs:
```typescript
const { logger } = Sentry;

logger.trace('Starting database connection', { database: 'users' });
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
logger.info('Updated profile', { profileId: 345 });
logger.warn('Rate limit reached for endpoint', {
  endpoint: '/api/results/',
  isEnterprise: false,
});
logger.error('Failed to process payment', {
  orderId: 'order_123',
  amount: 99.99,
});
logger.fatal('Database connection pool exhausted', {
  database: 'users',
  activeConnections: 100,
});
```
