import * as vscode from 'vscode';
import {
  resolveXokfLink,
  resolveXokfAsset,
  resolveRelativeDocLink,
  SCHEME,
  DEFAULT_FEDERATION_ANCHOR,
  PREVIEW_REDIRECT_EXT,
} from './resolver';
import { buildOpenUri } from './protocol';

/** A scheme-less, non-anchor link we should resolve as a local document link. */
function isRelativeDocLink(href: string): boolean {
  if (href === '' || href.startsWith('#')) {
    return false; // in-page anchor or empty
  }
  if (href.startsWith('//')) {
    return false; // protocol-relative
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return false; // has an explicit scheme (http, mailto, vscode, file, ...)
  }
  if (href.startsWith('/')) {
    return false; // root-relative; let VS Code resolve against the workspace
  }
  return true;
}

// Minimal shapes for the markdown-it pieces we touch, to avoid a dependency on
// markdown-it's own typings inside the extension.
interface ResourceProvider {
  asWebviewUri(resource: vscode.Uri): vscode.Uri;
}

interface RenderEnv {
  currentDocument?: vscode.Uri;
  resourceProvider?: ResourceProvider;
}

interface Token {
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
}

interface Renderer {
  renderToken(tokens: Token[], idx: number, options: unknown): string;
}

type LinkOpenRule = (
  tokens: Token[],
  idx: number,
  options: unknown,
  env: RenderEnv,
  self: Renderer
) => string;

type ImageRule = (
  tokens: Token[],
  idx: number,
  options: unknown,
  env: RenderEnv,
  self: Renderer
) => string;

interface MarkdownIt {
  renderer: { rules: { link_open?: LinkOpenRule; image?: ImageRule } };
}

interface ExtendOptions {
  uriScheme: string;
  extensionId: string;
  getAnchor: () => string;
}

/**
 * Build the `extendMarkdownIt` hook VS Code applies to its preview engine.
 *
 * Resolved `xokf://` links are rewritten at render time to a
 * `vscode://<extensionId>/open?...` deep link. The preview lets `vscode:` links
 * through to default navigation (no preventDefault), so the click routes to our
 * registered UriHandler — which gives us full control over WHICH editor group
 * the target opens in (the built-in `openMarkdownLinks` setting cannot target a
 * specific non-preview group).
 */
export function makeExtendMarkdownIt(opts: ExtendOptions) {
  return function extendMarkdownIt(md: MarkdownIt): MarkdownIt {
    const original = md.renderer.rules.link_open;

    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const href = token.attrGet('href');

      if (typeof href === 'string' && env?.currentDocument?.scheme === 'file') {
        const fromPath = env.currentDocument.fsPath;
        let resolved;
        if (href.startsWith(SCHEME)) {
          resolved = resolveXokfLink(fromPath, href, opts.getAnchor());
        } else if (isRelativeDocLink(href)) {
          // Native relative links (Markdown or JSON companions): route through
          // the same handler so they open in the text editor (first non-preview
          // group), instead of navigating inside the preview pane.
          resolved = resolveRelativeDocLink(fromPath, href, PREVIEW_REDIRECT_EXT);
        }
        if (resolved) {
          const deepLink = buildOpenUri(opts.uriScheme, opts.extensionId, {
            path: resolved.fsPath,
            fragment: resolved.fragment,
          });
          token.attrSet('href', deepLink);
          // VS Code's own link_open is the OUTER wrapper and already copied the
          // original href into `data-href` before this rule runs. The preview's
          // click handler keys off `data-href`, so overwrite it with the deep
          // link too — otherwise the click uses the stale original href.
          token.attrSet('data-href', deepLink);
        }
        // Unresolved → leave the href untouched (native behavior).
      }

      return original
        ? original(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    };

    const originalImage = md.renderer.rules.image;

    md.renderer.rules.image = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const src = token.attrGet('src');

      if (
        typeof src === 'string' &&
        src.startsWith(SCHEME) &&
        env?.currentDocument?.scheme === 'file'
      ) {
        const fromPath = env.currentDocument.fsPath;
        const resolved = resolveXokfAsset(fromPath, src, opts.getAnchor());
        if (resolved) {
          const target = vscode.Uri.file(resolved.fsPath);
          // VS Code's own image renderer converts scheme-less/file: sources to
          // a CSP-safe webview resource URI via `resourceProvider`. It only
          // runs on plain paths, so an explicit `xokf:` scheme reaches us
          // unresolved — we must do the same conversion ourselves, or the
          // <img> tag will still be blocked by the preview's CSP even after
          // pointing at the right file.
          const finalSrc = env.resourceProvider
            ? env.resourceProvider.asWebviewUri(target).toString()
            : target.toString();
          token.attrSet('src', finalSrc);
          token.attrSet('data-src', src);
        }
        // Unresolved → leave the src untouched (native behavior: broken image).
      }

      return originalImage
        ? originalImage(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    };

    return md;
  };
}

/** Read the configured federation anchor filename. */
export function getConfiguredAnchor(): string {
  return vscode.workspace
    .getConfiguration('xokf')
    .get<string>('federationAnchor', DEFAULT_FEDERATION_ANCHOR);
}
