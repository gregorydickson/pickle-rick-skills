import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const skillDir = path.join(repoRoot, '.agents', 'skills', 'pickle-rick');
const skillPath = path.join(skillDir, 'SKILL.md');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const raw = match[1];
  const result = {};
  let currentKey = null;
  let currentArray = null;
  let currentObject = null;

  for (const line of raw.split('\n')) {
    // Top-level key: value
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kvMatch) {
      if (currentArray && currentKey) result[currentKey] = currentArray;
      currentArray = null;
      currentObject = null;
      const [, key, val] = kvMatch;
      currentKey = key;
      result[key] = val.replace(/^["']|["']$/g, '');
      continue;
    }
    // Top-level key with no inline value (start of array/object)
    const keyOnly = line.match(/^(\w[\w_]*)\s*:\s*$/);
    if (keyOnly) {
      if (currentArray && currentKey) result[currentKey] = currentArray;
      currentKey = keyOnly[1];
      currentArray = [];
      currentObject = null;
      continue;
    }
    // Array item with key-value (start of new object in array)
    const arrObjMatch = line.match(/^\s+-\s+(\w+)\s*:\s*(.+)$/);
    if (arrObjMatch && currentArray) {
      if (currentObject) currentArray.push(currentObject);
      currentObject = {};
      const val = arrObjMatch[2].replace(/^["']|["']$/g, '');
      currentObject[arrObjMatch[1]] = val;
      continue;
    }
    // Array item (scalar)
    const arrMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrMatch && currentArray) {
      currentArray.push(arrMatch[1].replace(/^["']|["']$/g, ''));
      continue;
    }
    // Continuation key in object
    const contMatch = line.match(/^\s+(\w+)\s*:\s*(.+)$/);
    if (contMatch && currentObject) {
      const val = contMatch[2].replace(/^["']|["']$/g, '');
      currentObject[contMatch[1]] = val;
      continue;
    }
  }
  if (currentObject && currentArray) currentArray.push(currentObject);
  if (currentArray && currentKey) result[currentKey] = currentArray;
  return result;
}

describe('pickle-rick SKILL.md validation', () => {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'pickle-rick');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('all files listed in references array exist', () => {
    assert.ok(Array.isArray(frontmatter.references), 'references must be array');
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const fullPath = path.join(skillDir, refPath);
      assert.ok(fs.existsSync(fullPath), `reference file missing: ${refPath}`);
    }
  });

  it('SKILL.md + all references < 8000 tokens', () => {
    let totalWords = content.split(/\s+/).length;
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const refContent = fs.readFileSync(path.join(skillDir, refPath), 'utf-8');
      totalWords += refContent.split(/\s+/).length;
    }
    const estimatedTokens = Math.ceil(totalWords * 1.3);
    assert.ok(estimatedTokens < 8000, `token estimate ${estimatedTokens} exceeds 8000`);
  });

  it('SKILL.md body contains setup.js and mux-runner.js references', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('setup.js'), 'body must reference setup.js');
    assert.ok(body.includes('mux-runner.js'), 'body must reference mux-runner.js');
  });

  it('AGENTS.md at repo root with persona content', () => {
    const agentsPath = path.join(repoRoot, 'AGENTS.md');
    assert.ok(fs.existsSync(agentsPath), 'AGENTS.md must exist at repo root');
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
    assert.ok(agentsContent.includes('Pickle Rick'), 'AGENTS.md must contain "Pickle Rick"');
  });

  it('persona.md listed but marked conditional', () => {
    const personaRef = frontmatter.references.find(
      (r) => (typeof r === 'string' ? r : r.path) === 'references/persona.md'
    );
    assert.ok(personaRef, 'persona.md must be in references');
    assert.ok(typeof personaRef === 'object', 'persona ref must be an object');
    assert.equal(personaRef.conditional, 'true', 'persona.md must be marked conditional');
  });
});

// --- Meeseeks SKILL.md validation ---

const meeseeksDir = path.join(repoRoot, '.agents', 'skills', 'meeseeks');
const meeseeksSkillPath = path.join(meeseeksDir, 'SKILL.md');

describe('meeseeks SKILL.md validation', () => {
  const content = fs.readFileSync(meeseeksSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'meeseeks');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('all files listed in references array exist', () => {
    assert.ok(Array.isArray(frontmatter.references), 'references must be array');
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const fullPath = path.join(meeseeksDir, refPath);
      assert.ok(fs.existsSync(fullPath), `reference file missing: ${refPath}`);
    }
  });

  it('SKILL.md + all references < 8000 tokens', () => {
    let totalWords = content.split(/\s+/).length;
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const refContent = fs.readFileSync(path.join(meeseeksDir, refPath), 'utf-8');
      totalWords += refContent.split(/\s+/).length;
    }
    const estimatedTokens = Math.ceil(totalWords * 1.3);
    assert.ok(estimatedTokens < 8000, `token estimate ${estimatedTokens} exceeds 8000`);
  });

  it('focus-areas.md has 8 categories', () => {
    const focusPath = path.join(meeseeksDir, 'references', 'focus-areas.md');
    const focusContent = fs.readFileSync(focusPath, 'utf-8');
    const headings = focusContent.match(/^## \d+\. .+$/gm);
    assert.ok(headings, 'must have numbered H2 headings');
    assert.equal(headings.length, 8, `expected 8 focus areas, got ${headings.length}`);
  });

  it('all 8 named focus area categories present', () => {
    const focusPath = path.join(meeseeksDir, 'references', 'focus-areas.md');
    const focusContent = fs.readFileSync(focusPath, 'utf-8').toLowerCase();
    const expected = [
      'dependency health',
      'security',
      'correctness',
      'architecture',
      'test coverage',
      'resilience',
      'code quality',
      'polish',
    ];
    for (const name of expected) {
      assert.ok(focusContent.includes(name), `missing focus area: ${name}`);
    }
  });

  it('send-to-morty-review.md contains EXISTENCE_IS_PAIN token', () => {
    const reviewPath = path.join(meeseeksDir, 'references', 'send-to-morty-review.md');
    const reviewContent = fs.readFileSync(reviewPath, 'utf-8');
    assert.ok(reviewContent.includes('EXISTENCE_IS_PAIN'), 'must contain EXISTENCE_IS_PAIN token');
  });

  it('SKILL.md body references setup.js and mux-runner.js', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('setup.js'), 'body must reference setup.js');
    assert.ok(body.includes('mux-runner.js'), 'body must reference mux-runner.js');
  });
});

// --- pickle-prd SKILL.md validation ---

const prdDir = path.join(repoRoot, '.agents', 'skills', 'pickle-prd');
const prdSkillPath = path.join(prdDir, 'SKILL.md');

describe('pickle-prd SKILL.md validation', () => {
  const content = fs.readFileSync(prdSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'pickle-prd');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('triggers include prd', () => {
    assert.ok(frontmatter.triggers.includes('prd'), 'triggers must include prd');
  });

  it('all files listed in references array exist', () => {
    assert.ok(Array.isArray(frontmatter.references), 'references must be array');
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const fullPath = path.join(prdDir, refPath);
      assert.ok(fs.existsSync(fullPath), `reference file missing: ${refPath}`);
    }
  });

  it('SKILL.md + all references < 8000 tokens', () => {
    let totalWords = content.split(/\s+/).length;
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const refContent = fs.readFileSync(path.join(prdDir, refPath), 'utf-8');
      totalWords += refContent.split(/\s+/).length;
    }
    const estimatedTokens = Math.ceil(totalWords * 1.3);
    assert.ok(estimatedTokens < 8000, `token estimate ${estimatedTokens} exceeds 8000`);
  });

  it('SKILL.md body contains prd.md reference', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('prd.md'), 'body must reference prd.md output');
  });
});

// --- pickle-refine-prd SKILL.md validation ---

const refinePrdDir = path.join(repoRoot, '.agents', 'skills', 'pickle-refine-prd');
const refinePrdSkillPath = path.join(refinePrdDir, 'SKILL.md');

describe('pickle-refine-prd SKILL.md validation', () => {
  const content = fs.readFileSync(refinePrdSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'pickle-refine-prd');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('triggers include refine-prd', () => {
    assert.ok(frontmatter.triggers.includes('refine-prd'), 'triggers must include refine-prd');
  });

  it('all files listed in references array exist', () => {
    assert.ok(Array.isArray(frontmatter.references), 'references must be array');
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const fullPath = path.join(refinePrdDir, refPath);
      assert.ok(fs.existsSync(fullPath), `reference file missing: ${refPath}`);
    }
  });

  it('SKILL.md + all references < 8000 tokens', () => {
    let totalWords = content.split(/\s+/).length;
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const refContent = fs.readFileSync(path.join(refinePrdDir, refPath), 'utf-8');
      totalWords += refContent.split(/\s+/).length;
    }
    const estimatedTokens = Math.ceil(totalWords * 1.3);
    assert.ok(estimatedTokens < 8000, `token estimate ${estimatedTokens} exceeds 8000`);
  });

  it('refinement-roles.md has all 3 role descriptions', () => {
    const rolesPath = path.join(refinePrdDir, 'references', 'refinement-roles.md');
    const rolesContent = fs.readFileSync(rolesPath, 'utf-8');
    assert.ok(rolesContent.includes('Requirements Analyst'), 'missing Requirements Analyst');
    assert.ok(rolesContent.includes('Codebase Context Analyst'), 'missing Codebase Context Analyst');
    assert.ok(rolesContent.includes('Risk & Scope Auditor'), 'missing Risk & Scope Auditor');
  });

  it('refinement-roles.md documents cross-reference protocol', () => {
    const rolesPath = path.join(refinePrdDir, 'references', 'refinement-roles.md');
    const rolesContent = fs.readFileSync(rolesPath, 'utf-8');
    assert.ok(rolesContent.includes('(YOUR OWN — improve on this)'), 'missing cross-ref marking');
    assert.ok(rolesContent.includes('Cross-Reference Protocol'), 'missing cross-ref protocol section');
  });

  it('SKILL.md body references spawn-refinement-team.js', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('spawn-refinement-team.js'), 'body must reference spawn-refinement-team.js');
  });
});

// --- Portal-Gun SKILL.md validation ---

const portalGunDir = path.join(repoRoot, '.agents', 'skills', 'portal-gun');
const portalGunSkillPath = path.join(portalGunDir, 'SKILL.md');

describe('portal-gun SKILL.md validation', () => {
  const content = fs.readFileSync(portalGunSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'portal-gun');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('all files listed in references array exist', () => {
    assert.ok(Array.isArray(frontmatter.references), 'references must be array');
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const fullPath = path.join(portalGunDir, refPath);
      assert.ok(fs.existsSync(fullPath), `reference file missing: ${refPath}`);
    }
  });

  it('pattern-analysis-template.md exists', () => {
    const templatePath = path.join(portalGunDir, 'references', 'pattern-analysis-template.md');
    assert.ok(fs.existsSync(templatePath), 'pattern-analysis-template.md must exist');
  });

  it('target-analysis-template.md exists', () => {
    const templatePath = path.join(portalGunDir, 'references', 'target-analysis-template.md');
    assert.ok(fs.existsSync(templatePath), 'target-analysis-template.md must exist');
  });

  it('SKILL.md + all references < 8000 tokens', () => {
    let totalWords = content.split(/\s+/).length;
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const refContent = fs.readFileSync(path.join(portalGunDir, refPath), 'utf-8');
      totalWords += refContent.split(/\s+/).length;
    }
    const estimatedTokens = Math.ceil(totalWords * 1.3);
    assert.ok(estimatedTokens < 8000, `token estimate ${estimatedTokens} exceeds 8000`);
  });

  it('SKILL.md body references setup.js and mux-runner.js', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('setup.js'), 'body must reference setup.js');
    assert.ok(body.includes('mux-runner.js'), 'body must reference mux-runner.js');
  });

  it('SKILL.md documents pattern extraction not code copying', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('PATTERN'), 'body must mention PATTERN extraction');
    assert.ok(body.includes('never copies implementation code') || body.includes('not code'), 'body must clarify no code copying');
  });
});

// --- Council-of-Ricks SKILL.md validation ---

const councilDir = path.join(repoRoot, '.agents', 'skills', 'council-of-ricks');
const councilSkillPath = path.join(councilDir, 'SKILL.md');

describe('council-of-ricks SKILL.md validation', () => {
  const content = fs.readFileSync(councilSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'council-of-ricks');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('all files listed in references array exist', () => {
    assert.ok(Array.isArray(frontmatter.references), 'references must be array');
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const fullPath = path.join(councilDir, refPath);
      assert.ok(fs.existsSync(fullPath), `reference file missing: ${refPath}`);
    }
  });

  it('directive-template.md exists', () => {
    const templatePath = path.join(councilDir, 'references', 'directive-template.md');
    assert.ok(fs.existsSync(templatePath), 'directive-template.md must exist');
  });

  it('SKILL.md + all references < 8000 tokens', () => {
    let totalWords = content.split(/\s+/).length;
    for (const ref of frontmatter.references) {
      const refPath = typeof ref === 'string' ? ref : ref.path;
      const refContent = fs.readFileSync(path.join(councilDir, refPath), 'utf-8');
      totalWords += refContent.split(/\s+/).length;
    }
    const estimatedTokens = Math.ceil(totalWords * 1.3);
    assert.ok(estimatedTokens < 8000, `token estimate ${estimatedTokens} exceeds 8000`);
  });

  it('SKILL.md body contains THE_CITADEL_APPROVES', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('THE_CITADEL_APPROVES'), 'body must contain THE_CITADEL_APPROVES promise token');
  });

  it('SKILL.md body references setup.js and mux-runner.js', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('setup.js'), 'body must reference setup.js');
    assert.ok(body.includes('mux-runner.js'), 'body must reference mux-runner.js');
  });

  it('directive-template.md has per-branch structure', () => {
    const templatePath = path.join(councilDir, 'references', 'directive-template.md');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    assert.ok(templateContent.includes('Branch'), 'template must contain Branch heading');
    assert.ok(templateContent.includes('Findings') || templateContent.includes('Finding'), 'template must contain findings section');
    assert.ok(templateContent.includes('Fix') || templateContent.includes('fix'), 'template must contain fix instructions');
  });
});

// --- pickle-jar SKILL.md validation ---

const jarDir = path.join(repoRoot, '.agents', 'skills', 'pickle-jar');
const jarSkillPath = path.join(jarDir, 'SKILL.md');

describe('pickle-jar SKILL.md validation', () => {
  const content = fs.readFileSync(jarSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'pickle-jar');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('triggers include jar and batch', () => {
    assert.ok(frontmatter.triggers.includes('jar'), 'triggers must include jar');
    assert.ok(frontmatter.triggers.includes('batch'), 'triggers must include batch');
  });

  it('SKILL.md body references jar-runner.js and add-to-pickle-jar.js', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('jar-runner.js'), 'body must reference jar-runner.js');
    assert.ok(body.includes('add-to-pickle-jar.js'), 'body must reference add-to-pickle-jar.js');
  });

  it('SKILL.md documents SHA-256 integrity', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('SHA-256'), 'body must document SHA-256 integrity');
  });

  it('SKILL.md documents manager_max_turns (50)', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('manager_max_turns'), 'body must reference manager_max_turns');
    assert.ok(body.includes('50'), 'body must specify 50');
  });

  it('SKILL.md documents JARRED completion promise', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('JARRED'), 'body must document JARRED promise');
  });
});

// --- pickle-metrics SKILL.md validation ---

const metricsDir = path.join(repoRoot, '.agents', 'skills', 'pickle-metrics');
const metricsSkillPath = path.join(metricsDir, 'SKILL.md');

describe('pickle-metrics SKILL.md validation', () => {
  const content = fs.readFileSync(metricsSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'pickle-metrics');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('triggers include metrics', () => {
    assert.ok(frontmatter.triggers.includes('metrics'), 'triggers must include metrics');
  });

  it('SKILL.md body references metrics.js', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('metrics.js'), 'body must reference metrics.js');
  });

  it('SKILL.md body documents --days and --json flags', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('--days'), 'body must document --days flag');
    assert.ok(body.includes('--json'), 'body must document --json flag');
  });
});

// --- pickle-standup SKILL.md validation ---

const standupDir = path.join(repoRoot, '.agents', 'skills', 'pickle-standup');
const standupSkillPath = path.join(standupDir, 'SKILL.md');

describe('pickle-standup SKILL.md validation', () => {
  const content = fs.readFileSync(standupSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'pickle-standup');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('triggers include standup', () => {
    assert.ok(frontmatter.triggers.includes('standup'), 'triggers must include standup');
  });

  it('SKILL.md body references standup.js', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('standup.js'), 'body must reference standup.js');
  });

  it('SKILL.md body documents --since flag', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('--since'), 'body must document --since flag');
  });
});

// --- project-mayhem SKILL.md validation ---

const mayhemDir = path.join(repoRoot, '.agents', 'skills', 'project-mayhem');
const mayhemSkillPath = path.join(mayhemDir, 'SKILL.md');

describe('project-mayhem SKILL.md validation', () => {
  const content = fs.readFileSync(mayhemSkillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  it('YAML frontmatter has required fields', () => {
    assert.ok(frontmatter, 'frontmatter must parse');
    assert.equal(frontmatter.name, 'project-mayhem');
    assert.ok(frontmatter.description, 'description required');
    assert.ok(frontmatter.version, 'version required');
    assert.ok(Array.isArray(frontmatter.triggers), 'triggers must be array');
    assert.ok(frontmatter.triggers.length > 0, 'triggers must not be empty');
  });

  it('triggers include chaos and mutation', () => {
    assert.ok(frontmatter.triggers.includes('chaos'), 'triggers must include chaos');
    assert.ok(frontmatter.triggers.includes('mutation'), 'triggers must include mutation');
  });

  it('SKILL.md body documents git checkout revert', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('git checkout'), 'body must document git checkout for reverting');
  });

  it('SKILL.md body documents mutation testing, dependency downgrades, config corruption', () => {
    const body = content.replace(/^---[\s\S]*?---/, '').toLowerCase();
    assert.ok(body.includes('mutation'), 'body must mention mutation testing');
    assert.ok(body.includes('dependency'), 'body must mention dependency downgrades');
    assert.ok(body.includes('config'), 'body must mention config corruption');
  });

  it('SKILL.md body documents report generation', () => {
    const body = content.replace(/^---[\s\S]*?---/, '');
    assert.ok(body.includes('report') || body.includes('Report'), 'body must document report generation');
  });
});
