import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PromiseTokens, hasToken, wrapToken } from '../bin/types/index.js';

describe('PromiseTokens', () => {
  it('has exactly 8 entries', () => {
    assert.equal(Object.keys(PromiseTokens).length, 8);
  });
});

describe('hasToken', () => {
  it('detects token in promise tags', () => {
    assert.equal(hasToken('<promise>EPIC_COMPLETED</promise>', 'EPIC_COMPLETED'), true);
  });

  it('tolerates whitespace around token', () => {
    assert.equal(hasToken('<promise>  EPIC_COMPLETED  </promise>', 'EPIC_COMPLETED'), true);
  });

  it('returns false when token absent', () => {
    assert.equal(hasToken('no token here', 'EPIC_COMPLETED'), false);
  });
});

describe('wrapToken', () => {
  it('wraps token in promise tags', () => {
    assert.equal(wrapToken('EPIC_COMPLETED'), '<promise>EPIC_COMPLETED</promise>');
  });
});
