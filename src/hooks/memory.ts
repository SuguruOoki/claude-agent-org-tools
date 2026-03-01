import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

interface TaskInfo {
  id: string;
  subject: string;
  status: string;
  owner?: string;
  createdAt?: string;
  completedAt?: string;
}

interface RetroStats {
  teamName: string;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  tasks: TaskInfo[];
}

function formatDate(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function getHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
}

async function findActiveTeams(): Promise<string[]> {
  const teamsDir = join(getHome(), ".claude", "teams");
  try {
    const entries = await readdir(teamsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function loadTasks(teamName: string): Promise<TaskInfo[]> {
  const tasksDir = join(getHome(), ".claude", "tasks", teamName);
  try {
    const files = await readdir(tasksDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const tasks: TaskInfo[] = [];

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(tasksDir, file), "utf-8");
        const data = JSON.parse(raw);
        tasks.push({
          id: data.id ?? file.replace(/\.json$/, ""),
          subject: data.subject ?? "unknown",
          status: data.status ?? "unknown",
          owner: data.owner,
          createdAt: data.createdAt,
          completedAt: data.completedAt,
        });
      } catch {
        // skip invalid task files
      }
    }

    return tasks;
  } catch {
    return [];
  }
}

function computeStats(teamName: string, tasks: TaskInfo[]): RetroStats {
  return {
    teamName,
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
    pending: tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
    tasks,
  };
}

function generateMarkdown(stats: RetroStats): string {
  const lines: string[] = [];
  lines.push(`# Retrospective: ${stats.teamName}`);
  lines.push(`\nDate: ${formatDate()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total tasks | ${stats.total} |`);
  lines.push(`| Completed | ${stats.completed} |`);
  lines.push(`| Failed | ${stats.failed} |`);
  lines.push(`| Pending/In-progress | ${stats.pending} |`);

  const completionRate =
    stats.total > 0
      ? ((stats.completed / stats.total) * 100).toFixed(1)
      : "N/A";
  lines.push(`| Completion rate | ${completionRate}% |`);

  lines.push("");
  lines.push("## Task Details");
  lines.push("");
  lines.push("| ID | Subject | Status | Owner |");
  lines.push("|-----|---------|--------|-------|");
  for (const task of stats.tasks) {
    lines.push(
      `| ${task.id} | ${task.subject} | ${task.status} | ${task.owner ?? "-"} |`,
    );
  }

  lines.push("");
  lines.push("## Observations");
  lines.push("");

  if (stats.completed === stats.total && stats.total > 0) {
    lines.push("- All tasks completed successfully.");
  }
  if (stats.failed > 0) {
    lines.push(
      `- ${stats.failed} task(s) failed. Review and consider adding guard rails.`,
    );
  }
  if (stats.pending > 0) {
    lines.push(
      `- ${stats.pending} task(s) still pending/in-progress at session end.`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

export async function generateRetro(
  projectDir: string,
  outputDir: string,
): Promise<string[]> {
  const teams = await findActiveTeams();
  if (teams.length === 0) return [];

  const outputPath = join(projectDir, outputDir);
  await mkdir(outputPath, { recursive: true });

  const generated: string[] = [];

  for (const teamName of teams) {
    const tasks = await loadTasks(teamName);
    if (tasks.length === 0) continue;

    const stats = computeStats(teamName, tasks);
    const md = generateMarkdown(stats);
    const fileName = `${teamName}-${formatDate()}.md`;
    const filePath = join(outputPath, fileName);
    await writeFile(filePath, md, "utf-8");
    generated.push(filePath);
  }

  return generated;
}
