# pickle-rick-skills

CLI-agnostic autonomous engineering lifecycle — agentskills.io standard.
Port of pickle-rick-claude, maintained independently.

## Build & Test

From `scripts/`: `npx tsc --noEmit && npx tsc && cd .. && npm test`
Or from root: `npm test`

Tests: `scripts/tests/*.test.js` via `node --test`. No `.test.ts` files.

## Structure

```
.agents/skills/*/SKILL.md   — agentskills.io skill definitions (YAML frontmatter)
scripts/src/               — TypeScript source (ESM, Node 20+)
scripts/bin/               — Compiled JS output (tsc)
scripts/tests/             — Tests (node:test)
persona.md                 — Optional Pickle Rick persona
pickle_settings.json       — Default config
package.json               — Root package
```

## Conventions

- ESM (`"type": "module"`) with `.js` extensions in imports
- CLI guard: `if (process.argv[1] && path.basename(process.argv[1]) === 'foo.js') { ... }`
- Error handling: `const msg = err instanceof Error ? err.message : String(err);`
- Atomic writes: write to `.tmp.<pid>`, then `fs.renameSync`
- State management via JSON files (no database)
- No Claude Code hooks, no tmux/zellij — agents follow SKILL.md instructions inline
- Supports 8 CLI runtimes: claude, codex, gemini, goose, hermes, aider, openhands, amp

## Reference Source

This is a PORT of `pickle-rick-claude/extension/`. When implementing features, study
the corresponding source in `../pickle-rick-claude/extension/src/` for patterns and logic,
but adapt for the agentskills.io model (no hooks, no tmux, inline instructions).
