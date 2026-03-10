/**
 * TyranoScript parser
 * Converts token stream into an AST of ScenarioNodes.
 */

import { Scanner, Token } from './scanner';
import {
  ScenarioNode,
  TagNode,
  LabelNode,
  TextNode,
  CommentNode,
  IScriptNode,
  HtmlNode,
  MacroDefNode,
  IfBlockNode,
  ParsedScenario,
  ParseError,
  TagAttribute,
  Range,
  Position,
} from './types';

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private file: string;
  private errors: ParseError[] = [];
  private source: string;

  constructor(file: string) {
    this.file = file;
    this.source = '';
  }

  parse(source: string): ParsedScenario {
    this.source = source;
    const scanner = new Scanner(source);
    this.tokens = scanner.scan();
    this.pos = 0;
    this.errors = [];

    const nodes = this.parseNodes();
    const labels = new Map<string, import('./types').LabelNode>();
    const macros = new Map<string, MacroDefNode>();

    this.collectDefinitions(nodes, labels, macros);

    return {
      file: this.file,
      nodes,
      labels,
      macros,
      errors: this.errors,
    };
  }

  private parseNodes(until?: (t: Token) => boolean): ScenarioNode[] {
    const nodes: ScenarioNode[] = [];

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (!token || token.type === 'EOF') break;
      if (until && until(token)) break;

      if (token.type === 'NEWLINE') {
        this.advance();
        continue;
      }

      const node = this.parseNode();
      if (node) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  private parseNode(): ScenarioNode | null {
    const token = this.current();
    if (!token) return null;

    switch (token.type) {
      case 'COMMENT':
        return this.parseComment();
      case 'LABEL':
        return this.parseLabel();
      case 'TAG_OPEN':
        return this.parseTag();
      case 'TEXT':
        return this.parseText();
      default:
        this.advance();
        return null;
    }
  }

  private parseComment(): CommentNode {
    const token = this.current()!;
    this.advance();
    return {
      type: 'comment',
      content: token.value,
      range: this.tokenRange(token),
      file: this.file,
    };
  }

  private parseLabel(): LabelNode {
    const token = this.current()!;
    this.advance();
    return {
      type: 'label',
      name: token.value,
      nameRange: {
        start: { line: token.line, column: token.column + 1 },
        end: { line: token.line, column: token.column + 1 + token.value.length },
      },
      range: this.tokenRange(token),
      file: this.file,
    };
  }

  private parseTag(): ScenarioNode {
    this.advance(); // skip TAG_OPEN

    const nameToken = this.expect('TAG_NAME');
    if (!nameToken) {
      this.skipToTagClose();
      return this.makeErrorText();
    }

    const tagName = nameToken.value.toLowerCase();

    // Collect attributes
    const attributes = this.parseAttributes();

    // Expect TAG_CLOSE
    this.expect('TAG_CLOSE');

    const tagRange: Range = {
      start: { line: nameToken.line, column: nameToken.column - 1 },
      end: { line: nameToken.line, column: this.prevColumn() },
    };

    // Handle special block tags
    switch (tagName) {
      case 'iscript':
        return this.parseIScriptBlock(tagRange);
      case 'html':
        return this.parseHtmlBlock(tagRange);
      case 'macro':
        return this.parseMacroBlock(nameToken, attributes, tagRange);
      case 'if':
        return this.parseIfBlock(attributes, tagRange);
      default:
        return {
          type: 'tag',
          name: tagName,
          nameRange: this.tokenRange(nameToken),
          attributes,
          range: tagRange,
          file: this.file,
        } as TagNode;
    }
  }

  private parseAttributes(): TagAttribute[] {
    const attrs: TagAttribute[] = [];

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (!token || token.type === 'TAG_CLOSE' || token.type === 'EOF') break;

      if (token.type === 'ATTR_NAME') {
        const nameToken = token;
        this.advance();

        let value: string | undefined;
        let valueRange: Range | undefined;

        if (this.current()?.type === 'ATTR_EQUALS') {
          this.advance(); // skip =
          const valueToken = this.current();
          if (valueToken?.type === 'ATTR_VALUE') {
            value = valueToken.value;
            valueRange = this.tokenRange(valueToken);
            this.advance();
          }
        }

        attrs.push({
          name: nameToken.value,
          value,
          range: {
            start: { line: nameToken.line, column: nameToken.column },
            end: valueRange
              ? valueRange.end
              : { line: nameToken.line, column: nameToken.column + nameToken.length },
          },
          nameRange: this.tokenRange(nameToken),
          valueRange,
        });
      } else {
        this.advance();
      }
    }

    return attrs;
  }

  private parseIScriptBlock(openRange: Range): IScriptNode {
    // Collect raw text until [endscript]
    const scriptLines: string[] = [];
    const scriptStart: Position = { line: this.currentLine(), column: 0 };

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (!token || token.type === 'EOF') break;

      if (token.type === 'TAG_OPEN') {
        const saved = this.pos;
        this.advance();
        const name = this.current();
        if (name?.type === 'TAG_NAME' && name.value.toLowerCase() === 'endscript') {
          this.advance();
          this.expect('TAG_CLOSE');
          break;
        }
        this.pos = saved;
      }

      if (token.type === 'TEXT') {
        scriptLines.push(token.value);
      } else if (token.type === 'NEWLINE') {
        scriptLines.push('\n');
      }
      this.advance();
    }

    const scriptContent = scriptLines.join('');
    return {
      type: 'iscript',
      scriptContent,
      scriptRange: {
        start: scriptStart,
        end: { line: this.currentLine(), column: 0 },
      },
      range: {
        start: openRange.start,
        end: { line: this.currentLine(), column: this.currentColumn() },
      },
      file: this.file,
    };
  }

  private parseHtmlBlock(openRange: Range): HtmlNode {
    const htmlLines: string[] = [];
    const htmlStart: Position = { line: this.currentLine(), column: 0 };

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (!token || token.type === 'EOF') break;

      if (token.type === 'TAG_OPEN') {
        const saved = this.pos;
        this.advance();
        const name = this.current();
        if (name?.type === 'TAG_NAME' && name.value.toLowerCase() === 'endhtml') {
          this.advance();
          this.expect('TAG_CLOSE');
          break;
        }
        this.pos = saved;
      }

      if (token.type === 'TEXT') {
        htmlLines.push(token.value);
      } else if (token.type === 'NEWLINE') {
        htmlLines.push('\n');
      }
      this.advance();
    }

    return {
      type: 'html',
      htmlContent: htmlLines.join(''),
      htmlRange: {
        start: htmlStart,
        end: { line: this.currentLine(), column: 0 },
      },
      range: {
        start: openRange.start,
        end: { line: this.currentLine(), column: this.currentColumn() },
      },
      file: this.file,
    };
  }

  private parseMacroBlock(nameToken: Token, attributes: TagAttribute[], openRange: Range): MacroDefNode {
    const macroName = attributes.find(a => a.name === 'name')?.value ?? 'unknown';

    const body = this.parseNodes(t => {
      if (t.type === 'TAG_OPEN') {
        const next = this.tokens[this.pos + 1];
        return next?.type === 'TAG_NAME' && next.value.toLowerCase() === 'endmacro';
      }
      return false;
    });

    // Consume [endmacro]
    if (this.current()?.type === 'TAG_OPEN') {
      this.advance(); // [
      this.advance(); // endmacro
      this.expect('TAG_CLOSE');
    }

    return {
      type: 'macro_def',
      name: macroName,
      nameRange: this.tokenRange(nameToken),
      body,
      range: {
        start: openRange.start,
        end: { line: this.currentLine(), column: this.currentColumn() },
      },
      file: this.file,
    };
  }

  private parseIfBlock(attributes: TagAttribute[], openRange: Range): IfBlockNode {
    const condition = attributes.find(a => a.name === 'exp')?.value ?? '';

    const thenBranch = this.parseNodes(t => {
      if (t.type === 'TAG_OPEN') {
        const next = this.tokens[this.pos + 1];
        if (next?.type === 'TAG_NAME') {
          const name = next.value.toLowerCase();
          return name === 'elsif' || name === 'else' || name === 'endif';
        }
      }
      return false;
    });

    const elsifBranches: Array<{ condition: string; body: ScenarioNode[] }> = [];
    let elseBranch: ScenarioNode[] | null = null;

    while (this.pos < this.tokens.length) {
      const token = this.current();
      if (!token || token.type === 'EOF') break;

      if (token.type === 'TAG_OPEN') {
        const next = this.tokens[this.pos + 1];
        if (next?.type === 'TAG_NAME') {
          const name = next.value.toLowerCase();

          if (name === 'elsif') {
            this.advance(); // [
            this.advance(); // elsif
            const elsifAttrs = this.parseAttributes();
            this.expect('TAG_CLOSE');
            const elsifCondition = elsifAttrs.find(a => a.name === 'exp')?.value ?? '';
            const body = this.parseNodes(t => {
              if (t.type === 'TAG_OPEN') {
                const n = this.tokens[this.pos + 1];
                if (n?.type === 'TAG_NAME') {
                  const nn = n.value.toLowerCase();
                  return nn === 'elsif' || nn === 'else' || nn === 'endif';
                }
              }
              return false;
            });
            elsifBranches.push({ condition: elsifCondition, body });
            continue;
          }

          if (name === 'else') {
            this.advance(); // [
            this.advance(); // else
            this.expect('TAG_CLOSE');
            elseBranch = this.parseNodes(t => {
              if (t.type === 'TAG_OPEN') {
                const n = this.tokens[this.pos + 1];
                return n?.type === 'TAG_NAME' && n.value.toLowerCase() === 'endif';
              }
              return false;
            });
            continue;
          }

          if (name === 'endif') {
            this.advance(); // [
            this.advance(); // endif
            this.expect('TAG_CLOSE');
            break;
          }
        }
      }

      this.advance();
    }

    return {
      type: 'if_block',
      condition,
      thenBranch,
      elsifBranches,
      elseBranch,
      range: {
        start: openRange.start,
        end: { line: this.currentLine(), column: this.currentColumn() },
      },
      file: this.file,
    };
  }

  private parseText(): TextNode {
    const token = this.current()!;
    this.advance();
    return {
      type: 'text',
      content: token.value,
      range: this.tokenRange(token),
      file: this.file,
    };
  }

  // ── Helpers ──

  private current(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): void {
    this.pos++;
  }

  private expect(type: Token['type']): Token | null {
    const token = this.current();
    if (token && token.type === type) {
      this.advance();
      return token;
    }
    if (token) {
      this.errors.push({
        message: `Expected ${type} but got ${token.type} ("${token.value}")`,
        range: this.tokenRange(token),
        severity: 'error',
      });
    }
    return null;
  }

  private skipToTagClose(): void {
    while (this.pos < this.tokens.length) {
      if (this.current()?.type === 'TAG_CLOSE') {
        this.advance();
        break;
      }
      this.advance();
    }
  }

  private tokenRange(token: Token): Range {
    return {
      start: { line: token.line, column: token.column },
      end: { line: token.line, column: token.column + token.length },
    };
  }

  private currentLine(): number {
    return this.current()?.line ?? this.tokens[this.tokens.length - 1]?.line ?? 0;
  }

  private currentColumn(): number {
    return this.current()?.column ?? 0;
  }

  private prevColumn(): number {
    const prev = this.tokens[this.pos - 1];
    return prev ? prev.column + prev.length : 0;
  }

  private makeErrorText(): TextNode {
    return {
      type: 'text',
      content: '',
      range: { start: { line: this.currentLine(), column: 0 }, end: { line: this.currentLine(), column: 0 } },
      file: this.file,
    };
  }

  private collectDefinitions(
    nodes: ScenarioNode[],
    labels: Map<string, LabelNode>,
    macros: Map<string, MacroDefNode>,
  ): void {
    for (const node of nodes) {
      if (node.type === 'label') {
        labels.set(node.name, node);
      } else if (node.type === 'macro_def') {
        macros.set(node.name, node);
      }
    }
  }
}
