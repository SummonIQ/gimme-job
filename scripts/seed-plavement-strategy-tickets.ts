/**
 * One-shot seeder: create epics + issues in Plavement for GimmeJob's
 * strategic / near-term feature backlog.
 *
 * Usage:
 *   bun run scripts/seed-plavement-strategy-tickets.ts           # dry run
 *   bun run scripts/seed-plavement-strategy-tickets.ts --execute # actually create
 *
 * Targets the existing "Gimme Job" project in the local Plavement
 * instance. Each issue is sized to ~1–3 days of focused work and
 * carries a structured description (context → acceptance → notes).
 */

const API_URL = (process.env.PLAVEMENT_API_URL ?? 'http://localhost:20020').replace(
  /\/+$/,
  '',
);
const API_KEY =
  process.env.PLAVEMENT_API_KEY ?? 'pl_live_vL2rTMozak4t4UFnsqU8DOMnDO2lX6DI';
const EXECUTE = process.argv.includes('--execute');
const GIMME_JOB_PROJECT_ID = 'cmozyi0md0004d58o618migs9';

interface Issue {
  title: string;
  description: string;
}

interface EpicSpec {
  name: string;
  description: string;
  color: string;
  icon: string;
  issues: Issue[];
}

async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  attempt = 1,
): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${res.status}`;
      throw new Error(`${init.method ?? 'GET'} ${path} → ${msg}`);
    }
    return data as T;
  } catch (err) {
    const transient =
      err instanceof Error &&
      (/ECONNRESET|socket connection|fetch failed|network/i.test(err.message));
    if (transient && attempt < 4) {
      await new Promise(r => setTimeout(r, 600 * attempt));
      return api<T>(path, init, attempt + 1);
    }
    throw err;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------- Issue body helper ----------

function body({
  context,
  acceptance,
  notes,
  dependsOn,
}: {
  context: string;
  acceptance: string[];
  notes?: string;
  dependsOn?: string;
}): string {
  const parts: string[] = [];
  parts.push(`**Context**\n\n${context.trim()}`);
  parts.push(
    `**Acceptance criteria**\n\n${acceptance.map(a => `- ${a}`).join('\n')}`,
  );
  if (dependsOn) parts.push(`**Depends on**\n\n${dependsOn}`);
  if (notes) parts.push(`**Notes**\n\n${notes.trim()}`);
  return parts.join('\n\n');
}

// ---------- Epic + issue definitions ----------

const EPICS: EpicSpec[] = [
  {
    name: 'Outcome Intelligence',
    description:
      'Use ApplicationOutcomeEvent + JobFitAnalysis + ResumeRevision data to tell users which of their inputs (skills, resume variants, application strategies) actually convert to interviews and offers.',
    color: '#22c55e',
    icon: 'Target',
    issues: [
      {
        title: 'Define outcome-anchored skill-graph schema',
        description: body({
          context:
            'Skill claims today are unranked. We need a join surface between user-asserted skills, the JobFitAnalysis where each skill was scored, and the downstream ApplicationOutcomeEvent stages so we can show empirical conversion per skill.',
          acceptance: [
            'New Prisma model linking a skill atom to ApplicationSubmission + its outcome stage',
            'Migration adds backfill from existing JobFitAnalysis rows',
            'Documented in a short ADR in /docs',
          ],
        }),
      },
      {
        title: 'Build outcome-rollup job for skill conversion stats',
        description: body({
          context:
            'Given the link table, we need a periodic rollup that aggregates: per-skill application count, interview count, offer count, and conversion rates.',
          acceptance: [
            'Background job (cron + manual trigger) writes SkillOutcomeRollup rows per user',
            'Idempotent — re-running does not double count',
            'Reads from ApplicationOutcomeEvent as source of truth',
          ],
          dependsOn: 'Define outcome-anchored skill-graph schema',
        }),
      },
      {
        title: 'Outcome-anchored skill graph: profile surface',
        description: body({
          context:
            "Surface each user's skills with their empirical conversion rate. Skills with high interview-conversion should sort to the top; skills with low conversion should be flagged for de-emphasis or removal.",
          acceptance: [
            'New section on /profile showing skills with interview/offer conversion %',
            'Tooltip explains: count of applications, count of interviews, time window',
            'CTA to remove or down-weight low-converting skills',
          ],
          dependsOn: 'Build outcome-rollup job for skill conversion stats',
        }),
      },
      {
        title: 'Wire ResumeRevision to outcomes',
        description: body({
          context:
            'ResumeRevision is per-application but we never join it to outcomes. We need to attach the revision id used at submit time to the ApplicationSubmission and ensure it persists through outcome events.',
          acceptance: [
            'ApplicationSubmission.resumeRevisionId backfilled where derivable',
            'Submitter pipelines write resumeRevisionId at submit',
            'Index added for (resumeRevisionId, finalOutcomeAt)',
          ],
        }),
      },
      {
        title: 'Resume A/B conversion view',
        description: body({
          context:
            "Show the user which of their resume revisions are converting. Per-revision conversion to interview / final outcome, plus a 'champion vs challenger' framing for the two most-used revisions.",
          acceptance: [
            'New view at /profile/resumes/[id]/performance',
            'Per-revision rows with apps sent, interviews, offers, success %',
            'Highlight statistical significance flag when sample > 20',
          ],
          dependsOn: 'Wire ResumeRevision to outcomes',
        }),
      },
      {
        title: 'Failure-pattern dataset assembler',
        description: body({
          context:
            'Train a second head on the closed-posting model using application failures (FAILED submissions, REJECTED, ghosted, etc.). First we need a clean training dataset.',
          acceptance: [
            'Job assembles (features, failure-type) examples from ApplicationSubmission + outcomeEvents',
            'Features include: ATS, fit score, resume revision id, posting age, time of day, etc.',
            'Stored in a new ML training table; reproducible build',
          ],
        }),
      },
      {
        title: 'Failure-pattern model + coaching surface',
        description: body({
          context:
            'Predict likely failure cause before submit ("posting is likely stale", "fit score below your interview threshold", "this ATS rejects without cover letter") and surface as a pre-submit coaching nudge.',
          acceptance: [
            'Model serves predictions at submit time (latency < 200ms)',
            'Coaching UI appears in the assist flow before submit',
            'Predictions logged for offline accuracy review',
          ],
          dependsOn: 'Failure-pattern dataset assembler',
        }),
      },
    ],
  },
  {
    name: 'Personal Market Signal',
    description:
      'Personalized, real-time market signals: demand index, comp index, career-graph next steps, and recruiter trust scoring — all grounded in scraped listings and aggregated outcomes.',
    color: '#06b6d4',
    icon: 'Activity',
    issues: [
      {
        title: 'Listings-to-skill-bundle indexer',
        description: body({
          context:
            "We have huge ingestion volume but no per-user index of 'how is the market for THIS skill bundle today'. Need a rollup that scores listing volume + comp distribution against each user's skill set.",
          acceptance: [
            'Daily job builds PersonalMarketSnapshot rows per user',
            'Inputs: user skill atoms, last 30/90 days of listings, comp data where present',
            'Output includes percentile rank vs general market',
          ],
        }),
      },
      {
        title: 'Personal market index dashboard widget',
        description: body({
          context:
            "Surface the user's market index on the dashboard with sparklines for the last 90 days and a callout when their bundle becomes hot or cool.",
          acceptance: [
            'Dashboard widget with current index, 90-day sparkline, and delta vs last week',
            'Drill-in shows top contributing listings and comp distribution',
            'Real-time refresh via Pusher when a new snapshot lands',
          ],
          dependsOn: 'Listings-to-skill-bundle indexer',
        }),
      },
      {
        title: 'Career-graph dataset from anonymized career paths',
        description: body({
          context:
            "Build a career-graph node + edge dataset from anonymized peer career paths (CoreSignal / Apollo). For each role, list common next roles weighted by frequency and time-in-role.",
          acceptance: [
            'New CareerGraphNode + CareerGraphEdge tables',
            'Seeded from a controlled CoreSignal pull (compliance-reviewed)',
            'Edge weights include median time-in-role',
          ],
        }),
      },
      {
        title: 'Career-graph next-step suggestions UI',
        description: body({
          context:
            "Show the user their likely next roles based on similar career graphs, with an estimated readiness score against their current skill bundle.",
          acceptance: [
            'New /profile/career-path view with top 5 likely next roles',
            'Each next-step shows readiness % and the top skill gaps',
            'Link from a next-step to a saved JobSearch pre-filtered to that role',
          ],
          dependsOn: 'Career-graph dataset from anonymized career paths',
        }),
      },
      {
        title: 'Recruiter / employer signal aggregator',
        description: body({
          context:
            'Aggregate company-level response signals from ApplicationSubmission + outcome events: response rate, time-to-first-response, interview-to-offer rate, ghost rate.',
          acceptance: [
            'Nightly rollup writes EmployerSignalRollup per company',
            'Privacy-safe: only aggregated across users; no individual disclosure',
            'API to fetch the rollup for a given company',
          ],
        }),
      },
      {
        title: 'Recruiter trust score on listing + lead views',
        description: body({
          context:
            'Expose the employer signal rollup as a "trust score" pill on job listings and lead detail. Surfaces ghost-rate and response-time so candidates can prioritize.',
          acceptance: [
            'Score pill rendered on /jobs/[id], /leads/[id]',
            'Hover/tap reveals breakdown',
            'Score is disclosed as based on aggregated GimmeJob user data',
          ],
          dependsOn: 'Recruiter / employer signal aggregator',
        }),
      },
    ],
  },
  {
    name: 'Inbox Signals & Auto-Reply',
    description:
      'Treat the dedicated per-user application inbox as a first-class signal stream. Classify every inbound, surface the live pulse, draft replies, and protect against ghost.',
    color: '#a78bfa',
    icon: 'Inbox',
    issues: [
      {
        title: 'Inbound email classifier',
        description: body({
          context:
            'Classify every inbound message into a fixed taxonomy: auto_confirmation, screening_invite, interview_invite, rejection, salary_question, recruiter_outreach, ghosted, other.',
          acceptance: [
            'Server-side classifier writes ApplicationEmail.detectedStatus',
            'Uses an AI SDK call with structured output (Zod schema)',
            'Confidence threshold + manual-review queue for low-confidence cases',
          ],
        }),
      },
      {
        title: 'Live mutual-interest pulse feed',
        description: body({
          context:
            'Surface the classifier output as a live pulse feed on the dashboard, ordered by signal weight. Heaviest signals (interview_invite, offer-adjacent) at the top.',
          acceptance: [
            'Dashboard section "Pulse" with live feed of classified messages',
            'Realtime updates via Pusher when a new email is classified',
            'Each row links to the underlying ApplicationSubmission',
          ],
          dependsOn: 'Inbound email classifier',
        }),
      },
      {
        title: 'Reply-suggestion generator',
        description: body({
          context:
            'For each classified inbound, generate a context-aware draft reply (accept interview, ask about comp range, follow up after delay).',
          acceptance: [
            'Server action returns drafted reply text + tone toggle',
            'Drafts stored on FollowUpDraft model',
            'User can edit + send (sends out via SMTP from the user\'s tracking address)',
          ],
          dependsOn: 'Inbound email classifier',
        }),
      },
      {
        title: 'Ghost detection + auto-followup queue',
        description: body({
          context:
            'When an application has had no inbound for N days after SUBMITTED, mark it as candidate-ghosted and queue a follow-up draft at the right cadence (3d, 10d, 21d).',
          acceptance: [
            'Cron evaluates ghost candidates daily and creates FollowUpDraft rows',
            'User receives notification with a one-click "send"',
            'Stops escalating once any inbound arrives',
          ],
          dependsOn: 'Inbound email classifier',
        }),
      },
    ],
  },
  {
    name: 'Skill Atomization & Matching',
    description:
      'Replace the keyword-bag matching of listings vs candidates with decomposed skill atoms and confidence-scored matches.',
    color: '#f59e0b',
    icon: 'Hexagon',
    issues: [
      {
        title: 'Skill atom dictionary + extractor',
        description: body({
          context:
            'Define a canonical skill atom dictionary (composable units like "React.useEffect", "Postgres + pgvector", "AWS Lambda cold-start tuning"). Build an extractor that pulls atoms from listings and from resume text.',
          acceptance: [
            'SkillAtom table seeded with a starter dictionary (~1k atoms)',
            'Extractor runs per ingested listing and on resume parse',
            'Confidence score per extracted atom',
          ],
        }),
      },
      {
        title: 'Listing → atom decomposition pipeline',
        description: body({
          context:
            'Decompose every newly ingested listing into its skill atom set, with weights for required vs nice-to-have.',
          acceptance: [
            'Hook into the listing ingestion pipeline',
            'Persisted as ListingSkillAtom join rows',
            'Backfill job for existing listings (rate-limited)',
          ],
          dependsOn: 'Skill atom dictionary + extractor',
        }),
      },
      {
        title: 'Resume → atom decomposition pipeline',
        description: body({
          context:
            'Same decomposition applied to user resumes and tracked over revisions.',
          acceptance: [
            'Triggered on Resume create + ResumeRevision create',
            'Stored as ResumeSkillAtom rows with revisionId',
            'Visible diff between revisions in the resume designer',
          ],
          dependsOn: 'Skill atom dictionary + extractor',
        }),
      },
      {
        title: 'Atom-level match score replaces keyword match',
        description: body({
          context:
            'Replace the current JobFitAnalysis keyword overlap with an atom-vs-atom match including confidence + weighting. Surface the missing atoms as the gap list.',
          acceptance: [
            'New JobFitAnalysis.atomMatchScore alongside the legacy score',
            'Top "missing atoms" displayed on /leads/[id]',
            'A/B flag to compare old vs new ranking for a quarter',
          ],
          dependsOn: [
            'Listing → atom decomposition pipeline',
            'Resume → atom decomposition pipeline',
          ].join(' + '),
        }),
      },
    ],
  },
  {
    name: 'ATS Submission Intelligence',
    description:
      'Make submissions smarter per ATS: canonical answers adapted per platform with effectiveness scoring, and pacing driven by ATSAutomationPosture.',
    color: '#0ea5e9',
    icon: 'Bot',
    issues: [
      {
        title: 'Canonical answer store',
        description: body({
          context:
            'Today field-resolution recomputes per submit. Move to a canonical answer per question with provenance, last-updated, and effectiveness scoring.',
          acceptance: [
            'New CanonicalAnswer table keyed by question intent + user',
            'Resolver reads canonical first, falls back to per-submit AI',
            'Edit UI in /profile to review and lock answers',
          ],
        }),
      },
      {
        title: 'Per-ATS answer adaptation',
        description: body({
          context:
            'Same intent often needs different phrasing per ATS (e.g. Workday demographics vs Greenhouse open-text). Build an adapter layer keyed on (canonicalAnswerId, ATS) with a small dataset of variants.',
          acceptance: [
            'AnswerAdaptation join keyed on canonical answer + ATS',
            'Adapter applied at field-resolution time',
            'Variants seeded for the top 6 ATSes',
          ],
          dependsOn: 'Canonical answer store',
        }),
      },
      {
        title: 'Effectiveness scoring on answers',
        description: body({
          context:
            'Score each canonical answer + adaptation based on downstream outcomes (was the application submitted cleanly, did it advance).',
          acceptance: [
            'Rollup job computes per-answer success/failure counts',
            'Low-effectiveness answers flagged for user review',
            'Surfaced in the answer edit UI',
          ],
          dependsOn: 'Per-ATS answer adaptation',
        }),
      },
      {
        title: 'Promote ATSAutomationPosture to scheduling input',
        description: body({
          context:
            'Today ATSAutomationPosture is a safety check at submit time. Promote it to a scheduling input so the runtime spaces submissions to FORBIDDEN/GRAY postures appropriately.',
          acceptance: [
            'Scheduler reads posture and applies per-posture pacing rules',
            'GRAY postures inject jitter and per-day caps',
            'FORBIDDEN postures route to assist mode only',
          ],
        }),
      },
      {
        title: 'Strategic burst pacing engine',
        description: body({
          context:
            'For a planned burst (e.g. 30 apps in a session), generate a paced plan that respects per-ATS posture, time-of-day windows, and the user\'s outcome history.',
          acceptance: [
            'BurstPlan rows generated for each session',
            'UI shows the plan with timings before kickoff',
            'Plan adapts on the fly to failures',
          ],
          dependsOn: 'Promote ATSAutomationPosture to scheduling input',
        }),
      },
    ],
  },
  {
    name: 'Per-Application Artifacts',
    description:
      'Auto-generate tailored 1-page portfolios per application by composing user-uploaded artifacts (case studies, repos, demos, metrics).',
    color: '#ec4899',
    icon: 'FilePlus',
    issues: [
      {
        title: 'User artifact uploader + storage',
        description: body({
          context:
            "Lets users upload Looms, repo links, case studies, metric screenshots, etc. — the raw material for tailored portfolios.",
          acceptance: [
            'UserArtifact table (type, url/blob, tags, summary, embeddings)',
            'Upload UI under /profile/artifacts',
            'Vercel Blob storage for uploads, AI SDK for summary + tag extraction',
          ],
        }),
      },
      {
        title: 'Auto-portfolio template + renderer',
        description: body({
          context:
            'Define a one-page portfolio template (HTML → PDF via existing markdown-to-pdf path) that interpolates selected artifacts.',
          acceptance: [
            'PortfolioTemplate stored as React Server Component or Markdown',
            'Renderer produces a one-page PDF deterministically',
            'Theming matches the resume designer output',
          ],
        }),
      },
      {
        title: 'Per-application artifact selector',
        description: body({
          context:
            "Given a lead's atom set, pick the top N user artifacts that map to the listing's requirements.",
          acceptance: [
            'Selector ranks user artifacts vs listing atoms',
            'Returns top 3-5 with rationale',
            'Stored as PortfolioPick rows per lead',
          ],
          dependsOn: [
            'User artifact uploader + storage',
            'Listing → atom decomposition pipeline',
          ].join(' + '),
        }),
      },
      {
        title: 'Portfolio attached at submit',
        description: body({
          context:
            'Wire the per-application portfolio into the submit flow as an optional attachment alongside resume and cover letter.',
          acceptance: [
            'Submit flow exposes "attach tailored portfolio" toggle',
            'PDF generated lazily on submit',
            'Linked from /applications/[id] detail page',
          ],
          dependsOn: 'Auto-portfolio template + renderer',
        }),
      },
    ],
  },
  {
    name: 'Verified Credentials Layer',
    description:
      'The substrate that makes "skills move with you, verified, portable" real: signed work-artifact attestations, mini skill challenges, and a re-verify cadence.',
    color: '#f43f5e',
    icon: 'ShieldCheck',
    issues: [
      {
        title: 'WorkArtifact + Attestation schema',
        description: body({
          context:
            'Extend UserCredential with a WorkArtifact model that supports multiple verification paths (employer attestation, OAuth-pulled data, peer review, automated work-sample evaluation).',
          acceptance: [
            'WorkArtifact + Attestation Prisma models',
            'Issuer + issuedAt + signature fields ready for JWT-style assertions',
            'Migration + ADR describing the trust model',
          ],
        }),
      },
      {
        title: 'JWT-style signed assertions',
        description: body({
          context:
            "Sign each attestation as a JWT with the issuer's key. No crypto wallets — issuer is identified by trusted email domain or OAuth-verified identity.",
          acceptance: [
            'Signing service produces JWTs with stable claims (sub, iss, jti, iat, exp, claim)',
            'Verification helper for inbound assertions',
            'Issuer key registry seeded with GimmeJob as a default issuer',
          ],
          dependsOn: 'WorkArtifact + Attestation schema',
        }),
      },
      {
        title: 'Employer attestation flow',
        description: body({
          context:
            "Let a user request an attestation from a former manager. Email-based magic-link flow: manager confirms employment + claim, attestation is signed.",
          acceptance: [
            "User requests attestation; system emails the named manager",
            'Manager clicks signed link → reviews + signs',
            'Issued JWT attached to WorkArtifact',
          ],
          dependsOn: 'JWT-style signed assertions',
        }),
      },
      {
        title: 'GitHub OAuth attestation',
        description: body({
          context:
            'OAuth into GitHub and pull verifiable signals (commit counts on language X, maintainer of repo Y, ownership in a public package). Auto-issue WorkArtifacts.',
          acceptance: [
            'OAuth scope: read:user + public_repo',
            'Job extracts language footprint, top maintained repos, stars',
            'Issued attestations include source provenance + last-checked timestamp',
          ],
          dependsOn: 'JWT-style signed assertions',
        }),
      },
      {
        title: 'Stripe + HubSpot OAuth attestations',
        description: body({
          context:
            'Same pattern as GitHub for revenue-claimable roles: pull Stripe MRR / lifetime revenue or HubSpot pipeline numbers, with the user authorizing scope.',
          acceptance: [
            'OAuth onboarding flows for Stripe + HubSpot',
            'Numbers stored at attested precision (e.g., bucketed ranges to avoid PII)',
            'Issuer = the connected provider, signed via GimmeJob key',
          ],
          dependsOn: 'JWT-style signed assertions',
        }),
      },
      {
        title: 'Revocation + dispute resolution',
        description: body({
          context:
            'Issuers can revoke. Users can dispute. Need a revocation list + a dispute workflow that auditably notes both sides.',
          acceptance: [
            'AttestationRevocation table + endpoint',
            'Dispute workflow with admin review queue',
            'Public attestation page shows revocation/dispute state',
          ],
          dependsOn: 'WorkArtifact + Attestation schema',
        }),
      },
      {
        title: 'Mini skill challenges',
        description: body({
          context:
            'Short verifiable tasks (10–30 min) that mint signed credentials attached to the user\'s profile when passed.',
          acceptance: [
            'Challenge bank schema + 5 seed challenges (typed coding, SQL, system design rubric)',
            'Auto-grading where possible; rubric-based human review otherwise',
            'On pass: WorkArtifact + Attestation issued automatically',
          ],
          dependsOn: 'JWT-style signed assertions',
        }),
      },
      {
        title: 'Profile freeze + re-verify cadence',
        description: body({
          context:
            'On job change, snapshot the profile. At 6mo / 12mo in role, prompt the user to re-verify ongoing claims so the profile does not silently rot.',
          acceptance: [
            'ProfileSnapshot table keyed on each role transition',
            'Re-verify prompts at +6mo, +12mo',
            'Visible "last verified" indicator on each claim',
          ],
        }),
      },
    ],
  },
  {
    name: 'Recruiter Pull Portal (endgame)',
    description:
      "The recruiter-side product: query GimmeJob's structured candidate index directly, with candidate-controlled visibility opt-in.",
    color: '#8b5cf6',
    icon: 'Search',
    issues: [
      {
        title: 'Data foundation audit + readiness gate',
        description: body({
          context:
            "Before shipping the recruiter side, audit: how many users have signed attestations, atom-decomposed resumes, comp data, etc. Define minimum coverage thresholds before opening.",
          acceptance: [
            'Coverage report: % of users with N+ verified attestations, % with atom-decomposed resume, % with comp range',
            'Document the readiness gate (e.g., 10k candidates / 50k attestations)',
            'Dashboard for ongoing monitoring',
          ],
        }),
      },
      {
        title: 'Recruiter org auth + workspace',
        description: body({
          context:
            'Recruiter accounts are separate from candidate accounts. Use Better Auth with a distinct role + workspace concept.',
          acceptance: [
            'RecruiterOrg table + role separation in Better Auth',
            'Sign-up requires domain verification',
            'Workspace pages gated to recruiter role',
          ],
        }),
      },
      {
        title: 'Candidate-controlled visibility opt-in',
        description: body({
          context:
            'Candidates choose what is visible to recruiters: fully visible, anonymized profile, opt-in-on-request. Granular per attribute (comp, location, etc.).',
          acceptance: [
            'VisibilityPolicy on the user with per-attribute toggles',
            'Default: anonymized + opt-in-on-request',
            'UI in /profile/visibility',
          ],
        }),
      },
      {
        title: 'Recruiter query primitives (atom + filter)',
        description: body({
          context:
            "Query layer where recruiters search by skill atom bundles, recency, location, comp, and demand-side signals. Returns candidates respecting visibility policy.",
          acceptance: [
            'Server search API filtered by atoms + filters',
            'Pagination, saved searches',
            'Returns redacted vs full view based on visibility policy',
          ],
          dependsOn: [
            'Candidate-controlled visibility opt-in',
            'Atom-level match score replaces keyword match',
          ].join(' + '),
        }),
      },
      {
        title: 'Contact mediation: request → consent → reveal',
        description: body({
          context:
            'Recruiter requests contact; candidate gets a notification with the recruiter brief; on consent the recruiter sees full profile. No direct PII leak.',
          acceptance: [
            'ContactRequest model + UI in both surfaces',
            'Email + in-app notification to candidate',
            'Consent revokes after configurable window',
          ],
          dependsOn: 'Candidate-controlled visibility opt-in',
        }),
      },
      {
        title: 'Recruiter pricing model implementation',
        description: body({
          context:
            'Pricing options: subscription tier + per-contact credits. Implement billing + entitlement via Stripe.',
          acceptance: [
            'Stripe products for tiers + credit packs',
            'Entitlement check at query time + at contact time',
            'Invoices + receipts in the recruiter workspace',
          ],
          dependsOn: 'Recruiter org auth + workspace',
        }),
      },
      {
        title: 'EEO + AI-hiring-disclosure compliance pass',
        description: body({
          context:
            'NYC AEDT, EU AI Act, etc. require disclosure / bias testing when AI is used in hiring decisions. Recruiter portal is in scope.',
          acceptance: [
            'Bias audit framework + scheduled re-audit',
            'Recruiter UI surfaces AI-use disclosure to candidates',
            'Audit logs retained per applicable jurisdiction',
          ],
          dependsOn: 'Recruiter query primitives (atom + filter)',
        }),
      },
    ],
  },
  {
    name: 'Skill Mobility Primitives',
    description:
      'The building blocks behind "skills move with you, verified, portable, comparable". One issue per primitive — most piggyback on Outcome Intelligence + Verified Credentials.',
    color: '#14b8a6',
    icon: 'Boxes',
    issues: [
      {
        title: 'Primitive: Skill atom canonical form',
        description: body({
          context:
            'Canonical, composable, machine-comparable atoms. Lives in the SkillAtom dictionary from Skill Atomization.',
          acceptance: [
            'Atom JSON schema documented',
            'Tooling to merge near-duplicates',
            'Versioning policy for the dictionary',
          ],
          dependsOn: 'Skill atom dictionary + extractor',
        }),
      },
      {
        title: 'Primitive: Proof-of-work attestations',
        description: body({
          context:
            'A signed claim that the user did the work — issued from challenges, employer attestation, OAuth signals.',
          acceptance: [
            'Attestation JSON shape documented',
            'Surfaced on /profile and recruiter view',
            'Backed by the JWT-style signing service',
          ],
          dependsOn: 'JWT-style signed assertions',
        }),
      },
      {
        title: 'Primitive: Provenance graph',
        description: body({
          context:
            "For each claim, store its provenance chain: which artifact, which attestation, which employer, with timestamps. Visualize as a small graph.",
          acceptance: [
            'ProvenanceEdge model linking claim → source(s)',
            'API to query the chain for a given claim',
            'Visualization on the public profile page',
          ],
        }),
      },
      {
        title: 'Primitive: Recency decay',
        description: body({
          context:
            'Skills decay over time. Apply a configurable half-life so a 2017 React claim is weighted less than a 2025 one in matching.',
          acceptance: [
            'Decay function + half-life per atom category',
            'Match scoring uses decayed weight',
            'Surfaced as "fresh / aging / stale" pill in UI',
          ],
        }),
      },
      {
        title: 'Primitive: Adjacency map',
        description: body({
          context:
            'Atoms have adjacency relationships (Postgres ↔ pgvector, React ↔ Next.js). Used to expand a recruiter query and to suggest learning paths.',
          acceptance: [
            'AtomAdjacency table with weighted edges',
            'Seeded via embedding similarity + curated overrides',
            'Used by recruiter query expansion',
          ],
        }),
      },
      {
        title: 'Primitive: Demand index per atom',
        description: body({
          context:
            'Real-time demand index per atom (listings/week, comp distribution). Drives the Personal Market Index and recruiter pricing of credits.',
          acceptance: [
            'AtomDemandSnapshot rolled up nightly',
            'Public read endpoint for top atoms',
            'Powers the Personal Market widget',
          ],
          dependsOn: 'Listings-to-skill-bundle indexer',
        }),
      },
      {
        title: 'Primitive: Cross-platform title normalization',
        description: body({
          context:
            'Titles vary wildly ("Senior Frontend Engineer", "SWE 2 — UI", "Frontend, IC4"). Normalize to a canonical role node.',
          acceptance: [
            'RoleNode dictionary + normalizer',
            'Listings + user history normalized to RoleNode at ingest',
            'Reverse-lookup surfaces local title variants',
          ],
        }),
      },
      {
        title: 'Primitive: Compounding signal (skill bundles)',
        description: body({
          context:
            'Combinations of atoms (e.g., "React + accessibility + design systems") compound for specific role bundles. Score the bundle, not just atoms.',
          acceptance: [
            'SkillBundle model + scoring',
            'Applied during JobFit + recruiter search',
            'Top bundles surfaced in user profile',
          ],
          dependsOn: 'Primitive: Skill atom canonical form',
        }),
      },
      {
        title: 'Primitive: Skill liquidity (time-to-offer)',
        description: body({
          context:
            'For each atom or bundle, track median time-to-first-interview and time-to-offer. Surface as a personal liquidity score.',
          acceptance: [
            'SkillLiquidityRollup nightly job',
            'Per-user view shows liquidity vs market median',
            'Used as an input to next-step suggestions',
          ],
          dependsOn: 'Build outcome-rollup job for skill conversion stats',
        }),
      },
      {
        title: 'Primitive: Demonstration mode',
        description: body({
          context:
            'Portable skill demos: tiny interactive sandboxes (CodeSandbox-style) that demonstrate a claim. Embedded in profile + recruiter view.',
          acceptance: [
            'Demo upload + storage',
            'Sandboxed embed in profile',
            'Indexable so recruiters can search for "has demo"',
          ],
        }),
      },
      {
        title: 'Primitive: Portable passport format',
        description: body({
          context:
            'A machine-readable export of the entire verified profile (JSON-LD or similar) the user can take elsewhere.',
          acceptance: [
            'Export endpoint produces a stable JSON-LD doc',
            'Includes attestations + signing keys for verification',
            'Documented schema versioning',
          ],
          dependsOn: 'JWT-style signed assertions',
        }),
      },
      {
        title: 'Primitive: Anti-résumé profile',
        description: body({
          context:
            'Capability-shaped profile view (atoms + demonstrations + outcomes) rather than chronological history. Default view on the public profile.',
          acceptance: [
            'New /p/[slug] capability-first public profile',
            'Sections: atoms, demos, attestations, outcomes',
            'Chronological view available behind a tab',
          ],
        }),
      },
    ],
  },
];

// ---------- Runner ----------

interface CreatedEpic {
  id: string;
  name: string;
}

interface CreatedIssue {
  identifier: string;
  title: string;
}

async function main() {
  console.log(`Plavement API: ${API_URL}`);
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Target project: ${GIMME_JOB_PROJECT_ID} (Gimme Job)`);
  console.log('');

  let totalIssues = 0;
  const createdEpics: CreatedEpic[] = [];
  const createdIssues: CreatedIssue[] = [];

  for (const epicSpec of EPICS) {
    totalIssues += epicSpec.issues.length;
    console.log(
      `Epic: ${epicSpec.name} (${epicSpec.issues.length} issues)`,
    );
    if (!EXECUTE) {
      for (const issue of epicSpec.issues) {
        console.log(`  - ${issue.title}`);
      }
      continue;
    }

    const epicRes = await api<{ epic: { id: string } }>('/epics', {
      method: 'POST',
      body: JSON.stringify({
        projectId: GIMME_JOB_PROJECT_ID,
        name: epicSpec.name,
        description: epicSpec.description,
        status: 'planned',
        color: epicSpec.color,
        icon: epicSpec.icon,
      }),
    });
    const epicId = epicRes.epic.id;
    createdEpics.push({ id: epicId, name: epicSpec.name });
    console.log(`  ↳ created epic ${epicId}`);

    for (const issue of epicSpec.issues) {
      const res = await api<{ issue: { identifier: string; title: string } }>(
        '/issues',
        {
          method: 'POST',
          body: JSON.stringify({
            projectId: GIMME_JOB_PROJECT_ID,
            epicId,
            title: issue.title,
            description: issue.description,
            status: 'backlog',
          }),
        },
      );
      console.log(`    + ${res.issue.identifier}  ${issue.title}`);
      createdIssues.push({
        identifier: res.issue.identifier,
        title: issue.title,
      });
      await sleep(80);
    }
    console.log('');
  }

  console.log('---');
  console.log(
    `Total: ${EPICS.length} epics, ${totalIssues} issues across them.`,
  );
  if (!EXECUTE) {
    console.log('Dry run only — pass --execute to actually create.');
  } else {
    console.log(
      `Created ${createdEpics.length} epics + ${createdIssues.length} issues.`,
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
