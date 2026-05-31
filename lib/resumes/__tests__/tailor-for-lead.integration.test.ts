// @vitest-environment node
import { db } from '@/lib/db/client';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { tailorResumeForLead } from '../tailor-for-lead';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
const createdUserIds: string[] = [];

function nextSuffix() {
  fixtureCounter += 1;
  return `p9-2-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedTailoringFixture() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `tailor-resume-${suffix}@test.local`,
      firstName: 'Tailor',
      lastName: 'Resume',
    },
  });
  createdUserIds.push(user.id);

  const resume = await db.resume.create({
    data: {
      markdown:
        '# Tailor Resume\n\n## Experience\n- Built React dashboards for operations teams.\n\n## Skills\n- React\n- PostgreSQL',
      name: 'Base Resume',
      userId: user.id,
    },
  });
  const revision = await db.resumeRevision.create({
    data: {
      markdown:
        '# Tailor Resume\n\n## Experience\n- Built React dashboards for operations teams.\n\n## Skills\n- React\n- PostgreSQL',
      name: 'Base Revision',
      resumeId: resume.id,
      userId: user.id,
    },
  });

  await db.resume.update({
    data: { defaultRevisionId: revision.id },
    where: { id: resume.id },
  });
  await db.user.update({
    data: {
      defaultResumeId: resume.id,
      defaultRevisionId: revision.id,
    },
    where: { id: user.id },
  });

  const jobListing = await db.jobListing.create({
    data: {
      company: 'SignalSplash',
      description:
        'Build analytics dashboards with Next.js, TypeScript, and PostgreSQL for high-volume customer workflows.',
      jobId: `jobid-${suffix}`,
      qualifications: ['5+ years building web applications'],
      requirements: ['Next.js', 'TypeScript', 'PostgreSQL'],
      responsibilities: ['Ship analytics dashboards'],
      title: 'Senior Full Stack Engineer',
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

  return { jobLead, jobListing, resume, revision };
}

interface StoredTailoredFormats {
  docx: string;
  html: string;
  pdf: string;
  txt: string;
}

interface StoredTailoredJson {
  diffSummary: Array<{
    after: string;
    keywords: string[];
    reason: string;
    section: string;
  }>;
  emphasizedKeywords: string[];
  kind: string;
  source: {
    baseRevisionId: string | null;
    jobLeadId: string;
    jobListingId: string;
    resumeId: string;
  };
  summary: string;
}

describe.skipIf(!HAS_DB)('tailorResumeForLead', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('creates a tailored resume revision with all formats and links it to the lead', async () => {
    const { jobLead, jobListing, resume, revision } =
      await seedTailoringFixture();
    const rewriteResume = vi.fn(async () => ({
      diffSummary: [
        {
          after:
            'Added Next.js and TypeScript emphasis to the dashboard experience bullet.',
          keywords: ['Next.js', 'TypeScript', 'PostgreSQL'],
          reason:
            'The job description prioritizes analytics dashboards on this stack.',
          section: 'Experience',
        },
      ],
      emphasizedKeywords: ['Next.js', 'TypeScript', 'PostgreSQL'],
      markdown:
        '# Tailor Resume\n\n## Experience\n- Built React and Next.js analytics dashboards with TypeScript and PostgreSQL.\n\n## Skills\n- React\n- Next.js\n- TypeScript\n- PostgreSQL',
      summary: 'Tailored the resume toward the SignalSplash analytics role.',
    }));
    const renderFormats = vi.fn(async ({ markdown }) => ({
      docx: 'https://cdn.example/resumes/tailored.docx',
      html: `<p>${markdown}</p>`,
      pdf: 'https://cdn.example/resumes/tailored.pdf',
      txt: markdown,
    }));

    const result = await tailorResumeForLead(jobLead.id, {
      renderFormats,
      rewriteResume,
    });

    expect(rewriteResume).toHaveBeenCalledWith(
      expect.objectContaining({
        company: 'SignalSplash',
        jobTitle: 'Senior Full Stack Engineer',
      }),
    );
    expect(renderFormats).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: jobLead.id,
        resumeId: resume.id,
        title: jobLead.title,
      }),
    );

    const updatedLead = await db.jobLead.findUniqueOrThrow({
      include: { tailoredResumeRevision: true },
      where: { id: jobLead.id },
    });
    const tailoredRevision = updatedLead.tailoredResumeRevision;

    expect(updatedLead.tailoredResumeRevisionId).toBe(result.revisionId);
    expect(tailoredRevision?.id).toBe(result.revisionId);
    expect(tailoredRevision?.resumeId).toBe(resume.id);
    expect(tailoredRevision?.markdown).toContain('Next.js');
    expect(tailoredRevision?.markdown).toContain('TypeScript');
    expect(tailoredRevision?.pdfDocumentUrl).toBe(
      'https://cdn.example/resumes/tailored.pdf',
    );
    expect(tailoredRevision?.wordDocumentUrl).toBe(
      'https://cdn.example/resumes/tailored.docx',
    );

    const formats =
      tailoredRevision?.formats as unknown as StoredTailoredFormats;
    expect(formats).toEqual({
      docx: 'https://cdn.example/resumes/tailored.docx',
      html: expect.stringContaining('Next.js'),
      pdf: 'https://cdn.example/resumes/tailored.pdf',
      txt: expect.stringContaining('PostgreSQL'),
    });

    const metadata = tailoredRevision?.json as unknown as StoredTailoredJson;
    expect(metadata.kind).toBe('TAILORED_RESUME_FOR_LEAD');
    expect(metadata.source).toEqual({
      baseRevisionId: revision.id,
      jobLeadId: jobLead.id,
      jobListingId: jobListing.id,
      resumeId: resume.id,
    });
    expect(metadata.emphasizedKeywords).toEqual([
      'Next.js',
      'TypeScript',
      'PostgreSQL',
    ]);
    expect(metadata.diffSummary[0]).toEqual(
      expect.objectContaining({
        keywords: ['Next.js', 'TypeScript', 'PostgreSQL'],
        section: 'Experience',
      }),
    );
  });
});
