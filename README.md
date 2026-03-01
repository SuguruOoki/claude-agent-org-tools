# claude-agent-org-tools

Organization-theory based tools for Claude Code Agent Teams.

4 tools derived from manufacturing and software engineering organizational patterns:

| Tool | Origin | Purpose |
|------|--------|---------|
| **Andon Signal** | Toyota Production System | Emergency stop that blocks all agent writes |
| **Team Topology Protocol** | Team Topologies (Skelton & Pais) | Enforce file ownership boundaries |
| **RACI Auto-Router** | RACI Matrix | Route task completion notifications by role |
| **Organizational Memory** | Agile Retrospective | Auto-generate session retrospectives |

## Quick Start

```bash
cd your-project
bunx claude-agent-org-tools init
```

This single command:
1. Places the hook entrypoint at `.claude/hooks/org-tools.ts`
2. Generates `.claude/org-tools/config.json` with defaults
3. Merges hook definitions into `.claude/settings.json` (safely, without breaking existing hooks)

## What's Enabled by Default

| Tool | Default | Why |
|------|---------|-----|
| Andon Signal | ON | Zero config needed. No andon files = no effect |
| Organizational Memory | ON | Zero config needed. Generates retrospectives on session end |
| Team Topology | OFF | Requires `topology.json` with agent ownership map |
| RACI Auto-Router | OFF | Requires `raci.json` with routing matrix |

## CLI Commands

```bash
claude-org init                          # Initialize in current project
claude-org status                        # Show tool status
claude-org enable <tool>                 # Enable: andon|topology|raci|orgMemory
claude-org disable <tool>                # Disable a tool
claude-org andon <team> "reason"         # Trigger emergency stop
claude-org andon <team> --release        # Release emergency stop
claude-org andon <team> "reason" --severity warning  # Warning only (no block)
```

## How It Works

A single TypeScript file (`.claude/hooks/org-tools.ts`) handles all hook events:

```
PreToolUse (Write|Edit|Bash)  → Andon check + Topology boundary check
PostToolUse (TaskUpdate)      → RACI routing suggestion
Stop                          → Retrospective generation
```

Tool ON/OFF is controlled via `.claude/org-tools/config.json`, not by editing `settings.json`.

## Tool Details

### Andon Signal

Trigger an emergency stop when a critical issue is detected:

```bash
claude-org andon backend "DB schema migration in progress"
```

This creates `.claude/org-tools/andon/backend.json`. While this file exists, all `Write`, `Edit`, and `Bash` tool calls are blocked with exit code 2.

Release when resolved:

```bash
claude-org andon backend --release
```

### Team Topology Protocol

Define agent file ownership in `.claude/org-tools/topology.json`:

```json
{
  "agents": [
    {
      "name": "frontend",
      "type": "stream-aligned",
      "owns": ["src/frontend/**", "src/components/**"],
      "interactionMode": "collaboration"
    },
    {
      "name": "platform",
      "type": "platform",
      "owns": ["infra/**"],
      "interactionMode": "facilitating"
    }
  ]
}
```

- `facilitating` mode: Write/Edit to owned files is **blocked**
- `collaboration` mode: Cross-team writes produce **warnings** (v0.1)

Enable after creating the config:

```bash
claude-org enable topology
```

### RACI Auto-Router

Define routing rules in `.claude/org-tools/raci.json`:

```json
{
  "matrix": [
    {
      "taskPattern": "deploy.*production",
      "responsible": "sre",
      "accountable": "tech-lead",
      "consulted": ["qa"],
      "informed": ["product-manager"]
    }
  ]
}
```

When a `TaskUpdate` sets status to `completed` and the subject matches a pattern, a routing suggestion is logged to `.claude/org-tools/raci-suggestions.jsonl`.

v0.1 is log-only. The team lead reads the log and manually sends messages.

Enable after creating the config:

```bash
claude-org enable raci
```

### Organizational Memory

On session end (`Stop` hook), generates a Markdown retrospective for each active team:

```
.claude/org-tools/retrospectives/{team-name}-{date}.md
```

Contains:
- Task completion statistics
- Per-task status breakdown
- Observations (all complete, failures, pending items)

## File Structure

```
.claude/
  hooks/
    org-tools.ts              # Single hook entrypoint (auto-generated)
  org-tools/
    config.json               # Tool enable/disable config
    andon/                    # Andon signal files (per-team)
    retrospectives/           # Generated retrospective reports
    topology.json             # [User-created] Agent ownership map
    raci.json                 # [User-created] RACI routing matrix
    raci-suggestions.jsonl    # [Auto-generated] RACI routing log
```

## Requirements

- [Bun](https://bun.sh/) runtime
- Claude Code with hooks support

## Development

```bash
bun install
bun test
```

## License

MIT
