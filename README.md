# xokf

A VS Code extension that makes cross-bundle [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog) references using the `xokf://` scheme clickable in Markdown.

OKF (Open Knowledge Format) bundles are directory trees of Markdown files. The `xokf://<bundleID>/<conceptID>` scheme is a local-first extension on top of OKF v0.1 for addressing Concepts **across** federated bundles. VS Code's built-in Markdown support does not understand this scheme, so such links are inert. This extension resolves them and lets you Cmd/Ctrl+click to jump straight to the target file.

## How it works

The extension works in two places:

- **Source editor** — a `DocumentLinkProvider` makes every `xokf://...` token Cmd/Ctrl+clickable, jumping straight to the target file.
- **Rendered preview** — a markdown-it plugin rewrites each resolvable `xokf://...` link, at render time, into a `vscode://` deep link that routes back to the extension. Clicking it opens the target `.md` in the text editor — placed in the first tab group that is **not** the Markdown preview's own group, so the document never lands inside the preview pane.

Both paths run the same OKF federation resolution algorithm:

1. Walk up from the referring file to the nearest ancestor directory containing the federation anchor (`xokf.md`) — call it `ROOT`.
2. Strip the `xokf://` prefix; the whole remainder is treated as a path `P` (it is **not** split into URL host/path — `//` here is not an authority).
3. Resolve the target as `ROOT/P.md`. If `P` is a directory (a bundle root), resolve to `ROOT/P/index.md`.
4. A missing target is a tolerated broken link (per OKF rule 5) and is simply left unlinked.

Resolved references become clickable links pointing at the real file on disk.

### Example

Given a federation root marked by `~/knowledge/xokf.md`:

```
~/knowledge/
├── xokf.md
├── formal-sciences/cryptography/index.md
└── engineering-technology/.../blockchain/concepts/consensus.md
```

A link written as:

```markdown
See [consensus](xokf://engineering-technology/information-computing/distributed-systems/blockchain/concepts/consensus)
and [cryptography](xokf://formal-sciences/cryptography/index).
```

becomes Cmd/Ctrl+clickable and opens the corresponding `.md` files.

## Opening preview links in the text editor

Clicking an `xokf://` link **in the preview** opens the target in the text editor automatically — no settings required. The editor is placed in the first tab group that is not the preview's own group, so a single click keeps the preview where it is and shows the target document beside it.

The same treatment is applied to ordinary relative Markdown links (e.g. `[x](./other.md)`, `[y](../notes/z.md#sec)`): clicking one in the preview opens the target `.md` in the text editor's first non-preview group, rather than navigating inside the preview pane. Non-Markdown links (images, external `http(s)` links, in-page `#anchor`s) keep their native preview behavior.

> Why a deep link? VS Code's preview webview hard-codes an allowlist of pass-through link schemes and drops `command:`/custom-scheme links, and the native `markdown.preview.openMarkdownLinks` setting cannot target a specific (non-preview) editor group (see [vscode#246316](https://github.com/microsoft/vscode/issues/246316), [vscode#303561](https://github.com/microsoft/vscode/issues/303561)). The `vscode:` scheme *is* in the pass-through allowlist, so rewriting to a `vscode://` deep link that routes to the extension's URI handler is the reliable way to control exactly where the target opens.

## Scope and limitations

- Resolution is filesystem-based, so it only applies to files saved on disk (`file://` documents).
- Path traversal outside the federation root is blocked.
- Unresolvable references are left untouched (inert) rather than flagged as errors.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `xokf.federationAnchor` | `xokf.md` | Sentinel filename marking the federation root. Resolution walks up to the nearest folder containing this file. |

## Development

```bash
npm install
npm run compile      # one-shot build
npm run watch        # rebuild on change
```

Press `F5` in VS Code to launch an Extension Development Host, then open any `.md` file located beneath an `xokf.md` federation root.

## License

[MIT](./LICENSE)
