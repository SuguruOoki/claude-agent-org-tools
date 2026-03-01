import { mkdir, copyFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeSettingsFile } from "../settings-merger.js";
import { getDefaultConfig, saveConfig, loadConfig } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getTemplateDir(): string {
  return join(__dirname, "..", "templates");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(projectDir: string): Promise<void> {
  console.log("claude-agent-org-tools: initializing...\n");

  // 1. Create directories
  const dirs = [
    join(projectDir, ".claude", "hooks"),
    join(projectDir, ".claude", "org-tools", "andon"),
    join(projectDir, ".claude", "org-tools", "retrospectives"),
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  // 2. Copy self-contained hook script to .claude/hooks/org-tools.mjs
  const hookDest = join(projectDir, ".claude", "hooks", "org-tools.mjs");
  // Try compiled JS first (dist/), then fall back to TS source
  const hookSourceJs = join(getTemplateDir(), "org-tools-hook.js");
  const hookSourceTs = join(getTemplateDir(), "org-tools-hook.ts");
  const hookSource = (await fileExists(hookSourceJs))
    ? hookSourceJs
    : hookSourceTs;
  await copyFile(hookSource, hookDest);

  // 3. Generate config.json (if not exists)
  const configPath = join(projectDir, ".claude", "org-tools", "config.json");
  if (await fileExists(configPath)) {
    console.log("  config.json already exists, preserving existing config");
  } else {
    const defaultConfig = getDefaultConfig();
    await saveConfig(projectDir, defaultConfig);
  }

  // 4. Merge hooks into settings.json
  await mergeSettingsFile(projectDir);

  // 5. Status output
  const config = await loadConfig(projectDir);
  console.log("  Setup complete!\n");
  console.log("  Tool status:");
  const icon = (enabled: boolean) => (enabled ? "  \u2713" : "  \u25CB");
  console.log(
    `${icon(config.tools.andon.enabled)} Andon Signal: ${config.tools.andon.enabled ? "enabled" : "disabled"}`,
  );
  console.log(
    `${icon(config.tools.orgMemory.enabled)} Organizational Memory: ${config.tools.orgMemory.enabled ? "enabled" : "disabled"}`,
  );
  console.log(
    `${icon(config.tools.topology.enabled)} Team Topology: ${config.tools.topology.enabled ? "enabled" : "disabled (create .claude/org-tools/topology.json to enable)"}`,
  );
  console.log(
    `${icon(config.tools.raci.enabled)} RACI Auto-Router: ${config.tools.raci.enabled ? "enabled" : "disabled (create .claude/org-tools/raci.json to enable)"}`,
  );
  console.log("");
}
