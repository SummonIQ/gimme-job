/**
 * Migrate PlanBoardTask rows from gimme-job's database into Plavement issues.
 *
 * Usage:
 *   bun run scripts/migrate-plan-board-to-plavement.ts           # dry run (default)
 *   bun run scripts/migrate-plan-board-to-plavement.ts --execute # actually create in Plavement
 *
 * Env (read from .env / process.env, defaults match .mcp.json):
 *   PLAVEMENT_API_URL  default http://localhost:20020
 *   PLAVEMENT_API_KEY  required
 *
 * What it does:
 *   1. Loads all PlanBoardTask rows (ordered by phaseId, sortOrder).
 *   2. Ensures a Plavement Label exists for each distinct content label string.
 *   3. Ensures a Plavement Label exists for each distinct phaseId (e.g. "P18").
 *   4. For each PlanBoardTask, creates a Plavement Issue under the Gimme Job project:
 *        title       = PlanBoardTask.title (verbatim)
 *        description = composed markdown block: original description + metadata footer
 *        status      = mapped PlanBoardStatus → Plavement status
 *        projectId   = GIMME_JOB_PROJECT_ID (the existing "Gimme Job" project)
 *        labelIds    = content labels + phase label (e.g. "P18")
 *
 * Status mapping:
 *   TODO        -> todo
 *   IN_PROGRESS -> in_progress
 *   BLOCKED     -> blocked          (requires Plavement to support this status — see migration notes)
 *   DONE        -> done
 *
 * Notes:
 *   - Does NOT delete or modify any PlanBoardTask rows.
 *   - Does NOT delete plan-board UI or routes.
 *   - Idempotent for projects/labels (looks them up by name first).
 *   - Issues are NOT deduped — running --execute twice will create duplicate issues.
 *     Re-runs should only happen after manually clearing the Plavement workspace.
 */

import { db } from "../lib/db/client";
import type { PlanBoardTask } from "@prisma/client";

const API_URL = (process.env.PLAVEMENT_API_URL ?? "http://localhost:20020").replace(/\/+$/, "");
const API_KEY = process.env.PLAVEMENT_API_KEY ?? "pl_live_vL2rTMozak4t4UFnsqU8DOMnDO2lX6DI";
const EXECUTE = process.argv.includes("--execute");
const GIMME_JOB_PROJECT_ID = "cmozyi0md0004d58o618migs9";

if (!API_KEY) {
  console.error("PLAVEMENT_API_KEY is required");
  process.exit(1);
}

type PlavementStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled" | "blocked";

const STATUS_MAP: Record<PlanBoardTask["status"], PlavementStatus> = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  BLOCKED: "blocked",
  DONE: "done",
};

interface PlavementLabel {
  id: string;
  name: string;
}

interface PlavementIssue {
  id: string;
  identifier: string;
  title: string;
}

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data ? String(data.error) : `HTTP ${res.status}`;
    throw new Error(`${init.method ?? "GET"} ${path} → ${msg}`);
  }
  return data as T;
}

function buildDescription(task: PlanBoardTask): string {
  const sections: string[] = [];

  if (task.description?.trim()) {
    sections.push(task.description.trim());
  }

  const metadata: string[] = [];
  metadata.push(`**External ID:** \`${task.taskId}\``);
  metadata.push(`**Phase:** ${task.phaseId} — ${task.phaseTitle}`);
  if (task.acceptance?.trim()) metadata.push(`**Acceptance:**\n${task.acceptance.trim()}`);
  if (task.testsRequired?.trim()) metadata.push(`**Tests required:**\n${task.testsRequired.trim()}`);
  if (task.dependsOn.length > 0) metadata.push(`**Depends on:** ${task.dependsOn.map((d) => `\`${d}\``).join(", ")}`);
  if (task.files.length > 0) metadata.push(`**Files:**\n${task.files.map((f) => `- \`${f}\``).join("\n")}`);
  if (task.agentHandle) metadata.push(`**Agent handle:** ${task.agentHandle}`);
  if (task.claimedAt) metadata.push(`**Claimed at:** ${task.claimedAt.toISOString()}`);
  if (task.assignmentReason?.trim()) metadata.push(`**Assignment reason:** ${task.assignmentReason.trim()}`);
  if (task.notes?.trim()) metadata.push(`**Notes:**\n${task.notes.trim()}`);

  if (metadata.length > 0) {
    sections.push("---\n\n" + metadata.join("\n\n"));
  }

  return sections.join("\n\n");
}

async function ensureLabel(
  labelName: string,
  cache: Map<string, PlavementLabel>,
  existing: PlavementLabel[],
): Promise<PlavementLabel> {
  const cached = cache.get(labelName);
  if (cached) return cached;

  const found = existing.find((l) => l.name === labelName);
  if (found) {
    cache.set(labelName, found);
    return found;
  }

  if (!EXECUTE) {
    const stub: PlavementLabel = { id: `<would-create-label:${labelName}>`, name: labelName };
    cache.set(labelName, stub);
    return stub;
  }

  const res = await api<{ label: PlavementLabel }>("/labels", {
    method: "POST",
    body: JSON.stringify({ name: labelName }),
  });
  const created = res.label;
  console.log(`  + label: ${labelName}`);
  cache.set(labelName, created);
  existing.push(created);
  return created;
}

async function main() {
  console.log(`Plavement API: ${API_URL}`);
  console.log(`Mode: ${EXECUTE ? "EXECUTE (will create issues)" : "DRY RUN (no writes)"}`);
  console.log("");

  const tasks = await db.planBoardTask.findMany({
    orderBy: [{ phaseId: "asc" }, { sortOrder: "asc" }, { taskId: "asc" }],
  });
  console.log(`Loaded ${tasks.length} PlanBoardTask rows from gimme-job.\n`);

  const existingLabels: PlavementLabel[] = EXECUTE
    ? (await api<{ labels: PlavementLabel[] }>("/labels")).labels ?? []
    : [];

  const labelCache = new Map<string, PlavementLabel>();

  const phaseIds = new Set<string>();
  const contentLabels = new Set<string>();
  for (const t of tasks) {
    phaseIds.add(t.phaseId);
    for (const l of t.labels) contentLabels.add(l);
  }

  console.log(`Phase labels to ensure: ${phaseIds.size}`);
  console.log(`Distinct content labels to ensure: ${contentLabels.size}`);
  console.log("");

  for (const phaseId of phaseIds) {
    await ensureLabel(phaseId, labelCache, existingLabels);
  }
  for (const name of contentLabels) {
    await ensureLabel(name, labelCache, existingLabels);
  }

  console.log("\nCreating issues...");
  const summary: Array<{ taskId: string; identifier: string; status: PlavementStatus }> = [];

  for (const task of tasks) {
    const phaseLabel = labelCache.get(task.phaseId);
    if (!phaseLabel) throw new Error(`No phase label resolved for ${task.phaseId}`);

    const labelIds = [
      phaseLabel.id,
      ...task.labels.map((name) => {
        const l = labelCache.get(name);
        if (!l) throw new Error(`No label resolved for ${name}`);
        return l.id;
      }),
    ];

    const payload = {
      title: task.title,
      description: buildDescription(task),
      status: STATUS_MAP[task.status],
      projectId: GIMME_JOB_PROJECT_ID,
      labelIds,
    };

    if (!EXECUTE) {
      summary.push({ taskId: task.taskId, identifier: "<dry-run>", status: payload.status });
      continue;
    }

    const res = await api<{ issue: PlavementIssue }>("/issues", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const issue = res.issue;
    console.log(`  + ${issue.identifier}  [${payload.status.padEnd(11)}]  ${task.taskId}  ${task.title.slice(0, 60)}`);
    summary.push({ taskId: task.taskId, identifier: issue.identifier, status: payload.status });
  }

  console.log(`\nDone. Processed ${summary.length} tasks.`);
  if (!EXECUTE) {
    console.log("\nDry run only — pass --execute to actually write to Plavement.");
  }

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await db.$disconnect();
  process.exit(1);
});
