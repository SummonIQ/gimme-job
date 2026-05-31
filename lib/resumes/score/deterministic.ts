/**
 * Deterministic Resume Scorer
 *
 * Pure function: given the same markdown input, always produces the same score.
 * No AI / no network calls — entirely rule-based using regex and string analysis.
 *
 * Weighted scoring (100 points total):
 *   - Sections completeness:  25 pts
 *   - Keywords & action verbs: 30 pts
 *   - Formatting quality:      20 pts
 *   - Achievements:            15 pts
 *   - Readability:             10 pts
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number, max: number, ceiling: number): number {
  return clamp(Math.round((value / max) * ceiling), 0, ceiling);
}

// ── Section Detection (25 pts) ──────────────────────────────────────────────

const SECTION_PATTERNS: Array<{ name: string; patterns: RegExp[]; weight: number }> = [
  {
    name: 'contact',
    patterns: [
      /[\w.+-]+@[\w-]+\.[\w.]+/i,                 // email
      /(\+?\d[\d\s\-().]{7,})/,                    // phone
      /linkedin\.com\/in\//i,                       // linkedin
    ],
    weight: 5,
  },
  {
    name: 'summary',
    patterns: [
      /^#{1,3}\s*(summary|objective|profile|about\s*me)/im,
    ],
    weight: 4,
  },
  {
    name: 'experience',
    patterns: [
      /^#{1,3}\s*(work\s*)?experience|employment\s*history|professional\s*experience/im,
    ],
    weight: 6,
  },
  {
    name: 'education',
    patterns: [
      /^#{1,3}\s*education/im,
    ],
    weight: 4,
  },
  {
    name: 'skills',
    patterns: [
      /^#{1,3}\s*(technical\s*)?skills|competencies|expertise/im,
    ],
    weight: 4,
  },
  {
    name: 'extras',
    patterns: [
      /^#{1,3}\s*(certifications?|projects?|awards?|publications?|volunteer)/im,
    ],
    weight: 2,
  },
];

function scoreSections(text: string): number {
  let total = 0;

  for (const section of SECTION_PATTERNS) {
    const found = section.patterns.some((p) => p.test(text));
    if (found) total += section.weight;
  }

  return clamp(total, 0, 25);
}

// ── Keywords & Action Verbs (30 pts) ────────────────────────────────────────

const ACTION_VERBS = [
  'achieved', 'administered', 'analyzed', 'automated', 'built', 'collaborated',
  'contributed', 'coordinated', 'created', 'delivered', 'designed', 'developed',
  'directed', 'drove', 'engineered', 'established', 'executed', 'expanded',
  'facilitated', 'generated', 'grew', 'identified', 'implemented', 'improved',
  'increased', 'initiated', 'integrated', 'launched', 'led', 'managed',
  'mentored', 'migrated', 'negotiated', 'optimized', 'orchestrated', 'organized',
  'oversaw', 'pioneered', 'planned', 'produced', 'programmed', 'reduced',
  'refactored', 'resolved', 'restructured', 'revamped', 'scaled', 'secured',
  'spearheaded', 'streamlined', 'supervised', 'supported', 'tested', 'trained',
  'transformed', 'upgraded',
];

const TECHNICAL_KEYWORDS = [
  'api', 'aws', 'agile', 'azure', 'backend', 'ci/cd', 'cloud', 'css',
  'data', 'database', 'deploy', 'devops', 'docker', 'frontend', 'gcp',
  'git', 'html', 'http', 'java', 'javascript', 'kubernetes', 'linux',
  'machine learning', 'microservice', 'mobile', 'node', 'python', 'react',
  'rest', 'saas', 'scrum', 'security', 'sql', 'terraform', 'testing',
  'typescript', 'ui', 'ux',
  // non-tech
  'budget', 'client', 'compliance', 'cross-functional', 'customer',
  'deadline', 'kpi', 'metric', 'p&l', 'project management', 'revenue',
  'roi', 'sales', 'stakeholder', 'strategy', 'team',
];

function scoreKeywords(text: string): number {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  // Action verbs: up to 12 pts — 1 pt per unique verb found, max 12
  const uniqueVerbs = new Set<string>();
  for (const verb of ACTION_VERBS) {
    if (words.some((w) => w.startsWith(verb))) {
      uniqueVerbs.add(verb);
    }
  }
  const verbScore = normalize(uniqueVerbs.size, 12, 12);

  // Technical / industry keywords: up to 12 pts — 1 pt per unique keyword, max 12
  const uniqueKeywords = new Set<string>();
  for (const kw of TECHNICAL_KEYWORDS) {
    if (lower.includes(kw)) {
      uniqueKeywords.add(kw);
    }
  }
  const keywordScore = normalize(uniqueKeywords.size, 12, 12);

  // Variety bonus: up to 6 pts based on total unique meaningful words (>4 chars)
  const meaningfulWords = new Set(words.filter((w) => w.length > 4));
  const varietyScore = normalize(meaningfulWords.size, 200, 6);

  return clamp(verbScore + keywordScore + varietyScore, 0, 30);
}

// ── Formatting Quality (20 pts) ─────────────────────────────────────────────

function scoreFormatting(text: string): number {
  let score = 0;

  // Headers present (up to 5 pts)
  const headerCount = countMatches(text, /^#{1,3}\s+.+/gm);
  score += normalize(headerCount, 5, 5);

  // Bullet points used (up to 5 pts)
  const bulletCount = countMatches(text, /^[\s]*[-*+]\s+.+/gm);
  score += normalize(bulletCount, 8, 5);

  // Consistent structure — ratio of bulleted lines to total content lines (up to 5 pts)
  const contentLines = text.split('\n').filter((l) => l.trim().length > 0).length;
  if (contentLines > 0) {
    const bulletRatio = bulletCount / contentLines;
    // Ideal: 30-70% bulleted
    if (bulletRatio >= 0.3 && bulletRatio <= 0.7) {
      score += 5;
    } else if (bulletRatio >= 0.15 || bulletRatio <= 0.85) {
      score += 3;
    } else {
      score += 1;
    }
  }

  // Reasonable length: 300-1500 words (up to 5 pts)
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount >= 300 && wordCount <= 1500) {
    score += 5;
  } else if (wordCount >= 150 && wordCount <= 2500) {
    score += 3;
  } else if (wordCount >= 50) {
    score += 1;
  }

  return clamp(score, 0, 20);
}

// ── Achievements & Quantification (15 pts) ──────────────────────────────────

function scoreAchievements(text: string): number {
  // Numbers / percentages / dollar amounts (up to 10 pts — 1 pt per match, max 10)
  const quantifiers = countMatches(
    text,
    /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?[%+]?|\$\d[\d,]*(?:\.\d+)?[MBKmk]?|\b\d+x\b/g,
  );
  const quantScore = normalize(quantifiers, 10, 10);

  // Outcome-oriented phrases (up to 5 pts)
  const outcomePatterns = [
    /result(ed|ing|s)?\s+in/gi,
    /led\s+to/gi,
    /sav(ed|ing)\s/gi,
    /increas(ed|ing)\s/gi,
    /reduc(ed|ing)\s/gi,
    /improv(ed|ing)\s/gi,
    /generat(ed|ing)\s/gi,
    /deliver(ed|ing)\s/gi,
    /boost(ed|ing)\s/gi,
    /grew\s/gi,
  ];
  let outcomeCount = 0;
  for (const p of outcomePatterns) {
    outcomeCount += countMatches(text, p);
  }
  const outcomeScore = normalize(outcomeCount, 5, 5);

  return clamp(quantScore + outcomeScore, 0, 15);
}

// ── Readability (10 pts) ────────────────────────────────────────────────────

function scoreReadability(text: string): number {
  let score = 0;
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  // No extremely long paragraphs — lines over 300 chars (up to 4 pts)
  const longLines = lines.filter((l) => l.length > 300).length;
  if (longLines === 0) {
    score += 4;
  } else if (longLines <= 2) {
    score += 2;
  }

  // Clear hierarchy — headers followed by content (up to 3 pts)
  const hasHierarchy = /^#{1,3}\s+.+\n[\s\S]*?[-*+]\s+/m.test(text);
  if (hasHierarchy) score += 3;

  // Sentence length variety — stddev of line lengths (up to 3 pts)
  if (lines.length >= 3) {
    const lengths = lines.map((l) => l.trim().length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, l) => sum + (l - avg) ** 2, 0) / lengths.length;
    const stddev = Math.sqrt(variance);
    // Some variety is good (stddev 20-80 is ideal)
    if (stddev >= 20 && stddev <= 80) {
      score += 3;
    } else if (stddev >= 10) {
      score += 2;
    } else {
      score += 1;
    }
  }

  return clamp(score, 0, 10);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface DeterministicScoreBreakdown {
  sections: number;
  keywords: number;
  formatting: number;
  achievements: number;
  readability: number;
  total: number;
}

/**
 * Score a resume deterministically from its markdown content.
 * Returns a score 0-100 and a breakdown per category.
 *
 * **Pure function** — same input always yields same output.
 */
export function scoreResume(markdown: string): DeterministicScoreBreakdown {
  const text = markdown.trim();

  if (!text) {
    return { sections: 0, keywords: 0, formatting: 0, achievements: 0, readability: 0, total: 0 };
  }

  const sections = scoreSections(text);
  const keywords = scoreKeywords(text);
  const formatting = scoreFormatting(text);
  const achievements = scoreAchievements(text);
  const readability = scoreReadability(text);
  const total = clamp(sections + keywords + formatting + achievements + readability, 0, 100);

  return { sections, keywords, formatting, achievements, readability, total };
}
