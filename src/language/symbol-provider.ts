/**
 * Document symbol and workspace symbol providers for TyranoScript .ks files.
 * Exposes labels, macros, iscript blocks, if-blocks, and important tags
 * in the VS Code outline view and symbol search.
 */

import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import {
  ScenarioNode,
  ProjectIndex,
  Range as AstRange,
} from '../parser/types';

/** Tags considered important enough to surface as symbols. */
const IMPORTANT_TAGS = new Set([
  'jump',
  'call',
  'bg',
  'chara_show',
  'chara_new',
]);

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
 * Provides document symbols (outline) for a single TyranoScript file.
 */
export class TyranoDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  // getIndex is injected for consistency with other providers and future use.
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.DocumentSymbol[] {
    const parser = new Parser(document.uri.fsPath);
    const parsed = parser.parse(document.getText());
    return this.buildSymbols(parsed.nodes);
  }

  private buildSymbols(nodes: ScenarioNode[]): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];

    for (const node of nodes) {
      switch (node.type) {
        case 'label': {
          const range = toVscodeRange(node.range);
          const selectionRange = toVscodeRange(node.nameRange);
          const sym = new vscode.DocumentSymbol(
            `*${node.name}`,
            '',
            vscode.SymbolKind.Key,
            range,
            selectionRange,
          );
          symbols.push(sym);
          break;
        }

        case 'macro_def': {
          const range = toVscodeRange(node.range);
          const selectionRange = toVscodeRange(node.nameRange);
          const sym = new vscode.DocumentSymbol(
            node.name,
            'macro',
            vscode.SymbolKind.Function,
            range,
            selectionRange,
          );
          sym.children = this.buildSymbols(node.body);
          symbols.push(sym);
          break;
        }

        case 'iscript': {
          const range = toVscodeRange(node.range);
          const selectionRange = toVscodeRange(node.scriptRange);
          const sym = new vscode.DocumentSymbol(
            '[iscript]',
            '',
            vscode.SymbolKind.Event,
            range,
            selectionRange,
          );
          symbols.push(sym);
          break;
        }

        case 'if_block': {
          const range = toVscodeRange(node.range);
          // Selection range covers the start of the if-block
          const selectionRange = new vscode.Range(
            range.start,
            range.start.translate(0, `[if]`.length),
          );
          const sym = new vscode.DocumentSymbol(
            '[if]',
            node.condition,
            vscode.SymbolKind.Struct,
            range,
            selectionRange,
          );

          const children: vscode.DocumentSymbol[] = [];
          children.push(...this.buildSymbols(node.thenBranch));
          for (const branch of node.elsifBranches) {
            children.push(...this.buildSymbols(branch.body));
          }
          if (node.elseBranch) {
            children.push(...this.buildSymbols(node.elseBranch));
          }
          sym.children = children;
          symbols.push(sym);
          break;
        }

        case 'tag': {
          if (!IMPORTANT_TAGS.has(node.name)) break;

          const range = toVscodeRange(node.range);
          const selectionRange = toVscodeRange(node.nameRange);

          // Build a concise detail string from key attributes
          const detail = node.attributes
            .map(a => a.value !== undefined ? `${a.name}=${a.value}` : a.name)
            .join(' ');

          const sym = new vscode.DocumentSymbol(
            `[${node.name}]`,
            detail,
            vscode.SymbolKind.Property,
            range,
            selectionRange,
          );
          symbols.push(sym);
          break;
        }

        // text, comment, html, ignore_block are not surfaced as symbols
        default:
          break;
      }
    }

    return symbols;
  }
}

/**
 * Provides workspace-wide symbol search across all indexed TyranoScript files.
 * Returns labels and macros matching the query string.
 */
export class TyranoWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideWorkspaceSymbols(
    query: string,
    _token: vscode.CancellationToken,
  ): vscode.SymbolInformation[] {
    const index = this.getIndex();
    if (!index) return [];

    const lowerQuery = query.toLowerCase();
    const results: vscode.SymbolInformation[] = [];

    // Search labels
    for (const [name, entries] of index.globalLabels) {
      if (!this.matches(name, lowerQuery)) continue;
      for (const entry of entries) {
        const uri = this.resolveUri(entry.file);
        const location = new vscode.Location(uri, toVscodeRange(entry.node.range));
        results.push(new vscode.SymbolInformation(
          `*${name}`,
          vscode.SymbolKind.Key,
          entry.file,
          location,
        ));
      }
    }

    // Search macros
    for (const [name, entry] of index.globalMacros) {
      if (!this.matches(name, lowerQuery)) continue;
      const uri = this.resolveUri(entry.file);
      const location = new vscode.Location(uri, toVscodeRange(entry.node.range));
      results.push(new vscode.SymbolInformation(
        name,
        vscode.SymbolKind.Function,
        entry.file,
        location,
      ));
    }

    return results;
  }

  /**
   * Case-insensitive substring match. An empty query matches everything.
   */
  private matches(name: string, lowerQuery: string): boolean {
    return lowerQuery.length === 0 || name.toLowerCase().includes(lowerQuery);
  }

  private resolveUri(filePath: string): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    }
    return vscode.Uri.file(filePath);
  }
}
