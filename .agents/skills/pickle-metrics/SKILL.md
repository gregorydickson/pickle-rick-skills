---
name: pickle-metrics
description: Developer metrics reporter — event counts, commits, LOC changes from activity logs and git history.
version: 1.0.0
triggers:
  - metrics
  - tokens
  - usage
  - stats
---

# Pickle Metrics

Report developer activity metrics aggregated from activity logs and git history.

## Usage

```bash
node scripts/bin/metrics.js [--days N] [--since YYYY-MM-DD] [--weekly] [--json]
```

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--days N` | 7 | Number of days to report |
| `--since YYYY-MM-DD` | — | Start date (overrides --days) |
| `--weekly` | false | Group by ISO week (defaults to 28 days if no range) |
| `--json` | false | Output raw JSON instead of formatted table |

## Data Sources

1. **Activity logs** — NDJSON files at `~/.pickle-rick-skills/activity/activity-YYYY-MM-DD.ndjson`. Counts events per day.
2. **Git repos** — Scans subdirectories of `$METRICS_REPO_ROOT` (default: `~/loanlight`) for `.git` dirs. Extracts commit counts and LOC changes via `git log --shortstat`.

## Cache

Results are cached at `~/.pickle-rick-skills/metrics-cache.json`, invalidated daily by date. Delete the cache file to force a fresh scan.

## Output

Formatted ASCII table with columns: Date, Events, Commits, +Lines, -Lines. Header shows totals.
