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
