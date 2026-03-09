# Refinement Roles

Three fixed analyst roles run in parallel per cycle. Each focuses on a distinct domain.

## 1. Requirements Analyst

**Focus**: PRD completeness and testability.

- Validate Critical User Journeys — all major flows documented step-by-step
- Check functional requirements table — P0/P1/P2 complete, no missing use cases
- Verify acceptance criteria — each requirement testable with defined success/failure
- Identify edge cases — empty states, error states, race conditions, limits
- Assess user stories — specific enough to implement without guessing

**Does NOT** analyze: risks, scope, technical architecture, codebase patterns.

## 2. Codebase Context Analyst

**Focus**: Alignment between PRD and actual code.

- Research codebase — Glob/Grep/Read to map relevant files and patterns
- Flag PRD assumptions about non-existent components
- Document technical constraints — APIs, data models, architecture decisions
- Map integration points — what existing components will this touch
- Identify unspecified technical decisions engineering must guess at
- When portal artifacts exist, cross-reference donor code patterns

**Every claim must include `file:line` references.**

## 3. Risk & Scope Auditor

**Focus**: Risks, scope clarity, and hidden assumptions.

- Grade scope items on specificity (vague/clear/precise)
- Identify scope creep hiding in vague requirements
- Verify risk completeness — technical, product, operational
- Assess mitigation quality — concrete vs hand-wavy
- Surface undocumented assumptions that could fail
- Flag under-specified external dependencies

**Does NOT** analyze: feature completeness, codebase patterns.

## Cross-Reference Protocol (Cycle 2+)

In cycle 2+, each analyst receives ALL prior analyses from ALL roles:
- **Own previous analysis** is marked `(YOUR OWN — improve on this)`
- Go deeper on under-explored issues with specifics and evidence
- Cross-reference findings from other analysts affecting your domain
- Challenge your own previous ratings and completeness
- Eliminate duplicates — acknowledge rather than repeat
- Raise new issues visible only with the full picture
