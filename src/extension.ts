import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
 * same way the live preview does) to a standalone HTML file in a temp
 * directory, then hand it off to the OS's default browser via
 * `openExternal`.
 *
 * We deliberately do NOT use a VS Code WebviewPanel here: VS Code always
 * sandboxes webview content in an iframe without the `allow-modals`
 * permission (see webview/browser/pre/index.html — the sandbox attribute
 * list has no toggle for it, even with `enableScripts: true`), and browsers
 * treat `window.print()` as a modal-dialog-class API. Inside that sandbox the
 * call is silently ignored — no error, the print dialog just never appears.
 * A real browser tab has no such restriction, so `window.print()` (and the
 * page's manual print button, and the user's own Ctrl/Cmd+P) all work there.
 */
async function exportDocumentToPdf(document: vscode.TextDocument): Promise<void> {
  const { html, title } = renderDocumentForExport(document, getConfiguredAnchor());

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xokf-pdf-export-'));
  const tmpFile = path.join(tmpDir, `${sanitizeFileName(title)}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');

  const opened = await vscode.env.openExternal(vscode.Uri.file(tmpFile));
  if (!opened) {
    throw new Error('无法在系统默认浏览器中打开导出文件。');
  }
  void vscode.window.showInformationMessage(
    'xokf: 已在浏览器中打开导出预览 — 使用 Ctrl/Cmd+P（或页面上的打印按钮）打印，并选择“另存为 PDF”。'
  );
}

/** Strip characters that are unsafe in a filename across platforms. */
function sanitizeFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'document';
  return base.replace(/[/\\?%*:|"<>]/g, '_');
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
  // resolved) to a standalone HTML file opened in the system browser, which
  // supports triggering the print dialog for "Save as PDF".
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
