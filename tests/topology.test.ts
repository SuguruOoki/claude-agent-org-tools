import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkTopology } from "../src/hooks/topology.js";

describe("Team Topology Protocol", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "topology-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when topology.json does not exist", async () => {
    const result = await checkTopology(tmpDir, { file_path: "src/index.ts" });
    expect(result).toBeNull();
  });

  it("returns null when no file_path in tool input", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "topology.json"),
      JSON.stringify({
        agents: [
          {
            name: "frontend",
            type: "stream-aligned",
            owns: ["src/frontend/**"],
          },
        ],
      }),
    );

    const result = await checkTopology(tmpDir, {});
    expect(result).toBeNull();
  });

  it("returns null when file does not match any agent", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "topology.json"),
      JSON.stringify({
        agents: [
          {
            name: "frontend",
            type: "stream-aligned",
            owns: ["src/frontend/**"],
          },
        ],
      }),
    );

    const result = await checkTopology(tmpDir, {
      file_path: "src/backend/server.ts",
    });
    expect(result).toBeNull();
  });

  it("blocks write to facilitating team's files", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "topology.json"),
      JSON.stringify({
        agents: [
          {
            name: "platform",
            type: "platform",
            owns: ["infra/**"],
            interactionMode: "facilitating",
          },
        ],
      }),
    );

    const result = await checkTopology(tmpDir, {
      file_path: "infra/terraform/main.tf",
    });
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("facilitating");
  });

  it("allows write to stream-aligned team's files", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "topology.json"),
      JSON.stringify({
        agents: [
          {
            name: "frontend",
            type: "stream-aligned",
            owns: ["src/frontend/**"],
            interactionMode: "collaboration",
          },
        ],
      }),
    );

    const result = await checkTopology(tmpDir, {
      file_path: "src/frontend/App.tsx",
    });
    expect(result).toBeNull();
  });

  it("matches glob pattern with /**", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "topology.json"),
      JSON.stringify({
        agents: [
          {
            name: "api",
            type: "stream-aligned",
            owns: ["src/api/**"],
            interactionMode: "facilitating",
          },
        ],
      }),
    );

    const result = await checkTopology(tmpDir, {
      file_path: "src/api/routes/users.ts",
    });
    expect(result).not.toBeNull();
    expect(result!.block).toBe(true);
  });

  it("matches glob pattern with /*", async () => {
    const configDir = join(tmpDir, ".claude", "org-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "topology.json"),
      JSON.stringify({
        agents: [
          {
            name: "root-config",
            type: "platform",
            owns: ["config/*"],
            interactionMode: "facilitating",
          },
        ],
      }),
    );

    // Direct child matches
    const result1 = await checkTopology(tmpDir, {
      file_path: "config/app.json",
    });
    expect(result1).not.toBeNull();
    expect(result1!.block).toBe(true);

    // Nested path should not match
    const result2 = await checkTopology(tmpDir, {
      file_path: "config/nested/app.json",
    });
    expect(result2).toBeNull();
  });
});
