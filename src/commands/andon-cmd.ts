import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function triggerAndon(
  projectDir: string,
  team: string,
  reason: string,
  severity: "critical" | "warning" = "critical",
): Promise<void> {
  const andonDir = join(projectDir, ".claude", "org-tools", "andon");
  await mkdir(andonDir, { recursive: true });

  const andonFile = {
    triggered_by: "cli",
    severity,
    reason,
    timestamp: new Date().toISOString(),
  };

  const filePath = join(andonDir, `${team}.json`);
  await writeFile(filePath, JSON.stringify(andonFile, null, 2) + "\n", "utf-8");
  console.log(`Andon triggered for team "${team}" (${severity}): ${reason}`);
}

export async function releaseAndon(
  projectDir: string,
  team: string,
): Promise<void> {
  const filePath = join(
    projectDir,
    ".claude",
    "org-tools",
    "andon",
    `${team}.json`,
  );

  try {
    await unlink(filePath);
    console.log(`Andon released for team "${team}"`);
  } catch {
    console.log(`No active Andon found for team "${team}"`);
  }
}
