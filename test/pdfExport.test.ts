import { test, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { renderDocumentForExport, ExportableDocument } from '../src/pdfExport';

function touch(p: string, content = ''): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// A 1x1 transparent PNG, so the exported HTML has real bytes to base64-encode.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

let root: string;
let fromFsPath: string;

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'xokf-pdf-'));
  touch(path.join(root, 'xokf.md'));
  touch(path.join(root, 'eng', 'blockchain', 'index.md'), '# Index');
  touch(path.join(root, 'eng', 'blockchain', 'concepts', 'consensus.md'), '# Consensus');
  fs.mkdirSync(path.join(root, 'eng', 'blockchain', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'eng', 'blockchain', 'assets', 'diagram.png'), PNG_BYTES);
  touch(path.join(root, 'eng', 'blockchain', 'local.png'), 'not-a-real-png-but-exists');
  fromFsPath = path.join(root, 'eng', 'blockchain', 'article.md');
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function makeDoc(text: string): ExportableDocument {
  return {
    getText: () => text,
    uri: { fsPath: fromFsPath },
  };
}

test('inlines a resolvable xokf:// image as a base64 data URI', () => {
  const { html } = renderDocumentForExport(makeDoc('![diagram](xokf://eng/blockchain/assets/diagram.png)'));
  assert.match(html, /<img src="data:image\/png;base64,[A-Za-z0-9+/=]+"/);
  assert.doesNotMatch(html, /xokf:\/\//);
});

test('inlines a plain relative image as a base64 data URI', () => {
  const { html } = renderDocumentForExport(makeDoc('![x](./local.png)'));
  assert.match(html, /<img src="data:image\/png;base64,/);
});

test('leaves an unresolved xokf:// image src untouched', () => {
  const { html } = renderDocumentForExport(makeDoc('![missing](xokf://eng/blockchain/assets/missing.png)'));
  assert.match(html, /<img src="xokf:\/\/eng\/blockchain\/assets\/missing\.png"/);
});

test('leaves an http(s) image src untouched', () => {
  const { html } = renderDocumentForExport(makeDoc('![x](https://example.com/x.png)'));
  assert.match(html, /<img src="https:\/\/example\.com\/x\.png"/);
});

test('rewrites a resolvable xokf:// link to an absolute file:// URI', () => {
  const { html } = renderDocumentForExport(
    makeDoc('[consensus](xokf://eng/blockchain/concepts/consensus)')
  );
  const expected = path.join(root, 'eng/blockchain/concepts/consensus.md');
  assert.match(html, new RegExp(`href="file://${expected.replace(/\//g, '\\/')}"`));
});

test('rewrites a plain relative markdown link to an absolute file:// URI', () => {
  const { html } = renderDocumentForExport(makeDoc('[idx](./index.md)'));
  const expected = path.join(root, 'eng/blockchain/index.md');
  assert.match(html, new RegExp(`href="file://${expected.replace(/\//g, '\\/')}"`));
});

test('leaves an unresolved xokf:// link untouched', () => {
  const { html } = renderDocumentForExport(makeDoc('[x](xokf://eng/blockchain/missing)'));
  assert.match(html, /href="xokf:\/\/eng\/blockchain\/missing"/);
});

test('leaves an http(s) link untouched', () => {
  const { html } = renderDocumentForExport(makeDoc('[x](https://example.com)'));
  assert.match(html, /href="https:\/\/example\.com"/);
});

test('wraps output in a standalone HTML document with a print trigger', () => {
  const { html, title } = renderDocumentForExport(makeDoc('# Hello'));
  assert.equal(title, 'article.md');
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /<h1>Hello<\/h1>/);
});

test('escapes the title in the generated <title> tag', () => {
  const evilPath = path.join(root, 'eng', 'blockchain', '<script>.md');
  const doc: ExportableDocument = {
    getText: () => '# x',
    uri: { fsPath: evilPath },
  };
  const { html } = renderDocumentForExport(doc);
  assert.match(html, /<title>&lt;script&gt;\.md<\/title>/);
});
