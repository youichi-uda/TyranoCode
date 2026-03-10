/**
 * TyranoScript diagnostics provider.
 * Reports errors and warnings in real-time as the user types.
 */

import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import { TAG_DATABASE, isBuiltinTag } from './tag-database';
import {
  ParsedScenario,
  ProjectIndex,
  ScenarioNode,
  TagNode,
  IfBlockNode,
  MacroDefNode,
} from '../parser/types';

export class TyranoDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private parser: Parser;

  constructor(
    private getIndex: () => ProjectIndex | undefined,
    private getConfig: () => DiagnosticsConfig,
  ) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('tyranoscript');
    this.parser = new Parser('');
  }

  get collection(): vscode.DiagnosticCollection {
    return this.diagnosticCollection;
  }

  /**
   * Analyze a single document and update diagnostics.
   */
  analyzeDocument(document: vscode.TextDocument): ParsedScenario {
    const config = this.getConfig();
    if (!config.enable) {
      this.diagnosticCollection.delete(document.uri);
      return { file: document.fileName, nodes: [], labels: new Map(), macros: new Map(), errors: [] };
    }

    this.parser = new Parser(document.fileName);
    const parsed = this.parser.parse(document.getText());
    const diagnostics: vscode.Diagnostic[] = [];

    // Parse errors
    for (const error of parsed.errors) {
      diagnostics.push(
        new vscode.Diagnostic(
          toVscRange(error.range),
          error.message,
          error.severity === 'error'
            ? vscode.DiagnosticSeverity.Error
            : error.severity === 'warning'
              ? vscode.DiagnosticSeverity.Warning
              : vscode.DiagnosticSeverity.Information,
        ),
      );
    }

    // Semantic diagnostics
    this.checkNodes(parsed.nodes, diagnostics, config, document);

    this.diagnosticCollection.set(document.uri, diagnostics);
    return parsed;
  }

  private checkNodes(
    nodes: ScenarioNode[],
    diagnostics: vscode.Diagnostic[],
    config: DiagnosticsConfig,
    document: vscode.TextDocument,
  ): void {
    const blockStack: string[] = []; // track [if], [macro] nesting

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (node.type === 'tag') {
        this.checkTag(node, diagnostics, config, document);

        // Unreachable code detection
        if (config.unreachableCode) {
          if (node.name === 'jump' || node.name === 'return' || node.name === 's') {
            const hasCondition = node.attributes.some(a => a.name === 'cond');
            if (!hasCondition && i < nodes.length - 1) {
              const next = nodes[i + 1];
              if (next && next.type !== 'label' && next.type !== 'comment') {
                diagnostics.push(
                  new vscode.Diagnostic(
                    toVscRange(next.range),
                    `Unreachable code after [${node.name}]`,
                    vscode.DiagnosticSeverity.Warning,
                  ),
                );
              }
            }
          }
        }
      }

      if (node.type === 'if_block') {
        this.checkIfBlock(node, diagnostics, config, document);
      }

      if (node.type === 'macro_def') {
        this.checkMacroDef(node, diagnostics, config, document);
      }
    }
  }

  private checkTag(
    node: TagNode,
    diagnostics: vscode.Diagnostic[],
    config: DiagnosticsConfig,
    document: vscode.TextDocument,
  ): void {
    const tagDef = TAG_DATABASE.get(node.name);
    const index = this.getIndex();

    // Unknown tag — could be a macro
    if (!tagDef) {
      if (config.undefinedMacro && index && !index.globalMacros.has(node.name)) {
        diagnostics.push(
          new vscode.Diagnostic(
            toVscRange(node.nameRange),
            `Unknown tag or undefined macro: [${node.name}]`,
            vscode.DiagnosticSeverity.Warning,
          ),
        );
      }
      return;
    }

    // Check required parameters
    for (const param of tagDef.params) {
      if (param.required && !node.attributes.some(a => a.name === param.name)) {
        diagnostics.push(
          new vscode.Diagnostic(
            toVscRange(node.nameRange),
            `Missing required parameter "${param.name}" for [${node.name}]`,
            vscode.DiagnosticSeverity.Error,
          ),
        );
      }
    }

    // Check unknown parameters
    for (const attr of node.attributes) {
      if (!tagDef.params.some(p => p.name === attr.name) && attr.name !== 'cond') {
        diagnostics.push(
          new vscode.Diagnostic(
            toVscRange(attr.nameRange),
            `Unknown parameter "${attr.name}" for [${node.name}]`,
            vscode.DiagnosticSeverity.Warning,
          ),
        );
      }
    }

    // Check jump/call targets
    if ((node.name === 'jump' || node.name === 'call') && config.undefinedLabel && index) {
      const targetAttr = node.attributes.find(a => a.name === 'target');
      const storageAttr = node.attributes.find(a => a.name === 'storage');

      if (targetAttr?.value) {
        const labelName = targetAttr.value.replace(/^\*/, '');
        // Only check labels in the same file if no storage is specified
        if (!storageAttr?.value) {
          const labels = index.globalLabels.get(labelName);
          if (!labels || labels.length === 0) {
            diagnostics.push(
              new vscode.Diagnostic(
                toVscRange(targetAttr.valueRange ?? targetAttr.range),
                `Undefined label: *${labelName}`,
                vscode.DiagnosticSeverity.Error,
              ),
            );
          }
        }
      }
    }

    // Check resource file existence
    if (config.missingResource) {
      for (const attr of node.attributes) {
        const paramDef = tagDef.params.find(p => p.name === attr.name);
        if (paramDef?.type === 'file' && attr.value && attr.name !== 'storage') {
          // Resource file checks will be performed by the project indexer
          // using actual file system lookups (deferred to project-level analysis)
        }
      }
    }
  }

  private checkIfBlock(
    node: IfBlockNode,
    diagnostics: vscode.Diagnostic[],
    config: DiagnosticsConfig,
    document: vscode.TextDocument,
  ): void {
    // Check condition expressions are present
    if (!node.condition || node.condition.trim() === '') {
      diagnostics.push(
        new vscode.Diagnostic(
          toVscRange(node.range),
          '[if] missing exp parameter',
          vscode.DiagnosticSeverity.Error,
        ),
      );
    }

    // Recursively check contents of branches
    this.checkNodes(node.thenBranch, diagnostics, config, document);
    for (const branch of node.elsifBranches) {
      this.checkNodes(branch.body, diagnostics, config, document);
    }
    if (node.elseBranch) {
      this.checkNodes(node.elseBranch, diagnostics, config, document);
    }
  }

  private checkMacroDef(
    node: MacroDefNode,
    diagnostics: vscode.Diagnostic[],
    config: DiagnosticsConfig,
    document: vscode.TextDocument,
  ): void {
    // Check for duplicate macro names
    const index = this.getIndex();
    if (index) {
      const existing = index.globalMacros.get(node.name);
      if (existing && existing.file !== document.fileName) {
        diagnostics.push(
          new vscode.Diagnostic(
            toVscRange(node.nameRange),
            `Duplicate macro definition: [${node.name}] (also defined in ${existing.file})`,
            vscode.DiagnosticSeverity.Warning,
          ),
        );
      }
    }

    this.checkNodes(node.body, diagnostics, config, document);
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

export interface DiagnosticsConfig {
  enable: boolean;
  undefinedLabel: boolean;
  undefinedMacro: boolean;
  missingResource: boolean;
  unusedLabel: boolean;
  unreachableCode: boolean;
}

function toVscRange(range: import('../parser/types').Range): vscode.Range {
  return new vscode.Range(
    new vscode.Position(range.start.line, range.start.column),
    new vscode.Position(range.end.line, range.end.column),
  );
}
