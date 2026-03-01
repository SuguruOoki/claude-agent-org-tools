import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { generateRetro } from "../src/hooks/memory.js";

describe("Organizational Memory", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "memory-test-"));
    originalHome = process.env.HOME;
  });

  afterEach(async () => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no teams exist", async () => {
    // Point HOME to tmpDir so it won't find any teams
    process.env.HOME = tmpDir;
    const result = await generateRetro(tmpDir, ".claude/org-tools/retrospectives");
    expect(result).toEqual([]);
  });

  it("generates retrospective for a team with tasks", async () => {
    // Create fake team and tasks directories at tmpDir as HOME
    process.env.HOME = tmpDir;
    const teamsDir = join(tmpDir, ".claude", "teams");
    const tasksDir = join(tmpDir, ".claude", "tasks", "test-team");
    await mkdir(teamsDir, { recursive: true });
    await mkdir(tasksDir, { recursive: true });

    // Create team directory
    await mkdir(join(teamsDir, "test-team"), { recursive: true });

    // Create task files
    await writeFile(
      join(tasksDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "Setup project",
        status: "completed",
        owner: "dev-1",
      }),
    );
    await writeFile(
      join(tasksDir, "2.json"),
      JSON.stringify({
        id: "2",
        subject: "Write tests",
        status: "completed",
        owner: "dev-2",
      }),
    );
    await writeFile(
      join(tasksDir, "3.json"),
      JSON.stringify({
        id: "3",
        subject: "Deploy",
        status: "pending",
        owner: "sre",
      }),
    );

    const result = await generateRetro(tmpDir, ".claude/org-tools/retrospectives");
    expect(result.length).toBe(1);

    const content = await readFile(result[0], "utf-8");
    expect(content).toContain("# Retrospective: test-team");
    expect(content).toContain("| Total tasks | 3 |");
    expect(content).toContain("| Completed | 2 |");
    expect(content).toContain("| Pending/In-progress | 1 |");
    expect(content).toContain("66.7%");
  });

  it("skips teams with no tasks", async () => {
    process.env.HOME = tmpDir;
    const teamsDir = join(tmpDir, ".claude", "teams");
    await mkdir(join(teamsDir, "empty-team"), { recursive: true });

    const result = await generateRetro(tmpDir, ".claude/org-tools/retrospectives");
    expect(result).toEqual([]);
  });

  it("creates output directory if it does not exist", async () => {
    process.env.HOME = tmpDir;
    const teamsDir = join(tmpDir, ".claude", "teams");
    const tasksDir = join(tmpDir, ".claude", "tasks", "my-team");
    await mkdir(join(teamsDir, "my-team"), { recursive: true });
    await mkdir(tasksDir, { recursive: true });

    await writeFile(
      join(tasksDir, "1.json"),
      JSON.stringify({
        id: "1",
        subject: "Task",
        status: "completed",
      }),
    );

    const outputDir = ".claude/org-tools/new-retros";
    const result = await generateRetro(tmpDir, outputDir);
    expect(result.length).toBe(1);

    const files = await readdir(join(tmpDir, outputDir));
    expect(files.length).toBe(1);
  });
});
