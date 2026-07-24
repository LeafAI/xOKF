import * as vscode from 'vscode';
import { XokfDocumentLinkProvider } from './linkProvider';
import { XokfJsonLinkProvider } from './jsonLinkProvider';
import { makeExtendMarkdownIt, getConfiguredAnchor } from './markdownPreview';
import { parseOpenQuery } from './protocol';
import { renderDocumentForExport } from './pdfExport';

/**
 * Pick the editor group to open a target in: the first tab group whose active
 * tab is NOT a Markdown preview webview. Falls back to ViewColumn.Beside when
 * every group is showing a preview (or there are none).
 */
function pickEditorColumn(): vscode.ViewColumn {
  for (const group of vscode.window.tabGroups.all) {
    const active = group.activeTab;
    const isPreview =
      active?.input instanceof vscode.TabInputWebview &&
      /markdown/i.test(active.input.viewType);
    if (!isPreview) {
      return group.viewColumn;
    }
  }
  return vscode.ViewColumn.Beside;
}

async function openTarget(payload: { path: string; fragment?: string }): Promise<void> {
  const uri = vscode.Uri.file(payload.path);
  const column = pickEditorColumn();
  const editor = await vscode.window.showTextDocument(uri, { viewColumn: column });
  if (payload.fragment) {
    revealHeading(editor, payload.fragment);
  }
}

/** Best-effort: scroll to the first heading matching the slug fragment. */
function revealHeading(editor: vscode.TextEditor, fragment: string): void {
  const slug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  const target = slug(decodeURIComponent(fragment));
  const doc = editor.document;
  for (let line = 0; line < doc.lineCount; line++) {
    const m = /^#{1,6}\s+(.*)$/.exec(doc.lineAt(line).text);
    if (m && slug(m[1]) === target) {
      const pos = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.AtTop
      );
      return;
    }
  }
}

/**
 * Find the Markdown document to export: prefer the active text editor if
 * it's showing Markdown, otherwise fall back to the most recently active
 * Markdown document among open editors (covers invoking the command while
 * the preview pane — not the source editor — has focus).
 */
function findMarkdownDocument(): vscode.TextDocument | undefined {
  const active = vscode.window.activeTextEditor?.document;
  if (active?.languageId === 'markdown') {
    return active;
  }
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.languageId === 'markdown') {
      return editor.document;
    }
  }
  return undefined;
}

/**
 * Render the given Markdown document (resolving `xokf://` links/images the
 * same way the live preview does) into a standalone webview and trigger the
 * browser print dialog, so the user can save it as PDF. Rendering happens
 * entirely locally — no external process or dependency is spawned.
 */
async function exportDocumentToPdf(document: vscode.TextDocument): Promise<void> {
  const { html, title } = renderDocumentForExport(document, getConfiguredAnchor());

  const panel = vscode.window.createWebviewPanel(
    'xokfPdfExport',
    `导出 PDF: ${title}`,
    vscode.ViewColumn.Active,
    { enableScripts: true }
  );
  panel.webview.html = html;
}

export function activate(context: vscode.ExtensionContext) {
  // Editor (source view): make xokf:// links Cmd/Ctrl+clickable.
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: 'markdown', scheme: 'file' },
      new XokfDocumentLinkProvider()
    )
  );

  // JSON editor: make relative Markdown-file paths (e.g. "./concept.md#sec")
  // written as JSON string values clickable, opening the target's preview.
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      [
        { language: 'json', scheme: 'file' },
        { language: 'jsonc', scheme: 'file' },
      ],
      new XokfJsonLinkProvider()
    )
  );

  // Preview deep links route here: open the target in the first non-preview
  // tab group, so the editor never lands inside the Markdown preview's group.
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        if (uri.path !== '/open') {
          return;
        }
        const payload = parseOpenQuery(uri.query);
        if (payload) {
          void openTarget(payload);
        }
      },
    })
  );

  // JSON DocumentLink target for Markdown files: open the rendered preview.
  // `showPreviewToSide` resolves "beside the active (JSON) editor group", which
  // is where a preview conventionally already lives, so VS Code reuses that
  // existing panel rather than opening a duplicate.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'xokf.openPreview',
      async (fsPath: string, fragment?: string) => {
        const uri = fragment
          ? vscode.Uri.file(fsPath).with({ fragment })
          : vscode.Uri.file(fsPath);
        await vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
      }
    )
  );

  // JSON DocumentLink target for non-Markdown files: open in the text editor,
  // in the first non-preview tab group (same placement as preview-origin links).
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'xokf.openInEditor',
      async (fsPath: string, fragment?: string) => {
        await openTarget({ path: fsPath, fragment });
      }
    )
  );

  // Export the current Markdown document (with xokf:// links/images
  // resolved) to a standalone webview and trigger the browser print dialog,
  // so the user can save it as PDF for sharing.
  context.subscriptions.push(
    vscode.commands.registerCommand('xokf.exportToPdf', async () => {
      const document = findMarkdownDocument();
      if (!document) {
        void vscode.window.showWarningMessage('xokf: 没有找到可导出的 Markdown 文档。');
        return;
      }
      try {
        await exportDocumentToPdf(document);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`xokf: 导出 PDF 失败 — ${message}`);
      }
    })
  );

  // Preview: rewrite resolved xokf:// links to a vscode:// deep link that the
  // preview passes through to our UriHandler.
  return {
    extendMarkdownIt: makeExtendMarkdownIt({
      uriScheme: vscode.env.uriScheme,
      extensionId: context.extension.id,
      getAnchor: getConfiguredAnchor,
    }),
  };
}

export function deactivate(): void {
  // Nothing to clean up; subscriptions are disposed by VS Code.
}
