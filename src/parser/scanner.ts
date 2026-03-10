/**
 * TyranoScript lexical scanner
 * Tokenizes .ks files into a stream of tokens for the parser.
 */

export type TokenType =
  | 'TAG_OPEN'       // [
  | 'TAG_CLOSE'      // ]
  | 'TAG_NAME'       // tag name after [
  | 'ATTR_NAME'      // attribute name
  | 'ATTR_EQUALS'    // =
  | 'ATTR_VALUE'     // attribute value (quoted or unquoted)
  | 'LABEL'          // *label_name
  | 'COMMENT'        // ;comment
  | 'TEXT'           // plain text line
  | 'NEWLINE'        // line break
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  length: number;
}

export class Scanner {
  private source: string;
  private pos: number = 0;
  private line: number = 0;
  private column: number = 0;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  scan(): Token[] {
    this.tokens = [];
    this.pos = 0;
    this.line = 0;
    this.column = 0;

    while (this.pos < this.source.length) {
      this.scanLine();
    }

    this.tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
      length: 0,
    });

    return this.tokens;
  }

  private scanLine(): void {
    // Skip empty lines
    if (this.peek() === '\n') {
      this.emitToken('NEWLINE', '\n');
      this.advance();
      this.line++;
      this.column = 0;
      return;
    }
    if (this.peek() === '\r') {
      this.advance();
      if (this.peek() === '\n') {
        this.advance();
      }
      this.emitToken('NEWLINE', '\n');
      this.line++;
      this.column = 0;
      return;
    }

    const lineStart = this.column;
    const ch = this.peek();

    // Comment line
    if (ch === ';' && this.column === 0) {
      this.scanComment();
      return;
    }

    // Label line
    if (ch === '*' && this.column === 0) {
      this.scanLabel();
      return;
    }

    // Tag or text within a line
    if (ch === '[') {
      this.scanTag();
      return;
    }

    // At-sign shorthand: @tagname param=value
    if (ch === '@' && this.column === 0) {
      this.scanAtTag();
      return;
    }

    // Text content
    this.scanText();
  }

  private scanComment(): void {
    const startCol = this.column;
    let value = '';
    while (this.pos < this.source.length && this.peek() !== '\n' && this.peek() !== '\r') {
      value += this.peek();
      this.advance();
    }
    this.emitTokenAt('COMMENT', value, this.line, startCol);
  }

  private scanLabel(): void {
    const startCol = this.column;
    this.advance(); // skip *
    let name = '';
    while (this.pos < this.source.length && /[\w]/.test(this.peek())) {
      name += this.peek();
      this.advance();
    }
    this.emitTokenAt('LABEL', name, this.line, startCol);
    // consume rest of line (label can have display text after |)
    while (this.pos < this.source.length && this.peek() !== '\n' && this.peek() !== '\r') {
      this.advance();
    }
  }

  private scanTag(): void {
    this.emitToken('TAG_OPEN', '[');
    this.advance(); // skip [

    this.skipWhitespaceInline();

    // Tag name
    let tagName = '';
    const nameStartCol = this.column;
    while (this.pos < this.source.length && /[\w_]/.test(this.peek())) {
      tagName += this.peek();
      this.advance();
    }
    if (tagName) {
      this.emitTokenAt('TAG_NAME', tagName, this.line, nameStartCol);
    }

    // Attributes
    this.scanAttributes();

    // Closing ]
    if (this.peek() === ']') {
      this.emitToken('TAG_CLOSE', ']');
      this.advance();
    }
  }

  private scanAtTag(): void {
    this.advance(); // skip @
    // treat as if [ was found
    this.emitToken('TAG_OPEN', '@');

    this.skipWhitespaceInline();

    let tagName = '';
    const nameStartCol = this.column;
    while (this.pos < this.source.length && /[\w_]/.test(this.peek())) {
      tagName += this.peek();
      this.advance();
    }
    if (tagName) {
      this.emitTokenAt('TAG_NAME', tagName, this.line, nameStartCol);
    }

    this.scanAttributes();

    // @ tags end at EOL — emit implicit close
    this.emitToken('TAG_CLOSE', '');
  }

  private scanAttributes(): void {
    while (this.pos < this.source.length) {
      this.skipWhitespaceInline();

      const ch = this.peek();
      if (ch === ']' || ch === '\n' || ch === '\r' || this.pos >= this.source.length) {
        break;
      }

      // Attribute name
      let attrName = '';
      const attrStartCol = this.column;
      while (this.pos < this.source.length && /[\w_\-.]/.test(this.peek())) {
        attrName += this.peek();
        this.advance();
      }

      if (!attrName) {
        // Skip unknown character
        this.advance();
        continue;
      }

      this.emitTokenAt('ATTR_NAME', attrName, this.line, attrStartCol);

      this.skipWhitespaceInline();

      if (this.peek() === '=') {
        this.emitToken('ATTR_EQUALS', '=');
        this.advance();
        this.skipWhitespaceInline();

        // Attribute value
        const valueStartCol = this.column;
        let value = '';

        if (this.peek() === '"') {
          this.advance(); // skip opening "
          while (this.pos < this.source.length && this.peek() !== '"') {
            if (this.peek() === '\\') {
              value += this.peek();
              this.advance();
            }
            value += this.peek();
            this.advance();
          }
          if (this.peek() === '"') {
            this.advance(); // skip closing "
          }
          this.emitTokenAt('ATTR_VALUE', value, this.line, valueStartCol);
        } else if (this.peek() === "'") {
          this.advance();
          while (this.pos < this.source.length && this.peek() !== "'") {
            value += this.peek();
            this.advance();
          }
          if (this.peek() === "'") {
            this.advance();
          }
          this.emitTokenAt('ATTR_VALUE', value, this.line, valueStartCol);
        } else {
          // Unquoted value — read until whitespace or ]
          while (
            this.pos < this.source.length &&
            !/[\s\]]/.test(this.peek())
          ) {
            value += this.peek();
            this.advance();
          }
          this.emitTokenAt('ATTR_VALUE', value, this.line, valueStartCol);
        }
      }
    }
  }

  private scanText(): void {
    const startCol = this.column;
    let value = '';
    while (
      this.pos < this.source.length &&
      this.peek() !== '\n' &&
      this.peek() !== '\r' &&
      this.peek() !== '['
    ) {
      value += this.peek();
      this.advance();
    }
    if (value) {
      this.emitTokenAt('TEXT', value, this.line, startCol);
    }
  }

  private peek(): string {
    return this.source[this.pos] ?? '';
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private skipWhitespaceInline(): void {
    while (this.pos < this.source.length && (this.peek() === ' ' || this.peek() === '\t')) {
      this.advance();
    }
  }

  private emitToken(type: TokenType, value: string): void {
    this.tokens.push({
      type,
      value,
      line: this.line,
      column: this.column,
      length: value.length,
    });
  }

  private emitTokenAt(type: TokenType, value: string, line: number, column: number): void {
    this.tokens.push({
      type,
      value,
      line,
      column,
      length: value.length,
    });
  }
}
