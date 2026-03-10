/**
 * TyranoScript inlay hints provider.
 * Shows inline contextual information for tag parameters:
 * - Resolved file paths for storage attributes
 * - Character display names (jname) for chara_show/chara_hide/etc.
 * - Variable scope hints for [eval] expressions
 */

import * as vscode from 'vscode';
import { ProjectIndex, ScenarioNode, TagNode } from '../parser/types';

export class TyranoInlayHintsProvider implements vscode.InlayHintsProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    _token: vscode.CancellationToken,
  ): vscode.InlayHint[] {
    const hints: vscode.InlayHint[] = [];
    const index = this.getIndex();

    for (let lineNum = range.start.line; lineNum <= range.end.line; lineNum++) {
      if (lineNum >= document.lineCount) break;

      const lineText = document.lineAt(lineNum).text;
      this.collectHintsFromLine(lineText, lineNum, hints, index);
    }

    return hints;
  }

  /**
   * Parse tags from a single line and collect relevant inlay hints.
   */
  private collectHintsFromLine(
    lineText: string,
    lineNum: number,
    hints: vscode.InlayHint[],
    index: ProjectIndex | undefined,
  ): void {
    // Match tag patterns: [tagname attr="value" ...]
    const tagRegex = /\[(\w+)((?:\s+\w+(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s\]]+)?)*)\s*\]/g;
    let tagMatch: RegExpExecArray | null;

    while ((tagMatch = tagRegex.exec(lineText)) !== null) {
      const tagName = tagMatch[1];
      const attrText = tagMatch[2];
      const tagStartCol = tagMatch.index;

      const attrs = this.parseAttributes(attrText, tagStartCol + tagName.length + 1);

      // Storage attribute → show resolved file path
      this.addStorageHint(tagName, attrs, lineNum, hints);

      // Character tags → show display name (jname)
      this.addCharacterNameHint(tagName, attrs, lineNum, hints, index);

      // [eval] → show variable scope hints
      this.addEvalScopeHint(tagName, attrs, lineNum, hints);
    }
  }

  /**
   * For tags with storage="file.ks", show the resolved path hint after the value.
   */
  private addStorageHint(
    tagName: string,
    attrs: ParsedAttr[],
    lineNum: number,
    hints: vscode.InlayHint[],
  ): void {
    const storageTags = new Set([
      'jump', 'call', 'link', 'button', 'clickable',
      'loadjs', 'bg', 'image', 'playbgm', 'playse',
    ]);

    if (!storageTags.has(tagName)) return;

    const storageAttr = attrs.find(a => a.name === 'storage');
    if (!storageAttr?.value) return;

    const fileName = storageAttr.value;

    // Infer the resource subdirectory based on tag type
    let resolvedDir: string | undefined;
    if (tagName === 'bg' || tagName === 'image') {
      resolvedDir = 'data/fgimage';
      if (tagName === 'bg') resolvedDir = 'data/bgimage';
    } else if (tagName === 'playbgm') {
      resolvedDir = 'data/bgm';
    } else if (tagName === 'playse') {
      resolvedDir = 'data/sound';
    } else if (tagName === 'loadjs') {
      resolvedDir = 'data/others';
    } else {
      // jump/call/link → scenario directory
      resolvedDir = 'data/scenario';
    }

    if (resolvedDir) {
      const position = new vscode.Position(lineNum, storageAttr.valueEndCol);
      const hint = new vscode.InlayHint(
        position,
        ` ${resolvedDir}/${fileName}`,
        vscode.InlayHintKind.Parameter,
      );
      hint.paddingLeft = true;
      hint.tooltip = `Resolved path: ${resolvedDir}/${fileName}`;
      hints.push(hint);
    }
  }

  /**
   * For character-related tags with name="xxx", show the jname (display name)
   * if a [chara_new] definition is found in the project index.
   */
  private addCharacterNameHint(
    tagName: string,
    attrs: ParsedAttr[],
    lineNum: number,
    hints: vscode.InlayHint[],
    index: ProjectIndex | undefined,
  ): void {
    const charaTags = new Set([
      'chara_show', 'chara_hide', 'chara_mod', 'chara_move',
      'chara_face', 'chara_ptext', 'chara_part',
    ]);

    if (!charaTags.has(tagName)) return;
    if (!index) return;

    const nameAttr = attrs.find(a => a.name === 'name');
    if (!nameAttr?.value) return;

    const charaName = nameAttr.value;
    const jname = this.findCharaJname(charaName, index);

    if (jname) {
      const position = new vscode.Position(lineNum, nameAttr.valueEndCol);
      const hint = new vscode.InlayHint(
        position,
        ` (${jname})`,
        vscode.InlayHintKind.Parameter,
      );
      hint.paddingLeft = true;
      hint.tooltip = `Display name: ${jname}`;
      hints.push(hint);
    }
  }

  /**
   * For [eval exp="f.x = 1"], show the variable scope as an inlay hint.
   */
  private addEvalScopeHint(
    tagName: string,
    attrs: ParsedAttr[],
    lineNum: number,
    hints: vscode.InlayHint[],
  ): void {
    if (tagName !== 'eval') return;

    const expAttr = attrs.find(a => a.name === 'exp');
    if (!expAttr?.value) return;

    const scopeLabels: Record<string, string> = {
      'f.': 'game var',
      'sf.': 'system var',
      'tf.': 'temp var',
    };

    for (const [prefix, label] of Object.entries(scopeLabels)) {
      if (expAttr.value.includes(prefix)) {
        const position = new vscode.Position(lineNum, expAttr.valueStartCol);
        const hint = new vscode.InlayHint(
          position,
          `${label}: `,
          vscode.InlayHintKind.Type,
        );
        hint.paddingRight = true;
        hint.tooltip = `Expression uses ${label}s (${prefix}*)`;
        hints.push(hint);
        // Only show the first matching scope to avoid clutter
        break;
      }
    }
  }

  /**
   * Look up the jname for a character by searching for [chara_new] definitions
   * in the project index.
   */
  private findCharaJname(
    charaName: string,
    index: ProjectIndex,
  ): string | undefined {
    for (const [, scenario] of index.scenarios) {
      for (const node of scenario.nodes) {
        const jname = this.findJnameInNode(node, charaName);
        if (jname) return jname;
      }
    }
    return undefined;
  }

  /**
   * Recursively search a node tree for a [chara_new] tag that defines
   * the given character name, and return its jname attribute value.
   */
  private findJnameInNode(
    node: ScenarioNode,
    charaName: string,
  ): string | undefined {
    if (node.type === 'tag' && node.name === 'chara_new') {
      const nameAttr = node.attributes.find(a => a.name === 'name');
      if (nameAttr?.value === charaName) {
        const jnameAttr = node.attributes.find(a => a.name === 'jname');
        return jnameAttr?.value;
      }
    }

    if (node.type === 'if_block') {
      for (const child of node.thenBranch) {
        const result = this.findJnameInNode(child, charaName);
        if (result) return result;
      }
      for (const branch of node.elsifBranches) {
        for (const child of branch.body) {
          const result = this.findJnameInNode(child, charaName);
          if (result) return result;
        }
      }
      if (node.elseBranch) {
        for (const child of node.elseBranch) {
          const result = this.findJnameInNode(child, charaName);
          if (result) return result;
        }
      }
    }

    if (node.type === 'macro_def') {
      for (const child of node.body) {
        const result = this.findJnameInNode(child, charaName);
        if (result) return result;
      }
    }

    return undefined;
  }

  /**
   * Parse attributes from a tag's attribute text.
   * Returns an array of parsed attribute objects with their positions.
   */
  private parseAttributes(
    attrText: string,
    baseCol: number,
  ): ParsedAttr[] {
    const attrs: ParsedAttr[] = [];
    const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(attrText)) !== null) {
      const name = match[1];
      const value = match[2] ?? match[3] ?? match[4];
      const attrStartInText = match.index;

      // Calculate the column where the value starts and ends within the line
      const eqIndex = match[0].indexOf('=');
      const afterEq = match[0].substring(eqIndex + 1).trimStart();
      const valueOffset = match[0].length - afterEq.length;
      const hasQuote = afterEq.startsWith('"') || afterEq.startsWith("'");
      const valueStartCol = baseCol + attrStartInText + valueOffset + (hasQuote ? 1 : 0);
      const valueEndCol = valueStartCol + value.length;

      attrs.push({
        name,
        value,
        valueStartCol,
        valueEndCol,
      });
    }

    return attrs;
  }
}

interface ParsedAttr {
  name: string;
  value: string;
  valueStartCol: number;
  valueEndCol: number;
}
