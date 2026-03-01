import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const ORG_TOOLS_MARKER = "org-tools.mjs";

interface HookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string }>;
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookEntry[];
    PostToolUse?: HookEntry[];
    Stop?: HookEntry[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function getHookDefinitions(): {
  PreToolUse: HookEntry;
  PostToolUse: HookEntry;
  Stop: HookEntry;
} {
  return {
    PreToolUse: {
      matcher: "Write|Edit|Bash",
      hooks: [
        {
          type: "command",
          command: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/org-tools.mjs" pre-tool-use`,
        },
      ],
    },
    PostToolUse: {
      matcher: "TaskUpdate",
      hooks: [
        {
          type: "command",
          command: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/org-tools.mjs" post-tool-use`,
        },
      ],
    },
    Stop: {
      hooks: [
        {
          type: "command",
          command: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/org-tools.mjs" stop`,
        },
      ],
    },
  };
}

function hasOrgToolsHook(entries: HookEntry[]): boolean {
  return entries.some((entry) =>
    entry.hooks.some((h) => h.command.includes("org-tools")),
  );
}

export function mergeHooks(existing: ClaudeSettings): ClaudeSettings {
  const result = { ...existing };
  const hooks = { ...(result.hooks ?? {}) };
  const defs = getHookDefinitions();

  for (const key of ["PreToolUse", "PostToolUse", "Stop"] as const) {
    const current = (hooks[key] as HookEntry[] | undefined) ?? [];
    if (!hasOrgToolsHook(current)) {
      hooks[key] = [...current, defs[key]];
    }
  }

  return { ...result, hooks };
}

export function removeHooks(existing: ClaudeSettings): ClaudeSettings {
  const result = { ...existing };
  if (!result.hooks) return result;

  const hooks = { ...result.hooks };

  for (const key of ["PreToolUse", "PostToolUse", "Stop"] as const) {
    const current = (hooks[key] as HookEntry[] | undefined) ?? [];
    hooks[key] = current.filter(
      (entry) => !entry.hooks.some((h) => h.command.includes("org-tools")),
    );
    if ((hooks[key] as HookEntry[]).length === 0) {
      delete hooks[key];
    }
  }

  return { ...result, hooks };
}

export async function mergeSettingsFile(projectDir: string): Promise<void> {
  const settingsPath = join(projectDir, ".claude", "settings.json");
  let existing: ClaudeSettings = {};

  try {
    const raw = await readFile(settingsPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // file doesn't exist, start fresh
  }

  const merged = mergeHooks(existing);
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}
