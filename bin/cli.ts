#!/usr/bin/env bun
import { runInit } from "../src/commands/init.js";
import { runEnable, runDisable } from "../src/commands/enable.js";
import { runStatus } from "../src/commands/status.js";
import { triggerAndon, releaseAndon } from "../src/commands/andon-cmd.js";

const USAGE = `claude-agent-org-tools - Organization tools for Claude Code Agent Teams

Usage:
  claude-org init                        Initialize org-tools in current project
  claude-org enable <tool>               Enable a tool (andon|topology|raci|orgMemory)
  claude-org disable <tool>              Disable a tool
  claude-org status                      Show tool status
  claude-org andon <team> [reason]       Trigger Andon signal for a team
  claude-org andon <team> --release      Release Andon signal for a team

Options:
  --severity <critical|warning>          Andon severity (default: critical)
  --help, -h                             Show this help
`;

function getProjectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  const projectDir = getProjectDir();

  switch (command) {
    case "init":
      await runInit(projectDir);
      break;

    case "enable":
      if (!args[1]) {
        console.error("Usage: claude-org enable <tool>");
        process.exit(1);
      }
      await runEnable(projectDir, args[1]);
      break;

    case "disable":
      if (!args[1]) {
        console.error("Usage: claude-org disable <tool>");
        process.exit(1);
      }
      await runDisable(projectDir, args[1]);
      break;

    case "status":
      await runStatus(projectDir);
      break;

    case "andon": {
      if (!args[1]) {
        console.error("Usage: claude-org andon <team> [reason] [--release]");
        process.exit(1);
      }
      const team = args[1];
      const isRelease = args.includes("--release");

      if (isRelease) {
        await releaseAndon(projectDir, team);
      } else {
        const severityIdx = args.indexOf("--severity");
        const severity =
          severityIdx !== -1
            ? (args[severityIdx + 1] as "critical" | "warning")
            : "critical";
        const reason = args
          .slice(2)
          .filter((a) => a !== "--release" && a !== "--severity" && a !== severity)
          .join(" ") || "Manual trigger via CLI";
        await triggerAndon(projectDir, team, reason, severity);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err}`);
  process.exit(1);
});
