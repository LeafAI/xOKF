import * as vscode from 'vscode';
import { resolveRelativeDocLink, isMarkdownPath } from './resolver';

// Matches a JSON string literal in the raw source, escapes included.
const JSON_STRING_RE = /"(?:[^"\\]|\\.)*"/g;

export class XokfJsonLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.DocumentLink[] {
    if (document.uri.scheme !== 'file') {
      return [];
    }

    const fromFsPath = document.uri.fsPath;
    const text = document.getText();
    const links: vscode.DocumentLink[] = [];

    JSON_STRING_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = JSON_STRING_RE.exec(text)) !== null) {
      const raw = match[0];
      let value: string;
      try {
        value = JSON.parse(raw);
      } catch {
        continue; // not a valid JSON string literal (shouldn't happen in valid JSON)
      }
      if (typeof value !== 'string') {
        continue;
      }

      // Any relative path to an existing file is a link; Markdown targets open
      // their rendered preview, everything else opens in the text editor.
      const resolved = resolveRelativeDocLink(fromFsPath, value, null);
      if (!resolved) {
        continue;
      }

      // Range covers the string's content, excluding the surrounding quotes.
      const start = document.positionAt(match.index + 1);
      const end = document.positionAt(match.index + raw.length - 1);
      const args = encodeURIComponent(
        JSON.stringify([resolved.fsPath, resolved.fragment])
      );
      const isMarkdown = isMarkdownPath(resolved.fsPath);
      const command = isMarkdown ? 'xokf.openPreview' : 'xokf.openInEditor';
      const target = vscode.Uri.parse(`command:${command}?${args}`);

      const link = new vscode.DocumentLink(new vscode.Range(start, end), target);
      const rel = vscode.workspace.asRelativePath(resolved.fsPath);
      const verb = isMarkdown ? 'Open preview' : 'Open file';
      link.tooltip = resolved.fragment
        ? `${verb}: ${rel} (#${resolved.fragment})`
        : `${verb}: ${rel}`;
      links.push(link);
    }

    return links;
  }
}
