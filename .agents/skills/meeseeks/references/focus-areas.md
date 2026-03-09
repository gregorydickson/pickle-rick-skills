# Focus Areas — 8 Rotating Review Categories

Workers rotate through these categories based on `iteration % 8`. Each pass reviews the entire codebase against one focus area.

## 1. Dependency Health

Outdated and vulnerable dependencies, version hygiene, import cleanliness.

- Run `npm audit` / equivalent — flag CVEs
- Check for outdated deps (`npx npm-check-updates` or equivalent)
- Verify version pinning strategy (exact vs range)
- Run `npx depcheck` — remove unused deps
- Check for phantom/unlisted dependencies
- Verify lockfile consistency
- Check license compliance for new deps

## 2. Security

Injection vectors, auth gaps, secret exposure, input validation.

- SQL/command/path/template injection vectors
- Auth and authorization gaps (missing guards, privilege escalation)
- CSRF protection on state-changing endpoints
- Input validation at system boundaries
- Hardcoded secrets, API keys, credentials in source
- Security headers (CORS, CSP, HSTS)
- Unsafe deserialization
- Prototype pollution vectors
- Regex DoS (ReDoS) patterns
- Missing rate limiting on public endpoints

## 3. Correctness

Logic errors, edge cases, null handling, race conditions.

- Logic bugs and off-by-one errors
- Silent catch blocks that swallow errors
- Incomplete state machines (missing transitions)
- Missing error paths and unhandled rejections
- Race conditions in async code
- Wrong conditionals (&&/|| confusion, negation errors)
- Null/undefined mishandling
- Type coercion bugs
- Boundary condition failures

## 4. Architecture

Coupling, separation of concerns, abstraction levels, module boundaries.

- Tight coupling between modules
- Missing database indexes for query patterns
- Schema validation gaps at boundaries
- Wrong abstraction level (too high or too low)
- Observability gaps (missing logs, metrics, traces)
- Circular dependencies
- God objects / god functions
- Layer violations (UI touching DB, etc.)
- Leaking implementation details across boundaries

## 5. Test Coverage

Missing tests, assertion quality, edge case coverage, mock correctness.

- Error paths tested?
- Boundary conditions tested?
- Realistic mocks (not just happy-path stubs)?
- Tautological assertions (always-true tests)?
- Flaky test patterns (timing, ordering, global state)?
- Add missing tests for critical paths
- Integration test gaps
- Assertion specificity (overly broad matchers?)

## 6. Resilience

Error handling, retry logic, timeout coverage, graceful degradation.

- Missing retry with backoff on transient failures
- Missing timeouts on external calls
- Unbounded memory operations (loading entire datasets)
- Graceful shutdown gaps (cleanup on SIGTERM)
- Resource cleanup failures (file handles, connections)
- Missing circuit breakers on flaky dependencies
- Fallback behavior when dependencies unavailable
- Health check completeness

## 7. Code Quality

Naming, dead code, duplication, complexity, readability.

- Dead code — delete it
- Unused imports — remove them
- DRY violations — extract at 3+ occurrences
- Naming consistency (casing, conventions)
- Pattern adherence (project conventions)
- Unnecessary complexity (simplify)
- Deep nesting (max 2 levels)
- Long functions (extract focused helpers)
- Magic numbers/strings (use named constants)

## 8. Polish

Typos, formatting, doc accuracy, TODO cleanup, consistency.

- Typos in strings, comments, identifiers
- Stale comments that don't match code
- Minor performance optimizations
- Config tidying (unused env vars, dead feature flags)
- README/doc accuracy vs current behavior
- Leftover debug statements (console.log, debugger)
- TODO/FIXME/HACK cleanup — resolve or create tickets
- Formatting consistency (let linter handle, verify config)
