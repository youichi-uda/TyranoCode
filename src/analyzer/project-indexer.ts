/**
 * Project-wide indexer.
 * Scans all .ks files and builds a global index of labels, macros, variables, and resources.
 */

import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import {
  ProjectIndex,
  ParsedScenario,
  ScenarioNode,
  TagNode,
  IfBlockNode,
  MacroDefNode,
  VariableInfo,
  CharacterInfo,
  LabelNode,
  CHARA_NAME_TAGS,
  Range as AstRange,
  Position as AstPosition,
} from '../parser/types';

export class ProjectIndexer {
  private index: ProjectIndex;
  private parser: Parser;
  private _onDidUpdate = new vscode.EventEmitter<ProjectIndex>();

  readonly onDidUpdate = this._onDidUpdate.event;

  constructor() {
    this.index = this.createEmptyIndex();
    this.parser = new Parser('');
  }

  getIndex(): ProjectIndex {
    return this.index;
  }

  /**
   * Full re-index of all .ks files in the workspace.
   */
  async indexWorkspace(): Promise<void> {
    this.index = this.createEmptyIndex();

    const files = await vscode.workspace.findFiles('**/*.ks', '**/node_modules/**');

    for (const file of files) {
      try {
        const doc = await vscode.workspace.openTextDocument(file);
        this.indexDocument(doc);
      } catch {
        // Skip files that can't be opened
      }
    }

    this._onDidUpdate.fire(this.index);
  }

  /**
   * Index or re-index a single document.
   */
  indexDocument(document: vscode.TextDocument): ParsedScenario {
    const fileName = vscode.workspace.asRelativePath(document.uri);
    this.parser = new Parser(fileName);
    const parsed = this.parser.parse(document.getText());

    // Remove old entries for this file
    this.removeFileFromIndex(fileName);

    // Add to scenarios
    this.index.scenarios.set(fileName, parsed);

    // Index labels
    for (const [name, node] of parsed.labels) {
      const entries = this.index.globalLabels.get(name) ?? [];
      entries.push({ file: fileName, node });
      this.index.globalLabels.set(name, entries);
    }

    // Index macros
    for (const [name, node] of parsed.macros) {
      this.index.globalMacros.set(name, { file: fileName, node });
    }

    // Index variables and characters
    this.extractVariables(parsed.nodes, fileName);
    this.extractCharacters(parsed.nodes, fileName);

    this._onDidUpdate.fire(this.index);
    return parsed;
  }

  /**
   * Remove a file from the index.
   */
  removeFile(fileName: string): void {
    this.removeFileFromIndex(fileName);
    this._onDidUpdate.fire(this.index);
  }

  private removeFileFromIndex(fileName: string): void {
    this.index.scenarios.delete(fileName);

    // Clean labels
    for (const [name, entries] of this.index.globalLabels) {
      const filtered = entries.filter(e => e.file !== fileName);
      if (filtered.length === 0) {
        this.index.globalLabels.delete(name);
      } else {
        this.index.globalLabels.set(name, filtered);
      }
    }

    // Clean macros
    for (const [name, entry] of this.index.globalMacros) {
      if (entry.file === fileName) {
        this.index.globalMacros.delete(name);
      }
    }

    // Clean variables
    for (const [name, entries] of this.index.variables) {
      const filtered = entries.filter(e => e.file !== fileName);
      if (filtered.length === 0) {
        this.index.variables.delete(name);
      } else {
        this.index.variables.set(name, filtered);
      }
    }

    // Clean characters
    for (const [name, entries] of this.index.characters) {
      const filtered = entries.filter(e => e.file !== fileName);
      if (filtered.length === 0) {
        this.index.characters.delete(name);
      } else {
        this.index.characters.set(name, filtered);
      }
    }
  }

  private extractVariables(nodes: ScenarioNode[], file: string): void {
    for (const node of nodes) {
      this.extractVariablesFromNode(node, file);
    }
  }

  private extractVariablesFromNode(node: ScenarioNode, file: string): void {
    switch (node.type) {
      case 'tag':
        this.extractVariablesFromTag(node, file);
        break;
      case 'if_block':
        this.extractVariablesFromExpression(node.condition, file, node.range);
        this.extractVariables(node.thenBranch, file);
        for (const branch of node.elsifBranches) {
          this.extractVariablesFromExpression(branch.condition, file, node.range);
          this.extractVariables(branch.body, file);
        }
        if (node.elseBranch) {
          this.extractVariables(node.elseBranch, file);
        }
        break;
      case 'macro_def':
        this.extractVariables(node.body, file);
        break;
      case 'iscript':
        this.extractVariablesFromExpression(node.scriptContent, file, node.scriptRange);
        break;
    }
  }

  private extractVariablesFromTag(node: TagNode, file: string): void {
    for (const attr of node.attributes) {
      if (!attr.value) continue;

      // Use valueRange for precise positioning; fall back to attr.range
      const exprRange = attr.valueRange ?? attr.range;

      // Check for variable writes in [eval]
      if (node.name === 'eval' && attr.name === 'exp') {
        // Pattern: f.var = value or sf.var = value
        const writeMatch = attr.value.match(/^(f|sf|tf)\.(\w+)\s*=/);
        if (writeMatch) {
          const varRange = this.computeVarRange(attr.value, writeMatch.index!, writeMatch[0].length - (writeMatch[0].length - writeMatch[0].trimEnd().length), exprRange);
          this.addVariable(writeMatch[1] as 'f' | 'sf' | 'tf', writeMatch[2], file, attr.range, 'write', varRange);
        }
      }

      // Check for variable reads in expressions
      if (attr.name === 'exp' || attr.name === 'cond') {
        this.extractVariablesFromExpression(attr.value, file, exprRange);
      }
    }
  }

  private extractVariablesFromExpression(
    expr: string,
    file: string,
    range: import('../parser/types').Range,
  ): void {
    const regex = /(f|sf|tf)\.(\w+)/g;
    let match;
    while ((match = regex.exec(expr)) !== null) {
      const scope = match[1] as 'f' | 'sf' | 'tf';
      const name = match[2];
      // Simple heuristic: if followed by = (but not == or !=), it's a write
      const afterMatch = expr.substring(match.index + match[0].length);
      const isWrite = /^\s*=[^=]/.test(afterMatch);
      const varRange = this.computeVarRange(expr, match.index, match[0].length, range);
      this.addVariable(scope, name, file, range, isWrite ? 'write' : 'read', varRange);
    }
  }

  /**
   * Compute the precise line/column range of a regex match within an expression,
   * given the expression's containing range (which may be an attribute valueRange or scriptRange).
   */
  private computeVarRange(
    expr: string,
    matchOffset: number,
    matchLength: number,
    containerRange: AstRange,
  ): AstRange {
    // Walk through the expression text to compute line/column at matchOffset
    let line = containerRange.start.line;
    let col = containerRange.start.column;

    for (let i = 0; i < matchOffset; i++) {
      if (expr[i] === '\n') {
        line++;
        col = 0;
      } else {
        col++;
      }
    }

    const startPos: AstPosition = { line, column: col };

    // Walk the match itself for the end position
    for (let i = 0; i < matchLength; i++) {
      if (expr[matchOffset + i] === '\n') {
        line++;
        col = 0;
      } else {
        col++;
      }
    }

    const endPos: AstPosition = { line, column: col };
    return { start: startPos, end: endPos };
  }

  private addVariable(
    scope: 'f' | 'sf' | 'tf',
    name: string,
    file: string,
    range: import('../parser/types').Range,
    usage: 'read' | 'write',
    varRange?: AstRange,
  ): void {
    const fullName = `${scope}.${name}`;
    const entries = this.index.variables.get(fullName) ?? [];
    entries.push({ scope, name, file, range, usage, varRange });
    this.index.variables.set(fullName, entries);
  }

  // ── Character indexing ──────────────────────────────────────────

  private extractCharacters(nodes: ScenarioNode[], file: string): void {
    for (const node of nodes) {
      this.extractCharactersFromNode(node, file);
    }
  }

  private extractCharactersFromNode(node: ScenarioNode, file: string): void {
    switch (node.type) {
      case 'tag':
        if (CHARA_NAME_TAGS.has(node.name)) {
          for (const attr of node.attributes) {
            if (attr.name === 'name' && attr.value && attr.valueRange) {
              this.addCharacter(attr.value, file, attr.valueRange, node.name);
            }
          }
        }
        break;
      case 'if_block':
        this.extractCharacters(node.thenBranch, file);
        for (const branch of node.elsifBranches) {
          this.extractCharacters(branch.body, file);
        }
        if (node.elseBranch) {
          this.extractCharacters(node.elseBranch, file);
        }
        break;
      case 'macro_def':
        this.extractCharacters(node.body, file);
        break;
    }
  }

  private addCharacter(name: string, file: string, nameRange: AstRange, tagName: string): void {
    // Skip dynamic values like &mp.name
    if (name.startsWith('&')) return;
    const key = name.toLowerCase();
    const entries = this.index.characters.get(key) ?? [];
    entries.push({ name, file, nameRange, tagName });
    this.index.characters.set(key, entries);
  }

  private createEmptyIndex(): ProjectIndex {
    return {
      scenarios: new Map(),
      globalLabels: new Map(),
      globalMacros: new Map(),
      variables: new Map(),
      characters: new Map(),
    };
  }

  dispose(): void {
    this._onDidUpdate.dispose();
  }
}
