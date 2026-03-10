/**
 * Semantic tokens provider for TyranoScript .ks files.
 * Provides enhanced semantic highlighting beyond the TextMate grammar,
 * including variable scoping, tag/macro differentiation, and expression analysis.
 */

import * as vscode from 'vscode';
import { Scanner, Token } from '../parser/scanner';

const TOKEN_TYPES = [
  'function',   // tag names
  'variable',   // f.xxx, sf.xxx, tf.xxx variables
  'parameter',  // attribute names
  'string',     // quoted string values
  'number',     // numeric values
  'label',      // label names after *
  'macro',      // macro names in [macro name="xxx"]
  'comment',    // comment lines
  'keyword',    // keywords like if, else, endif, macro, endmacro
];

const TOKEN_MODIFIERS = [
  'declaration', // variable writes, macro definitions
  'readonly',    // read-only access
];

export const SEMANTIC_TOKENS_LEGEND = new vscode.SemanticTokensLegend(
  TOKEN_TYPES,
  TOKEN_MODIFIERS,
);

/** Tags that are treated as keywords rather than regular function-like tags. */
const KEYWORD_TAGS = new Set([
  'if', 'elsif', 'else', 'endif',
  'macro', 'endmacro',
  'iscript', 'endscript',
  'ignore', 'endignore',
]);

/** Variable prefixes that indicate TyranoScript game variables. */
const VARIABLE_PREFIX_PATTERN = /\b(f|sf|tf|mp)\.\w+/g;

/** Pattern to detect variable assignment (write) contexts. */
const VARIABLE_WRITE_PATTERN = /\b(f|sf|tf)\.\w+\s*[+\-*\/]?=/;

export class TyranoSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(SEMANTIC_TOKENS_LEGEND);
    const text = document.getText();
    const scanner = new Scanner(text);
    const tokens = scanner.scan();

    let currentTagName = '';
    let insideTag = false;
    let currentAttrName = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      switch (token.type) {
        case 'COMMENT':
          builder.push(
            new vscode.Range(
              new vscode.Position(token.line, token.column),
              new vscode.Position(token.line, token.column + token.length),
            ),
            'comment',
            [],
          );
          break;

        case 'LABEL':
          builder.push(
            new vscode.Range(
              new vscode.Position(token.line, token.column),
              new vscode.Position(token.line, token.column + 1 + token.length),
            ),
            'label',
            [],
          );
          break;

        case 'TAG_OPEN':
          insideTag = true;
          currentTagName = '';
          currentAttrName = '';
          break;

        case 'TAG_CLOSE':
          insideTag = false;
          currentTagName = '';
          currentAttrName = '';
          break;

        case 'TAG_NAME': {
          const name = token.value.toLowerCase().replace(/^[#/]/, '');
          currentTagName = name;

          if (KEYWORD_TAGS.has(name)) {
            builder.push(
              new vscode.Range(
                new vscode.Position(token.line, token.column),
                new vscode.Position(token.line, token.column + token.length),
              ),
              'keyword',
              [],
            );
          } else {
            builder.push(
              new vscode.Range(
                new vscode.Position(token.line, token.column),
                new vscode.Position(token.line, token.column + token.length),
              ),
              'function',
              [],
            );
          }
          break;
        }

        case 'ATTR_NAME':
          currentAttrName = token.value;
          builder.push(
            new vscode.Range(
              new vscode.Position(token.line, token.column),
              new vscode.Position(token.line, token.column + token.length),
            ),
            'parameter',
            [],
          );
          break;

        case 'ATTR_VALUE': {
          // Check if this is a macro name declaration
          if (currentTagName === 'macro' && currentAttrName === 'name') {
            builder.push(
              new vscode.Range(
                new vscode.Position(token.line, token.column),
                new vscode.Position(token.line, token.column + token.length),
              ),
              'macro',
              ['declaration'],
            );
            break;
          }

          // Check if the value is purely numeric
          if (/^-?\d+(\.\d+)?$/.test(token.value)) {
            builder.push(
              new vscode.Range(
                new vscode.Position(token.line, token.column),
                new vscode.Position(token.line, token.column + token.length),
              ),
              'number',
              [],
            );
            break;
          }

          // Check for variables in expression attributes (exp, cond, etc.)
          if (this.isExpressionAttribute(currentAttrName)) {
            this.pushVariableTokens(builder, token);
            break;
          }

          // For quoted string values, emit as string
          // The scanner strips quotes, so check the column offset to determine
          // if it was originally quoted by looking at the document character
          builder.push(
            new vscode.Range(
              new vscode.Position(token.line, token.column),
              new vscode.Position(token.line, token.column + token.length),
            ),
            'string',
            [],
          );
          break;
        }

        default:
          break;
      }
    }

    return builder.build();
  }

  /**
   * Determines whether the given attribute name typically holds an expression
   * that may contain variable references.
   */
  private isExpressionAttribute(attrName: string): boolean {
    return attrName === 'exp' || attrName === 'cond';
  }

  /**
   * Scans an attribute value for TyranoScript variable references (f.xxx, sf.xxx, tf.xxx)
   * and pushes semantic tokens for each occurrence. Variables on the left-hand side of
   * an assignment operator receive the 'declaration' modifier.
   */
  private pushVariableTokens(
    builder: vscode.SemanticTokensBuilder,
    token: Token,
  ): void {
    const value = token.value;
    const isWrite = VARIABLE_WRITE_PATTERN.test(value);

    // Reset the global regex before using it
    VARIABLE_PREFIX_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = VARIABLE_PREFIX_PATTERN.exec(value)) !== null) {
      const varStart = match.index;
      const varLength = match[0].length;
      const modifiers = isWrite && varStart === match.index ? ['declaration'] : [];

      builder.push(
        new vscode.Range(
          new vscode.Position(token.line, token.column + varStart),
          new vscode.Position(token.line, token.column + varStart + varLength),
        ),
        'variable',
        modifiers,
      );
    }
  }
}
