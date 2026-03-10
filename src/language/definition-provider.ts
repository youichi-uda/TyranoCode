/**
 * Go-to-definition and find-all-references for TyranoScript.
 * Supports labels, macros, and variables.
 */

import * as vscode from 'vscode';
import { ProjectIndex } from '../parser/types';

export class TyranoDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.Definition | undefined {
    const line = document.lineAt(position).text;
    const wordRange = document.getWordRangeAtPosition(position, /[\w_]+/);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);
    const index = this.getIndex();
    if (!index) return undefined;

    // Label target in jump/call
    const targetMatch = line.match(/target\s*=\s*["']?\*?(\w+)/);
    if (targetMatch && targetMatch[1] === word) {
      return this.findLabelDefinition(word, index);
    }

    // Tag name — could be a macro
    const textBefore = line.substring(0, wordRange.start.character);
    const tagOpenIdx = textBefore.lastIndexOf('[');
    const tagCloseIdx = textBefore.lastIndexOf(']');
    if (tagOpenIdx > tagCloseIdx && !/\s/.test(textBefore.substring(tagOpenIdx + 1))) {
      return this.findMacroDefinition(word, index);
    }

    // Label definition (clicking on *label_name)
    if (textBefore.endsWith('*')) {
      return this.findLabelDefinition(word, index);
    }

    return undefined;
  }

  private findLabelDefinition(name: string, index: ProjectIndex): vscode.Location[] | undefined {
    const entries = index.globalLabels.get(name);
    if (!entries || entries.length === 0) return undefined;

    return entries.map(entry => {
      const uri = this.resolveUri(entry.file);
      const pos = new vscode.Position(entry.node.range.start.line, entry.node.range.start.column);
      return new vscode.Location(uri, pos);
    });
  }

  private findMacroDefinition(name: string, index: ProjectIndex): vscode.Location | undefined {
    const entry = index.globalMacros.get(name.toLowerCase());
    if (!entry) return undefined;

    const uri = this.resolveUri(entry.file);
    const pos = new vscode.Position(entry.node.range.start.line, entry.node.range.start.column);
    return new vscode.Location(uri, pos);
  }

  private resolveUri(filePath: string): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    }
    return vscode.Uri.file(filePath);
  }
}

export class TyranoReferenceProvider implements vscode.ReferenceProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    _token: vscode.CancellationToken,
  ): vscode.Location[] | undefined {
    const wordRange = document.getWordRangeAtPosition(position, /[\w_]+/);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);
    const index = this.getIndex();
    if (!index) return undefined;

    const locations: vscode.Location[] = [];

    // Search all scenarios for references to this label/macro/variable
    for (const [file, scenario] of index.scenarios) {
      const uri = this.resolveUri(file);
      this.findReferencesInNodes(scenario.nodes, word, uri, locations);
    }

    return locations.length > 0 ? locations : undefined;
  }

  private findReferencesInNodes(
    nodes: import('../parser/types').ScenarioNode[],
    name: string,
    uri: vscode.Uri,
    locations: vscode.Location[],
  ): void {
    for (const node of nodes) {
      if (node.type === 'tag') {
        // Check if tag name matches (macro usage)
        if (node.name === name.toLowerCase()) {
          locations.push(new vscode.Location(uri, new vscode.Range(
            new vscode.Position(node.nameRange.start.line, node.nameRange.start.column),
            new vscode.Position(node.nameRange.end.line, node.nameRange.end.column),
          )));
        }
        // Check target attributes for label references
        for (const attr of node.attributes) {
          if (attr.name === 'target' && attr.value?.replace(/^\*/, '') === name) {
            const range = attr.valueRange ?? attr.range;
            locations.push(new vscode.Location(uri, new vscode.Range(
              new vscode.Position(range.start.line, range.start.column),
              new vscode.Position(range.end.line, range.end.column),
            )));
          }
        }
      }

      if (node.type === 'if_block') {
        this.findReferencesInNodes(node.thenBranch, name, uri, locations);
        for (const branch of node.elsifBranches) {
          this.findReferencesInNodes(branch.body, name, uri, locations);
        }
        if (node.elseBranch) {
          this.findReferencesInNodes(node.elseBranch, name, uri, locations);
        }
      }

      if (node.type === 'macro_def') {
        this.findReferencesInNodes(node.body, name, uri, locations);
      }
    }
  }

  private resolveUri(filePath: string): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    }
    return vscode.Uri.file(filePath);
  }
}
