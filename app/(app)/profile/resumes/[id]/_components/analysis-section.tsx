import {
  Field,
  FieldLabel,
  Fields,
  FieldValue,
} from '@/components/data/fields';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ResumeAnalysis } from '@/types/domain/resume';

interface AnalysisSectionProps {
  analysis: ResumeAnalysis;
}

export function AnalysisSection({ analysis }: AnalysisSectionProps) {
  return (
    <>
      {/* Summary & Score */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields className="grid-cols-1 border-b border-muted/90 md:grid-cols-[10rem_1fr]">
            <Field className="md:w-40">
              <FieldLabel>ATS Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {analysis.score}
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Summary</FieldLabel>
              <FieldValue>{analysis.summary}</FieldValue>
            </Field>
          </Fields>

          <Fields className="grid-cols-1 md:grid-cols-2">
            <Field>
              <FieldLabel>Strengths</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.strengths.map(s => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Weaknesses</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.weaknesses.map(w => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>
          </Fields>
        </CardContent>
      </Card>

      {/* Grammar & Spelling */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>Grammar &amp; Spelling</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields className="grid-cols-1 md:grid-cols-[10rem_1fr]">
            <Field className="md:w-40">
              <FieldLabel>Grammar Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {analysis.grammar?.score ?? '—'}
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>
                Grammar Issues ({analysis.grammar?.issues_found ?? 0})
              </FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.grammar?.issues?.length
                    ? analysis.grammar.issues.map(issue => {
                        const key = `${issue.word}-${issue.suggestion}`;
                        return (
                          <li key={key}>
                            {issue.description}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {issue.example}
                            </span>
                            <br />
                            <span className="text-xs text-foreground">
                              {issue.suggestion}
                            </span>
                          </li>
                        );
                      })
                    : 'No issues found.'}
                </ul>
              </FieldValue>
            </Field>

            <Field className="md:w-40">
              <FieldLabel>Spelling Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {analysis.spelling?.score ?? '—'}
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>
                Spelling Issues ({analysis.spelling?.issues_found ?? 0})
              </FieldLabel>
              <FieldValue>
                {analysis.spelling?.issues?.length ? (
                  <ul className="ml-5 list-disc">
                    {analysis.spelling.issues.map((issue, i) => (
                      <li key={`spelling-${i}`}>
                        <strong>{issue.word}</strong> should be{' '}
                        <em>{issue.suggestion}</em>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {issue.context_sentence}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No issues found.
                  </p>
                )}
              </FieldValue>
            </Field>
          </Fields>
        </CardContent>
      </Card>

      {/* Keywords */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>Keyword Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields className="grid-cols-1 md:grid-cols-[10rem_1fr]">
            <Field className="md:w-40">
              <FieldLabel>Keywords Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {analysis.keywords.score}
              </FieldValue>
            </Field>
            <Field>
              <FieldLabel>Summary</FieldLabel>
              <FieldValue>
                {analysis.keywords.feedback?.length ? (
                  <ul className="ml-5 list-disc">
                    {analysis.keywords.feedback.map((fb, i) => (
                      <li key={`feedback-${i}`}>{fb}</li>
                    ))}
                  </ul>
                ) : (
                  'No feedback found.'
                )}
              </FieldValue>
            </Field>
          </Fields>
          <Fields className="grid-cols-1 md:grid-cols-2">
            <Field>
              <FieldLabel>Missing Keywords</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.keywords.missing.map((kw, i) => (
                    <li key={`missing-${i}`}>{kw}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>
            <Field>
              <FieldLabel>Overused Keywords</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.keywords.overused.map((kw, i) => (
                    <li key={`overused-${i}`}>{kw}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>
          </Fields>
        </CardContent>
      </Card>

      {/* Sections */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>Sections Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields className="grid-cols-1 md:grid-cols-[10rem_1fr]">
            <Field className="md:w-40">
              <FieldLabel>Overall Sections Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {analysis.sections.score}
              </FieldValue>
            </Field>

            {analysis.sections.details?.length ? (
              <Field>
                <FieldLabel>Section Feedback</FieldLabel>
                <FieldValue>
                  <ul className="ml-5 list-disc">
                    {analysis.sections.details.flatMap((detail, i) =>
                      detail.feedback.map((fb, j) => (
                        <li key={`detail-feedback-${i}-${j}`}>
                          {detail.name}: {fb}
                        </li>
                      )),
                    )}
                  </ul>
                </FieldValue>
              </Field>
            ) : (
              <p className="text-sm text-muted-foreground">
                No section issues reported.
              </p>
            )}
          </Fields>
        </CardContent>
      </Card>

      {/* Formatting, Readability & Likeability */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>Formatting, Readability &amp; Likeability</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields className="grid-cols-1 md:grid-cols-[10rem_1fr]">
            <Field className="md:w-40">
              <FieldLabel>Formatting Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {analysis.formatting.score}
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Formatting Feedback</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.formatting.feedback.map((fb, i) => (
                    <li key={`formatting-fb-${i}`}>{fb}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>

            <Field className="md:w-40">
              <FieldLabel>Readability Score</FieldLabel>
              <FieldValue className="font-mono font-semibold">
                {analysis.readability.score}
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Readability Feedback</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.readability.feedback.map((fb, i) => (
                    <li key={`readability-fb-${i}`}>{fb}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>

            <Field className="md:w-40">
              <FieldLabel>Likeability Score</FieldLabel>
              <FieldValue className="font-mono font-semibold">
                {analysis.likeability?.score ?? '—'}
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Likeability Feedback</FieldLabel>
              <FieldValue>
                {analysis.likeability?.feedback?.length ? (
                  <ul className="ml-5 list-disc">
                    {analysis.likeability.feedback.map((fb, i) => (
                      <li key={`likeability-fb-${i}`}>{fb}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not available — re-analyze to generate likeability score.
                  </p>
                )}
              </FieldValue>
            </Field>
          </Fields>
          <Fields className="grid-cols-1">
            <Field>
              <FieldLabel>Incompatible Elements</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.formatting.incompatible_elements.map((el, i) => (
                    <li key={`incompat-${i}`}>{el}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>
          </Fields>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields className="grid-cols-1 md:grid-cols-[10rem_1fr]">
            <Field className="md:w-40">
              <FieldLabel>Achievements Score</FieldLabel>
              <FieldValue className="font-mono text-lg font-semibold">
                {analysis.achievements.score}
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Good Examples</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.achievements.good_examples.map((ex, i) => (
                    <li key={`good-${i}`}>{ex}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>
          </Fields>

          <Fields className="grid-cols-1">
            <Field>
              <FieldLabel>Needs Improvement</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.achievements.needs_improvement.map((ni, i) => (
                    <li key={`needs-${i}`}>{ni}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>
          </Fields>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          <Fields>
            <Field>
              <FieldLabel>Priority Fixes</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.recommendations.priority_fixes.map((fix, i) => (
                    <li key={`priority-${i}`}>{fix}</li>
                  ))}
                </ul>
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Content Enhancements</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.recommendations.content_enhancements.map(
                    (enh, i) => (
                      <li key={`content-${i}`}>{enh}</li>
                    ),
                  )}
                </ul>
              </FieldValue>
            </Field>

            <Field>
              <FieldLabel>Long Term Improvements</FieldLabel>
              <FieldValue>
                <ul className="ml-5 list-disc">
                  {analysis.recommendations.long_term_improvements.map(
                    (lt, i) => (
                      <li key={`longterm-${i}`}>{lt}</li>
                    ),
                  )}
                </ul>
              </FieldValue>
            </Field>
          </Fields>
        </CardContent>
      </Card>
    </>
  );
}
