import * as vscode from 'vscode';
import { resolveXokfLink, SCHEME, DEFAULT_FEDERATION_ANCHOR } from './resolver';

// Match an xokf:// token up to the first whitespace or Markdown/HTML delimiter.
const LINK_RE = /xokf:\/\/[^\s)<>\]"'`]+/g;
// Trailing punctuation that is almost always prose, not part of the path.
const TRAILING_PUNCT_RE = /[.,;:!?]+$/;

export class XokfDocumentLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.DocumentLink[] {
    // Resolution is filesystem-based; only real files have a federation root.
    if (document.uri.scheme !== 'file') {
      return [];
    }

    const anchor = vscode.workspace
      .getConfiguration('xokf')
      .get<string>('federationAnchor', DEFAULT_FEDERATION_ANCHOR);

    const fromFsPath = document.uri.fsPath;
    const text = document.getText();
    const links: vscode.DocumentLink[] = [];

    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(text)) !== null) {
      let href = match[0];
      const trimmed = href.replace(TRAILING_PUNCT_RE, '');
      href = trimmed;

      const resolved = resolveXokfLink(fromFsPath, href, anchor);
      if (!resolved) {
        // Broken / unresolved reference — tolerated (OKF rule 5), no link.
        continue;
      }

      const start = document.positionAt(match.index);
      const end = document.positionAt(match.index + href.length);
      const target = vscode.Uri.file(resolved.fsPath);

      const link = new vscode.DocumentLink(new vscode.Range(start, end), target);
      const rel = vscode.workspace.asRelativePath(resolved.fsPath);
      link.tooltip = resolved.fragment
        ? `xokf → ${rel} (#${resolved.fragment})`
        : `xokf → ${rel}`;
      links.push(link);
    }

    return links;
  }
}

export { SCHEME };
