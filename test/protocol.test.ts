import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildOpenUri, parseOpenQuery } from '../src/protocol';

test('builds a vscode deep link with the expected shape', () => {
  const uri = buildOpenUri('vscode', 'LeafAI.xokf', {
    path: '/Users/me/kb/eng/index.md',
  });
  assert.match(uri, /^vscode:\/\/LeafAI\.xokf\/open\?data=[A-Za-z0-9_-]+$/);
});

test('round-trips a path with no fragment', () => {
  const payload = { path: '/Users/me/kb/eng/blockchain/consensus.md' };
  const uri = buildOpenUri('vscode', 'LeafAI.xokf', payload);
  const query = uri.slice(uri.indexOf('?') + 1);
  assert.deepEqual(parseOpenQuery(query), { path: payload.path, fragment: undefined });
});

test('round-trips a path with a fragment', () => {
  const payload = { path: '/Users/me/kb/eng/consensus.md', fragment: 'proof-of-stake' };
  const uri = buildOpenUri('vscode-insiders', 'LeafAI.xokf', payload);
  const query = uri.slice(uri.indexOf('?') + 1);
  assert.deepEqual(parseOpenQuery(query), payload);
});

test('round-trips paths with spaces and non-ASCII characters', () => {
  const payload = { path: '/Users/me/kb/中文 目录/概念 a.md', fragment: '小节 一' };
  const uri = buildOpenUri('vscode', 'LeafAI.xokf', payload);
  const query = uri.slice(uri.indexOf('?') + 1);
  assert.deepEqual(parseOpenQuery(query), payload);
});

test('tolerates extra query parameters around data', () => {
  const payload = { path: '/Users/me/kb/x.md' };
  const uri = buildOpenUri('vscode', 'LeafAI.xokf', payload);
  const data = uri.slice(uri.indexOf('data=') + 'data='.length);
  assert.deepEqual(parseOpenQuery(`foo=1&data=${data}&bar=2`), {
    path: payload.path,
    fragment: undefined,
  });
});

test('returns undefined when data is missing', () => {
  assert.equal(parseOpenQuery('foo=1&bar=2'), undefined);
});

test('returns undefined when data is garbled', () => {
  assert.equal(parseOpenQuery('data=not-valid-base64-json!!!'), undefined);
});
