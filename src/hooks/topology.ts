import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const AgentSchema = z.object({
  name: z.string(),
  type: z.enum(["stream-aligned", "platform", "enabling", "complicated-subsystem"]),
  owns: z.array(z.string()),
  interactionMode: z.enum(["collaboration", "x-as-a-service", "facilitating"]).optional(),
});

const TopologyConfigSchema = z.object({
  agents: z.array(AgentSchema),
});

export type TopologyConfig = z.infer<typeof TopologyConfigSchema>;
export type Agent = z.infer<typeof AgentSchema>;

export interface TopologyResult {
  block: boolean;
  reason: string;
}

interface ToolInput {
  file_path?: string;
  command?: string;
}

function matchesPattern(filePath: string, pattern: string): boolean {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -2); // "src/api/**" → "src/api/"
    return filePath.startsWith(prefix);
  }
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1); // "config/*" → "config/"
    const remaining = filePath.slice(prefix.length);
    return filePath.startsWith(prefix) && !remaining.includes("/");
  }
  return filePath === pattern;
}

function findOwner(
  agents: Agent[],
  filePath: string,
): Agent | undefined {
  return agents.find((agent) =>
    agent.owns.some((pattern) => matchesPattern(filePath, pattern)),
  );
}

export async function checkTopology(
  projectDir: string,
  toolInput: ToolInput,
  callerAgent?: string,
): Promise<TopologyResult | null> {
  const configPath = join(
    projectDir,
    ".claude",
    "org-tools",
    "topology.json",
  );

  let config: TopologyConfig;
  try {
    const raw = await readFile(configPath, "utf-8");
    config = TopologyConfigSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }

  const filePath = toolInput.file_path;
  if (!filePath) return null;

  const owner = findOwner(config.agents, filePath);
  if (!owner) return null;

  // facilitating タイプが Write/Edit しようとした場合はブロック
  if (owner.interactionMode === "facilitating") {
    return {
      block: true,
      reason: `${filePath} は facilitating チームの管轄です。直接編集は禁止されています。`,
    };
  }

  // owns 外への書き込みは警告のみ（v0.1）
  if (callerAgent && callerAgent !== owner.name) {
    process.stderr.write(
      `[org-tools] Topology警告: ${callerAgent} が ${owner.name} の管轄ファイル (${filePath}) を編集しようとしています\n`,
    );
  }

  return null;
}
