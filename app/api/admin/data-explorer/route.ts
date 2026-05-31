import { type NextRequest, NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const VALID_TABLES = [
  'observations',
  'rules',
  'ats-systems',
  'analysis-jobs',
  'training-sessions',
  'applications',
] as const;

type TableName = (typeof VALID_TABLES)[number];

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminUser(user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    // Counts-only mode: return row counts for all tables
    if (searchParams.get('counts') === 'true') {
      const counts = await getAllCounts();
      return NextResponse.json({ counts });
    }

    const table = searchParams.get('table') as TableName | null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10),
      ),
    );
    const search = searchParams.get('search')?.trim() || undefined;
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortDir = (searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc') as
      | 'asc'
      | 'desc';
    const columnFilter = searchParams.get('columnFilter') || undefined;
    const columnValue = searchParams.get('columnValue') || undefined;

    if (!table || !VALID_TABLES.includes(table)) {
      return NextResponse.json(
        { error: `Invalid table. Valid: ${VALID_TABLES.join(', ')}` },
        { status: 400 },
      );
    }

    const skip = (page - 1) * pageSize;
    const result = await queryTable(table, {
      skip,
      take: pageSize,
      search,
      sortBy,
      sortDir,
      columnFilter,
      columnValue,
    });

    return NextResponse.json({
      table,
      page,
      pageSize,
      totalCount: result.totalCount,
      totalPages: Math.ceil(result.totalCount / pageSize),
      columns: result.columns,
      rows: result.rows,
    });
  } catch (error) {
    console.error('[DataExplorer] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 },
    );
  }
}

async function getAllCounts(): Promise<Record<string, number>> {
  const [
    observations,
    rules,
    atsSystems,
    analysisJobs,
    trainingSessions,
    applications,
  ] = await Promise.all([
    db.aTSFieldObservation.count(),
    db.aTSRule.count(),
    db.aTSSystem.count(),
    db.aTSAnalysisJob.count(),
    db.assistTrainingSession.count(),
    db.applicationSubmission.count(),
  ]);
  return {
    observations,
    rules,
    'ats-systems': atsSystems,
    'analysis-jobs': analysisJobs,
    'training-sessions': trainingSessions,
    applications,
  };
}

interface QueryOptions {
  skip: number;
  take: number;
  search?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  columnFilter?: string;
  columnValue?: string;
}

interface QueryResult {
  totalCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

async function queryTable(
  table: TableName,
  opts: QueryOptions,
): Promise<QueryResult> {
  switch (table) {
    case 'observations':
      return queryObservations(opts);
    case 'rules':
      return queryRules(opts);
    case 'ats-systems':
      return queryAtsSystems(opts);
    case 'analysis-jobs':
      return queryAnalysisJobs(opts);
    case 'training-sessions':
      return queryTrainingSessions(opts);
    case 'applications':
      return queryApplications(opts);
    default:
      throw new Error(`Unknown table: ${table}`);
  }
}

function buildColumnWhere(
  opts: QueryOptions,
): Record<string, unknown> | undefined {
  if (!opts.columnFilter || !opts.columnValue) return undefined;
  // Support exact match filtering on a specific column
  return { [opts.columnFilter]: opts.columnValue };
}

function mergeWhere(
  ...parts: (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const defined = parts.filter(Boolean) as Record<string, unknown>[];
  if (defined.length === 0) return {};
  if (defined.length === 1) return defined[0];
  return { AND: defined };
}

async function queryObservations(opts: QueryOptions): Promise<QueryResult> {
  const searchWhere = opts.search
    ? {
        OR: [
          { hostname: { contains: opts.search, mode: 'insensitive' as const } },
          {
            fieldLabel: { contains: opts.search, mode: 'insensitive' as const },
          },
          {
            fieldDisplayName: {
              contains: opts.search,
              mode: 'insensitive' as const,
            },
          },
          {
            fieldName: { contains: opts.search, mode: 'insensitive' as const },
          },
          { selector: { contains: opts.search, mode: 'insensitive' as const } },
          { action: { contains: opts.search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const where = mergeWhere(searchWhere, buildColumnWhere(opts));

  const orderBy = opts.sortBy
    ? { [opts.sortBy]: opts.sortDir }
    : { updatedAt: opts.sortDir };

  const [totalCount, rows] = await Promise.all([
    db.aTSFieldObservation.count({ where }),
    db.aTSFieldObservation.findMany({
      where,
      orderBy,
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        hostname: true,
        pathname: true,
        selector: true,
        stableSelector: true,
        tagName: true,
        inputType: true,
        fieldName: true,
        fieldId: true,
        fieldLabel: true,
        fieldDisplayName: true,
        ariaLabel: true,
        stepIndex: true,
        sessionId: true,
        action: true,
        actionType: true,
        aiReason: true,
        valueFilled: true,
        success: true,
        observationCount: true,
        maxLength: true,
        minLength: true,
        pattern: true,
        inputMode: true,
        fieldConstraints: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const columns = [
    'id',
    'hostname',
    'fieldDisplayName',
    'fieldLabel',
    'fieldName',
    'tagName',
    'inputType',
    'selector',
    'stableSelector',
    'action',
    'actionType',
    'aiReason',
    'valueFilled',
    'success',
    'observationCount',
    'maxLength',
    'minLength',
    'pattern',
    'inputMode',
    'stepIndex',
    'sessionId',
    'createdAt',
    'updatedAt',
  ];

  return { totalCount, columns, rows };
}

async function queryRules(opts: QueryOptions): Promise<QueryResult> {
  const searchWhere = opts.search
    ? {
        OR: [
          { hostname: { contains: opts.search, mode: 'insensitive' as const } },
          {
            fieldLabel: { contains: opts.search, mode: 'insensitive' as const },
          },
          {
            fieldName: { contains: opts.search, mode: 'insensitive' as const },
          },
          {
            stableSelector: {
              contains: opts.search,
              mode: 'insensitive' as const,
            },
          },
          { reason: { contains: opts.search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const where = mergeWhere(searchWhere, buildColumnWhere(opts));

  const orderBy = opts.sortBy
    ? { [opts.sortBy]: opts.sortDir }
    : { updatedAt: opts.sortDir };

  const [totalCount, rows] = await Promise.all([
    db.aTSRule.count({ where }),
    db.aTSRule.findMany({
      where,
      orderBy,
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        hostname: true,
        action: true,
        actionType: true,
        stableSelector: true,
        tagName: true,
        fieldName: true,
        fieldLabel: true,
        ariaLabel: true,
        role: true,
        stepIndex: true,
        reason: true,
        observationCount: true,
        confidence: true,
        enabled: true,
        consecutiveFailures: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const columns = [
    'id',
    'hostname',
    'action',
    'actionType',
    'stableSelector',
    'tagName',
    'fieldName',
    'fieldLabel',
    'ariaLabel',
    'role',
    'stepIndex',
    'reason',
    'observationCount',
    'confidence',
    'enabled',
    'consecutiveFailures',
    'createdAt',
    'updatedAt',
  ];

  return { totalCount, columns, rows };
}

async function queryAtsSystems(opts: QueryOptions): Promise<QueryResult> {
  const searchWhere = opts.search
    ? {
        OR: [
          { name: { contains: opts.search, mode: 'insensitive' as const } },
          { vendor: { contains: opts.search, mode: 'insensitive' as const } },
          {
            detectedDomain: {
              contains: opts.search,
              mode: 'insensitive' as const,
            },
          },
          {
            difficulty: { contains: opts.search, mode: 'insensitive' as const },
          },
        ],
      }
    : undefined;

  const where = mergeWhere(searchWhere, buildColumnWhere(opts));

  const orderBy = opts.sortBy
    ? { [opts.sortBy]: opts.sortDir }
    : { lastAnalyzed: opts.sortDir };

  const [totalCount, rows] = await Promise.all([
    db.aTSSystem.count({ where }),
    db.aTSSystem.findMany({
      where,
      orderBy,
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        name: true,
        vendor: true,
        detectedDomain: true,
        domainPatterns: true,
        isMultiStep: true,
        stepCount: true,
        difficulty: true,
        successRate: true,
        avgCompletionTime: true,
        totalAnalyzed: true,
        resumeUploadMethod: true,
        lastAnalyzed: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const columns = [
    'id',
    'name',
    'vendor',
    'detectedDomain',
    'domainPatterns',
    'isMultiStep',
    'stepCount',
    'difficulty',
    'successRate',
    'avgCompletionTime',
    'totalAnalyzed',
    'resumeUploadMethod',
    'lastAnalyzed',
    'createdAt',
    'updatedAt',
  ];

  return { totalCount, columns, rows };
}

async function queryAnalysisJobs(opts: QueryOptions): Promise<QueryResult> {
  const searchWhere = opts.search
    ? {
        OR: [
          { status: { contains: opts.search, mode: 'insensitive' as const } },
          { error: { contains: opts.search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const where = mergeWhere(searchWhere, buildColumnWhere(opts));

  const orderBy = opts.sortBy
    ? { [opts.sortBy]: opts.sortDir }
    : { startedAt: opts.sortDir };

  const [totalCount, rows] = await Promise.all([
    db.aTSAnalysisJob.count({ where }),
    db.aTSAnalysisJob.findMany({
      where,
      orderBy,
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        userId: true,
        status: true,
        searchQueries: true,
        totalUrls: true,
        processedUrls: true,
        foundSystems: true,
        progress: true,
        startedAt: true,
        completedAt: true,
        error: true,
      },
    }),
  ]);

  const columns = [
    'id',
    'userId',
    'status',
    'searchQueries',
    'totalUrls',
    'processedUrls',
    'foundSystems',
    'progress',
    'startedAt',
    'completedAt',
    'error',
  ];

  return { totalCount, columns, rows };
}

async function queryTrainingSessions(opts: QueryOptions): Promise<QueryResult> {
  const searchWhere = opts.search
    ? {
        OR: [
          { hostname: { contains: opts.search, mode: 'insensitive' as const } },
          {
            targetUrl: { contains: opts.search, mode: 'insensitive' as const },
          },
          { status: { contains: opts.search, mode: 'insensitive' as const } },
          {
            atsSystemName: {
              contains: opts.search,
              mode: 'insensitive' as const,
            },
          },
          { error: { contains: opts.search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const where = mergeWhere(searchWhere, buildColumnWhere(opts));

  const orderBy = opts.sortBy
    ? { [opts.sortBy]: opts.sortDir }
    : { startedAt: opts.sortDir };

  const [totalCount, rows] = await Promise.all([
    db.assistTrainingSession.count({ where }),
    db.assistTrainingSession.findMany({
      where,
      orderBy,
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        status: true,
        targetUrl: true,
        hostname: true,
        totalSteps: true,
        completedSteps: true,
        progress: true,
        observationsCreated: true,
        rulesPromoted: true,
        atsSystemName: true,
        error: true,
        startedAt: true,
        completedAt: true,
      },
    }),
  ]);

  const columns = [
    'id',
    'status',
    'targetUrl',
    'hostname',
    'totalSteps',
    'completedSteps',
    'progress',
    'observationsCreated',
    'rulesPromoted',
    'atsSystemName',
    'error',
    'startedAt',
    'completedAt',
  ];

  return { totalCount, columns, rows };
}

async function queryApplications(opts: QueryOptions): Promise<QueryResult> {
  const searchWhere = opts.search
    ? {
        OR: [
          {
            submissionUrl: {
              contains: opts.search,
              mode: 'insensitive' as const,
            },
          },
          {
            errorMessage: {
              contains: opts.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }
    : undefined;

  const where = mergeWhere(searchWhere, buildColumnWhere(opts));

  const orderBy = opts.sortBy
    ? { [opts.sortBy]: opts.sortDir }
    : { createdAt: opts.sortDir };

  const [totalCount, rows] = await Promise.all([
    db.applicationSubmission.count({ where }),
    db.applicationSubmission.findMany({
      where,
      orderBy,
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        status: true,
        submissionUrl: true,
        submittedAt: true,
        wasAutomated: true,
        errorMessage: true,
        daysSinceSubmission: true,
        daysToResponse: true,
        interviewCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const columns = [
    'id',
    'status',
    'submissionUrl',
    'submittedAt',
    'wasAutomated',
    'errorMessage',
    'daysSinceSubmission',
    'daysToResponse',
    'interviewCount',
    'createdAt',
    'updatedAt',
  ];

  return { totalCount, columns, rows };
}
