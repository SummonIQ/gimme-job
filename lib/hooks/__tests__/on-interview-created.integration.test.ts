// @vitest-environment node
import { db } from '@/lib/db/client';
import { afterAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateAIObject: vi.fn(async (prompt: string) => ({
    questions: [
      {
        description: 'Checks ownership of shipped systems.',
        difficulty: 'MEDIUM',
        question: 'Tell me about a production system you owned end to end.',
        type: 'BEHAVIORAL',
      },
      {
        description: 'Checks role-specific technical depth.',
        difficulty: 'MEDIUM',
        question: 'How would you debug a slow queue worker?',
        type: 'TECHNICAL',
      },
    ],
  })),
  prompts: [] as string[],
  sendEvent: vi.fn(async () => undefined),
}));

vi.mock('@/lib/ai', () => ({
  generateAIObject: vi.fn(async (prompt: string) => {
    mocks.prompts.push(prompt);
    return mocks.generateAIObject(prompt);
  }),
}));

vi.mock('@/lib/events/send', () => ({
  sendEvent: mocks.sendEvent,
}));

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
const createdUserIds: string[] = [];

function nextSuffix() {
  fixtureCounter += 1;
  return `p12-4-${Date.now()}-${fixtureCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function seedFixture() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `interview-prep-${suffix}@test.local`,
      firstName: 'Interview',
      lastName: 'Prep',
    },
  });
  createdUserIds.push(user.id);

  const jobListing = await db.jobListing.create({
    data: {
      company: 'Fixture Co',
      description: 'Own distributed TypeScript services and queue workers.',
      jobId: `jobid-${suffix}`,
      title: 'Senior Platform Engineer',
      userId: user.id,
    },
  });

  const resume = await db.resume.create({
    data: {
      name: 'Base Resume',
      userId: user.id,
    },
  });

  const resumeRevision = await db.resumeRevision.create({
    data: {
      markdown: 'Led queue reliability work and TypeScript platform projects.',
      name: 'Tailored Resume',
      resumeId: resume.id,
      userId: user.id,
    },
  });

  const jobLead = await db.jobLead.create({
    data: {
      jobListingId: jobListing.id,
      tailoredResumeRevisionId: resumeRevision.id,
      title: jobListing.title,
      userId: user.id,
    },
  });

  return { jobLead, user };
}

describe.skipIf(!HAS_DB)('onInterviewCreated (integration)', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('creates prep questions, a session, and an in-app notification for a matched invite', async () => {
    const { onInterviewCreated } = await import('../on-interview-created');
    const { jobLead, user } = await seedFixture();
    const emailId = `email-${nextSuffix()}`;

    const result = await onInterviewCreated({
      applicationSubmissionId: null,
      emailId,
      interviewDate: '2026-04-24T17:00:00.000Z',
      interviewType: 'VIDEO',
      jobLeadId: jobLead.id,
      source: 'improvmx_webhook',
      userId: user.id,
    });

    expect(result?.alreadyPrepared).toBe(false);
    expect(result?.sessionId).toEqual(expect.any(String));
    expect(result?.notificationId).toEqual(expect.any(String));

    const session = await db.interviewSession.findUniqueOrThrow({
      include: { questions: true },
      where: { id: result!.sessionId },
    });
    expect(session.jobLeadId).toBe(jobLead.id);
    expect(session.sourceEmailId).toBe(emailId);
    expect(session.questions).toHaveLength(2);

    const notification = await db.notification.findUniqueOrThrow({
      where: { id: result!.notificationId! },
    });
    expect(notification.eventType).toBe('INTERVIEW_REQUESTED');
    expect(notification.actionUrl).toBe(
      `/interviews/simulate?jobLeadId=${jobLead.id}`,
    );
    expect(notification.message).toContain('Prep questions are ready');

    expect(mocks.prompts.at(-1)).toContain(
      'Own distributed TypeScript services and queue workers.',
    );
    expect(mocks.prompts.at(-1)).toContain(
      'Led queue reliability work and TypeScript platform projects.',
    );

    const duplicate = await onInterviewCreated({
      emailId,
      jobLeadId: jobLead.id,
      source: 'improvmx_webhook',
      userId: user.id,
    });

    expect(duplicate?.alreadyPrepared).toBe(true);
    expect(duplicate?.sessionId).toBe(session.id);
    await expect(
      db.interviewSession.count({ where: { sourceEmailId: emailId } }),
    ).resolves.toBe(1);
  });
});
