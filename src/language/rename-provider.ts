/**
 * Rename provider for TyranoScript .ks files.
 *
 * Free: label and macro renaming across the project.
 * Pro:  variable, character, and storage/file renaming.
 */

import * as vscode from 'vscode';
import { Scanner, Token } from '../parser/scanner';
import {
  ProjectIndex,
  ScenarioNode,
  LABEL_REF_TAGS,
  CHARA_NAME_TAGS,
} from '../parser/types';
import { localize } from './i18n';
import type { LicenseManager } from '../license/license-manager';

type RenameKind = 'label' | 'macro' | 'variable' | 'character' | 'storage';

interface RenameInfo {
  kind: RenameKind;
  name: string;
  range: vscode.Range;
}

/** Map tag names to their asset subdirectories for storage rename. */
const STORAGE_FOLDERS: ReadonlyMap<string, readonly string[]> = new Map([
  ['jump', ['data/scenario']],
  ['call', ['data/scenario']],
  ['bg', ['data/bgimage']],
  ['image', ['data/image', 'data/fgimage']],
  ['chara_new', ['data/fgimage']],
  ['chara_face', ['data/fgimage']],
  ['chara_mod', ['data/fgimage']],
  ['chara_show', ['data/fgimage']],
  ['playbgm', ['data/bgm']],
  ['fadeinbgm', ['data/bgm']],
  ['xchgbgm', ['data/bgm']],
  ['playse', ['data/sound']],
  ['fadeinse', ['data/sound']],
  ['movie', ['data/video']],
  ['bgmovie', ['data/video']],
  ['loadjs', ['data/others']],
  ['loadcss', ['data/others']],
]);

export class TyranoRenameProvider implements vscode.RenameProvider {
  constructor(
    private getIndex: () => ProjectIndex | undefined,
    private licenseManager?: LicenseManager,
  ) {}

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<{ range: vscode.Range; placeholder: string }> {
    const info = this.getSymbolAtPosition(document, position);
    if (!info) {
      throw new Error(localize('Cannot rename this element.', 'この要素の名前は変更できません。'));
    }
    return { range: info.range, placeholder: info.name };
  }

  async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken,
  ): Promise<vscode.WorkspaceEdit | undefined> {
    const info = this.getSymbolAtPosition(document, position);
    if (!info) return undefined;

    const index = this.getIndex();
    if (!index) return undefined;

    // Pro gate for variable, character, storage
    if (info.kind === 'variable' || info.kind === 'character' || info.kind === 'storage') {
      if (this.licenseManager && !(await this.licenseManager.requirePro('refactoring'))) {
        return undefined;
      }
    }

    const edit = new vscode.WorkspaceEdit();

    switch (info.kind) {
      case 'label':
        this.renameLabelDefinitions(info.name, newName, index, edit);
        this.renameLabelReferences(info.name, newName, index, edit);
        break;
      case 'macro':
        this.renameMacroDefinition(info.name, newName, index, edit);
        this.renameMacroUsages(info.name, newName, index, edit);
        break;
      case 'variable':
        this.renameVariable(info.name, newName, index, edit);
        break;
      case 'character':
        this.renameCharacter(info.name, newName, index, edit);
        break;
      case 'storage':
        await this.renameStorage(info.name, newName, index, edit, document, position);
        break;
    }

    return edit;
  }

  // ── Symbol detection ───────────────────────────────────────────

  private getSymbolAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): RenameInfo | undefined {
    const index = this.getIndex();
    if (!index) return undefined;

    const source = document.getText();
    const scanner = new Scanner(source);
    const tokens = scanner.scan();

    const token = this.findTokenAtPosition(tokens, position);
    if (!token) return undefined;

    // ── Label ──
    if (token.type === 'LABEL') {
      const range = new vscode.Range(
        new vscode.Position(token.line, token.column + 1),
        new vscode.Position(token.line, token.column + 1 + token.value.length),
      );
      return { kind: 'label', name: token.value, range };
    }

    // ── TAG_NAME ──
    if (token.type === 'TAG_NAME') {
      const nextTokens = this.getFollowingTokens(tokens, token);

      // [macro name="xxx"] — rename the macro name
      if (token.value === 'macro') {
        const nameAttr = this.findNameAttribute(nextTokens);
        if (nameAttr) return this.makeMacroRenameInfo(nameAttr);
      }

      // Tag name matches a known macro → rename macro usage
      const macroName = token.value.toLowerCase();
      if (index.globalMacros.has(macroName)) {
        const range = new vscode.Range(
          new vscode.Position(token.line, token.column),
          new vscode.Position(token.line, token.column + token.value.length),
        );
        return { kind: 'macro', name: macroName, range };
      }
    }

    // ── ATTR_VALUE ──
    if (token.type === 'ATTR_VALUE') {
      const context = this.getTagContext(tokens, token);

      // [macro name="xxx"]
      if (context?.tagName === 'macro' && context.attrName === 'name') {
        return this.makeMacroRenameInfo(token);
      }

      // Variable in exp/cond: f.xxx, sf.xxx, tf.xxx
      if (context && (context.attrName === 'exp' || context.attrName === 'cond')) {
        const varInfo = this.findVariableAtCursor(token, position);
        if (varInfo) return varInfo;
      }

      // Character name in chara_* tags
      if (context && CHARA_NAME_TAGS.has(context.tagName) && context.attrName === 'name') {
        if (!token.value.startsWith('&')) {
          const startCol = token.column + 1;
          const range = new vscode.Range(
            new vscode.Position(token.line, startCol),
            new vscode.Position(token.line, startCol + token.value.length),
          );
          return { kind: 'character', name: token.value, range };
        }
      }

      // Storage reference
      if (context && (context.attrName === 'storage' || context.attrName === 'file')) {
        if (!token.value.startsWith('&')) {
          const startCol = token.column + 1;
          const range = new vscode.Range(
            new vscode.Position(token.line, startCol),
            new vscode.Position(token.line, startCol + token.value.length),
          );
          return { kind: 'storage', name: token.value, range };
        }
      }
    }

    // ── ATTR_NAME 'name' inside [macro] ──
    if (token.type === 'ATTR_NAME' && token.value === 'name') {
      const context = this.getTagContext(tokens, token);
      if (context?.tagName === 'macro') {
        const valueToken = this.findNextValueToken(tokens, token);
        if (valueToken) return this.makeMacroRenameInfo(valueToken);
      }
    }

    return undefined;
  }

  /**
   * Find a variable (f.xxx / sf.xxx / tf.xxx) at the cursor position
   * within an ATTR_VALUE token (exp="..." or cond="...").
   */
  private findVariableAtCursor(token: Token, position: vscode.Position): RenameInfo | undefined {
    const value = token.value;
    const valueStartCol = token.column + 1; // skip opening quote
    const cursorOffsetInValue = position.character - valueStartCol;

    const regex = /(f|sf|tf)\.(\w+)/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;

      if (cursorOffsetInValue >= matchStart && cursorOffsetInValue <= matchEnd) {
        const range = new vscode.Range(
          new vscode.Position(token.line, valueStartCol + matchStart),
          new vscode.Position(token.line, valueStartCol + matchEnd),
        );
        return { kind: 'variable', name: match[0], range };
      }
    }

    return undefined;
  }

  // ── Variable rename ────────────────────────────────────────────

  private renameVariable(
    oldFullName: string,
    newInput: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
  ): void {
    // Parse old name
    const dotIndex = oldFullName.indexOf('.');
    const oldScope = oldFullName.substring(0, dotIndex);
    const oldName = oldFullName.substring(dotIndex + 1);

    // Parse new name: user may input "f.total" or just "total"
    let newScope = oldScope;
    let newName = newInput;
    const newDotIndex = newInput.indexOf('.');
    if (newDotIndex !== -1) {
      newScope = newInput.substring(0, newDotIndex);
      newName = newInput.substring(newDotIndex + 1);
    }
    const newFullName = `${newScope}.${newName}`;

    const entries = index.variables.get(oldFullName);
    if (!entries) return;

    for (const entry of entries) {
      if (!entry.varRange) continue;
      const uri = this.resolveUri(entry.file);
      const range = this.toVscodeRange(entry.varRange);
      edit.replace(uri, range, newFullName);
    }
  }

  // ── Character rename ───────────────────────────────────────────

  private renameCharacter(
    oldName: string,
    newName: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
  ): void {
    const key = oldName.toLowerCase();
    const entries = index.characters.get(key);
    if (entries) {
      for (const entry of entries) {
        const uri = this.resolveUri(entry.file);
        const range = this.toVscodeRange(entry.nameRange);
        edit.replace(uri, range, newName);
      }
    }

    // Also rename #speaker tags
    for (const [file, scenario] of index.scenarios) {
      const uri = this.resolveUri(file);
      this.walkNodes(scenario.nodes, (node) => {
        if (node.type !== 'tag') return;
        // Speaker tag: #charname (parsed as tag with name starting with special char or as-is)
        if (node.name === oldName || node.name === oldName.toLowerCase()) {
          // Check if this is actually a #speaker tag (name matches and not a chara_ tag)
          if (!CHARA_NAME_TAGS.has(node.name) && !LABEL_REF_TAGS.has(node.name)) {
            // Likely a custom macro or speaker — skip if it's a known macro
            if (!index.globalMacros.has(node.name)) {
              const range = this.toVscodeRange(node.nameRange);
              edit.replace(uri, range, newName);
            }
          }
        }
      });
    }
  }

  // ── Storage rename ─────────────────────────────────────────────

  private async renameStorage(
    oldName: string,
    newName: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<void> {
    // Update all storage/file references across the project
    for (const [file, scenario] of index.scenarios) {
      const uri = this.resolveUri(file);
      this.walkNodes(scenario.nodes, (node) => {
        if (node.type !== 'tag') return;
        for (const attr of node.attributes) {
          if ((attr.name === 'storage' || attr.name === 'file') && attr.value && attr.valueRange) {
            if (attr.value === oldName || attr.value.toLowerCase() === oldName.toLowerCase()) {
              const range = this.toVscodeRange(attr.valueRange);
              edit.replace(uri, range, newName);
            }
          }
        }
      });
    }

    // Try to rename the physical file
    await this.renamePhysicalFile(oldName, newName, edit, document, position);
  }

  /**
   * Attempt to rename the physical file on disk.
   * Uses the tag context to determine which directory the file lives in.
   */
  private async renamePhysicalFile(
    oldName: string,
    newName: string,
    edit: vscode.WorkspaceEdit,
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    // Find the tag at cursor to determine the directory
    const source = document.getText();
    const scanner = new Scanner(source);
    const tokens = scanner.scan();
    const token = this.findTokenAtPosition(tokens, position);
    if (!token) return;

    const context = this.getTagContext(tokens, token);
    if (!context) return;

    const folders = STORAGE_FOLDERS.get(context.tagName);
    if (!folders) return;

    // Preserve extension if not provided in newName
    const oldExt = oldName.includes('.') ? oldName.substring(oldName.lastIndexOf('.')) : '';
    const newHasExt = newName.includes('.');
    const actualNewName = newHasExt ? newName : newName + oldExt;

    // Search each candidate folder for the old file
    for (const folder of folders) {
      const oldUri = vscode.Uri.joinPath(workspaceFolder.uri, folder, oldName);
      const newUri = vscode.Uri.joinPath(workspaceFolder.uri, folder, actualNewName);
      try {
        await vscode.workspace.fs.stat(oldUri);
        // File exists — add file rename to the workspace edit
        edit.renameFile(oldUri, newUri);
        return;
      } catch {
        // File not found in this folder, try next
      }
    }
  }

  // ── Label rename (free) ────────────────────────────────────────

  private renameLabelDefinitions(
    oldName: string,
    newName: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
  ): void {
    const entries = index.globalLabels.get(oldName);
    if (!entries) return;

    for (const entry of entries) {
      const uri = this.resolveUri(entry.file);
      const range = this.toVscodeRange(entry.node.nameRange);
      edit.replace(uri, range, newName);
    }
  }

  private renameLabelReferences(
    oldName: string,
    newName: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
  ): void {
    for (const [file, scenario] of index.scenarios) {
      const uri = this.resolveUri(file);
      this.walkNodes(scenario.nodes, (node) => {
        if (node.type !== 'tag') return;
        if (LABEL_REF_TAGS.has(node.name)) {
          for (const attr of node.attributes) {
            if (attr.name === 'target' && attr.value != null) {
              const targetValue = attr.value.replace(/^\*/, '');
              if (targetValue === oldName && attr.valueRange) {
                const hasAsterisk = attr.value.startsWith('*');
                const replacementText = hasAsterisk ? `*${newName}` : newName;
                const range = this.toVscodeRange(attr.valueRange);
                edit.replace(uri, range, replacementText);
              }
            }
          }
        }
      });
    }
  }

  // ── Macro rename (free) ────────────────────────────────────────

  private renameMacroDefinition(
    oldName: string,
    newName: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
  ): void {
    const entry = index.globalMacros.get(oldName);
    if (!entry) return;

    const uri = this.resolveUri(entry.file);
    const range = this.toVscodeRange(entry.node.nameRange);
    edit.replace(uri, range, newName);
  }

  private renameMacroUsages(
    oldName: string,
    newName: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
  ): void {
    for (const [file, scenario] of index.scenarios) {
      const uri = this.resolveUri(file);
      this.walkNodes(scenario.nodes, (node) => {
        if (node.type !== 'tag') return;
        if (node.name === oldName) {
          const range = this.toVscodeRange(node.nameRange);
          edit.replace(uri, range, newName);
        }
      });
    }
  }

  // ── Token helpers ──────────────────────────────────────────────

  private findTokenAtPosition(tokens: Token[], position: vscode.Position): Token | undefined {
    for (const token of tokens) {
      if (token.type === 'EOF' || token.type === 'NEWLINE') continue;

      const tokenStartCol = token.column;
      let tokenEndCol: number;
      if (token.type === 'LABEL') {
        tokenEndCol = token.column + 1 + token.value.length;
      } else if (token.type === 'ATTR_VALUE') {
        tokenEndCol = token.column + token.value.length + 2;
      } else {
        tokenEndCol = token.column + token.value.length;
      }

      if (
        token.line === position.line &&
        position.character >= tokenStartCol &&
        position.character <= tokenEndCol
      ) {
        return token;
      }
    }
    return undefined;
  }

  private getFollowingTokens(tokens: Token[], after: Token): Token[] {
    const result: Token[] = [];
    let found = false;
    for (const t of tokens) {
      if (found) {
        if (t.type === 'TAG_CLOSE' || t.type === 'NEWLINE' || t.type === 'EOF') break;
        result.push(t);
      }
      if (t === after) found = true;
    }
    return result;
  }

  private findNameAttribute(tokens: Token[]): Token | undefined {
    for (let i = 0; i < tokens.length; i++) {
      if (
        tokens[i].type === 'ATTR_NAME' &&
        tokens[i].value === 'name' &&
        i + 2 < tokens.length &&
        tokens[i + 1].type === 'ATTR_EQUALS' &&
        tokens[i + 2].type === 'ATTR_VALUE'
      ) {
        return tokens[i + 2];
      }
    }
    return undefined;
  }

  private getTagContext(
    tokens: Token[],
    target: Token,
  ): { tagName: string; attrName: string | undefined } | undefined {
    let tagName: string | undefined;
    let lastAttrName: string | undefined;

    for (const t of tokens) {
      if (t === target) {
        return tagName ? { tagName, attrName: lastAttrName } : undefined;
      }
      if (t.type === 'TAG_NAME') {
        tagName = t.value;
        lastAttrName = undefined;
      }
      if (t.type === 'TAG_OPEN') {
        tagName = undefined;
        lastAttrName = undefined;
      }
      if (t.type === 'TAG_CLOSE') {
        tagName = undefined;
        lastAttrName = undefined;
      }
      if (t.type === 'ATTR_NAME') {
        lastAttrName = t.value;
      }
    }
    return undefined;
  }

  private findNextValueToken(tokens: Token[], attrNameToken: Token): Token | undefined {
    let found = false;
    for (const t of tokens) {
      if (found) {
        if (t.type === 'ATTR_EQUALS') continue;
        if (t.type === 'ATTR_VALUE') return t;
        return undefined;
      }
      if (t === attrNameToken) found = true;
    }
    return undefined;
  }

  private makeMacroRenameInfo(
    valueToken: Token,
  ): { kind: 'macro'; name: string; range: vscode.Range } {
    const startCol = valueToken.column + 1;
    const range = new vscode.Range(
      new vscode.Position(valueToken.line, startCol),
      new vscode.Position(valueToken.line, startCol + valueToken.value.length),
    );
    return { kind: 'macro', name: valueToken.value.toLowerCase(), range };
  }

  // ── Shared helpers ─────────────────────────────────────────────

  private walkNodes(nodes: ScenarioNode[], visitor: (node: ScenarioNode) => void): void {
    for (const node of nodes) {
      visitor(node);

      if (node.type === 'if_block') {
        this.walkNodes(node.thenBranch, visitor);
        for (const branch of node.elsifBranches) {
          this.walkNodes(branch.body, visitor);
        }
        if (node.elseBranch) {
          this.walkNodes(node.elseBranch, visitor);
        }
      }

      if (node.type === 'macro_def') {
        this.walkNodes(node.body, visitor);
      }
    }
  }

  private toVscodeRange(range: import('../parser/types').Range): vscode.Range {
    return new vscode.Range(
      new vscode.Position(range.start.line, range.start.column),
      new vscode.Position(range.end.line, range.end.column),
    );
  }

  private resolveUri(filePath: string): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    }
    return vscode.Uri.file(filePath);
  }
}
