import { describe, it, expect } from "bun:test";
import { mergeHooks, removeHooks } from "../src/settings-merger.js";

describe("Settings Merger", () => {
  describe("mergeHooks", () => {
    it("creates hooks from empty settings", () => {
      const result = mergeHooks({});
      expect(result.hooks).toBeDefined();
      expect(result.hooks!.PreToolUse).toHaveLength(1);
      expect(result.hooks!.PostToolUse).toHaveLength(1);
      expect(result.hooks!.Stop).toHaveLength(1);
    });

    it("preserves existing hooks", () => {
      const existing = {
        hooks: {
          PreToolUse: [
            {
              matcher: "Write",
              hooks: [{ type: "command", command: "echo existing" }],
            },
          ],
        },
      };

      const result = mergeHooks(existing);
      const preToolUse = result.hooks!.PreToolUse as Array<{
        matcher?: string;
        hooks: Array<{ type: string; command: string }>;
      }>;
      expect(preToolUse).toHaveLength(2);
      expect(preToolUse[0].hooks[0].command).toBe("echo existing");
      expect(preToolUse[1].hooks[0].command).toContain("org-tools.ts");
    });

    it("does not duplicate org-tools hooks on repeated calls", () => {
      const first = mergeHooks({});
      const second = mergeHooks(first);

      expect(second.hooks!.PreToolUse).toHaveLength(1);
      expect(second.hooks!.PostToolUse).toHaveLength(1);
      expect(second.hooks!.Stop).toHaveLength(1);
    });

    it("preserves non-hook keys", () => {
      const existing = {
        env: { FOO: "bar" },
        teammateMode: true,
        hooks: {},
      };

      const result = mergeHooks(existing);
      expect((result as Record<string, unknown>).env).toEqual({ FOO: "bar" });
      expect((result as Record<string, unknown>).teammateMode).toBe(true);
    });

    it("sets correct matcher for PreToolUse", () => {
      const result = mergeHooks({});
      const preToolUse = result.hooks!.PreToolUse as Array<{
        matcher?: string;
      }>;
      expect(preToolUse[0].matcher).toBe("Write|Edit|Bash");
    });

    it("sets correct matcher for PostToolUse", () => {
      const result = mergeHooks({});
      const postToolUse = result.hooks!.PostToolUse as Array<{
        matcher?: string;
      }>;
      expect(postToolUse[0].matcher).toBe("TaskUpdate");
    });
  });

  describe("removeHooks", () => {
    it("removes org-tools hooks", () => {
      const withHooks = mergeHooks({});
      const result = removeHooks(withHooks);

      expect(result.hooks!.PreToolUse).toBeUndefined();
      expect(result.hooks!.PostToolUse).toBeUndefined();
      expect(result.hooks!.Stop).toBeUndefined();
    });

    it("preserves other hooks when removing", () => {
      const existing = mergeHooks({
        hooks: {
          PreToolUse: [
            {
              matcher: "Write",
              hooks: [{ type: "command", command: "echo custom" }],
            },
          ],
        },
      });

      const result = removeHooks(existing);
      const preToolUse = result.hooks!.PreToolUse as Array<{
        hooks: Array<{ command: string }>;
      }>;
      expect(preToolUse).toHaveLength(1);
      expect(preToolUse[0].hooks[0].command).toBe("echo custom");
    });

    it("handles settings without hooks", () => {
      const result = removeHooks({ env: { FOO: "bar" } });
      expect(result.env).toEqual({ FOO: "bar" });
    });
  });
});
