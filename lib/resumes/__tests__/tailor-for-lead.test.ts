import { describe, expect, it } from 'vitest';

import {
  buildTailoredResumePrompt,
  renderTailoredResumeFormats,
} from '../tailor-for-lead';

describe('buildTailoredResumePrompt', () => {
  it('contains the source resume, job description, keyword requirement, and review diff contract', () => {
    const prompt = buildTailoredResumePrompt({
      baseResumeMarkdown:
        '# Steven Bennett\n\n## Experience\n- Built React dashboards.',
      company: 'SignalSplash',
      jobDescription:
        'Description:\nBuild Next.js analytics products with TypeScript and PostgreSQL.',
      jobTitle: 'Senior Full Stack Engineer',
      userProfile: { location: 'California' },
    });

    expect(prompt).toContain('Senior Full Stack Engineer');
    expect(prompt).toContain('SignalSplash');
    expect(prompt).toContain('Next.js analytics products');
    expect(prompt).toContain('Built React dashboards');
    expect(prompt).toContain('emphasizedKeywords');
    expect(prompt).toContain('diffSummary');
    expect(prompt).toContain('Do not invent employers');
    expect(prompt).toContain('truthful experience');
  });
});

describe('renderTailoredResumeFormats', () => {
  it('renders text/html/pdf and uploads docx/pdf assets', async () => {
    const uploads: Array<{
      contentLength: number;
      contentType: string;
      extension: string;
    }> = [];

    const formats = await renderTailoredResumeFormats(
      {
        leadId: 'lead-123',
        markdown:
          '# Tailored Resume\n\n## Skills\n- Next.js\n- TypeScript\n- PostgreSQL',
        resumeId: 'resume-123',
        title: 'Senior Full Stack Engineer',
        userId: 'user-123',
      },
      {
        convertToDocx: async () => Buffer.from('docx-content'),
        upload: async input => {
          uploads.push({
            contentLength: input.body.byteLength,
            contentType: input.contentType,
            extension: input.extension,
          });

          return `https://cdn.example/${input.extension}`;
        },
      },
    );

    expect(formats).toEqual({
      docx: 'https://cdn.example/docx',
      html: expect.stringContaining('<h1>Tailored Resume</h1>'),
      pdf: 'https://cdn.example/pdf',
      txt: expect.stringContaining('Next.js'),
    });
    expect(formats.html).toContain('<li>TypeScript</li>');
    expect(uploads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentLength: 'docx-content'.length,
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: 'docx',
        }),
        expect.objectContaining({
          contentType: 'application/pdf',
          extension: 'pdf',
        }),
      ]),
    );
    expect(
      uploads.find(upload => upload.extension === 'pdf')?.contentLength,
    ).toBeGreaterThan(0);
  });
});
