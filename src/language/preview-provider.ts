/**
 * Static scene preview for TyranoScript .ks files.
 *
 * Renders a visual mockup of the current scene based on static AST analysis.
 * Does NOT execute TyranoScript — reads the parsed nodes and generates an
 * HTML representation showing backgrounds, character positions, dialog text,
 * labels, and branching indicators.
 */

import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import {
  ProjectIndex,
  ScenarioNode,
  TagNode,
  IfBlockNode,
} from '../parser/types';
import { localize } from './i18n';

// ── Visual element types extracted from AST ──

interface BackgroundElement {
  storage: string;
}

interface CharacterElement {
  name: string;
  storage: string;
  left: number;
  top: number;
}

interface DialogElement {
  speaker: string;
  text: string;
}

interface LabelElement {
  name: string;
  line: number;
}

interface BranchIndicator {
  condition: string;
  branchCount: number;
  line: number;
}

interface SceneSnapshot {
  backgrounds: BackgroundElement[];
  characters: Map<string, CharacterElement>;
  dialogs: DialogElement[];
  labels: LabelElement[];
  branches: BranchIndicator[];
}

// ── Provider ──

export class TyranoPreviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private parser: Parser;

  constructor(private getIndex: () => ProjectIndex | undefined) {
    this.parser = new Parser('');
  }

  /**
   * Create or reveal the preview panel for the given document.
   */
  show(document: vscode.TextDocument): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'tyranodev.scenePreview',
        localize('TyranoCode: Scene Preview', 'TyranoCode: シーンプレビュー'),
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: vscode.workspace.workspaceFolders
            ? [vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'data')]
            : [],
        },
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.update(document);
  }

  /**
   * Re-render the preview for the given document.
   */
  update(document: vscode.TextDocument): void {
    if (!this.panel) return;

    const snapshot = this.extractScene(document);
    this.panel.webview.html = this.renderHtml(snapshot, document.fileName, this.panel.webview);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  // ── AST extraction ──

  private extractScene(document: vscode.TextDocument): SceneSnapshot {
    const fileName = vscode.workspace.asRelativePath(document.uri);
    this.parser = new Parser(fileName);
    const parsed = this.parser.parse(document.getText());

    // Collect chara_new definitions from the entire project
    const charaDefs = this.collectCharaDefs();

    const snapshot: SceneSnapshot = {
      backgrounds: [],
      characters: new Map(),
      dialogs: [],
      labels: [],
      branches: [],
    };

    let currentSpeaker = '';

    this.walkNodes(parsed.nodes, snapshot, { speaker: currentSpeaker, charaDefs });

    return snapshot;
  }

  /**
   * Collect [chara_new] definitions from all scenarios in the project index.
   * Returns a map: character name -> { storage (default image path), face -> image path }.
   */
  private collectCharaDefs(): Map<string, { storage: string; faces: Map<string, string> }> {
    const defs = new Map<string, { storage: string; faces: Map<string, string> }>();
    const index = this.getIndex();
    if (!index) return defs;

    for (const [, scenario] of index.scenarios) {
      for (const node of scenario.nodes) {
        if (node.type !== 'tag') continue;
        const attr = (name: string) => node.attributes.find(a => a.name === name)?.value;

        if (node.name === 'chara_new') {
          const name = attr('name');
          const storage = attr('storage');
          if (name && storage) {
            defs.set(name, { storage, faces: new Map() });
          }
        } else if (node.name === 'chara_face') {
          const name = attr('name');
          const face = attr('face');
          const storage = attr('storage');
          if (name && face && storage) {
            const def = defs.get(name);
            if (def) {
              def.faces.set(face, storage);
            }
          }
        }
      }
    }

    return defs;
  }

  /**
   * Walk AST nodes sequentially, accumulating the scene state.
   * The final state represents the "last visible" frame of the scene.
   */
  private walkNodes(
    nodes: ScenarioNode[],
    snapshot: SceneSnapshot,
    ctx: { speaker: string; charaDefs: Map<string, { storage: string; faces: Map<string, string> }> },
  ): void {
    for (const node of nodes) {
      switch (node.type) {
        case 'label':
          snapshot.labels.push({
            name: node.name,
            line: node.range.start.line,
          });
          break;

        case 'tag':
          this.processTag(node, snapshot, ctx);
          break;

        case 'text':
          this.processText(node.content, snapshot, ctx);
          break;

        case 'if_block':
          this.processIfBlock(node, snapshot, ctx);
          break;

        case 'macro_def':
          // Do not descend into macro bodies for the preview —
          // macros are templates, not live scene content.
          break;
      }
    }
  }

  private processTag(
    node: TagNode,
    snapshot: SceneSnapshot,
    ctx: { speaker: string; charaDefs: Map<string, { storage: string; faces: Map<string, string> }> },
  ): void {
    const attr = (name: string): string | undefined =>
      node.attributes.find(a => a.name === name)?.value;

    switch (node.name) {
      case 'bg': {
        const storage = attr('storage');
        if (storage) {
          snapshot.backgrounds.push({ storage });
        }
        break;
      }

      case 'chara_show': {
        const name = attr('name');
        if (name) {
          const def = ctx.charaDefs.get(name);
          snapshot.characters.set(name, {
            name,
            storage: def?.storage ?? '',
            left: parseInt(attr('left') ?? '0', 10) || 0,
            top: parseInt(attr('top') ?? '0', 10) || 0,
          });
        }
        break;
      }

      case 'chara_mod': {
        // Update face: resolve new image path from chara_face defs or derive from name convention
        const name = attr('name');
        const face = attr('face');
        if (name && face) {
          const existing = snapshot.characters.get(name);
          if (existing) {
            const def = ctx.charaDefs.get(name);
            // Try chara_face definition, otherwise derive path by replacing filename
            const facePath = def?.faces.get(face)
              ?? (def?.storage ? def.storage.replace(/\/[^/]+$/, `/${face}.png`) : '');
            existing.storage = facePath;
          }
        }
        break;
      }

      case 'chara_hide':
      case 'chara_hide_all':
        // Don't remove characters — we want to show all that appeared
        break;

      // Speaker name tag: [#speaker_name]
      // The parser treats `#name` inside brackets as a tag named the raw value.
      // In TyranoScript the `[#name]` form sets the speaker. The parser emits
      // this as a text node starting with `#`. We handle it in processText.
      // However, some parsers may also emit a tag with name starting with '#'.
      default:
        if (node.name.startsWith('#')) {
          ctx.speaker = node.name.substring(1);
        }
        break;
    }
  }

  private processText(
    content: string,
    snapshot: SceneSnapshot,
    ctx: { speaker: string; charaDefs: Map<string, { storage: string; faces: Map<string, string> }> },
  ): void {
    const trimmed = content.trim();
    if (!trimmed) return;

    // TyranoScript speaker directive: a line starting with # sets the name
    if (trimmed.startsWith('#')) {
      ctx.speaker = trimmed.substring(1).trim();
      return;
    }

    // Any other non-empty text is dialog — accumulate all
    snapshot.dialogs.push({
      speaker: ctx.speaker,
      text: trimmed,
    });
  }

  private processIfBlock(
    node: IfBlockNode,
    snapshot: SceneSnapshot,
    ctx: { speaker: string; charaDefs: Map<string, { storage: string; faces: Map<string, string> }> },
  ): void {
    let branchCount = 1; // then-branch
    branchCount += node.elsifBranches.length;
    if (node.elseBranch) branchCount += 1;

    snapshot.branches.push({
      condition: node.condition,
      branchCount,
      line: node.range.start.line,
    });

    // Walk the then-branch to capture visible elements
    this.walkNodes(node.thenBranch, snapshot, ctx);
  }

  // ── HTML rendering ──

  private renderHtml(snapshot: SceneSnapshot, fileName: string, webview: vscode.Webview): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    // Resolve a game-relative path (e.g., "chara/sakura/normal.png") to a webview URI
    const toImageUri = (gamePath: string): string => {
      if (!workspaceFolder || !gamePath) return '';
      const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'data', 'fgimage', gamePath);
      return webview.asWebviewUri(fileUri).toString();
    };

    const toBgUri = (bgFile: string): string => {
      if (!workspaceFolder || !bgFile) return '';
      const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'data', 'bgimage', bgFile);
      return webview.asWebviewUri(fileUri).toString();
    };

    // Build per-bg data for tabs
    const backgrounds = snapshot.backgrounds.length > 0
      ? snapshot.backgrounds
      : [{ storage: 'none' }];
    const bgTabsHtml = backgrounds
      .map((bg, i) => {
        const active = i === 0 ? ' active' : '';
        return `<button class="bg-tab${active}" data-index="${i}">${this.escapeHtml(bg.storage)}</button>`;
      })
      .join('');
    const bgPanesHtml = backgrounds
      .map((bg, i) => {
        const hue = this.hashToHue(bg.storage);
        const hidden = i === 0 ? '' : ' hidden';
        const bgUri = toBgUri(bg.storage);
        const bgStyle = bgUri
          ? `background:url('${bgUri}') center/cover no-repeat, linear-gradient(135deg,hsl(${hue},30%,15%) 0%,hsl(${hue},40%,25%) 100%)`
          : `background:linear-gradient(135deg,hsl(${hue},30%,15%) 0%,hsl(${hue},40%,25%) 100%)`;
        return `<div class="bg-pane${hidden}" data-index="${i}" style="${bgStyle}">
          <span class="bg-label">${this.escapeHtml(bg.storage)}</span>
        </div>`;
      })
      .join('');

    const characterBoxes = Array.from(snapshot.characters.values())
      .map(ch => {
        const hue = this.hashToHue(ch.name);
        const scaledLeft = Math.round(ch.left * 0.75);
        const scaledTop = Math.round(ch.top * 0.75);
        const imgUri = toImageUri(ch.storage);
        const imgHtml = imgUri
          ? `<img class="character-img" src="${imgUri}" alt="${this.escapeHtml(ch.name)}">`
          : `<div class="character-body" style="background:hsl(${hue},40%,20%)"></div>`;
        return `<div class="character" style="left:${scaledLeft}px;top:${scaledTop}px;border-color:hsl(${hue},60%,50%)">
          <span class="character-name" style="background:hsl(${hue},60%,30%)">${this.escapeHtml(ch.name)}</span>
          ${imgHtml}
        </div>`;
      })
      .join('\n');

    const dialogItems = snapshot.dialogs
      .map(d =>
        `<div class="dialog-entry">${d.speaker ? `<span class="dialog-speaker">${this.escapeHtml(d.speaker)}</span> ` : ''}` +
        `<span class="dialog-text">${this.escapeHtml(d.text)}</span></div>`)
      .join('\n');

    const labelItems = snapshot.labels
      .map(
        l =>
          `<div class="label-item"><span class="label-marker">*</span>${this.escapeHtml(l.name)}<span class="label-line">L${l.line + 1}</span></div>`,
      )
      .join('\n');

    const branchItems = snapshot.branches
      .map(
        b =>
          `<div class="branch-item" title="${this.escapeHtml(b.condition)}"><span class="branch-icon">&#9670;</span> if (${this.escapeHtml(this.truncate(b.condition, 30))}) &mdash; ${b.branchCount} branch${b.branchCount !== 1 ? 'es' : ''}<span class="label-line">L${b.line + 1}</span></div>`,
      )
      .join('\n');

    const shortName = fileName.replace(/^.*[/\\]/, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scene Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #ccc);
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: 13px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      gap: 12px;
    }

    .header {
      width: 100%;
      max-width: 980px;
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0.7;
      font-size: 11px;
    }

    .header .file-name {
      font-weight: 600;
    }

    /* ── BG Tabs ── */
    .bg-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      background: rgba(0,0,0,0.5);
      padding: 6px 8px;
    }

    .bg-tab {
      background: rgba(255,255,255,0.08);
      color: var(--vscode-editor-foreground, #ccc);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 3px;
      padding: 3px 10px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      font-family: inherit;
    }

    .bg-tab:hover { background: rgba(255,255,255,0.15); }
    .bg-tab.active {
      background: rgba(86,156,214,0.4);
      border-color: #569cd6;
      color: #fff;
      font-weight: 600;
    }

    /* ── Stage area ── */
    .stage-container {
      position: relative;
      width: 100%;
      max-width: 960px;
      aspect-ratio: 16 / 9;
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .bg-pane {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bg-pane.hidden { display: none; }

    .bg-pane .bg-label {
      font-size: 16px;
      opacity: 0.35;
      letter-spacing: 2px;
      text-transform: uppercase;
      pointer-events: none;
      user-select: none;
    }

    /* ── Characters ── */
    .character {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 5;
      pointer-events: none;
    }

    .character-name {
      display: block;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      text-align: center;
      color: #eee;
      white-space: nowrap;
      border-radius: 3px;
      margin-bottom: 2px;
    }

    .character-img {
      max-height: 400px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
    }

    .character-body {
      width: 80px;
      height: 160px;
      opacity: 0.5;
      border-radius: 4px;
    }

    /* ── Panels ── */
    .panels {
      width: 100%;
      max-width: 980px;
      display: flex;
      gap: 12px;
    }

    .panel {
      flex: 1;
      background: var(--vscode-sideBar-background, #252526);
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 4px;
      padding: 10px 12px;
      max-height: 300px;
      overflow-y: auto;
    }

    .panel.dialog-panel {
      flex: 2;
    }

    .panel-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.6;
      margin-bottom: 8px;
    }

    .label-item, .branch-item {
      padding: 3px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }

    .label-marker { color: #569cd6; font-weight: 700; }
    .branch-icon { color: #dcdcaa; font-size: 10px; }
    .label-line { margin-left: auto; opacity: 0.4; font-size: 10px; }

    .dialog-entry {
      padding: 4px 0;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      line-height: 1.5;
      font-size: 12px;
    }
    .dialog-entry:last-child { border-bottom: none; }
    .dialog-speaker { font-weight: 700; color: #e8c870; margin-right: 4px; }
    .dialog-text { color: #eee; }

    .empty-note {
      opacity: 0.35;
      font-style: italic;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="file-name">${this.escapeHtml(shortName)}</span>
    <span>&mdash; ${localize('Scene Preview (static analysis)', 'シーンプレビュー (静的解析)')}</span>
  </div>

  <div class="stage-container">
    <div class="bg-tabs">${bgTabsHtml}</div>
    ${bgPanesHtml}
    ${characterBoxes}
  </div>

  <div class="panels">
    <div class="panel dialog-panel">
      <div class="panel-title">${localize('Dialog', 'ダイアログ')} (${snapshot.dialogs.length})</div>
      ${dialogItems || `<div class="empty-note">${localize('No dialog', 'ダイアログなし')}</div>`}
    </div>
    <div class="panel">
      <div class="panel-title">${localize('Labels', 'ラベル')} (${snapshot.labels.length})</div>
      ${labelItems || `<div class="empty-note">${localize('No labels', 'ラベルなし')}</div>`}
    </div>
    <div class="panel">
      <div class="panel-title">${localize('Branches', '分岐')} (${snapshot.branches.length})</div>
      ${branchItems || `<div class="empty-note">${localize('No branches', '分岐なし')}</div>`}
    </div>
  </div>

  <script>
    document.querySelectorAll('.bg-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const idx = tab.dataset.index;
        document.querySelectorAll('.bg-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.bg-pane').forEach(p => p.classList.add('hidden'));
        tab.classList.add('active');
        document.querySelector('.bg-pane[data-index="' + idx + '"]').classList.remove('hidden');
      });
    });
  </script>
</body>
</html>`;
  }

  // ── Utilities ──

  /**
   * Deterministic string-to-hue mapping for consistent placeholder colours.
   */
  private hashToHue(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 360;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '\u2026';
  }
}

// ── Registration helper ──

/**
 * Register the scene preview command and live-update subscriptions.
 */
export function registerPreview(
  context: vscode.ExtensionContext,
  getIndex: () => ProjectIndex | undefined,
): TyranoPreviewProvider {
  const provider = new TyranoPreviewProvider(getIndex);

  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.previewScene', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(localize('No active .ks file to preview.', 'プレビュー対象の .ks ファイルがありません。'));
        return;
      }
      provider.show(editor.document);
    }),
  );

  // Live update on text change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId === 'tyranoscript') {
        provider.update(e.document);
      }
    }),
  );

  // Update when switching to another .ks editor
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.languageId === 'tyranoscript') {
        provider.update(editor.document);
      }
    }),
  );

  context.subscriptions.push({ dispose: () => provider.dispose() });

  return provider;
}
