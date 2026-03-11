/**
 * CodeLens provider for TyranoScript .ks files.
 * Shows reference counts above label and macro definitions.
 */

import * as vscode from 'vscode';
import {
  ProjectIndex,
  ScenarioNode,
  TagNode,
  Range as AstRange,
  LABEL_REF_TAGS,
} from '../parser/types';
import { localize } from './i18n';

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
 * A reference is a TagNode in LABEL_REF_TAGS whose target attribute
 * matches the given label name (with or without the leading '*').
 */
function collectLabelReferenceLocations(
  labelName: string,
  index: ProjectIndex,
  resolveUri: (file: string) => vscode.Uri,
): vscode.Location[] {
  const locations: vscode.Location[] = [];
  for (const [file, scenario] of index.scenarios) {
    const uri = resolveUri(file);
    collectLabelRefsInNodes(scenario.nodes, labelName, uri, locations);
  }
  return locations;
}

function collectLabelRefsInNodes(
  nodes: ScenarioNode[],
  labelName: string,
  uri: vscode.Uri,
  locations: vscode.Location[],
): void {
  for (const node of nodes) {
    if (node.type === 'tag') {
      if (LABEL_REF_TAGS.has(node.name)) {
        for (const attr of node.attributes) {
          if (attr.name === 'target' && attr.value?.replace(/^\*/, '') === labelName) {
            const range = attr.valueRange ?? attr.range;
            locations.push(new vscode.Location(uri, toVscodeRange(range)));
          }
        }
      }
    } else if (node.type === 'if_block') {
      collectLabelRefsInNodes(node.thenBranch, labelName, uri, locations);
      for (const branch of node.elsifBranches) {
        collectLabelRefsInNodes(branch.body, labelName, uri, locations);
      }
      if (node.elseBranch) {
        collectLabelRefsInNodes(node.elseBranch, labelName, uri, locations);
      }
    } else if (node.type === 'macro_def') {
      collectLabelRefsInNodes(node.body, labelName, uri, locations);
    }
  }
}

/**
 * Counts references to a macro across all scenarios in the project index.
 * A reference is any TagNode whose name matches the macro name.
 */
function collectMacroReferenceLocations(
  macroName: string,
  index: ProjectIndex,
  resolveUri: (file: string) => vscode.Uri,
): vscode.Location[] {
  const lowerName = macroName.toLowerCase();
  const locations: vscode.Location[] = [];
  for (const [file, scenario] of index.scenarios) {
    const uri = resolveUri(file);
    collectMacroRefsInNodes(scenario.nodes, lowerName, uri, locations);
  }
  return locations;
}

function collectMacroRefsInNodes(
  nodes: ScenarioNode[],
  lowerName: string,
  uri: vscode.Uri,
  locations: vscode.Location[],
): void {
  for (const node of nodes) {
    if (node.type === 'tag') {
      if (node.name === lowerName) {
        locations.push(new vscode.Location(uri, toVscodeRange(node.nameRange)));
      }
    } else if (node.type === 'if_block') {
      collectMacroRefsInNodes(node.thenBranch, lowerName, uri, locations);
      for (const branch of node.elsifBranches) {
        collectMacroRefsInNodes(branch.body, lowerName, uri, locations);
      }
      if (node.elseBranch) {
        collectMacroRefsInNodes(node.elseBranch, lowerName, uri, locations);
      }
    } else if (node.type === 'macro_def') {
      collectMacroRefsInNodes(node.body, lowerName, uri, locations);
    }
  }
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
        const refLocations = collectLabelReferenceLocations(name, index, f => this.resolveUri(f));
        const range = toVscodeRange(entry.node.range);
        const nameRange = toVscodeRange(entry.node.nameRange);
        const refCount = refLocations.length;
        const title = refCount === 1
          ? localize('1 reference', '1 参照')
          : localize(`${refCount} references`, `${refCount} 参照`);

        lenses.push(new vscode.CodeLens(range, {
          title,
          command: 'editor.action.showReferences',
          arguments: [document.uri, nameRange.start, refLocations],
        }));
      }
    }

    // Find macros defined in this file
    for (const [name, entry] of index.globalMacros) {
      if (!this.isSameFile(entry.file, filePath)) continue;
      const refLocations = collectMacroReferenceLocations(name, index, f => this.resolveUri(f));
      const range = toVscodeRange(entry.node.range);
      const nameRange = toVscodeRange(entry.node.nameRange);
      const refCount = refLocations.length;
      const title = refCount === 1
        ? localize('1 reference', '1 参照')
        : localize(`${refCount} references`, `${refCount} 参照`);

      lenses.push(new vscode.CodeLens(range, {
        title,
        command: 'editor.action.showReferences',
        arguments: [document.uri, nameRange.start, refLocations],
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

  private resolveUri(filePath: string): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    }
    return vscode.Uri.file(filePath);
  }
}
