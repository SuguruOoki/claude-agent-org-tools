#!/usr/bin/env bun
import { loadConfig } from "../config.js";
import { checkAndon } from "./andon.js";
import { checkTopology } from "./topology.js";
import { handleRaci } from "./raci.js";
import { generateRetro } from "./memory.js";

interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  [key: string]: unknown;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function getProjectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

async function handlePreToolUse(input: HookInput): Promise<void> {
  const projectDir = getProjectDir();
  const config = await loadConfig(projectDir);

  // Andon check
  if (config.tools.andon.enabled) {
    const result = await checkAndon(projectDir);
    if (result?.block) {
      process.stdout.write(
        JSON.stringify({ decision: "block", reason: result.reason }),
      );
      process.exit(2);
    }
  }

  // Topology check
  if (config.tools.topology.enabled && input.tool_input) {
    const result = await checkTopology(
      projectDir,
      input.tool_input as { file_path?: string },
    );
    if (result?.block) {
      process.stdout.write(
        JSON.stringify({ decision: "block", reason: result.reason }),
      );
      process.exit(2);
    }
  }
}

async function handlePostToolUse(input: HookInput): Promise<void> {
  const projectDir = getProjectDir();
  const config = await loadConfig(projectDir);

  if (config.tools.raci.enabled && input.tool_input) {
    const suggestion = await handleRaci(
      projectDir,
      input.tool_input as { taskId?: string; status?: string; subject?: string },
      config.tools.raci.configPath,
    );
    if (suggestion) {
      process.stderr.write(
        `[org-tools] RACI suggestion logged: A=${suggestion.accountable}, C=[${suggestion.consulted.join(",")}], I=[${suggestion.informed.join(",")}]\n`,
      );
    }
  }
}

async function handleStop(): Promise<void> {
  const projectDir = getProjectDir();
  const config = await loadConfig(projectDir);

  if (config.tools.orgMemory.enabled) {
    const generated = await generateRetro(
      projectDir,
      config.tools.orgMemory.outputDir,
    );
    if (generated.length > 0) {
      process.stderr.write(
        `[org-tools] Retrospectives generated: ${generated.join(", ")}\n`,
      );
    }
  }
}

async function main(): Promise<void> {
  const hookType = process.argv[2];

  if (!hookType || !["pre-tool-use", "post-tool-use", "stop"].includes(hookType)) {
    process.stderr.write(
      `Usage: org-tools.ts <pre-tool-use|post-tool-use|stop>\n`,
    );
    process.exit(1);
  }

  let input: HookInput = {};
  if (hookType !== "stop") {
    try {
      const raw = await readStdin();
      if (raw.trim()) {
        input = JSON.parse(raw);
      }
    } catch {
      // no stdin or invalid JSON, proceed with empty input
    }
  }

  switch (hookType) {
    case "pre-tool-use":
      await handlePreToolUse(input);
      break;
    case "post-tool-use":
      await handlePostToolUse(input);
      break;
    case "stop":
      await handleStop();
      break;
  }
}

main().catch((err) => {
  process.stderr.write(`[org-tools] Error: ${err}\n`);
  process.exit(1);
});
