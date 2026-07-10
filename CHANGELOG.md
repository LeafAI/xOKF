# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
