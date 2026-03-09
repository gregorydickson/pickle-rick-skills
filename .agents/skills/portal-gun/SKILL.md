---
name: portal-gun
description: Cross-repo pattern extraction and transplant PRD generation
version: 1.0.0
triggers:
  - portal
  - portal-gun
  - transplant
  - extract
  - donor
references:
  - path: references/pattern-analysis-template.md
    description: Structured template for donor codebase pattern extraction
  - path: references/target-analysis-template.md
    description: Structured template for target codebase survey
---

# Portal Gun — Cross-Repo Pattern Extraction

You are the **LAUNCHER**. You do NOT perform the extraction directly — the scripts handle donor analysis, pattern extraction, target survey, and transplant PRD generation.

**IMPORTANT**: This skill extracts structural PATTERNS (architecture, data flow, error handling, testing strategy) — it never copies implementation code. The output is a transplant PRD, not a code dump.

## Usage

```
/portal-gun <donor repo URL or local path>
```

## Step 1: Initialize Session

Run the setup script with the portal template:

```bash
node scripts/bin/setup.js "portal-gun: <donor description>" --runtime <cli> --template portal.md
```

Replace `<cli>` with your runtime name (claude, gemini, codex, aider, goose, hermes, amp, kilo).

Capture the `SESSION_ROOT=<path>` line from stdout. This is the session directory.

**Optional flags**: `--max-iterations <N>`, `--max-time <MIN>`, `--worker-timeout <SEC>`

## Step 2: Run Extraction Engine

Start the mux-runner with the session directory:

```bash
node scripts/bin/mux-runner.js <session-dir>
```

The runner executes the portal-gun lifecycle:

1. **Acquire donor** — clone/fetch the donor codebase (GitHub URL, local path, npm/PyPI package)
2. **Extract patterns** — analyze donor for structural patterns using `references/pattern-analysis-template.md`:
   - Architecture patterns (entry points, key abstractions)
   - Data flow patterns (input → transform → output)
   - Error handling patterns (retry, fallback, propagation strategy)
   - Testing patterns (unit/integration/e2e approach)
   - Integration patterns (how components connect)
   - Invariants (rules that must hold for the pattern to work)
3. **Survey target** — analyze the target codebase using `references/target-analysis-template.md`:
   - Current architecture and tech stack
   - Integration points where the pattern connects
   - Conflicts between donor and target approaches
   - Gaps the target needs to fill
   - Migration strategy
4. **Generate transplant PRD** — cross-reference pattern analysis with target analysis to produce `prd.md`

All artifacts persist in `<session-dir>/portal/`:
- `portal/pattern_analysis.md` — extracted patterns from donor
- `portal/target_analysis.md` — target codebase survey
- `portal/prd.md` — transplant PRD combining both analyses

Wait for the process to exit.

## Step 3: Report Result

- Exit code 0 = extraction and PRD generation completed successfully
- Non-zero = check session logs in `<session-dir>/` for details

Report the exit status and PRD location to the user.

**Next steps** after portal-gun completes:
- Hand off `prd.md` to `/pickle-refine-prd` for decomposition into atomic tickets
- Or run `/pickle-rick --resume <session-dir>` to execute the transplant PRD directly

## Cross-Skill Handoff

The `portal/` directory in the session is readable by other skills. The refinement team's Codebase Context Analyst checks for `portal/pattern_analysis.md` to cross-reference donor patterns against target constraints during PRD refinement.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `portal_depth` | `deep` | Analysis depth: `shallow` (summary only) or `deep` (full structural analysis) |
| `portal_save_pattern` | `false` | Persist extracted pattern to library for future reuse |
