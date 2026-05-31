// @vitest-environment node
import { db } from '@/lib/db/client';
import { afterAll, describe, expect, it } from 'vitest';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;

function nextSuffix() {
  fixtureCounter += 1;
  return `p9-1-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedFixture() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `tailored-assets-${suffix}@test.local`,
      firstName: 'Tailored',
      lastName: 'Assets',
    },
  });
  createdUserIds.push(user.id);

  const jobListing = await db.jobListing.create({
    data: {
      jobId: `jobid-${suffix}`,
      title: 'Senior Engineer',
      userId: user.id,
    },
  });

  const resume = await db.resume.create({
    data: {
      name: 'Base Resume',
      userId: user.id,
    },
  });

  const jobLead = await db.jobLead.create({
    data: {
      jobListingId: jobListing.id,
      title: jobListing.title,
      userId: user.id,
    },
  });

  return { user, jobListing, resume, jobLead };
}

describe.skipIf(!HAS_DB)('P9.1 tailored lead assets schema', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('round-trips the formats blob on ResumeRevision', async () => {
    const { user, resume } = await seedFixture();

    const formats = {
      pdf: 'https://cdn.example/resumes/123.pdf',
      docx: 'https://cdn.example/resumes/123.docx',
      txt: 'resume\ntext\nbody',
      html: '<html><body>resume</body></html>',
    } as const;

    const created = await db.resumeRevision.create({
      data: {
        formats,
        name: 'Tailored Rev',
        resumeId: resume.id,
        userId: user.id,
      },
    });

    expect(created.formats).toEqual(formats);

    const fetched = await db.resumeRevision.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(fetched.formats).toEqual(formats);
  });

  it('accepts null formats (backfill default)', async () => {
    const { user, resume } = await seedFixture();

    const created = await db.resumeRevision.create({
      data: {
        name: 'No-formats Rev',
        resumeId: resume.id,
        userId: user.id,
      },
    });

    expect(created.formats).toBeNull();
  });

  it('links JobLead.tailoredResumeRevisionId and JobLead.tailoredCoverLetterId', async () => {
    const { user, resume, jobLead } = await seedFixture();

    const revision = await db.resumeRevision.create({
      data: {
        formats: { pdf: 'x', docx: 'y', txt: 'z', html: '<p/>' },
        name: 'Tailored',
        resumeId: resume.id,
        userId: user.id,
      },
    });

    const coverLetter = await db.coverLetter.create({
      data: {
        name: 'Tailored CL',
        userId: user.id,
      },
    });

    const updated = await db.jobLead.update({
      data: {
        tailoredCoverLetterId: coverLetter.id,
        tailoredResumeRevisionId: revision.id,
      },
      include: {
        tailoredCoverLetter: true,
        tailoredResumeRevision: true,
      },
      where: { id: jobLead.id },
    });

    expect(updated.tailoredResumeRevisionId).toBe(revision.id);
    expect(updated.tailoredCoverLetterId).toBe(coverLetter.id);
    expect(updated.tailoredResumeRevision?.id).toBe(revision.id);
    expect(updated.tailoredResumeRevision?.formats).toEqual({
      pdf: 'x',
      docx: 'y',
      txt: 'z',
      html: '<p/>',
    });
    expect(updated.tailoredCoverLetter?.id).toBe(coverLetter.id);
  });

  it('nulls tailored FKs on ON DELETE SET NULL', async () => {
    const { user, resume, jobLead } = await seedFixture();

    const revision = await db.resumeRevision.create({
      data: { name: 'Deletable', resumeId: resume.id, userId: user.id },
    });
    const coverLetter = await db.coverLetter.create({
      data: { name: 'Deletable CL', userId: user.id },
    });

    await db.jobLead.update({
      data: {
        tailoredCoverLetterId: coverLetter.id,
        tailoredResumeRevisionId: revision.id,
      },
      where: { id: jobLead.id },
    });

    await db.resumeRevision.delete({ where: { id: revision.id } });
    await db.coverLetter.delete({ where: { id: coverLetter.id } });

    const after = await db.jobLead.findUniqueOrThrow({
      where: { id: jobLead.id },
    });
    expect(after.tailoredResumeRevisionId).toBeNull();
    expect(after.tailoredCoverLetterId).toBeNull();
  });
});
