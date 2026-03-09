---
name: meeseeks
description: Rotating-focus code review with commit-on-finding
version: 1.0.0
triggers:
  - meeseeks
  - review
  - code-review
  - audit
references:
  - path: references/persona.md
    description: Pickle Rick voice and coding philosophy
    conditional: true
    condition: "Included when config.json persona != false"
  - path: references/focus-areas.md
    description: 8 rotating review categories with checklists
  - path: references/send-to-morty-review.md
    description: Per-pass review template with EXISTENCE_IS_PAIN promise token
---

# Meeseeks — Rotating-Focus Code Review

You are the **LAUNCHER**. You do NOT perform the review directly — the scripts handle worker orchestration, focus area rotation, and pass gating.

## Usage

```
/meeseeks [target description]
```

## Step 1: Initialize Session

Run the setup script with the meeseeks template:

```bash
node scripts/bin/setup.js "meeseeks review" --runtime <cli> --template meeseeks.md
```

Replace `<cli>` with your runtime name (claude, gemini, codex, aider, goose, hermes, amp, kilo).

Capture the `SESSION_ROOT=<path>` line from stdout. This is the session directory.

**Optional flags**: `--max-iterations <N>`, `--max-time <MIN>`, `--worker-timeout <SEC>`

## Step 2: Run Review Loop

Start the mux-runner with the session directory:

```bash
node scripts/bin/mux-runner.js <session-dir>
```

The runner spawns review workers that rotate through 8 focus areas (see `references/focus-areas.md`). Each pass reviews the codebase against one focus area:
- **Clean pass**: worker emits `<promise>EXISTENCE_IS_PAIN</promise>` — no findings
- **Dirty pass**: worker commits fixes and lists findings

The loop exits when consecutive clean passes reach `meeseeks_min_passes` (default 10). Hard stop at `meeseeks_max_passes` (default 50).

Wait for the process to exit.

## Step 3: Report Results

- Exit code 0 = review complete, codebase clean
- Non-zero = check session logs in `<session-dir>/` for details

Report the exit status and review summary to the user.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `meeseeks_min_passes` | 10 | Minimum passes before clean exit |
| `meeseeks_max_passes` | 50 | Hard iteration limit |
| `meeseeks_model` | sonnet | Model for review workers (cost optimization) |

Set in `pickle_settings.json` or pass via `--max-iterations` flag.

## How It Works

1. `transitionToMeeseeks` resets: `iteration: 0`, `current_ticket: null`, `command_template: 'meeseeks.md'`
2. Each iteration picks focus area via `iteration % 8`
3. Worker reviews against that focus, commits fixes or emits EXISTENCE_IS_PAIN
4. `classifyCompletion()` maps EXISTENCE_IS_PAIN to `review_clean`
5. Min-gate: clean pass only exits if `iteration >= meeseeks_min_passes`
