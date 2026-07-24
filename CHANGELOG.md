# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `xokf: 导出为 PDF（Export to PDF）` command: renders the current Markdown
  document with a standalone `markdown-it` instance (independent of the
  built-in preview engine, so it also works when exporting via third-party
  PDF tools would otherwise bypass our link/image resolution), inlines
  resolvable `xokf://`/relative images as base64 data URIs, rewrites
  resolvable `xokf://`/relative links to absolute `file://` URIs, and opens
  the result in a webview that triggers the system print dialog for
  "Save as PDF". No external dependency or process is required.

### Fixed

- Markdown preview: `![alt](xokf://<bundleID>/<assetPath>)` image references
  were left unresolved (broken-image icon) because the preview plugin only
  patched markdown-it's `link_open` rule, not its separate `image` rule. Added
  a matching `image` rule that resolves the asset via the same federation
  algorithm and rewrites the `src` to a CSP-safe webview resource URI (via
  `resourceProvider.asWebviewUri`, mirroring what VS Code's own image renderer
  does for scheme-less paths).

## [0.1.0] - 2026-06-18

### Added

- Initial release.
- `DocumentLinkProvider` that resolves `xokf://<bundleID>/<conceptID>` references
  in the Markdown source editor, following the OKF federation resolution
  algorithm (walk up to the nearest `xokf.md`, then resolve `ROOT/P.md` or
  `ROOT/P/index.md`).
- markdown-it plugin that rewrites resolvable `xokf://` links — and ordinary
  relative Markdown/JSON links (`./x.md`, `../y.md#sec`, `./data.json`) — in the
  rendered preview to a `vscode://` deep link, plus a URI handler that opens the
  target in the text editor — placed in the first tab group that is not the
  preview's own group, so the document never opens inside the preview pane.
- `DocumentLinkProvider` for `.json`/`.jsonc` files that makes any relative path
  to an existing file, written as a JSON string value, clickable: Markdown
  targets open the rendered preview (reusing an existing preview tab via
  `markdown.showPreviewToSide` when one is already open beside the JSON editor);
  all other targets open in the text editor's first non-preview tab group.
- Broken-link tolerance: unresolved references are left unlinked rather than
  flagged as errors.
- Path-traversal protection: references cannot resolve outside the federation
  root.
- `xokf.federationAnchor` setting to customize the federation sentinel filename.
