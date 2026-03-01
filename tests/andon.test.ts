import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkAndon } from "../src/hooks/andon.js";

describe("Andon Signal", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "andon-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when andon directory does not exist", async () => {
    const result = await checkAndon(tmpDir);
    expect(result).toBeNull();
  });

  it("returns null when andon directory is empty", async () => {
    await mkdir(join(tmpDir, ".claude", "org-tools", "andon"), {
      recursive: true,
    });
    const result = await checkAndon(tmpDir);
    expect(result).toBeNull();
  });

  it("blocks on critical severity", async () => {
    const andonDir = join(tmpDir, ".claude", "org-tools", "andon");
    await mkdir(andonDir, { recursive: true });
    await writeFile(
      join(andonDir, "backend.json"),
      JSON.stringify({
        triggered_by: "backend-engineer",
        severity: "critical",
        reason: "DB schema migration in progress",
        timestamp: "2026-02-28T14:30:00Z",
      }),
    );

    const result = await checkAndon(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
    expect(result!.severity).toBe("critical");
    expect(result!.team).toBe("backend");
    expect(result!.reason).toContain("DB schema migration");
  });

  it("returns null (no block) for warning severity", async () => {
    const andonDir = join(tmpDir, ".claude", "org-tools", "andon");
    await mkdir(andonDir, { recursive: true });
    await writeFile(
      join(andonDir, "frontend.json"),
      JSON.stringify({
        triggered_by: "frontend-engineer",
        severity: "warning",
        reason: "API contract may change",
        timestamp: "2026-02-28T14:30:00Z",
      }),
    );

    const result = await checkAndon(tmpDir);
    expect(result).toBeNull();
  });

  it("skips invalid JSON files", async () => {
    const andonDir = join(tmpDir, ".claude", "org-tools", "andon");
    await mkdir(andonDir, { recursive: true });
    await writeFile(join(andonDir, "bad.json"), "not valid json");

    const result = await checkAndon(tmpDir);
    expect(result).toBeNull();
  });

  it("skips non-json files", async () => {
    const andonDir = join(tmpDir, ".claude", "org-tools", "andon");
    await mkdir(andonDir, { recursive: true });
    await writeFile(join(andonDir, "readme.txt"), "just a text file");

    const result = await checkAndon(tmpDir);
    expect(result).toBeNull();
  });

  it("processes first critical file found", async () => {
    const andonDir = join(tmpDir, ".claude", "org-tools", "andon");
    await mkdir(andonDir, { recursive: true });

    await writeFile(
      join(andonDir, "a-team.json"),
      JSON.stringify({
        triggered_by: "a",
        severity: "critical",
        reason: "First issue",
        timestamp: "2026-02-28T14:30:00Z",
      }),
    );
    await writeFile(
      join(andonDir, "b-team.json"),
      JSON.stringify({
        triggered_by: "b",
        severity: "critical",
        reason: "Second issue",
        timestamp: "2026-02-28T14:31:00Z",
      }),
    );

    const result = await checkAndon(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
  });
});
