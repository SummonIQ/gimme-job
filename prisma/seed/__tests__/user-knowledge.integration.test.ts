// @vitest-environment node
import { db } from '@/lib/db/client';
import { afterAll, describe, expect, it } from 'vitest';

import {
  getMissingCoverLetterKnowledgeKeys,
  parseWhyThisCompanyTemplates,
  seedUserKnowledge,
  USER_KNOWLEDGE_SEEDS,
  findWhyThisCompanyTemplate,
} from '../user-knowledge';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
const createdUserIds: string[] = [];

function nextSuffix() {
  fixtureCounter += 1;
  return `p9-5-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createSeedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `user-knowledge-${suffix}@test.local`,
      firstName: 'Seed',
      lastName: 'Knowledge',
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function getKnowledgeMap(
  userId: string,
): Promise<Record<string, string>> {
  const rows = await db.userKnowledge.findMany({
    select: { key: true, value: true },
    where: { userId },
  });

  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}

describe.skipIf(!HAS_DB)('UserKnowledge seed', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('populates coverLetterStyle and a whyThisCompany template library', async () => {
    const user = await createSeedUser();
    const result = await seedUserKnowledge({ userId: user.id });

    expect(result.created).toBe(USER_KNOWLEDGE_SEEDS.length);
    expect(result.updated).toBe(0);

    const knowledge = await getKnowledgeMap(user.id);
    const templates = parseWhyThisCompanyTemplates(knowledge.whyThisCompany);

    expect(knowledge.coverLetterStyle).toContain('senior-engineer voice');
    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(getMissingCoverLetterKnowledgeKeys(knowledge)).toEqual([]);
  });

  it('is idempotent for unchanged seed-owned rows', async () => {
    const user = await createSeedUser();
    await seedUserKnowledge({ userId: user.id });

    const second = await seedUserKnowledge({ userId: user.id });
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(USER_KNOWLEDGE_SEEDS.length);
  });

  it('does not overwrite manual knowledge with equal or higher confidence', async () => {
    const user = await createSeedUser();
    await db.userKnowledge.create({
      data: {
        confidence: 1,
        key: 'coverLetterStyle',
        source: 'manual',
        userId: user.id,
        value: 'Manual Steven-approved cover letter style.',
      },
    });

    const result = await seedUserKnowledge({ userId: user.id });
    const row = await db.userKnowledge.findUniqueOrThrow({
      where: { userId_key: { key: 'coverLetterStyle', userId: user.id } },
    });

    expect(result.skippedManual).toBe(1);
    expect(row.value).toBe('Manual Steven-approved cover letter style.');
    expect(row.source).toBe('manual');
  });

  it('provides reusable why-this-company context for five sample job descriptions', async () => {
    const user = await createSeedUser();
    await seedUserKnowledge({ userId: user.id });
    const knowledge = await getKnowledgeMap(user.id);
    const templates = parseWhyThisCompanyTemplates(knowledge.whyThisCompany);
    const sampleDescriptions = [
      'Build analytics dashboards and reporting workflows for SaaS customers.',
      'Improve cloud infrastructure, APIs, and CI/CD for a developer platform.',
      'Ship accessible software for public sector and regulated healthcare teams.',
      'Scale consumer commerce flows with React performance improvements.',
      'Create collaborative product experiences for operational teams.',
    ];

    expect(getMissingCoverLetterKnowledgeKeys(knowledge)).toEqual([]);
    for (const description of sampleDescriptions) {
      const template = findWhyThisCompanyTemplate(templates, description);
      const rendered = template.template.replace('{company}', 'ExampleCo');

      expect(template.id).toBeTruthy();
      expect(rendered).toContain('ExampleCo');
      expect(rendered.length).toBeGreaterThan(80);
    }
  });
});
