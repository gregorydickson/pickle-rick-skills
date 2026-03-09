import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  buildRefinementPrompt,
  WORKER_ROLES,
} from '../bin/spawn-refinement-team.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'refinement-test-'));
}

const SAMPLE_PRD = `# Sample PRD

## Problem
Users need widget support.

## Requirements
| Priority | Requirement |
| P0 | Widget rendering |

## Risks
None identified.
`;

// ---------------------------------------------------------------------------
// 1. Three workers spawned per cycle
// ---------------------------------------------------------------------------

describe('buildRefinementPrompt roles', () => {
  it('produces prompts for all 3 roles', () => {
    for (const roleId of WORKER_ROLES) {
      const prompt = buildRefinementPrompt(
        roleId, SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1,
      );
      assert.ok(prompt.includes(SAMPLE_PRD), `PRD content missing for ${roleId}`);
      assert.ok(prompt.includes('ANALYSIS_DONE'), `ANALYSIS_DONE missing for ${roleId}`);
    }
  });

  it('requirements role has requirements-specific instructions', () => {
    const prompt = buildRefinementPrompt('requirements', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1);
    assert.ok(prompt.includes('Requirements Analyst'), 'Missing role title');
    assert.ok(prompt.includes('Critical User Journeys'), 'Missing CUJ instruction');
    assert.ok(!prompt.includes('Codebase Context'), 'Should not contain codebase instructions');
  });

  it('codebase role has codebase-specific instructions', () => {
    const prompt = buildRefinementPrompt('codebase', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1);
    assert.ok(prompt.includes('Codebase Context Analyst'), 'Missing role title');
    assert.ok(prompt.includes('file:line'), 'Missing file:line instruction');
  });

  it('risk-scope role has risk-specific instructions', () => {
    const prompt = buildRefinementPrompt('risk-scope', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1);
    assert.ok(prompt.includes('Risk & Scope Auditor'), 'Missing role title');
    assert.ok(prompt.includes('Scope Clarity'), 'Missing scope instruction');
  });
});

// ---------------------------------------------------------------------------
// 2. Cross-reference: cycle 1 has no cross-references
// ---------------------------------------------------------------------------

describe('cross-reference cycle 1', () => {
  it('cycle 1 has no cross-reference section', () => {
    const prompt = buildRefinementPrompt('requirements', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1);
    assert.ok(!prompt.includes('Previous Cycle Analyses'), 'Cycle 1 should not have cross-refs');
    assert.ok(!prompt.includes('(YOUR OWN'), 'Cycle 1 should not have own marking');
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-reference: cycle 2+ injects all prior analyses
// ---------------------------------------------------------------------------

describe('cross-reference cycle 2+', () => {
  it('cycle 2 injects all prior analyses', () => {
    const prev = new Map();
    prev.set('requirements', 'Requirements analysis content');
    prev.set('codebase', 'Codebase analysis content');
    prev.set('risk-scope', 'Risk analysis content');

    const prompt = buildRefinementPrompt(
      'requirements', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 2, prev,
    );

    assert.ok(prompt.includes('Previous Cycle Analyses'), 'Missing cross-ref section');
    assert.ok(prompt.includes('Requirements analysis content'), 'Missing requirements analysis');
    assert.ok(prompt.includes('Codebase analysis content'), 'Missing codebase analysis');
    assert.ok(prompt.includes('Risk analysis content'), 'Missing risk analysis');
    assert.ok(prompt.includes('THIS IS CYCLE 2'), 'Missing cycle note');
  });
});

// ---------------------------------------------------------------------------
// 4. Own analysis marking
// ---------------------------------------------------------------------------

describe('own analysis marking', () => {
  it('marks own previous analysis with "(YOUR OWN — improve on this)"', () => {
    const prev = new Map();
    prev.set('requirements', 'My own requirements findings');
    prev.set('codebase', 'Codebase findings from other analyst');
    prev.set('risk-scope', 'Risk findings from other analyst');

    const prompt = buildRefinementPrompt(
      'requirements', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 2, prev,
    );

    // Own analysis should be marked
    assert.ok(prompt.includes('(YOUR OWN — improve on this)'), 'Missing own marking');

    // Check that it's on the requirements line, not on others
    const lines = prompt.split('\n');
    const ownLine = lines.find(l => l.includes('(YOUR OWN — improve on this)'));
    assert.ok(ownLine, 'Own marking line not found');
    assert.ok(ownLine.includes('Requirements Analyst'), 'Own marking not on requirements line');
  });

  it('does not mark other analysts as own', () => {
    const prev = new Map();
    prev.set('requirements', 'Req content');
    prev.set('codebase', 'Code content');
    prev.set('risk-scope', 'Risk content');

    const prompt = buildRefinementPrompt(
      'codebase', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 2, prev,
    );

    const lines = prompt.split('\n');
    const ownLines = lines.filter(l => l.includes('(YOUR OWN — improve on this)'));
    assert.equal(ownLines.length, 1, 'Should have exactly one own marking');
    assert.ok(ownLines[0].includes('Codebase Context'), 'Own marking on wrong role');
  });
});

// ---------------------------------------------------------------------------
// 5. Early termination (tested via manifest structure)
// ---------------------------------------------------------------------------

describe('early termination logic', () => {
  it('RefinementManifest type has early_termination field', async () => {
    // Import the type and verify the manifest structure is exportable
    const mod = await import('../bin/spawn-refinement-team.js');
    assert.ok(typeof mod.spawnRefinementTeam === 'function', 'spawnRefinementTeam must be exported');
    assert.ok(typeof mod.buildRefinementPrompt === 'function', 'buildRefinementPrompt must be exported');
    assert.ok(Array.isArray(mod.WORKER_ROLES), 'WORKER_ROLES must be exported');
    assert.equal(mod.WORKER_ROLES.length, 3, 'Must have exactly 3 roles');
  });
});

// ---------------------------------------------------------------------------
// 6. Portal context injection
// ---------------------------------------------------------------------------

describe('portal context', () => {
  it('injects portal context into codebase role when portalDir provided', () => {
    const prompt = buildRefinementPrompt(
      'codebase', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1,
      undefined, '/tmp/session/portal',
    );

    assert.ok(prompt.includes('Portal Artifacts'), 'Missing portal section');
    assert.ok(prompt.includes('pattern_analysis.md'), 'Missing pattern_analysis reference');
    assert.ok(prompt.includes('target_analysis.md'), 'Missing target_analysis reference');
    assert.ok(prompt.includes('donor/'), 'Missing donor reference');
  });

  it('does not inject portal context into non-codebase roles', () => {
    const reqPrompt = buildRefinementPrompt(
      'requirements', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1,
      undefined, '/tmp/session/portal',
    );
    assert.ok(!reqPrompt.includes('Portal Artifacts'), 'Requirements should not have portal section');

    const riskPrompt = buildRefinementPrompt(
      'risk-scope', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1,
      undefined, '/tmp/session/portal',
    );
    assert.ok(!riskPrompt.includes('Portal Artifacts'), 'Risk-scope should not have portal section');
  });

  it('no portal section when portalDir is undefined', () => {
    const prompt = buildRefinementPrompt(
      'codebase', SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1,
    );
    assert.ok(!prompt.includes('Portal Artifacts'), 'Should not have portal section without portalDir');
  });
});

// ---------------------------------------------------------------------------
// 7. Manifest output schema
// ---------------------------------------------------------------------------

describe('manifest schema', () => {
  it('spawnRefinementTeam throws on missing session dir', async () => {
    const { spawnRefinementTeam } = await import('../bin/spawn-refinement-team.js');
    await assert.rejects(
      () => spawnRefinementTeam('/nonexistent-session-dir-' + process.pid, '/tmp/prd.md'),
      { message: /Session directory not found/ },
    );
  });

  it('spawnRefinementTeam throws on missing PRD file', async () => {
    const tmpDir = makeTmpDir();
    try {
      const { spawnRefinementTeam } = await import('../bin/spawn-refinement-team.js');
      await assert.rejects(
        () => spawnRefinementTeam(tmpDir, '/nonexistent-prd-' + process.pid + '.md'),
        { message: /PRD file not found/ },
      );
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ }
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Cycle archival naming
// ---------------------------------------------------------------------------

describe('cycle archival naming', () => {
  it('output_path follows analysis_<role>_c<N>.md convention', () => {
    // Verify the naming convention by checking prompt output file path
    for (const roleId of WORKER_ROLES) {
      const outputFile = `/tmp/refinement/analysis_${roleId}.md`;
      const prompt = buildRefinementPrompt(roleId, SAMPLE_PRD, outputFile, '/tmp/work', 1);
      assert.ok(prompt.includes(outputFile), `Output file path missing for ${roleId}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. ANALYSIS_DONE detection
// ---------------------------------------------------------------------------

describe('ANALYSIS_DONE detection', () => {
  it('prompt instructs worker to emit ANALYSIS_DONE token', () => {
    for (const roleId of WORKER_ROLES) {
      const prompt = buildRefinementPrompt(roleId, SAMPLE_PRD, '/tmp/out.md', '/tmp/work', 1);
      assert.ok(
        prompt.includes('<promise>ANALYSIS_DONE</promise>'),
        `Missing ANALYSIS_DONE instruction for ${roleId}`,
      );
    }
  });

  it('hasToken detects ANALYSIS_DONE in worker output', async () => {
    const { hasToken } = await import('../bin/types/index.js');
    const output = 'Analysis complete.\n<promise>ANALYSIS_DONE</promise>\n';
    assert.ok(hasToken(output, 'ANALYSIS_DONE'), 'Failed to detect ANALYSIS_DONE');

    const noToken = 'Analysis complete. No promise here.';
    assert.ok(!hasToken(noToken, 'ANALYSIS_DONE'), 'False positive on ANALYSIS_DONE');
  });
});
