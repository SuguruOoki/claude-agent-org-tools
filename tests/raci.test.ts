import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleRaci } from "../src/hooks/raci.js";

describe("RACI Auto-Router", () => {
  let tmpDir: string;
  const raciConfigRelPath = ".claude/org-tools/raci.json";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "raci-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when status is not completed", async () => {
    const result = await handleRaci(
      tmpDir,
      { status: "in_progress", subject: "test" },
      raciConfigRelPath,
    );
    expect(result).toBeNull();
  });

  it("returns null when raci config does not exist", async () => {
    const result = await handleRaci(
      tmpDir,
      { status: "completed", subject: "test" },
      raciConfigRelPath,
    );
    expect(result).toBeNull();
  });

  it("returns null when no task pattern matches", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(tmpDir, raciConfigRelPath),
      JSON.stringify({
        matrix: [
          {
            taskPattern: "deploy.*production",
            responsible: "sre",
            accountable: "tech-lead",
            consulted: ["qa"],
            informed: ["product-manager"],
          },
        ],
      }),
    );

    const result = await handleRaci(
      tmpDir,
      { status: "completed", subject: "fix login bug" },
      raciConfigRelPath,
    );
    expect(result).toBeNull();
  });

  it("returns suggestion and writes log when pattern matches", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(tmpDir, raciConfigRelPath),
      JSON.stringify({
        matrix: [
          {
            taskPattern: "deploy.*production",
            responsible: "sre",
            accountable: "tech-lead",
            consulted: ["qa"],
            informed: ["product-manager"],
          },
        ],
      }),
    );

    const result = await handleRaci(
      tmpDir,
      { status: "completed", subject: "deploy to production" },
      raciConfigRelPath,
    );

    expect(result).not.toBeNull();
    expect(result!.accountable).toBe("tech-lead");
    expect(result!.consulted).toEqual(["qa"]);
    expect(result!.informed).toEqual(["product-manager"]);

    // Verify log file was written
    const logPath = join(tmpDir, ".claude", "org-tools", "raci-suggestions.jsonl");
    const logContent = await readFile(logPath, "utf-8");
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.task).toBe("deploy to production");
    expect(logEntry.accountable).toBe("tech-lead");
  });

  it("appends to existing log file", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(tmpDir, raciConfigRelPath),
      JSON.stringify({
        matrix: [
          {
            taskPattern: ".*",
            responsible: "dev",
            accountable: "lead",
            consulted: [],
            informed: [],
          },
        ],
      }),
    );

    await handleRaci(
      tmpDir,
      { status: "completed", subject: "task 1" },
      raciConfigRelPath,
    );
    await handleRaci(
      tmpDir,
      { status: "completed", subject: "task 2" },
      raciConfigRelPath,
    );

    const logPath = join(tmpDir, ".claude", "org-tools", "raci-suggestions.jsonl");
    const lines = (await readFile(logPath, "utf-8")).trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).task).toBe("task 1");
    expect(JSON.parse(lines[1]).task).toBe("task 2");
  });
});
