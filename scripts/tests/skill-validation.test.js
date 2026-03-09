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
