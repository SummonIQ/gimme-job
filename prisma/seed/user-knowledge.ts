import { db } from '@/lib/db/client';

interface UserKnowledgeSeed {
  readonly confidence: number;
  readonly key: string;
  readonly source: string;
  readonly value: string;
}

interface SeedUserKnowledgeOptions {
  readonly email?: string;
  readonly userId?: string;
}

interface SeedUserKnowledgeResult {
  created: number;
  skippedManual: number;
  unchanged: number;
  updated: number;
  userId: string;
}

export interface WhyThisCompanyTemplate {
  readonly id: string;
  readonly label: string;
  readonly matchKeywords: readonly string[];
  readonly template: string;
}

const DEFAULT_STEVEN_EMAILS = [
  'bright-and-early@outlook.com',
  'steven@applab.io',
] as const;

export const COVER_LETTER_STYLE = [
  'Write in a concise, direct senior-engineer voice. Keep the letter specific, practical, and evidence-backed rather than promotional.',
  'Default structure: a short opening that names the role and company, one paragraph connecting the job to relevant product/platform work, one paragraph with two or three concrete strengths, and a brief close.',
  'Prefer concrete engineering language: React, Next.js, TypeScript, cloud infrastructure, accessibility, automation, GraphQL, data-heavy UI, CI/CD, and mentoring when the job description supports them.',
  'Sound collaborative and calm. Avoid hype, inflated claims, generic passion statements, and long autobiographical openings.',
  'Voice samples: "I am drawn to teams where product details and system reliability both matter." "My strongest work has been turning ambiguous operational needs into durable tools that teams can use every day." "I tend to be most useful where frontend craft, platform thinking, and delivery discipline overlap."',
].join('\n\n');

export const WHY_THIS_COMPANY_TEMPLATES: readonly WhyThisCompanyTemplate[] = [
  {
    id: 'product-analytics-platform',
    label: 'Product analytics and workflow platforms',
    matchKeywords: [
      'analytics',
      'dashboard',
      'workflow',
      'saas',
      'insight',
      'reporting',
      'customer data',
    ],
    template:
      'I am interested in {company} because the role sits at the intersection of product engineering, analytics, and reliable workflows. That is where I have done a lot of my best work: building React and Next.js interfaces that make complex operational data usable for real teams.',
  },
  {
    id: 'developer-infrastructure',
    label: 'Developer tools, cloud infrastructure, and platform teams',
    matchKeywords: [
      'developer',
      'infrastructure',
      'platform',
      'cloud',
      'devops',
      'kubernetes',
      'ci/cd',
      'api',
    ],
    template:
      'I am interested in {company} because the work combines product-facing engineering with the platform discipline needed to keep teams moving. My background spans frontend systems, Node.js services, cloud infrastructure, and release automation, so I can contribute across the parts of the stack that make developer and customer workflows dependable.',
  },
  {
    id: 'mission-critical-systems',
    label: 'Regulated, public-sector, energy, health, and education systems',
    matchKeywords: [
      'public sector',
      'government',
      'health',
      'education',
      'energy',
      'accessibility',
      'compliance',
      'regulated',
    ],
    template:
      'I am interested in {company} because the product appears to support workflows where correctness, accessibility, and reliability matter. I have worked on systems for enterprise, public-sector, education, and energy contexts, and I value engineering work where quality has a direct impact on people trying to get important work done.',
  },
  {
    id: 'consumer-scale-commerce',
    label: 'Consumer-scale commerce, media, and high-traffic product teams',
    matchKeywords: [
      'consumer',
      'commerce',
      'retail',
      'media',
      'marketplace',
      'growth',
      'scale',
      'performance',
    ],
    template:
      'I am interested in {company} because high-traffic product work rewards careful frontend architecture, clear user flows, and dependable delivery. My experience includes consumer-scale teams and design-driven React applications, and I would bring that mix of product judgment and implementation depth to this role.',
  },
];

export const USER_KNOWLEDGE_SEEDS: readonly UserKnowledgeSeed[] = [
  {
    confidence: 0.95,
    key: 'coverLetterStyle',
    source: 'seed:p9.5',
    value: COVER_LETTER_STYLE,
  },
  {
    confidence: 0.95,
    key: 'whyThisCompany',
    source: 'seed:p9.5',
    value: JSON.stringify(
      {
        version: 1,
        templates: WHY_THIS_COMPANY_TEMPLATES,
      },
      null,
      2,
    ),
  },
];

export function parseWhyThisCompanyTemplates(
  value: string,
): WhyThisCompanyTemplate[] {
  let parsed: { templates?: unknown };

  try {
    parsed = JSON.parse(value) as { templates?: unknown };
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.templates)) {
    return [];
  }

  return parsed.templates.filter(isWhyThisCompanyTemplate);
}

export function findWhyThisCompanyTemplate(
  templates: readonly WhyThisCompanyTemplate[],
  jobDescription: string,
): WhyThisCompanyTemplate {
  const normalizedDescription = jobDescription.toLowerCase();
  const matched = templates.find(template =>
    template.matchKeywords.some(keyword =>
      normalizedDescription.includes(keyword.toLowerCase()),
    ),
  );

  return matched ?? templates[0];
}

export function getMissingCoverLetterKnowledgeKeys(
  knowledge: Record<string, string>,
): string[] {
  const missing: string[] = [];

  if (!knowledge.coverLetterStyle?.trim()) {
    missing.push('coverLetterStyle');
  }

  if (parseWhyThisCompanyTemplates(knowledge.whyThisCompany ?? '').length < 3) {
    missing.push('whyThisCompany');
  }

  return missing;
}

export async function seedUserKnowledge(
  options: SeedUserKnowledgeOptions = {},
): Promise<SeedUserKnowledgeResult> {
  const user = await resolveSeedUser(options);
  const result: SeedUserKnowledgeResult = {
    created: 0,
    skippedManual: 0,
    unchanged: 0,
    updated: 0,
    userId: user.id,
  };

  for (const seed of USER_KNOWLEDGE_SEEDS) {
    const existing = await db.userKnowledge.findUnique({
      where: { userId_key: { key: seed.key, userId: user.id } },
    });

    if (!existing) {
      await db.userKnowledge.create({
        data: {
          confidence: seed.confidence,
          key: seed.key,
          source: seed.source,
          userId: user.id,
          value: seed.value,
        },
      });
      result.created += 1;
      continue;
    }

    if (
      existing.source === 'manual' &&
      existing.confidence >= seed.confidence
    ) {
      result.skippedManual += 1;
      continue;
    }

    const drift =
      existing.value !== seed.value ||
      existing.source !== seed.source ||
      existing.confidence !== seed.confidence;

    if (!drift) {
      result.unchanged += 1;
      continue;
    }

    await db.userKnowledge.update({
      data: {
        confidence: seed.confidence,
        source: seed.source,
        value: seed.value,
      },
      where: { userId_key: { key: seed.key, userId: user.id } },
    });
    result.updated += 1;
  }

  return result;
}

async function resolveSeedUser({ email, userId }: SeedUserKnowledgeOptions) {
  if (userId) {
    return db.user.findUniqueOrThrow({ where: { id: userId } });
  }

  if (email) {
    return db.user.findUniqueOrThrow({ where: { email } });
  }

  const envEmail = process.env.USER_KNOWLEDGE_SEED_EMAIL;
  if (envEmail) {
    return db.user.findUniqueOrThrow({ where: { email: envEmail } });
  }

  for (const defaultEmail of DEFAULT_STEVEN_EMAILS) {
    const user = await db.user.findUnique({ where: { email: defaultEmail } });
    if (user) {
      return user;
    }
  }

  throw new Error(
    `No seed user found. Set USER_KNOWLEDGE_SEED_EMAIL or pass userId.`,
  );
}

function isWhyThisCompanyTemplate(
  value: unknown,
): value is WhyThisCompanyTemplate {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    Array.isArray(candidate.matchKeywords) &&
    candidate.matchKeywords.every(keyword => typeof keyword === 'string') &&
    typeof candidate.template === 'string'
  );
}

if (import.meta.main) {
  seedUserKnowledge()
    .then(result => {
      console.log('UserKnowledge seed result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('UserKnowledge seed failed:', error);
      process.exit(1);
    });
}
