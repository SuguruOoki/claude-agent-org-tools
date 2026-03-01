import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const AndonFileSchema = z.object({
  triggered_by: z.string(),
  severity: z.enum(["critical", "warning"]),
  reason: z.string(),
  timestamp: z.string(),
});

export type AndonFile = z.infer<typeof AndonFileSchema>;

export interface AndonResult {
  block: boolean;
  reason: string;
  team: string;
  severity: "critical" | "warning";
}

export async function checkAndon(
  projectDir: string,
): Promise<AndonResult | null> {
  const andonDir = join(projectDir, ".claude", "org-tools", "andon");

  let files: string[];
  try {
    files = await readdir(andonDir);
  } catch {
    return null;
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  if (jsonFiles.length === 0) return null;

  for (const file of jsonFiles) {
    const filePath = join(andonDir, file);
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = AndonFileSchema.parse(JSON.parse(raw));
      const team = file.replace(/\.json$/, "");

      if (parsed.severity === "critical") {
        return {
          block: true,
          reason: `Andon発動中 (${team}): ${parsed.reason}`,
          team,
          severity: "critical",
        };
      }

      process.stderr.write(
        `[org-tools] Andon警告 (${team}): ${parsed.reason}\n`,
      );
    } catch {
      // skip invalid files
    }
  }

  return null;
}
