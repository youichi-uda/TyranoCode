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

// ── Visual element types extracted from AST ──

interface BackgroundElement {
  storage: string;
}

interface CharacterElement {
  name: string;
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
  background: BackgroundElement | null;
  characters: Map<string, CharacterElement>;
  dialog: DialogElement | null;
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
        'TyranoCode: Scene Preview',
        vscode.ViewColumn.Beside,
        { enableScripts: false, retainContextWhenHidden: true },
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
    this.panel.webview.html = this.renderHtml(snapshot, document.fileName);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  // ── AST extraction ──

  private extractScene(document: vscode.TextDocument): SceneSnapshot {
    const fileName = vscode.workspace.asRelativePath(document.uri);
    this.parser = new Parser(fileName);
    const parsed = this.parser.parse(document.getText());

    const snapshot: SceneSnapshot = {
      background: null,
      characters: new Map(),
      dialog: null,
      labels: [],
      branches: [],
    };

    let currentSpeaker = '';

    this.walkNodes(parsed.nodes, snapshot, { speaker: currentSpeaker });

    return snapshot;
  }

  /**
   * Walk AST nodes sequentially, accumulating the scene state.
   * The final state represents the "last visible" frame of the scene.
   */
  private walkNodes(
    nodes: ScenarioNode[],
    snapshot: SceneSnapshot,
    ctx: { speaker: string },
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
    ctx: { speaker: string },
  ): void {
    const attr = (name: string): string | undefined =>
      node.attributes.find(a => a.name === name)?.value;

    switch (node.name) {
      case 'bg': {
        const storage = attr('storage');
        if (storage) {
          snapshot.background = { storage };
        }
        break;
      }

      case 'chara_show': {
        const name = attr('name');
        if (name) {
          snapshot.characters.set(name, {
            name,
            left: parseInt(attr('left') ?? '0', 10) || 0,
            top: parseInt(attr('top') ?? '0', 10) || 0,
          });
        }
        break;
      }

      case 'chara_hide': {
        const name = attr('name');
        if (name) {
          snapshot.characters.delete(name);
        }
        break;
      }

      case 'chara_hide_all':
        snapshot.characters.clear();
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
    ctx: { speaker: string },
  ): void {
    const trimmed = content.trim();
    if (!trimmed) return;

    // TyranoScript speaker directive: a line starting with # sets the name
    if (trimmed.startsWith('#')) {
      ctx.speaker = trimmed.substring(1).trim();
      return;
    }

    // Any other non-empty text is dialog
    snapshot.dialog = {
      speaker: ctx.speaker,
      text: trimmed,
    };
  }

  private processIfBlock(
    node: IfBlockNode,
    snapshot: SceneSnapshot,
    ctx: { speaker: string },
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

  private renderHtml(snapshot: SceneSnapshot, fileName: string): string {
    const bgName = snapshot.background?.storage ?? 'none';
    const bgHue = this.hashToHue(bgName);

    const characterBoxes = Array.from(snapshot.characters.values())
      .map(ch => {
        const hue = this.hashToHue(ch.name);
        // Scale positions: TyranoScript uses pixel coords on a typically
        // 1280x720 canvas. We display on a 960x540 area, so scale by 0.75.
        const scaledLeft = Math.round(ch.left * 0.75);
        const scaledTop = Math.round(ch.top * 0.75);
        return `<div class="character" style="left:${scaledLeft}px;top:${scaledTop}px;border-color:hsl(${hue},60%,50%)">
          <span class="character-name" style="background:hsl(${hue},60%,30%)">${this.escapeHtml(ch.name)}</span>
          <div class="character-body" style="background:hsl(${hue},40%,20%)"></div>
        </div>`;
      })
      .join('\n');

    const dialogHtml = snapshot.dialog
      ? `<div class="dialog-box">
          ${snapshot.dialog.speaker ? `<div class="dialog-speaker">${this.escapeHtml(snapshot.dialog.speaker)}</div>` : ''}
          <div class="dialog-text">${this.escapeHtml(snapshot.dialog.text)}</div>
        </div>`
      : '';

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

    /* ── Stage area ── */
    .stage-container {
      position: relative;
      width: 960px;
      height: 540px;
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .stage-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, hsl(${bgHue},30%,15%) 0%, hsl(${bgHue},40%,25%) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stage-bg .bg-label {
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
      width: 80px;
      height: 160px;
      border: 2px solid;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .character-name {
      display: block;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      text-align: center;
      color: #eee;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .character-body {
      flex: 1;
      opacity: 0.5;
    }

    /* ── Dialog box ── */
    .dialog-box {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      padding: 14px 20px;
      min-height: 100px;
    }

    .dialog-speaker {
      font-weight: 700;
      font-size: 14px;
      color: #e8c870;
      margin-bottom: 6px;
    }

    .dialog-text {
      font-size: 14px;
      line-height: 1.6;
      color: #eee;
    }

    /* ── Sidebar panels ── */
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
      max-height: 260px;
      overflow-y: auto;
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

    .label-marker {
      color: #569cd6;
      font-weight: 700;
    }

    .branch-icon {
      color: #dcdcaa;
      font-size: 10px;
    }

    .label-line {
      margin-left: auto;
      opacity: 0.4;
      font-size: 10px;
    }

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
    <span>&mdash; Scene Preview (static analysis)</span>
  </div>

  <div class="stage-container">
    <div class="stage-bg">
      <span class="bg-label">bg: ${this.escapeHtml(bgName)}</span>
    </div>
    ${characterBoxes}
    ${dialogHtml}
  </div>

  <div class="panels">
    <div class="panel">
      <div class="panel-title">Labels</div>
      ${labelItems || '<div class="empty-note">No labels</div>'}
    </div>
    <div class="panel">
      <div class="panel-title">Branches</div>
      ${branchItems || '<div class="empty-note">No branches</div>'}
    </div>
  </div>
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
        vscode.window.showWarningMessage('No active .ks file to preview.');
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
