import * as fs from 'fs';
import * as path from 'path';

export const SCHEME = 'xokf://';
export const DEFAULT_FEDERATION_ANCHOR = 'xokf.md';

export interface ResolvedLink {
  /** Absolute filesystem path of the target Markdown file. */
  fsPath: string;
  /** Optional heading fragment (without the leading '#'), if the link carried one. */
  fragment?: string;
}

/**
 * Walk up from `startDir` to the nearest ancestor directory containing the
 * federation anchor (default `xokf.md`). Returns undefined if none is found.
 */
export function findFederationRoot(
  startDir: string,
  anchor: string = DEFAULT_FEDERATION_ANCHOR
): string | undefined {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, anchor))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

function isWithin(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

interface XokfBase {
  root: string;
  base: string;
  fragment?: string;
}

/**
 * Shared first half of xokf:// resolution: find the federation root, strip
 * the scheme, decode the path, and join it under the root — with the
 * traversal guard applied. Returns undefined for anything that can't even
 * get this far (no scheme, no federation root, empty path, or escapes root).
 */
function resolveXokfBase(
  fromFsPath: string,
  href: string,
  anchor: string
): XokfBase | undefined {
  if (!href.startsWith(SCHEME)) {
    return undefined;
  }

  const root = findFederationRoot(path.dirname(fromFsPath), anchor);
  if (!root) {
    return undefined;
  }

  // Take the whole remainder as a path. Separate an optional heading fragment.
  let p = href.slice(SCHEME.length);
  let fragment: string | undefined;
  const hashIdx = p.indexOf('#');
  if (hashIdx >= 0) {
    fragment = decodeURIComponent(p.slice(hashIdx + 1)) || undefined;
    p = p.slice(0, hashIdx);
  }
  p = decodeURIComponent(p).replace(/\/+$/, '');
  if (p === '') {
    return undefined;
  }

  const base = path.normalize(path.join(root, p));
  // Safety: never resolve outside the federation root.
  if (!isWithin(root, base)) {
    return undefined;
  }

  return { root, base, fragment };
}

/**
 * Resolve an `xokf://<bundleID>/<conceptID>` reference to a concrete Markdown
 * file, per the OKF federation resolution algorithm:
 *
 *   1. From the referring file, walk up to the nearest dir containing `xokf.md`
 *      → ROOT. (None → unresolved; caller tolerates the broken link.)
 *   2. Strip the `xokf://` prefix → path P (the whole remainder is a path; do
 *      NOT split on URL host/path — `//` does not denote an authority here).
 *   3. Target = ROOT/P.md; if P is a directory (a bundle root), target =
 *      ROOT/P/index.md.
 *   4. Missing target → undefined (tolerated broken link, OKF rule 5).
 */
export function resolveXokfLink(
  fromFsPath: string,
  href: string,
  anchor: string = DEFAULT_FEDERATION_ANCHOR
): ResolvedLink | undefined {
  const resolved = resolveXokfBase(fromFsPath, href, anchor);
  if (!resolved) {
    return undefined;
  }
  const { base, fragment } = resolved;

  // Concept file: ROOT/P.md
  const asFile = base + '.md';
  if (fs.existsSync(asFile) && fs.statSync(asFile).isFile()) {
    return { fsPath: asFile, fragment };
  }

  // Bundle root directory: ROOT/P/index.md
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    const idx = path.join(base, 'index.md');
    if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
      return { fsPath: idx, fragment };
    }
  }

  // Tolerated broken link.
  return undefined;
}

/**
 * Resolve an `xokf://<bundleID>/<assetPath>` reference to an existing
 * non-Markdown asset (image, etc.), per the same federation root and path
 * rules as `resolveXokfLink`, except the target is taken as-is — no `.md` /
 * `index.md` fallback — since assets keep their own extension.
 */
export function resolveXokfAsset(
  fromFsPath: string,
  href: string,
  anchor: string = DEFAULT_FEDERATION_ANCHOR
): ResolvedLink | undefined {
  const resolved = resolveXokfBase(fromFsPath, href, anchor);
  if (!resolved) {
    return undefined;
  }
  const { base, fragment } = resolved;

  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return { fsPath: base, fragment };
  }

  // Tolerated broken link.
  return undefined;
}

const MARKDOWN_EXT = /\.(md|markdown)$/i;

/** Whether `fsPath` is a Markdown file, per its extension. */
export function isMarkdownPath(fsPath: string): boolean {
  return MARKDOWN_EXT.test(fsPath);
}

/**
 * Extensions the Markdown preview should redirect to the text editor instead
 * of letting VS Code's default (same-group) resource-link handling apply.
 * Markdown itself plus JSON, since JSON side-files are common OKF companions.
 */
export const PREVIEW_REDIRECT_EXT = /\.(md|markdown|json|jsonc)$/i;

/**
 * Resolve an ordinary, scheme-less relative link (e.g. `./other.md`,
 * `../notes/x.md#sec`) against the referring file. Returns a target only when
 * it resolves to an existing file whose extension matches `extPattern`
 * (Markdown-only by default; pass `null` to accept any existing file), so
 * unmatched links and broken links fall back to the caller's default handling.
 */
export function resolveRelativeDocLink(
  fromFsPath: string,
  href: string,
  extPattern: RegExp | null = MARKDOWN_EXT
): ResolvedLink | undefined {
  let p = href;
  let fragment: string | undefined;
  const hashIdx = p.indexOf('#');
  if (hashIdx >= 0) {
    fragment = decodeURIComponent(p.slice(hashIdx + 1)) || undefined;
    p = p.slice(0, hashIdx);
  }
  if (p === '') {
    return undefined;
  }
  p = decodeURIComponent(p);
  if (extPattern && !extPattern.test(p)) {
    return undefined;
  }

  const abs = path.resolve(path.dirname(fromFsPath), p);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    return { fsPath: abs, fragment };
  }
  return undefined;
}
