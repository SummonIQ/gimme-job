# RapidAPI Tests

Use these in RapidAPI Studio Tests.

If the plan only allows a few tests, create these first:

1. Dataset Stats
2. List Active Jobs
3. Search Filter
4. Facets
5. Healthcheck

## Dataset Stats

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/stats",
      "variable": "stats",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjStatsGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "stats.status",
      "value": "200"
    },
    "_id": "GjStatsA001"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "stats.data.data.activeCount",
      "value": "number"
    },
    "_id": "GjStatsA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "stats.data.data.expiredCount",
      "value": "number"
    },
    "_id": "GjStatsA003"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "stats.data.data.latestUpdatedAt"
    },
    "_id": "GjStatsA004"
  }
]
```

## List Active Jobs

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs?limit=2",
      "variable": "jobs",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjJobsGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "jobs.status",
      "value": "200"
    },
    "_id": "GjJobsA001"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "jobs.data.meta.count",
      "value": "number"
    },
    "_id": "GjJobsA002"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "jobs.data.data.0.id"
    },
    "_id": "GjJobsA003"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "jobs.data.data.0.title",
      "value": "string"
    },
    "_id": "GjJobsA004"
  }
]
```

## Search Filter

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs?query=engineer&limit=2",
      "variable": "searchJobs",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjSearchGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "searchJobs.status",
      "value": "200"
    },
    "_id": "GjSearchA001"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "searchJobs.data.data.0.id"
    },
    "_id": "GjSearchA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "searchJobs.data.data.0.title",
      "value": "string"
    },
    "_id": "GjSearchA003"
  }
]
```

## Remote Salary Filter

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs?remote=true&has_salary=true&limit=2",
      "variable": "filteredJobs",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjFilterGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "filteredJobs.status",
      "value": "200"
    },
    "_id": "GjFilterA001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "filteredJobs.data.data.0.remote",
      "value": "true"
    },
    "_id": "GjFilterA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "filteredJobs.data.data.0.salary",
      "value": "string"
    },
    "_id": "GjFilterA003"
  }
]
```

## Backfill Jobs

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/backfill?limit=2",
      "variable": "backfill",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjBackfillGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "backfill.status",
      "value": "200"
    },
    "_id": "GjBackfillA001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "backfill.data.meta.window",
      "value": "6m"
    },
    "_id": "GjBackfillA002"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "backfill.data.data.0.id"
    },
    "_id": "GjBackfillA003"
  }
]
```

## Posted Jobs 7 Days

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/posted-7d?limit=2",
      "variable": "posted",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjPostedGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "posted.status",
      "value": "200"
    },
    "_id": "GjPostedA001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "posted.data.meta.window",
      "value": "7d"
    },
    "_id": "GjPostedA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "posted.data.meta.count",
      "value": "number"
    },
    "_id": "GjPostedA003"
  }
]
```

## Indexed Jobs 24 Hours

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/indexed-24h?limit=2",
      "variable": "indexed",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjIndexedGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "indexed.status",
      "value": "200"
    },
    "_id": "GjIndexedA001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "indexed.data.meta.window",
      "value": "24h"
    },
    "_id": "GjIndexedA002"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "indexed.data.meta.windowField",
      "value": "createdAt"
    },
    "_id": "GjIndexedA003"
  }
]
```

## Hourly Jobs

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/hourly?limit=2",
      "variable": "hourly",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjHourlyGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "hourly.status",
      "value": "200"
    },
    "_id": "GjHourlyA001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "hourly.data.meta.window",
      "value": "1h"
    },
    "_id": "GjHourlyA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "hourly.data.meta.count",
      "value": "number"
    },
    "_id": "GjHourlyA003"
  }
]
```

## Updated Jobs

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/updated?limit=2",
      "variable": "updated",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjUpdatedGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "updated.status",
      "value": "200"
    },
    "_id": "GjUpdatedA001"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "updated.data.data.0.id"
    },
    "_id": "GjUpdatedA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "updated.data.data.0.updatedAt",
      "value": "string"
    },
    "_id": "GjUpdatedA003"
  }
]
```

## Modified Jobs 24 Hours

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/modified-24h?limit=2",
      "variable": "modified",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjModifiedGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "modified.status",
      "value": "200"
    },
    "_id": "GjModifiedA001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "modified.data.meta.window",
      "value": "24h"
    },
    "_id": "GjModifiedA002"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "modified.data.meta.windowField",
      "value": "updatedAt"
    },
    "_id": "GjModifiedA003"
  }
]
```

## Expired Jobs

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/expired?limit=2",
      "variable": "expired",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjExpiredGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "expired.status",
      "value": "200"
    },
    "_id": "GjExpiredA001"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "expired.data.data.0.jobId"
    },
    "_id": "GjExpiredA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "expired.data.data.0.provider",
      "value": "string"
    },
    "_id": "GjExpiredA003"
  }
]
```

## Provider Counts

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/providers",
      "variable": "providers",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjProvidersGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "providers.status",
      "value": "200"
    },
    "_id": "GjProvidersA001"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "providers.data.data.0.provider",
      "value": "string"
    },
    "_id": "GjProvidersA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "providers.data.data.0.count",
      "value": "number"
    },
    "_id": "GjProvidersA003"
  }
]
```

## Facets

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/v1/jobs/facets",
      "variable": "facets",
      "headers": {
        "X-RapidAPI-Proxy-Secret": "48d7a9a0-43b9-11f1-939c-cdfae6aa4d63",
        "X-RapidAPI-Subscription": "pro"
      }
    },
    "_id": "GjFacetsGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "facets.status",
      "value": "200"
    },
    "_id": "GjFacetsA001"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "facets.data.data.provider.0.value",
      "value": "string"
    },
    "_id": "GjFacetsA002"
  },
  {
    "action": "Assert.type",
    "parameters": {
      "expression": "facets.data.data.provider.0.count",
      "value": "number"
    },
    "_id": "GjFacetsA003"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "facets.data.data.jobType"
    },
    "_id": "GjFacetsA004"
  }
]
```

## Healthcheck

```json
[
  {
    "action": "Http.get",
    "parameters": {
      "url": "https://gimme-job-listings-api-production.up.railway.app/health",
      "variable": "health"
    },
    "_id": "GjHealthGet001"
  },
  {
    "action": "Assert.equals",
    "parameters": {
      "expression": "health.status",
      "value": "200"
    },
    "_id": "GjHealthA001"
  },
  {
    "action": "Assert.exists",
    "parameters": {
      "expression": "health.data.status"
    },
    "_id": "GjHealthA002"
  }
]
```
