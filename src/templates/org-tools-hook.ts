#!/usr/bin/env node
// claude-agent-org-tools: Self-contained hook entrypoint
// This file is auto-generated. Do not edit manually.
// Re-generate with: npx claude-agent-org-tools init
// @ts-nocheck

import {
  readFileSync,
  readdirSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";

// --- Config ---

function loadConfig(projectDir) {
  const defaults = {
    tools: {
      andon: { enabled: true },
      topology: {
        enabled: false,
        configPath: ".claude/org-tools/topology.json",
      },
      raci: { enabled: false, configPath: ".claude/org-tools/raci.json" },
      orgMemory: {
        enabled: true,
        outputDir: ".claude/org-tools/retrospectives",
      },
    },
  };
  try {
    const raw = readFileSync(
      join(projectDir, ".claude", "org-tools", "config.json"),
      "utf-8",
    );
    const parsed = JSON.parse(raw);
    return {
      tools: {
        andon: { ...defaults.tools.andon, ...parsed.tools?.andon },
        topology: { ...defaults.tools.topology, ...parsed.tools?.topology },
        raci: { ...defaults.tools.raci, ...parsed.tools?.raci },
        orgMemory: { ...defaults.tools.orgMemory, ...parsed.tools?.orgMemory },
      },
    };
  } catch {
    return defaults;
  }
}

// --- Andon ---

function checkAndon(projectDir) {
  const dir = join(projectDir, ".claude", "org-tools", "andon");
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }
  if (files.length === 0) return null;

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      const team = file.replace(/\.json$/, "");
      if (data.severity === "critical") {
        return {
          block: true,
          reason: `Andon\u767A\u52D5\u4E2D (${team}): ${data.reason}`,
        };
      }
      process.stderr.write(
        `[org-tools] Andon\u8B66\u544A (${team}): ${data.reason}\n`,
      );
    } catch {
      /* skip invalid */
    }
  }
  return null;
}

// --- Topology ---

function matchesPattern(filePath, pattern) {
  if (pattern.endsWith("/**")) {
    return filePath.startsWith(pattern.slice(0, -2));
  }
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1);
    const remaining = filePath.slice(prefix.length);
    return filePath.startsWith(prefix) && !remaining.includes("/");
  }
  return filePath === pattern;
}

function checkTopology(projectDir, toolInput) {
  const configPath = join(
    projectDir,
    ".claude",
    "org-tools",
    "topology.json",
  );
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }

  const filePath = toolInput.file_path;
  if (!filePath) return null;

  const owner = config.agents.find((a) =>
    a.owns?.some((p) => matchesPattern(filePath, p)),
  );
  if (!owner) return null;

  if (owner.interactionMode === "facilitating") {
    return {
      block: true,
      reason: `${filePath} \u306F facilitating \u30C1\u30FC\u30E0\u306E\u7BA1\u8F44\u3067\u3059\u3002\u76F4\u63A5\u7DE8\u96C6\u306F\u7981\u6B62\u3055\u308C\u3066\u3044\u307E\u3059\u3002`,
    };
  }
  return null;
}

// --- RACI ---

function handleRaci(projectDir, toolInput, configPath) {
  if (toolInput.status !== "completed") return;
  const fullPath = join(projectDir, configPath);
  let config;
  try {
    config = JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch {
    return;
  }

  const subject = toolInput.subject ?? "";
  const entry = config.matrix.find((e) =>
    new RegExp(e.taskPattern, "i").test(subject),
  );
  if (!entry) return;

  const suggestion = {
    task: subject,
    timestamp: new Date().toISOString(),
    accountable: entry.accountable,
    consulted: entry.consulted,
    informed: entry.informed,
  };

  const logDir = join(projectDir, ".claude", "org-tools");
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    /* exists */
  }
  appendFileSync(
    join(logDir, "raci-suggestions.jsonl"),
    JSON.stringify(suggestion) + "\n",
    "utf-8",
  );
  process.stderr.write(
    `[org-tools] RACI: A=${suggestion.accountable}, C=[${suggestion.consulted.join(",")}], I=[${suggestion.informed.join(",")}]\n`,
  );
}

// --- Organizational Memory ---

function generateRetro(projectDir, outputDir) {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/tmp";
  const teamsDir = join(home, ".claude", "teams");
  let teamNames;
  try {
    teamNames = readdirSync(teamsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return;
  }

  const outPath = join(projectDir, outputDir);
  try {
    mkdirSync(outPath, { recursive: true });
  } catch {
    /* exists */
  }

  const date = new Date().toISOString().split("T")[0];

  for (const team of teamNames) {
    const tasksDir = join(home, ".claude", "tasks", team);
    let taskFiles;
    try {
      taskFiles = readdirSync(tasksDir).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    if (taskFiles.length === 0) continue;

    const tasks = [];
    for (const f of taskFiles) {
      try {
        const d = JSON.parse(readFileSync(join(tasksDir, f), "utf-8"));
        tasks.push({
          id: d.id ?? f.replace(/\.json$/, ""),
          subject: d.subject ?? "",
          status: d.status ?? "",
          owner: d.owner,
        });
      } catch {
        /* skip */
      }
    }

    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    const pending = tasks.length - completed - failed;
    const rate =
      tasks.length > 0
        ? ((completed / tasks.length) * 100).toFixed(1)
        : "N/A";

    const lines = [
      `# Retrospective: ${team}`,
      `\nDate: ${date}\n`,
      "## Summary\n",
      "| Metric | Count |",
      "|--------|-------|",
      `| Total tasks | ${tasks.length} |`,
      `| Completed | ${completed} |`,
      `| Failed | ${failed} |`,
      `| Pending/In-progress | ${pending} |`,
      `| Completion rate | ${rate}% |\n`,
      "## Task Details\n",
      "| ID | Subject | Status | Owner |",
      "|-----|---------|--------|-------|",
      ...tasks.map(
        (t) => `| ${t.id} | ${t.subject} | ${t.status} | ${t.owner ?? "-"} |`,
      ),
      "",
    ];
    writeFileSync(
      join(outPath, `${team}-${date}.md`),
      lines.join("\n"),
      "utf-8",
    );
    process.stderr.write(
      `[org-tools] Retrospective: ${join(outPath, team + "-" + date + ".md")}\n`,
    );
  }
}

// --- Main ---

function readStdin() {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function main() {
  const hookType = process.argv[2];
  if (!hookType) {
    process.stderr.write(
      "Usage: org-tools.mjs <pre-tool-use|post-tool-use|stop>\n",
    );
    process.exit(1);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const config = loadConfig(projectDir);

  if (hookType === "pre-tool-use") {
    let input = {};
    try {
      const raw = readStdin();
      if (raw.trim()) input = JSON.parse(raw);
    } catch {
      /* no input */
    }

    if (config.tools.andon.enabled) {
      const result = checkAndon(projectDir);
      if (result?.block) {
        process.stdout.write(
          JSON.stringify({ decision: "block", reason: result.reason }),
        );
        process.exit(2);
      }
    }
    if (config.tools.topology.enabled && input.tool_input) {
      const result = checkTopology(projectDir, input.tool_input);
      if (result?.block) {
        process.stdout.write(
          JSON.stringify({ decision: "block", reason: result.reason }),
        );
        process.exit(2);
      }
    }
  } else if (hookType === "post-tool-use") {
    let input = {};
    try {
      const raw = readStdin();
      if (raw.trim()) input = JSON.parse(raw);
    } catch {
      /* no input */
    }

    if (config.tools.raci.enabled && input.tool_input) {
      handleRaci(projectDir, input.tool_input, config.tools.raci.configPath);
    }
  } else if (hookType === "stop") {
    if (config.tools.orgMemory.enabled) {
      generateRetro(projectDir, config.tools.orgMemory.outputDir);
    }
  }
}

main();
