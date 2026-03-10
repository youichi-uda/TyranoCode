/**
 * TyranoScript hover documentation provider.
 * Shows tag/attribute docs on hover.
 */

import * as vscode from 'vscode';
import { TAG_DATABASE } from './tag-database';
import { ProjectIndex } from '../parser/types';

export class TyranoHoverProvider implements vscode.HoverProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.Hover | undefined {
    const line = document.lineAt(position).text;
    const wordRange = document.getWordRangeAtPosition(position, /[\w_]+/);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);

    // Check if we're inside a tag
    const textBefore = line.substring(0, wordRange.start.character);
    const tagOpenIdx = textBefore.lastIndexOf('[');
    const tagCloseIdx = textBefore.lastIndexOf(']');

    if (tagOpenIdx > tagCloseIdx) {
      const insideTag = textBefore.substring(tagOpenIdx + 1);

      // Is this the tag name?
      if (!/\s/.test(insideTag)) {
        return this.hoverTagName(word);
      }

      // Is this an attribute name?
      const tagNameMatch = insideTag.match(/^(\w+)/);
      if (tagNameMatch) {
        return this.hoverAttribute(tagNameMatch[1], word);
      }
    }

    // @ tag at start of line
    if (textBefore.trimStart().startsWith('@') && !/\s/.test(textBefore.trimStart().substring(1))) {
      return this.hoverTagName(word);
    }

    // Label reference
    if (line.charAt(wordRange.start.character - 1) === '*') {
      return this.hoverLabel(word);
    }

    // Variable hover (f.xxx, sf.xxx, tf.xxx)
    const varMatch = line.substring(Math.max(0, wordRange.start.character - 3), wordRange.end.character)
      .match(/(f|sf|tf)\.(\w+)/);
    if (varMatch) {
      return this.hoverVariable(varMatch[1] as 'f' | 'sf' | 'tf', varMatch[2]);
    }

    return undefined;
  }

  private hoverTagName(name: string): vscode.Hover | undefined {
    const tagDef = TAG_DATABASE.get(name.toLowerCase());
    if (!tagDef) {
      // Check macros
      const index = this.getIndex();
      if (index) {
        const macroDef = index.globalMacros.get(name);
        if (macroDef) {
          return new vscode.Hover(
            new vscode.MarkdownString(
              `**[${name}]** — user macro\n\nDefined in \`${macroDef.file}:${macroDef.node.range.start.line + 1}\``
            )
          );
        }
      }
      return undefined;
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**[${tagDef.name}]** — _${tagDef.category}_\n\n`);
    md.appendMarkdown(`${tagDef.description}\n\n`);
    if (tagDef.descriptionJa) {
      md.appendMarkdown(`${tagDef.descriptionJa}\n\n`);
    }

    if (tagDef.params.length > 0) {
      md.appendMarkdown('### Parameters\n\n');
      md.appendMarkdown('| Name | Type | Required | Default | Description |\n');
      md.appendMarkdown('|------|------|----------|---------|-------------|\n');
      for (const p of tagDef.params) {
        md.appendMarkdown(
          `| \`${p.name}\` | ${p.type} | ${p.required ? '**yes**' : 'no'} | ${p.default ?? '—'} | ${p.description} |\n`
        );
      }
    }

    if (tagDef.closingTag) {
      md.appendMarkdown(`\n\nClosing tag: \`[${tagDef.closingTag}]\``);
    }

    return new vscode.Hover(md);
  }

  private hoverAttribute(tagName: string, attrName: string): vscode.Hover | undefined {
    const tagDef = TAG_DATABASE.get(tagName.toLowerCase());
    if (!tagDef) return undefined;

    const param = tagDef.params.find(p => p.name === attrName);
    if (!param) return undefined;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${param.name}** — \`${param.type}\`${param.required ? ' _(required)_' : ''}\n\n`);
    md.appendMarkdown(`${param.description}\n\n`);
    if (param.descriptionJa) {
      md.appendMarkdown(`${param.descriptionJa}\n\n`);
    }
    if (param.default) {
      md.appendMarkdown(`Default: \`${param.default}\`\n\n`);
    }
    if (param.enumValues) {
      md.appendMarkdown(`Values: ${param.enumValues.map(v => `\`${v}\``).join(', ')}`);
    }

    return new vscode.Hover(md);
  }

  private hoverLabel(name: string): vscode.Hover | undefined {
    const index = this.getIndex();
    if (!index) return undefined;

    const locations = index.globalLabels.get(name);
    if (!locations || locations.length === 0) return undefined;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**\\*${name}** — label\n\n`);
    for (const loc of locations) {
      md.appendMarkdown(`- \`${loc.file}:${loc.node.range.start.line + 1}\`\n`);
    }
    return new vscode.Hover(md);
  }

  private hoverVariable(scope: 'f' | 'sf' | 'tf', name: string): vscode.Hover | undefined {
    const scopeNames: Record<string, string> = {
      f: 'Game variable (saved with save data)',
      sf: 'System variable (persistent across saves)',
      tf: 'Temporary variable (lost on page change)',
    };

    const index = this.getIndex();
    const fullName = `${scope}.${name}`;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${fullName}**\n\n`);
    md.appendMarkdown(`_${scopeNames[scope]}_\n\n`);

    if (index) {
      const refs = index.variables.get(fullName);
      if (refs) {
        const writes = refs.filter(r => r.usage === 'write');
        const reads = refs.filter(r => r.usage === 'read');
        md.appendMarkdown(`Writes: ${writes.length} | Reads: ${reads.length}\n`);
      }
    }

    return new vscode.Hover(md);
  }
}
