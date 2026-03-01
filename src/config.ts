import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export const OrgToolsConfigSchema = z.object({
  tools: z.object({
    andon: z
      .object({
        enabled: z.boolean().default(true),
      })
      .default({}),
    topology: z
      .object({
        enabled: z.boolean().default(false),
        configPath: z.string().default(".claude/org-tools/topology.json"),
      })
      .default({}),
    raci: z
      .object({
        enabled: z.boolean().default(false),
        configPath: z.string().default(".claude/org-tools/raci.json"),
      })
      .default({}),
    orgMemory: z
      .object({
        enabled: z.boolean().default(true),
        outputDir: z.string().default(".claude/org-tools/retrospectives"),
      })
      .default({}),
  }).default({}),
});

export type OrgToolsConfig = z.infer<typeof OrgToolsConfigSchema>;

export const TOOL_NAMES = ["andon", "topology", "raci", "orgMemory"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export function getDefaultConfig(): OrgToolsConfig {
  return OrgToolsConfigSchema.parse({ tools: {} });
}

export function getConfigPath(projectDir: string): string {
  return join(projectDir, ".claude", "org-tools", "config.json");
}

export async function loadConfig(projectDir: string): Promise<OrgToolsConfig> {
  const configPath = getConfigPath(projectDir);
  try {
    const raw = await readFile(configPath, "utf-8");
    return OrgToolsConfigSchema.parse(JSON.parse(raw));
  } catch {
    return getDefaultConfig();
  }
}

export async function saveConfig(
  projectDir: string,
  config: OrgToolsConfig,
): Promise<void> {
  const configPath = getConfigPath(projectDir);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}
