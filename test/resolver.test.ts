import { test, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  resolveXokfLink,
  resolveRelativeDocLink,
  findFederationRoot,
  PREVIEW_REDIRECT_EXT,
  isMarkdownPath,
} from '../src/resolver';

let root: string;
let from: string;

function touch(p: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '');
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'xokf-'));
  touch(path.join(root, 'xokf.md'));
  touch(path.join(root, 'crypto', 'index.md'));
  touch(path.join(root, 'eng', 'blockchain', 'index.md'));
  touch(path.join(root, 'eng', 'blockchain', 'concepts', 'consensus.md'));
  touch(path.join(root, 'eng', 'blockchain', 'concepts', 'with space.md'));
  from = path.join(root, 'eng', 'blockchain', 'concepts', 'consensus.md');
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('resolves a concept file', () => {
  const r = resolveXokfLink(from, 'xokf://eng/blockchain/concepts/consensus');
  assert.equal(r?.fsPath, path.join(root, 'eng/blockchain/concepts/consensus.md'));
});

test('resolves a concept literally named index', () => {
  const r = resolveXokfLink(from, 'xokf://crypto/index');
  assert.equal(r?.fsPath, path.join(root, 'crypto/index.md'));
});

test('resolves a bundle directory to its index.md', () => {
  const r = resolveXokfLink(from, 'xokf://eng/blockchain');
  assert.equal(r?.fsPath, path.join(root, 'eng/blockchain/index.md'));
});

test('captures a heading fragment', () => {
  const r = resolveXokfLink(from, 'xokf://eng/blockchain/concepts/consensus#proof-of-stake');
  assert.equal(r?.fragment, 'proof-of-stake');
});

test('decodes percent-encoded paths', () => {
  const r = resolveXokfLink(from, 'xokf://eng/blockchain/concepts/with%20space');
  assert.equal(r?.fsPath, path.join(root, 'eng/blockchain/concepts/with space.md'));
});

test('missing target is a tolerated broken link (undefined)', () => {
  assert.equal(resolveXokfLink(from, 'xokf://eng/blockchain/concepts/missing'), undefined);
});

test('path traversal outside the federation root is blocked', () => {
  assert.equal(resolveXokfLink(from, 'xokf://../../../../etc/passwd'), undefined);
});

test('non-xokf scheme is ignored', () => {
  assert.equal(resolveXokfLink(from, 'http://example.com'), undefined);
});

test('returns undefined when no federation root exists', () => {
  const orphan = fs.mkdtempSync(path.join(os.tmpdir(), 'xokf-orphan-'));
  try {
    const f = path.join(orphan, 'note.md');
    touch(f);
    assert.equal(resolveXokfLink(f, 'xokf://anything'), undefined);
    assert.equal(findFederationRoot(orphan), undefined);
  } finally {
    fs.rmSync(orphan, { recursive: true, force: true });
  }
});

test('relative link resolves a sibling markdown file', () => {
  const r = resolveRelativeDocLink(from, './with%20space.md');
  assert.equal(r?.fsPath, path.join(root, 'eng/blockchain/concepts/with space.md'));
});

test('relative link resolves up the tree with a fragment', () => {
  const r = resolveRelativeDocLink(from, '../index.md#intro');
  assert.equal(r?.fsPath, path.join(root, 'eng/blockchain/index.md'));
  assert.equal(r?.fragment, 'intro');
});

test('relative link to a missing file is undefined', () => {
  assert.equal(resolveRelativeDocLink(from, './missing.md'), undefined);
});

test('relative link to a non-markdown file is undefined', () => {
  touch(path.join(root, 'eng', 'blockchain', 'concepts', 'diagram.png'));
  assert.equal(resolveRelativeDocLink(from, './diagram.png'), undefined);
});

test('relative link to JSON is undefined by default (markdown-only)', () => {
  touch(path.join(root, 'eng', 'blockchain', 'concepts', 'data.json'));
  assert.equal(resolveRelativeDocLink(from, './data.json'), undefined);
});

test('relative link to JSON resolves under PREVIEW_REDIRECT_EXT', () => {
  const r = resolveRelativeDocLink(from, './data.json', PREVIEW_REDIRECT_EXT);
  assert.equal(r?.fsPath, path.join(root, 'eng/blockchain/concepts/data.json'));
});

test('PREVIEW_REDIRECT_EXT still excludes images', () => {
  assert.equal(resolveRelativeDocLink(from, './diagram.png', PREVIEW_REDIRECT_EXT), undefined);
});

test('null extPattern resolves any existing file', () => {
  const r = resolveRelativeDocLink(from, './diagram.png', null);
  assert.equal(r?.fsPath, path.join(root, 'eng/blockchain/concepts/diagram.png'));
});

test('null extPattern still requires the file to exist', () => {
  assert.equal(resolveRelativeDocLink(from, './missing.png', null), undefined);
});

test('isMarkdownPath detects .md and .markdown, case-insensitively', () => {
  assert.equal(isMarkdownPath('/a/b.md'), true);
  assert.equal(isMarkdownPath('/a/b.MARKDOWN'), true);
  assert.equal(isMarkdownPath('/a/b.json'), false);
});

test('custom federation anchor is honored', () => {
  const alt = fs.mkdtempSync(path.join(os.tmpdir(), 'xokf-alt-'));
  try {
    touch(path.join(alt, 'root.marker'));
    touch(path.join(alt, 'a', 'b.md'));
    const f = path.join(alt, 'a', 'b.md');
    assert.equal(resolveXokfLink(f, 'xokf://a/b', 'root.marker')?.fsPath, path.join(alt, 'a/b.md'));
    // default anchor would not find a root here
    assert.equal(resolveXokfLink(f, 'xokf://a/b'), undefined);
  } finally {
    fs.rmSync(alt, { recursive: true, force: true });
  }
});
