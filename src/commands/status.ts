import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config.js";

async function checkHooksRegistered(projectDir: string): Promise<boolean> {
  try {
    const settingsPath = join(projectDir, ".claude", "settings.json");
    const raw = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings.hooks ?? {};
    const preToolUse = hooks.PreToolUse ?? [];
    return preToolUse.some((entry: { hooks?: Array<{ command?: string }> }) =>
      entry.hooks?.some((h) => h.command?.includes("org-tools.ts")),
    );
  } catch {
    return false;
  }
}

export async function runStatus(projectDir: string): Promise<void> {
  const config = await loadConfig(projectDir);
  const hooksRegistered = await checkHooksRegistered(projectDir);

  console.log("claude-agent-org-tools status\n");
  console.log(`Hooks registered: ${hooksRegistered ? "yes" : "no"}`);
  console.log("");
  console.log("Tools:");

  const icon = (enabled: boolean) => (enabled ? "[ON] " : "[OFF]");

  console.log(`  ${icon(config.tools.andon.enabled)} Andon Signal`);
  console.log(
    `  ${icon(config.tools.topology.enabled)} Team Topology (config: ${config.tools.topology.configPath})`,
  );
  console.log(
    `  ${icon(config.tools.raci.enabled)} RACI Auto-Router (config: ${config.tools.raci.configPath})`,
  );
  console.log(
    `  ${icon(config.tools.orgMemory.enabled)} Organizational Memory (output: ${config.tools.orgMemory.outputDir})`,
  );
  console.log("");
}
