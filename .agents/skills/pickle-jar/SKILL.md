---
name: pickle-jar
description: Batch PRD execution queue — queue tasks, verify integrity, execute sequentially.
version: 1.0.0
triggers:
  - jar
  - batch
  - queue
  - pickle-jar
---

# Pickle Jar — Batch PRD Execution Queue

Queue multiple PRDs for sequential batch execution. Each task spawns a full mux-runner.js lifecycle (setup.js session creation, iteration loop, completion detection).

## Queue a Task

```bash
node scripts/bin/add-to-pickle-jar.js <prd-path> "<task description>"
```

Validates the PRD path (rejects path traversal), computes SHA-256 hash for integrity verification, and appends to `~/.pickle-rick-skills/jar-queue.json`.

## Execute All Queued Tasks

```bash
node scripts/bin/jar-runner.js
```

Processes all `queued` tasks sequentially:

1. **Integrity check** — SHA-256 hash verified against queue-time snapshot. Modified PRDs are skipped (`integrity_failed`).
2. **Session creation** — `setup.js` creates a fresh session per task.
3. **State configuration** — `completion_promise: 'JARRED'`, `max_iterations` set to `manager_max_turns` (50, NOT tmux_max_turns 200).
4. **Execution** — Spawns `mux-runner.js <session-dir>` per task. Never spawns CLI directly.
5. **Status tracking** — Each task marked `completed`, `failed`, or `integrity_failed`.
6. **Notification** — macOS notification on completion (Darwin only).

### Dry Run

```bash
node scripts/bin/jar-runner.js --dry-run
```

Lists what would execute without running.

## Queue Format

Stored at `~/.pickle-rick-skills/jar-queue.json`:

```json
{
  "tasks": [
    {
      "id": "hex-string",
      "prd_path": "/absolute/path/to/prd.md",
      "task": "description",
      "sha256": "hash-at-queue-time",
      "status": "queued",
      "queued_at": "ISO-8601"
    }
  ]
}
```

## Security

- **Path traversal prevention**: Rejects `..`, absolute paths outside cwd, null bytes
- **SHA-256 integrity**: PRD content hashed at queue time, verified before execution
- **Sequential only**: One task at a time, never parallel
