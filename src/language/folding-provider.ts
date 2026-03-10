/**
 * TyranoScript folding range provider.
 * Provides code folding for block constructs, comment runs, and label sections.
 */

import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import { ScenarioNode, LabelNode, CommentNode } from '../parser/types';

export class TyranoFoldingProvider implements vscode.FoldingRangeProvider {

  provideFoldingRanges(
    document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken,
  ): vscode.FoldingRange[] {
    const parser = new Parser(document.uri.fsPath);
    const parsed = parser.parse(document.getText());
    const ranges: vscode.FoldingRange[] = [];

    this.collectBlockRanges(parsed.nodes, ranges);
    this.collectCommentRanges(parsed.nodes, ranges);
    this.collectLabelRanges(parsed.nodes, document.lineCount, ranges);

    return ranges;
  }

  /**
   * Walk AST nodes and create folding ranges for block constructs:
   * [if]...[endif], [macro]...[endmacro], [iscript]...[endscript], [html]...[endhtml]
   */
  private collectBlockRanges(nodes: ScenarioNode[], ranges: vscode.FoldingRange[]): void {
    for (const node of nodes) {
      switch (node.type) {
        case 'if_block': {
          const startLine = node.range.start.line;
          const endLine = node.range.end.line;
          if (endLine > startLine) {
            ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
          }
          // Recurse into branches
          this.collectBlockRanges(node.thenBranch, ranges);
          for (const branch of node.elsifBranches) {
            this.collectBlockRanges(branch.body, ranges);
          }
          if (node.elseBranch) {
            this.collectBlockRanges(node.elseBranch, ranges);
          }
          break;
        }

        case 'macro_def': {
          const startLine = node.range.start.line;
          const endLine = node.range.end.line;
          if (endLine > startLine) {
            ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
          }
          this.collectBlockRanges(node.body, ranges);
          break;
        }

        case 'iscript': {
          const startLine = node.range.start.line;
          const endLine = node.range.end.line;
          if (endLine > startLine) {
            ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
          }
          break;
        }

        case 'html': {
          const startLine = node.range.start.line;
          const endLine = node.range.end.line;
          if (endLine > startLine) {
            ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
          }
          break;
        }
      }
    }
  }

  /**
   * Find runs of consecutive comment lines (`;` lines) and create comment folding ranges.
   */
  private collectCommentRanges(nodes: ScenarioNode[], ranges: vscode.FoldingRange[]): void {
    let commentStart: number | null = null;
    let commentEnd: number | null = null;

    for (const node of nodes) {
      if (node.type === 'comment') {
        const line = node.range.start.line;
        if (commentStart === null) {
          commentStart = line;
          commentEnd = line;
        } else if (line === commentEnd! + 1) {
          // Consecutive comment line
          commentEnd = line;
        } else {
          // Gap — flush previous run
          if (commentEnd! > commentStart) {
            ranges.push(new vscode.FoldingRange(commentStart, commentEnd!, vscode.FoldingRangeKind.Comment));
          }
          commentStart = line;
          commentEnd = line;
        }
      } else {
        // Non-comment node — flush if we had a run
        if (commentStart !== null && commentEnd !== null && commentEnd > commentStart) {
          ranges.push(new vscode.FoldingRange(commentStart, commentEnd, vscode.FoldingRangeKind.Comment));
        }
        commentStart = null;
        commentEnd = null;
      }
    }

    // Flush any trailing comment run
    if (commentStart !== null && commentEnd !== null && commentEnd > commentStart) {
      ranges.push(new vscode.FoldingRange(commentStart, commentEnd, vscode.FoldingRangeKind.Comment));
    }
  }

  /**
   * Create folding ranges for label sections: from *label to the next *label or end of file.
   */
  private collectLabelRanges(
    nodes: ScenarioNode[],
    totalLines: number,
    ranges: vscode.FoldingRange[],
  ): void {
    // Gather all top-level labels in order
    const labels: LabelNode[] = [];
    for (const node of nodes) {
      if (node.type === 'label') {
        labels.push(node);
      }
    }

    for (let i = 0; i < labels.length; i++) {
      const startLine = labels[i].range.start.line;
      const endLine = i + 1 < labels.length
        ? labels[i + 1].range.start.line - 1
        : totalLines - 1;

      if (endLine > startLine) {
        ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
      }
    }
  }
}
