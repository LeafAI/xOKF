import { test, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Module from 'node:module';

// The extension imports `vscode`, which only exists inside a running VS Code
// host. Stub just enough of the API surface `markdownPreview.ts` touches so
// it can be exercised under plain node:test.
const vscodeStub = {
  Uri: {
    file(fsPath: string) {
      return {
        scheme: 'file',
        fsPath,
        toString: () => `file://${fsPath}`,
      };
    },
  },
  workspace: {
    getConfiguration() {
      return { get: (_key: string, def: unknown) => def };
    },
  },
};

type ModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;

const originalLoad = (Module as unknown as { _load: ModuleLoad })._load;
(Module as unknown as { _load: ModuleLoad })._load = (request, parent, isMain) => {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad(request, parent, isMain);
};

/* eslint-disable @typescript-eslint/no-require-imports */
const { makeExtendMarkdownIt } = require('../src/markdownPreview');
/* eslint-enable @typescript-eslint/no-require-imports */

function touch(p: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '');
}

let root: string;
let fromFsPath: string;

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'xokf-preview-'));
  touch(path.join(root, 'xokf.md'));
  touch(path.join(root, 'eng', 'blockchain', 'index.md'));
  touch(path.join(root, 'eng', 'blockchain', 'assets', 'diagram.png'));
  fromFsPath = path.join(root, 'eng', 'blockchain', 'index.md');
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
  (Module as unknown as { _load: ModuleLoad })._load = originalLoad;
});

interface FakeToken {
  attrs: Record<string, string>;
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
}

function makeToken(src: string): FakeToken {
  return {
    attrs: { src },
    attrGet(name) {
      return name in this.attrs ? this.attrs[name] : null;
    },
    attrSet(name, value) {
      this.attrs[name] = value;
    },
  };
}

const fakeSelf = {
  renderToken: () => '<fallback/>',
};

type ImageRule = (
  tokens: FakeToken[],
  idx: number,
  options: unknown,
  env: unknown,
  self: typeof fakeSelf
) => string;

function makeMd(): { renderer: { rules: { image?: ImageRule } } } {
  return { renderer: { rules: {} } };
}

test('resolvable xokf:// image src is rewritten to the resolved file URI', () => {
  const md = makeMd();
  makeExtendMarkdownIt({
    uriScheme: 'vscode',
    extensionId: 'LeafAI.xokf',
    getAnchor: () => 'xokf.md',
  })(md as never);

  const token = makeToken('xokf://eng/blockchain/assets/diagram.png');
  const env = { currentDocument: vscodeStub.Uri.file(fromFsPath) };

  md.renderer.rules.image?.([token], 0, {}, env, fakeSelf);

  assert.equal(token.attrGet('src'), `file://${path.join(root, 'eng/blockchain/assets/diagram.png')}`);
  assert.equal(token.attrGet('data-src'), 'xokf://eng/blockchain/assets/diagram.png');
});

test('xokf:// image src is converted via resourceProvider.asWebviewUri when available', () => {
  const md = makeMd();
  makeExtendMarkdownIt({
    uriScheme: 'vscode',
    extensionId: 'LeafAI.xokf',
    getAnchor: () => 'xokf.md',
  })(md as never);

  const token = makeToken('xokf://eng/blockchain/assets/diagram.png');
  const resourceProvider = {
    asWebviewUri: (uri: { fsPath: string }) => ({
      toString: () => `https://file+.vscode-resource/${uri.fsPath}`,
    }),
  };
  const env = {
    currentDocument: vscodeStub.Uri.file(fromFsPath),
    resourceProvider,
  };

  md.renderer.rules.image?.([token], 0, {}, env, fakeSelf);

  assert.equal(
    token.attrGet('src'),
    `https://file+.vscode-resource/${path.join(root, 'eng/blockchain/assets/diagram.png')}`
  );
});

test('unresolved xokf:// image src is left untouched', () => {
  const md = makeMd();
  makeExtendMarkdownIt({
    uriScheme: 'vscode',
    extensionId: 'LeafAI.xokf',
    getAnchor: () => 'xokf.md',
  })(md as never);

  const token = makeToken('xokf://eng/blockchain/assets/missing.png');
  const env = { currentDocument: vscodeStub.Uri.file(fromFsPath) };

  md.renderer.rules.image?.([token], 0, {}, env, fakeSelf);

  assert.equal(token.attrGet('src'), 'xokf://eng/blockchain/assets/missing.png');
  assert.equal(token.attrGet('data-src'), null);
});

test('non-xokf image src is passed through untouched', () => {
  const md = makeMd();
  makeExtendMarkdownIt({
    uriScheme: 'vscode',
    extensionId: 'LeafAI.xokf',
    getAnchor: () => 'xokf.md',
  })(md as never);

  const token = makeToken('./local.png');
  const env = { currentDocument: vscodeStub.Uri.file(fromFsPath) };

  md.renderer.rules.image?.([token], 0, {}, env, fakeSelf);

  assert.equal(token.attrGet('src'), './local.png');
});

