import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { db as prisma } from '@/lib/db/client';

const TASK_LINE_PATTERN = /^- \[([ x>!])\] \*\*(P\d+\.\d+)\*\*\s+(.+)$/;
const PHASE_LINE_PATTERN = /^### Phase (\d+)\s+—\s+(.+)$/;
const CHECKBOX_STATUS = {
  ' ': 'TODO',
  '!': 'BLOCKED',
  '>': 'IN_PROGRESS',
  x: 'DONE',
} as const;

function stripMarkdown(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function parseInlineList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map(item => stripMarkdown(item))
    .filter(Boolean);
}

function extractField(lines: string[], fieldName: string): string | null {
  const prefix = `- ${fieldName}:`;
  const line = lines.map(l => l.trim()).find(l => l.startsWith(prefix));
  if (!line) return null;
  const value = line.slice(prefix.length).trim();
  return value.length > 0 ? stripMarkdown(value) : null;
}

function collectDetailLines(lines: string[], start: number): string[] {
  const out: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    if (TASK_LINE_PATTERN.test(lines[i]) || PHASE_LINE_PATTERN.test(lines[i])) {
      break;
    }
    out.push(lines[i]);
  }
  return out;
}

async function main() {
  const file = path.resolve(process.cwd(), 'FINAL_PLAN.md');
  const content = await readFile(file, 'utf8');
  const lines = content.split(/\r?\n/);

  let phaseId = 'P?';
  let phaseTitle = 'Unassigned';
  let sortOrder = 0;
  let inserted = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const phaseMatch = lines[i].match(PHASE_LINE_PATTERN);
    if (phaseMatch) {
      phaseId = `P${phaseMatch[1]}`;
      phaseTitle = stripMarkdown(phaseMatch[2]);
      continue;
    }

    const taskMatch = lines[i].match(TASK_LINE_PATTERN);
    if (!taskMatch) continue;

    const detailLines = collectDetailLines(lines, i + 1);
    const taskId = taskMatch[2];
    const title = stripMarkdown(taskMatch[3]);
    const status =
      CHECKBOX_STATUS[taskMatch[1] as keyof typeof CHECKBOX_STATUS] ?? 'TODO';
    const acceptance = extractField(detailLines, 'Acceptance');
    const testsRequired = extractField(detailLines, 'Tests required');
    const dependsOn = parseInlineList(extractField(detailLines, 'Depends on'));
    const files = parseInlineList(extractField(detailLines, 'Files'));
    const labels = parseInlineList(extractField(detailLines, 'Labels'));

    await prisma.planBoardTask.upsert({
      where: { taskId },
      create: {
        taskId,
        title,
        phaseId,
        phaseTitle,
        acceptance,
        testsRequired,
        dependsOn,
        files,
        labels,
        sortOrder,
        status,
      },
      update: {
        title,
        phaseId,
        phaseTitle,
        acceptance,
        testsRequired,
        dependsOn,
        files,
        labels,
        sortOrder,
      },
    });

    sortOrder += 1;
    inserted += 1;
  }

  console.log(`Seeded ${inserted} tickets.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
