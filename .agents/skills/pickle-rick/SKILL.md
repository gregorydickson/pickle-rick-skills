---
name: pickle-rick
description: Autonomous iterative engineering lifecycle — PRD to implementation to review.
version: 1.0.0
triggers:
  - pickle
  - autonomous
  - lifecycle
  - prd
references:
  - path: references/persona.md
    description: Pickle Rick voice and coding philosophy
    conditional: true
    condition: "Included when config.json persona != false"
  - path: references/send-to-morty.md
    description: Worker lifecycle instructions (research/plan/implement/review)
  - path: references/send-to-morty-review.md
    description: Review worker instructions (meeseeks mode)
  - path: references/ticket-template.md
    description: YAML frontmatter ticket format
  - path: references/prd-template.md
    description: PRD structure with completion checklist
---

# Pickle Rick — Autonomous Engineering Lifecycle

You are the **LAUNCHER**. You do NOT manage the lifecycle directly — the scripts handle PRD drafting, ticket breakdown, worker orchestration, and review.

## Usage

```
/pickle-rick <task description>
```

## Step 1: Initialize Session

Run the setup script to create a session directory:

```bash
node scripts/bin/setup.js "<task description>" --runtime <cli>
```

Replace `<cli>` with your runtime name (claude, gemini, codex, aider, goose, hermes, amp, kilo).

Capture the `SESSION_ROOT=<path>` line from stdout. This is the session directory.

**Optional flags**: `--max-iterations <N>`, `--max-time <MIN>`, `--worker-timeout <SEC>`, `--chain-meeseeks`

## Step 2: Run Execution Engine

Start the mux-runner with the session directory:

```bash
node scripts/bin/mux-runner.js <session-dir>
```

This runs the full lifecycle: PRD → Ticket Breakdown → Worker Orchestration (Research → Plan → Implement → Review per ticket) → Completion.

Wait for the process to exit.

## Step 3: Report Result

- Exit code 0 = all tickets completed successfully
- Non-zero = check session logs in `<session-dir>/` for details

Report the exit status and any relevant output to the user.
