/**
 * Cleanup the previous (mis-targeted) Plavement migration:
 *   - Delete every Issue in the workspace EXCEPT the smoke-test we already deleted.
 *   - Delete the 19 phase Projects (any project whose name starts with "P" followed by digits + " — ").
 *
 * Does NOT touch labels (we want to keep the 27 label labels and add new phase labels later).
 * Does NOT touch the existing "Gimme Job" project.
 *
 * Run with: bun run scripts/cleanup-plavement-migration.ts --execute
 */

const API_URL = (process.env.PLAVEMENT_API_URL ?? "http://localhost:20020").replace(/\/+$/, "");
const API_KEY = process.env.PLAVEMENT_API_KEY ?? "pl_live_vL2rTMozak4t4UFnsqU8DOMnDO2lX6DI";
const EXECUTE = process.argv.includes("--execute");

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

async function main() {
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}`);

  const { issues } = await api<{ issues: Array<{ identifier: string; title: string }> }>("/issues");
  console.log(`Found ${issues.length} issues to delete.`);

  for (const issue of issues) {
    if (!EXECUTE) {
      console.log(`  - would DELETE ${issue.identifier}  ${issue.title.slice(0, 60)}`);
      continue;
    }
    await api(`/issues/${encodeURIComponent(issue.identifier)}`, { method: "DELETE" });
    console.log(`  - DELETED ${issue.identifier}`);
  }

  const { projects } = await api<{ projects: Array<{ id: string; name: string }> }>("/projects");
  const phaseProjects = projects.filter((p) => /^P\d+\s+—\s+/.test(p.name));
  console.log(`\nFound ${phaseProjects.length} phase projects to delete (of ${projects.length} total).`);

  for (const project of phaseProjects) {
    if (!EXECUTE) {
      console.log(`  - would DELETE project ${project.id}: ${project.name}`);
      continue;
    }
    await api(`/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
    console.log(`  - DELETED project: ${project.name}`);
  }

  console.log(EXECUTE ? "\nCleanup complete." : "\nDry run — pass --execute to actually delete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
