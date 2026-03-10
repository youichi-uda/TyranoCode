/**
 * Rename provider for TyranoScript .ks files.
 * Supports safe renaming of labels and macros across the entire project.
 */

import * as vscode from 'vscode';
import { Scanner, Token } from '../parser/scanner';
import {
  ProjectIndex,
  ScenarioNode,
} from '../parser/types';

export class TyranoRenameProvider implements vscode.RenameProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<{ range: vscode.Range; placeholder: string }> {
    const info = this.getSymbolAtPosition(document, position);
    if (!info) {
      throw new Error('Cannot rename this element.');
    }
    return { range: info.range, placeholder: info.name };
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.WorkspaceEdit> {
    const info = this.getSymbolAtPosition(document, position);
    if (!info) return undefined;

    const index = this.getIndex();
    if (!index) return undefined;

    const edit = new vscode.WorkspaceEdit();

    if (info.kind === 'label') {
      this.renameLabelDefinitions(info.name, newName, index, edit);
      this.renameLabelReferences(info.name, newName, index, edit);
    } else {
      this.renameMacroDefinition(info.name, newName, index, edit);
      this.renameMacroUsages(info.name, newName, index, edit);
    }

    return edit;
  }

  /**
   * Use the Scanner to determine what symbol is under the cursor.
   */
  private getSymbolAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): { kind: 'label' | 'macro'; name: string; range: vscode.Range } | undefined {
    const index = this.getIndex();
    if (!index) return undefined;

    const source = document.getText();
    const scanner = new Scanner(source);
    const tokens = scanner.scan();

    const token = this.findTokenAtPosition(tokens, position);
    if (!token) return undefined;

    // Case 1: Cursor is on a LABEL token → label rename
    if (token.type === 'LABEL') {
      const range = new vscode.Range(
        new vscode.Position(token.line, token.column + 1), // skip the *
        new vscode.Position(token.line, token.column + 1 + token.value.length),
      );
      return { kind: 'label', name: token.value, range };
    }

    // Case 2: Cursor is on a TAG_NAME
    if (token.type === 'TAG_NAME') {
      // Check if this TAG_NAME is inside a [macro name="..."] definition
      const nextTokens = this.getFollowingTokens(tokens, token);
      if (token.value === 'macro') {
        // This is the 'macro' keyword itself; the renameable part is the name attribute
        const nameAttr = this.findNameAttribute(nextTokens);
        if (nameAttr) {
          return this.makeMacroRenameInfo(nameAttr);
        }
      }

      // Check if this tag name matches a known macro → rename macro usage
      const macroName = token.value.toLowerCase();
      if (index.globalMacros.has(macroName)) {
        const range = new vscode.Range(
          new vscode.Position(token.line, token.column),
          new vscode.Position(token.line, token.column + token.value.length),
        );
        return { kind: 'macro', name: macroName, range };
      }
    }

    // Case 3: Cursor is on an ATTR_VALUE that is a name attribute inside [macro name="..."]
    if (token.type === 'ATTR_VALUE') {
      const context = this.getTagContext(tokens, token);
      if (context?.tagName === 'macro' && context.attrName === 'name') {
        return this.makeMacroRenameInfo(token);
      }
    }

    // Case 4: Cursor is on an ATTR_NAME that is 'name' inside [macro]
    if (token.type === 'ATTR_NAME' && token.value === 'name') {
      const context = this.getTagContext(tokens, token);
      if (context?.tagName === 'macro') {
        // Find the value token that follows
        const valueToken = this.findNextValueToken(tokens, token);
        if (valueToken) {
          return this.makeMacroRenameInfo(valueToken);
        }
      }
    }

    return undefined;
  }

  /**
   * Find the token at the given position.
   */
  private findTokenAtPosition(tokens: Token[], position: vscode.Position): Token | undefined {
    for (const token of tokens) {
      if (token.type === 'EOF' || token.type === 'NEWLINE') continue;

      const tokenStartCol = token.type === 'LABEL' ? token.column : token.column;
      const tokenEndCol = token.type === 'LABEL'
        ? token.column + 1 + token.value.length  // +1 for the * prefix
        : token.column + token.value.length;

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

  /**
   * Get tokens that follow a given token in the stream (same tag context).
   */
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

  /**
   * Find the name="xxx" attribute value token in a list of tokens.
   */
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

  /**
   * Determine the tag context (tag name, attribute name) for a given token.
   */
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

  /**
   * Find the ATTR_VALUE token that follows an ATTR_NAME token (with = in between).
   */
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
    // The valueRange of a quoted attribute includes the quotes in column position
    // but the token value itself is the unquoted content.
    // The scanner emits ATTR_VALUE at the column of the opening quote.
    const startCol = valueToken.column + 1; // skip opening quote
    const range = new vscode.Range(
      new vscode.Position(valueToken.line, startCol),
      new vscode.Position(valueToken.line, startCol + valueToken.value.length),
    );
    return { kind: 'macro', name: valueToken.value.toLowerCase(), range };
  }

  // ── Label renaming ──────────────────────────────────────────────────

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
      // nameRange covers the label name (without the * prefix)
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
        // Check jump/call target attributes
        if (node.name === 'jump' || node.name === 'call') {
          for (const attr of node.attributes) {
            if (attr.name === 'target' && attr.value != null) {
              const targetValue = attr.value.replace(/^\*/, '');
              if (targetValue === oldName && attr.valueRange) {
                // The value may include a leading * — preserve it
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

  // ── Macro renaming ──────────────────────────────────────────────────

  private renameMacroDefinition(
    oldName: string,
    newName: string,
    index: ProjectIndex,
    edit: vscode.WorkspaceEdit,
  ): void {
    const entry = index.globalMacros.get(oldName);
    if (!entry) return;

    const uri = this.resolveUri(entry.file);
    // nameRange covers the macro name inside [macro name="xxx"]
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

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Walk all nodes recursively, including branches of if_block and macro_def bodies.
   */
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
