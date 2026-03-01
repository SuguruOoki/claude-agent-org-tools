import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { z } from "zod";

const RaciEntrySchema = z.object({
  taskPattern: z.string(),
  responsible: z.string(),
  accountable: z.string(),
  consulted: z.array(z.string()).default([]),
  informed: z.array(z.string()).default([]),
});

const RaciConfigSchema = z.object({
  matrix: z.array(RaciEntrySchema),
});

export type RaciConfig = z.infer<typeof RaciConfigSchema>;
export type RaciEntry = z.infer<typeof RaciEntrySchema>;

export interface RaciSuggestion {
  task: string;
  timestamp: string;
  accountable: string;
  consulted: string[];
  informed: string[];
}

interface TaskUpdateInput {
  taskId?: string;
  status?: string;
  subject?: string;
}

function matchTaskPattern(subject: string, pattern: string): boolean {
  const regex = new RegExp(pattern, "i");
  return regex.test(subject);
}

export async function handleRaci(
  projectDir: string,
  toolInput: TaskUpdateInput,
  configPath: string,
): Promise<RaciSuggestion | null> {
  if (toolInput.status !== "completed") return null;

  const fullConfigPath = join(projectDir, configPath);
  let config: RaciConfig;
  try {
    const raw = await readFile(fullConfigPath, "utf-8");
    config = RaciConfigSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }

  const subject = toolInput.subject ?? "";
  const matchedEntry = config.matrix.find((entry) =>
    matchTaskPattern(subject, entry.taskPattern),
  );

  if (!matchedEntry) return null;

  const suggestion: RaciSuggestion = {
    task: subject,
    timestamp: new Date().toISOString(),
    accountable: matchedEntry.accountable,
    consulted: matchedEntry.consulted,
    informed: matchedEntry.informed,
  };

  const logPath = join(
    projectDir,
    ".claude",
    "org-tools",
    "raci-suggestions.jsonl",
  );
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, JSON.stringify(suggestion) + "\n", "utf-8");

  return suggestion;
}
