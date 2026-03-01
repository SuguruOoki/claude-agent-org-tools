import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, readdir, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInit } from "../src/commands/init.js";
import { runEnable, runDisable } from "../src/commands/enable.js";
import { runStatus } from "../src/commands/status.js";
import { triggerAndon, releaseAndon } from "../src/commands/andon-cmd.js";
import { loadConfig } from "../src/config.js";

describe("CLI Integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "cli-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("init", () => {
    it("creates required directories and files", async () => {
      await runInit(tmpDir);

      // Check config.json exists
      const configPath = join(tmpDir, ".claude", "org-tools", "config.json");
      const config = JSON.parse(await readFile(configPath, "utf-8"));
      expect(config.tools.andon.enabled).toBe(true);
      expect(config.tools.topology.enabled).toBe(false);

      // Check settings.json has hooks
      const settingsPath = join(tmpDir, ".claude", "settings.json");
      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(settings.hooks.PreToolUse).toBeDefined();
      expect(settings.hooks.PostToolUse).toBeDefined();
      expect(settings.hooks.Stop).toBeDefined();

      // Check directories exist
      const andonDir = join(tmpDir, ".claude", "org-tools", "andon");
      const retroDir = join(tmpDir, ".claude", "org-tools", "retrospectives");
      await access(andonDir);
      await access(retroDir);
    });

    it("is idempotent (safe to run twice)", async () => {
      await runInit(tmpDir);
      await runInit(tmpDir);

      const settingsPath = join(tmpDir, ".claude", "settings.json");
      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      // Should have exactly 1 hook per type, not 2
      expect(settings.hooks.PreToolUse).toHaveLength(1);
      expect(settings.hooks.PostToolUse).toHaveLength(1);
      expect(settings.hooks.Stop).toHaveLength(1);
    });
  });

  describe("enable/disable", () => {
    it("enables a disabled tool", async () => {
      await runInit(tmpDir);

      // topology is disabled by default
      let config = await loadConfig(tmpDir);
      expect(config.tools.topology.enabled).toBe(false);

      await runEnable(tmpDir, "topology");
      config = await loadConfig(tmpDir);
      expect(config.tools.topology.enabled).toBe(true);
    });

    it("disables an enabled tool", async () => {
      await runInit(tmpDir);

      // andon is enabled by default
      let config = await loadConfig(tmpDir);
      expect(config.tools.andon.enabled).toBe(true);

      await runDisable(tmpDir, "andon");
      config = await loadConfig(tmpDir);
      expect(config.tools.andon.enabled).toBe(false);
    });
  });

  describe("status", () => {
    it("runs without error after init", async () => {
      await runInit(tmpDir);
      // status just prints to console, verify it doesn't throw
      await runStatus(tmpDir);
    });
  });

  describe("andon", () => {
    it("triggers and releases andon", async () => {
      await runInit(tmpDir);

      // Trigger
      await triggerAndon(tmpDir, "test-team", "Testing andon");
      const andonDir = join(tmpDir, ".claude", "org-tools", "andon");
      const files = await readdir(andonDir);
      expect(files).toContain("test-team.json");

      const content = JSON.parse(
        await readFile(join(andonDir, "test-team.json"), "utf-8"),
      );
      expect(content.reason).toBe("Testing andon");
      expect(content.severity).toBe("critical");

      // Release
      await releaseAndon(tmpDir, "test-team");
      const filesAfter = await readdir(andonDir);
      expect(filesAfter).not.toContain("test-team.json");
    });

    it("triggers with warning severity", async () => {
      await runInit(tmpDir);
      await triggerAndon(tmpDir, "fe-team", "API might change", "warning");

      const content = JSON.parse(
        await readFile(
          join(tmpDir, ".claude", "org-tools", "andon", "fe-team.json"),
          "utf-8",
        ),
      );
      expect(content.severity).toBe("warning");
    });

    it("handles release of non-existent andon gracefully", async () => {
      await runInit(tmpDir);
      // Should not throw
      await releaseAndon(tmpDir, "nonexistent");
    });
  });
});
