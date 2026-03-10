/**
 * CodeLens provider for TyranoScript .ks files.
 * Shows reference counts above label and macro definitions.
 */

import * as vscode from 'vscode';
import {
  ProjectIndex,
  ScenarioNode,
  Range as AstRange,
} from '../parser/types';

/**
 * Convert a 0-based AST Range to a VS Code Range.
 */
function toVscodeRange(r: AstRange): vscode.Range {
  return new vscode.Range(
    new vscode.Position(r.start.line, r.start.column),
    new vscode.Position(r.end.line, r.end.column),
  );
}

/**
 * Counts references to a label across all scenarios in the project index.
 * A reference is a TagNode named 'jump' or 'call' whose target attribute
 * matches the given label name (with or without the leading '*').
 */
function countLabelReferences(labelName: string, index: ProjectIndex): number {
  let count = 0;
  for (const [, scenario] of index.scenarios) {
    count += countLabelRefsInNodes(scenario.nodes, labelName);
  }
  return count;
}

function countLabelRefsInNodes(nodes: ScenarioNode[], labelName: string): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'tag') {
      if (node.name === 'jump' || node.name === 'call') {
        for (const attr of node.attributes) {
          if (attr.name === 'target' && attr.value?.replace(/^\*/, '') === labelName) {
            count++;
          }
        }
      }
    } else if (node.type === 'if_block') {
      count += countLabelRefsInNodes(node.thenBranch, labelName);
      for (const branch of node.elsifBranches) {
        count += countLabelRefsInNodes(branch.body, labelName);
      }
      if (node.elseBranch) {
        count += countLabelRefsInNodes(node.elseBranch, labelName);
      }
    } else if (node.type === 'macro_def') {
      count += countLabelRefsInNodes(node.body, labelName);
    }
  }
  return count;
}

/**
 * Counts references to a macro across all scenarios in the project index.
 * A reference is any TagNode whose name matches the macro name.
 */
function countMacroReferences(macroName: string, index: ProjectIndex): number {
  const lowerName = macroName.toLowerCase();
  let count = 0;
  for (const [, scenario] of index.scenarios) {
    count += countMacroRefsInNodes(scenario.nodes, lowerName);
  }
  return count;
}

function countMacroRefsInNodes(nodes: ScenarioNode[], lowerName: string): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'tag') {
      if (node.name === lowerName) {
        count++;
      }
    } else if (node.type === 'if_block') {
      count += countMacroRefsInNodes(node.thenBranch, lowerName);
      for (const branch of node.elsifBranches) {
        count += countMacroRefsInNodes(branch.body, lowerName);
      }
      if (node.elseBranch) {
        count += countMacroRefsInNodes(node.elseBranch, lowerName);
      }
    } else if (node.type === 'macro_def') {
      count += countMacroRefsInNodes(node.body, lowerName);
    }
  }
  return count;
}

/**
 * Provides CodeLens annotations for TyranoScript .ks files, showing
 * reference counts above label definitions (`*label`) and macro
 * definitions (`[macro name="xxx"]`).
 */
export class TyranoCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private getIndex: () => ProjectIndex | undefined) {}

  /**
   * Signal that code lenses should be recomputed (e.g. after re-indexing).
   */
  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    const index = this.getIndex();
    if (!index) return [];

    const filePath = document.uri.fsPath;
    const lenses: vscode.CodeLens[] = [];

    // Find labels defined in this file
    for (const [name, entries] of index.globalLabels) {
      for (const entry of entries) {
        if (!this.isSameFile(entry.file, filePath)) continue;
        const refCount = countLabelReferences(name, index);
        const range = toVscodeRange(entry.node.range);
        const nameRange = toVscodeRange(entry.node.nameRange);
        const title = refCount === 1 ? '1 reference' : `${refCount} references`;

        lenses.push(new vscode.CodeLens(range, {
          title,
          command: 'editor.action.goToReferences',
          arguments: [document.uri, nameRange.start],
        }));
      }
    }

    // Find macros defined in this file
    for (const [name, entry] of index.globalMacros) {
      if (!this.isSameFile(entry.file, filePath)) continue;
      const refCount = countMacroReferences(name, index);
      const range = toVscodeRange(entry.node.range);
      const nameRange = toVscodeRange(entry.node.nameRange);
      const title = refCount === 1 ? '1 reference' : `${refCount} references`;

      lenses.push(new vscode.CodeLens(range, {
        title,
        command: 'editor.action.goToReferences',
        arguments: [document.uri, nameRange.start],
      }));
    }

    return lenses;
  }

  /**
   * Check whether an index file path corresponds to the given absolute fsPath.
   * The index may store relative paths, so we resolve against workspace root.
   */
  private isSameFile(indexPath: string, fsPath: string): boolean {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const resolved = vscode.Uri.joinPath(workspaceFolder.uri, indexPath).fsPath;
      return resolved === fsPath;
    }
    return indexPath === fsPath;
  }
}
