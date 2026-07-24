import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import {
  resolveXokfLink,
  resolveXokfAsset,
  resolveRelativeDocLink,
  SCHEME,
  DEFAULT_FEDERATION_ANCHOR,
  ResolvedLink,
} from './resolver';

/**
 * Minimal shape of the source document this module needs — matches the
 * relevant members of `vscode.TextDocument` without importing the `vscode`
 * module, so this file (and its tests) stay dependency-free.
 */
export interface ExportableDocument {
  getText(): string;
  uri: { fsPath: string };
}

export interface RenderedExport {
  html: string;
  title: string;
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

function hasExplicitScheme(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function toDataUri(fsPath: string): string | undefined {
  const mime = IMAGE_MIME_BY_EXT[path.extname(fsPath).toLowerCase()];
  if (!mime) {
    return undefined;
  }
  try {
    const bytes = fs.readFileSync(fsPath);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return undefined;
  }
}

/** Best-effort file: URI, without pulling in the vscode API. */
function toFileUri(fsPath: string): string {
  const normalized = fsPath.replace(/\\/g, '/');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `file://${encodeURI(withLeadingSlash)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveImageAssetPath(
  fromFsPath: string,
  src: string,
  anchor: string
): string | undefined {
  if (src.startsWith(SCHEME)) {
    return resolveXokfAsset(fromFsPath, src, anchor)?.fsPath;
  }
  if (hasExplicitScheme(src)) {
    return undefined; // http(s):, data:, etc. — leave to the browser.
  }
  const candidate = path.resolve(path.dirname(fromFsPath), src.split('#')[0]);
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : undefined;
}

function resolveDocLink(
  fromFsPath: string,
  href: string,
  anchor: string
): ResolvedLink | undefined {
  if (href.startsWith(SCHEME)) {
    return resolveXokfLink(fromFsPath, href, anchor);
  }
  if (href === '' || href.startsWith('#') || hasExplicitScheme(href)) {
    return undefined;
  }
  return resolveRelativeDocLink(fromFsPath, href, null);
}

/**
 * Render a Markdown document to a standalone, shareable HTML document meant
 * for browser printing ("Save as PDF"):
 *
 *   - `xokf://` and plain relative image references are inlined as base64
 *     data URIs, so the result has no external file dependencies and can be
 *     shared/opened anywhere.
 *   - `xokf://` and plain relative document links are resolved and rewritten
 *     to an absolute `file://` URI (best-effort — only useful when opened on
 *     the originating machine), with the resolved relative path shown as a
 *     tooltip.
 *   - Anything else (http(s) links/images, in-page anchors, unresolved refs)
 *     is left untouched — same "tolerated broken link" behavior as the rest
 *     of the extension.
 */
export function renderDocumentForExport(
  document: ExportableDocument,
  anchor: string = DEFAULT_FEDERATION_ANCHOR
): RenderedExport {
  const fromFsPath = document.uri.fsPath;
  const md: MarkdownIt = new MarkdownIt({ html: true, linkify: true });

  const originalImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src');
    if (typeof src === 'string') {
      const assetPath = resolveImageAssetPath(fromFsPath, src, anchor);
      const dataUri = assetPath ? toDataUri(assetPath) : undefined;
      if (dataUri) {
        token.attrSet('src', dataUri);
      }
    }
    return originalImage
      ? originalImage(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  const originalLinkOpen = md.renderer.rules.link_open;
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href');
    if (typeof href === 'string') {
      const resolved = resolveDocLink(fromFsPath, href, anchor);
      if (resolved) {
        token.attrSet('href', toFileUri(resolved.fsPath));
        const rel =
          path.relative(path.dirname(fromFsPath), resolved.fsPath) ||
          path.basename(resolved.fsPath);
        token.attrSet('title', resolved.fragment ? `${rel}#${resolved.fragment}` : rel);
      }
    }
    return originalLinkOpen
      ? originalLinkOpen(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  const body = md.render(document.getText());
  const title = path.basename(fromFsPath);
  return { html: wrapHtml(title, body), title };
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.65; padding: 2.5rem; max-width: 860px; margin: 0 auto; color: #24292e; }
  img { max-width: 100%; }
  pre { background: #f6f8fa; padding: 1rem; overflow: auto; border-radius: 6px; }
  code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d0d7de; padding: 6px 12px; }
  blockquote { border-left: 4px solid #d0d7de; margin: 0; padding-left: 1rem; color: #57606a; }
  h1, h2, h3 { border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
  a { color: #0969da; }
  .xokf-print-bar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 0.5em; padding: 0.5em 0; background: #fff; }
  .xokf-print-bar button { font-size: 0.95em; padding: 0.4em 1em; cursor: pointer; }
  @media print { .xokf-print-bar { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<div class="xokf-print-bar"><button onclick="window.print()">🖨️ 打印 / 保存为 PDF</button></div>
${body}
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 200));</script>
</body>
</html>`;
}
