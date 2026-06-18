/**
 * Encoding for the deep-link payload that carries a resolved target from the
 * Markdown preview (markdown-it render) to the extension host (UriHandler).
 *
 * The preview click handler forwards links whose scheme is in its passthrough
 * list (`vscode:` is one) untouched, so a `vscode://<extensionId>/open?...` href
 * routes to our registered `UriHandler`. We pack the already-resolved absolute
 * path (and optional heading fragment) into the query as a base64url blob so the
 * VS Code URI parser can't mangle path separators or non-ASCII characters.
 */

export interface OpenPayload {
  /** Absolute filesystem path of the target Markdown file. */
  path: string;
  /** Optional heading fragment (without the leading '#'). */
  fragment?: string;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/**
 * Build the deep link the preview should navigate to:
 *   `${uriScheme}://${extensionId}/open?data=<base64url(JSON)>`
 */
export function buildOpenUri(
  uriScheme: string,
  extensionId: string,
  payload: OpenPayload
): string {
  const data = toBase64Url(JSON.stringify(payload));
  return `${uriScheme}://${extensionId}/open?data=${data}`;
}

/**
 * Parse the `data` blob from a UriHandler query string back into a payload.
 * Returns undefined if the query is missing/garbled.
 */
export function parseOpenQuery(query: string): OpenPayload | undefined {
  const match = /(?:^|&)data=([^&]+)/.exec(query);
  if (!match) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(fromBase64Url(match[1]));
    if (parsed && typeof parsed.path === 'string') {
      return {
        path: parsed.path,
        fragment: typeof parsed.fragment === 'string' ? parsed.fragment : undefined,
      };
    }
  } catch {
    // fall through
  }
  return undefined;
}
