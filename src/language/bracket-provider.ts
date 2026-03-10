/**
 * TyranoScript bracket/block highlight provider.
 * Highlights matching open/close tag pairs when the cursor is on one of them.
 *
 * Supported pairs:
 *   [if] / [elsif] / [else] / [endif]
 *   [macro] / [endmacro]
 *   [iscript] / [endscript]
 *   [html] / [endhtml]
 *   [ruby] / [/ruby]
 *   [b] / [/b], [i] / [/i], [s] / [/s], [a] / [/a]
 */

import * as vscode from 'vscode';
import { Scanner, Token } from '../parser/scanner';

/** Tags that use the "end" prefix to close: if->endif, macro->endmacro, etc. */
const BLOCK_PAIRS: ReadonlyMap<string, string> = new Map([
  ['if', 'endif'],
  ['endif', 'if'],
  ['macro', 'endmacro'],
  ['endmacro', 'macro'],
  ['iscript', 'endscript'],
  ['endscript', 'iscript'],
  ['html', 'endhtml'],
  ['endhtml', 'html'],
]);

/** Intermediate tags that belong to the if block. */
const IF_INTERMEDIATES = new Set(['elsif', 'else']);

/** Tags that use the /xxx closing form. */
const SLASH_CLOSE_TAGS = new Set(['ruby', 'b', 'i', 's', 'a']);

interface TagNameToken {
  name: string;
  range: vscode.Range;
}

export class TyranoBracketHighlightProvider implements vscode.DocumentHighlightProvider {

  provideDocumentHighlights(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.DocumentHighlight[] | null {
    const scanner = new Scanner(document.getText());
    const tokens = scanner.scan();

    // Collect all TAG_NAME tokens with their VS Code ranges.
    const tagTokens = this.collectTagNameTokens(tokens);
    if (tagTokens.length === 0) return null;

    // Find the tag token at the cursor position.
    const current = this.findTokenAtPosition(tagTokens, position);
    if (!current) return null;

    const name = current.name.toLowerCase();

    // Case 1a: Cursor on elsif/else — find matching if, then highlight entire block
    if (IF_INTERMEDIATES.has(name)) {
      return this.highlightFromIntermediate(tagTokens, current);
    }

    // Case 1: Block pair with "end" prefix (if/endif, macro/endmacro, etc.)
    if (BLOCK_PAIRS.has(name)) {
      return this.highlightBlockPair(tagTokens, current);
    }

    // Case 2: Slash-closed tags like [ruby]...[/ruby]
    if (SLASH_CLOSE_TAGS.has(name)) {
      return this.highlightSlashPairFromOpen(tagTokens, current);
    }

    // Case 3: Closing slash tag like [/ruby]
    if (name.startsWith('/') && SLASH_CLOSE_TAGS.has(name.substring(1))) {
      return this.highlightSlashPairFromClose(tagTokens, current);
    }

    return null;
  }

  /**
   * Collect all TAG_NAME tokens from the scanner output, converting positions
   * to VS Code Range objects.
   */
  private collectTagNameTokens(tokens: Token[]): TagNameToken[] {
    const result: TagNameToken[] = [];
    for (const tok of tokens) {
      if (tok.type === 'TAG_NAME') {
        result.push({
          name: tok.value,
          range: new vscode.Range(
            tok.line, tok.column,
            tok.line, tok.column + tok.length,
          ),
        });
      }
    }
    return result;
  }

  /**
   * Find the TAG_NAME token whose range contains the cursor position.
   */
  private findTokenAtPosition(
    tagTokens: TagNameToken[],
    position: vscode.Position,
  ): TagNameToken | null {
    for (const t of tagTokens) {
      if (t.range.contains(position)) {
        return t;
      }
    }
    return null;
  }

  /**
   * Highlight a block pair that uses the end-prefix pattern (if/endif, macro/endmacro, etc.).
   * Handles nesting and also highlights intermediate tags (elsif, else) for if blocks.
   */
  private highlightBlockPair(
    tagTokens: TagNameToken[],
    current: TagNameToken,
  ): vscode.DocumentHighlight[] | null {
    const name = current.name.toLowerCase();
    const isOpener = name === 'if' || name === 'macro' || name === 'iscript' || name === 'html';
    const openTag = isOpener ? name : BLOCK_PAIRS.get(name)!;
    const closeTag = isOpener ? BLOCK_PAIRS.get(name)! : name;

    // Find the index of the current token in the list.
    const currentIdx = tagTokens.indexOf(current);
    if (currentIdx < 0) return null;

    const highlights: vscode.DocumentHighlight[] = [];

    if (isOpener) {
      // Search forward for the matching close, tracking nesting depth.
      let depth = 0;
      for (let i = currentIdx; i < tagTokens.length; i++) {
        const n = tagTokens[i].name.toLowerCase();
        if (n === openTag) {
          if (depth === 0) {
            highlights.push(new vscode.DocumentHighlight(
              tagTokens[i].range, vscode.DocumentHighlightKind.Text,
            ));
          }
          depth++;
        } else if (n === closeTag) {
          depth--;
          if (depth === 0) {
            highlights.push(new vscode.DocumentHighlight(
              tagTokens[i].range, vscode.DocumentHighlightKind.Text,
            ));
            break;
          }
        } else if (depth === 1 && openTag === 'if' && IF_INTERMEDIATES.has(n)) {
          // Highlight elsif / else at the same nesting level.
          highlights.push(new vscode.DocumentHighlight(
            tagTokens[i].range, vscode.DocumentHighlightKind.Text,
          ));
        }
      }
    } else {
      // Current is a closer. Search backward to find the opener.
      let depth = 0;

      for (let i = currentIdx; i >= 0; i--) {
        const n = tagTokens[i].name.toLowerCase();
        if (n === closeTag) {
          depth++;
        } else if (n === openTag) {
          depth--;
          if (depth === 0) {
            // Found the matching opener. Now collect everything forward from it.
            return this.highlightBlockPair(tagTokens, tagTokens[i]);
          }
        }
      }
    }

    return highlights.length > 0 ? highlights : null;
  }

  /**
   * When the cursor is on an [elsif] or [else], search backward for the
   * matching [if] (respecting nesting), then delegate to highlightBlockPair
   * from that opener so the full block (if/elsif/else/endif) is highlighted.
   */
  private highlightFromIntermediate(
    tagTokens: TagNameToken[],
    current: TagNameToken,
  ): vscode.DocumentHighlight[] | null {
    const currentIdx = tagTokens.indexOf(current);
    if (currentIdx < 0) return null;

    let depth = 0;
    for (let i = currentIdx - 1; i >= 0; i--) {
      const n = tagTokens[i].name.toLowerCase();
      if (n === 'endif') {
        depth++;
      } else if (n === 'if') {
        if (depth === 0) {
          return this.highlightBlockPair(tagTokens, tagTokens[i]);
        }
        depth--;
      }
    }

    return null;
  }

  /**
   * From an opening tag like [ruby], find the matching [/ruby].
   */
  private highlightSlashPairFromOpen(
    tagTokens: TagNameToken[],
    current: TagNameToken,
  ): vscode.DocumentHighlight[] | null {
    const name = current.name.toLowerCase();
    const closeName = '/' + name;
    const currentIdx = tagTokens.indexOf(current);
    if (currentIdx < 0) return null;

    let depth = 0;
    for (let i = currentIdx; i < tagTokens.length; i++) {
      const n = tagTokens[i].name.toLowerCase();
      if (n === name) {
        depth++;
      } else if (n === closeName) {
        depth--;
        if (depth === 0) {
          return [
            new vscode.DocumentHighlight(current.range, vscode.DocumentHighlightKind.Text),
            new vscode.DocumentHighlight(tagTokens[i].range, vscode.DocumentHighlightKind.Text),
          ];
        }
      }
    }

    return null;
  }

  /**
   * From a closing tag like [/ruby], find the matching [ruby].
   */
  private highlightSlashPairFromClose(
    tagTokens: TagNameToken[],
    current: TagNameToken,
  ): vscode.DocumentHighlight[] | null {
    const name = current.name.toLowerCase();
    const openName = name.substring(1);
    const currentIdx = tagTokens.indexOf(current);
    if (currentIdx < 0) return null;

    let depth = 0;
    for (let i = currentIdx; i >= 0; i--) {
      const n = tagTokens[i].name.toLowerCase();
      if (n === name) {
        depth++;
      } else if (n === openName) {
        depth--;
        if (depth === 0) {
          return [
            new vscode.DocumentHighlight(tagTokens[i].range, vscode.DocumentHighlightKind.Text),
            new vscode.DocumentHighlight(current.range, vscode.DocumentHighlightKind.Text),
          ];
        }
      }
    }

    return null;
  }
}
