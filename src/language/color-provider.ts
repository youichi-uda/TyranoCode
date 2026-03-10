/**
 * TyranoScript color provider.
 * Provides color swatches and color picker for 0xRRGGBB / 0xAARRGGBB values in .ks files.
 */

import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import { ScenarioNode, TagNode } from '../parser/types';
import { TAG_DATABASE } from './tag-database';

/** Regex matching TyranoScript hex color values: 0xRRGGBB or 0xAARRGGBB */
const COLOR_REGEX = /^0x([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class TyranoColorProvider implements vscode.DocumentColorProvider {

  provideDocumentColors(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.ColorInformation[] {
    const parser = new Parser(document.uri.fsPath);
    const parsed = parser.parse(document.getText());
    const colors: vscode.ColorInformation[] = [];

    this.walkNodes(parsed.nodes, colors);

    return colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: { document: vscode.TextDocument; range: vscode.Range },
    _token: vscode.CancellationToken,
  ): vscode.ColorPresentation[] {
    const r = Math.round(color.red * 255);
    const g = Math.round(color.green * 255);
    const b = Math.round(color.blue * 255);
    const a = Math.round(color.alpha * 255);

    const hex = color.alpha < 1
      ? `0x${this.toHex(a)}${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`
      : `0x${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;

    const presentation = new vscode.ColorPresentation(hex);
    presentation.textEdit = new vscode.TextEdit(context.range, hex);

    return [presentation];
  }

  /**
   * Recursively walk AST nodes, collecting color information from tag attributes.
   */
  private walkNodes(nodes: ScenarioNode[], colors: vscode.ColorInformation[]): void {
    for (const node of nodes) {
      switch (node.type) {
        case 'tag':
          this.collectColorsFromTag(node, colors);
          break;
        case 'if_block':
          this.walkNodes(node.thenBranch, colors);
          for (const branch of node.elsifBranches) {
            this.walkNodes(branch.body, colors);
          }
          if (node.elseBranch) {
            this.walkNodes(node.elseBranch, colors);
          }
          break;
        case 'macro_def':
          this.walkNodes(node.body, colors);
          break;
      }
    }
  }

  /**
   * Check each attribute of a tag node for color values.
   * An attribute is considered a color if:
   *   - The tag definition lists it with type 'color', or
   *   - The attribute name contains the substring 'color'
   */
  private collectColorsFromTag(tag: TagNode, colors: vscode.ColorInformation[]): void {
    const tagDef = TAG_DATABASE.get(tag.name);
    const colorParamNames = new Set<string>();

    if (tagDef) {
      for (const param of tagDef.params) {
        if (param.type === 'color') {
          colorParamNames.add(param.name);
        }
      }
    }

    for (const attr of tag.attributes) {
      if (!attr.value || !attr.valueRange) continue;

      const isColorAttr = colorParamNames.has(attr.name) || attr.name.toLowerCase().includes('color');
      if (!isColorAttr) continue;

      const match = attr.value.match(COLOR_REGEX);
      if (!match) continue;

      const hexStr = match[1];
      const color = this.parseHexColor(hexStr);
      if (!color) continue;

      const range = new vscode.Range(
        new vscode.Position(attr.valueRange.start.line, attr.valueRange.start.column),
        new vscode.Position(attr.valueRange.end.line, attr.valueRange.end.column),
      );

      colors.push(new vscode.ColorInformation(range, color));
    }
  }

  /**
   * Parse a hex string (RRGGBB or AARRGGBB) into a vscode.Color with RGBA values 0-1.
   */
  private parseHexColor(hex: string): vscode.Color | undefined {
    let r: number, g: number, b: number, a: number;

    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = 255;
    } else if (hex.length === 8) {
      a = parseInt(hex.substring(0, 2), 16);
      r = parseInt(hex.substring(2, 4), 16);
      g = parseInt(hex.substring(4, 6), 16);
      b = parseInt(hex.substring(6, 8), 16);
    } else {
      return undefined;
    }

    if ([r, g, b, a].some(v => isNaN(v))) return undefined;

    return new vscode.Color(r / 255, g / 255, b / 255, a / 255);
  }

  private toHex(n: number): string {
    return n.toString(16).padStart(2, '0');
  }
}
