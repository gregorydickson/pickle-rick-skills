---
name: pickle-standup
description: Formatted standup summary from activity logs — sessions, commits, durations.
version: 1.0.0
triggers:
  - standup
  - summary
  - status
  - daily
---

# Pickle Standup

Generate a formatted standup report from activity logs and git history.

## Usage

```bash
node scripts/bin/standup.js [--days N] [--since YYYY-MM-DD] [--json]
```

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--days N` | 1 | Number of days to include |
| `--since YYYY-MM-DD` | — | Start date (overrides --days) |
| `--json` | false | Output raw JSON instead of markdown |

## Output Format

Markdown standup report grouped by session:

```
# Standup - YYYY-MM-DD to YYYY-MM-DD

## Task Name (session-id)
- **Duration**: Xh Ym (N iterations)
- **Mode**: tmux/inline
- **Commits**:
  - `abc1234` commit message

## Ad-hoc Commits
- `def5678` other commit

## Ad-hoc Activity
- `HH:MM` **event_type** - detail
```

Sessions are sorted newest-first. Empty sessions (only lifecycle events, no commits) are filtered out. Commits are deduplicated between hook-logged and git-discovered.
