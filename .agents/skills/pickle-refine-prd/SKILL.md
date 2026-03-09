---
name: pickle-refine-prd
description: Refine and decompose a PRD into atomic tickets using parallel analysis.
version: 1.0.0
triggers:
  - refine-prd
  - decompose
  - breakdown
references:
  - path: references/refinement-roles.md
    description: Three analyst roles and cross-reference protocol
---

# Pickle Refine PRD — Multi-Perspective Analysis & Decomposition

You are the **LAUNCHER**. You invoke the refinement team script which spawns 3 parallel analyst workers per cycle.

## Usage

```
/pickle-refine-prd <prd-path> [--cycles N]
```

## Step 1: Validate Input

Confirm the PRD file exists at the given path. Read it to verify it has the expected structure (Problem, Objective, Requirements sections).

## Step 2: Determine Session Directory

If a Pickle Rick session is active, use its session directory. Otherwise, create a temporary working directory.

## Step 3: Run Refinement Team

Execute the refinement script:

```bash
node scripts/bin/spawn-refinement-team.js <session-dir> <prd-path> [--cycles N]
```

Default: 3 cycles. Each cycle spawns 3 analysts in parallel (see `references/refinement-roles.md`):
- **Requirements Analyst** — completeness, testability, edge cases
- **Codebase Context Analyst** — code alignment, integration points
- **Risk & Scope Auditor** — risks, scope clarity, assumptions

Cycle 2+ includes cross-referencing: each analyst sees ALL prior analyses, with their own marked for improvement.

Wait for the process to exit and read `refinement_manifest.json` from the session directory.

## Step 4: Report Results

Read the manifest and report:
- Cycles completed vs requested
- Per-worker success/failure
- Whether early termination occurred (all workers failed in a cycle)
- Paths to analysis files for the user to review

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `refinement_cycles` | 3 | Number of analysis cycles |
| `refinement_max_turns` | 100 | Max turns per worker per cycle |
| `refinement_worker_timeout_seconds` | 600 | Worker timeout in seconds |

Set in `pickle_settings.json`.
