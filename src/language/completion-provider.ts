/**
 * TyranoScript autocompletion provider.
 * Provides tag names, attribute names, attribute values, and label/file completions.
 */

import * as vscode from 'vscode';
import { TAG_DATABASE, TagDef } from './tag-database';
import { ProjectIndex } from '../parser/types';

export class TyranoCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): vscode.CompletionItem[] {
    const line = document.lineAt(position).text;
    const textBefore = line.substring(0, position.character);

    // Inside a tag — check if we're completing tag name or attributes
    const tagOpenIdx = textBefore.lastIndexOf('[');
    const tagCloseIdx = textBefore.lastIndexOf(']');

    // After @ at beginning of line — tag name completion
    if (/^@\w*$/.test(textBefore)) {
      return this.completeTagNames(textBefore.substring(1));
    }

    if (tagOpenIdx > tagCloseIdx) {
      // We're inside [ ... ]
      const insideTag = textBefore.substring(tagOpenIdx + 1);

      // Check if we're at the tag name position
      if (!/\s/.test(insideTag)) {
        return this.completeTagNames(insideTag);
      }

      // We're in the attributes area — figure out the tag name
      const tagNameMatch = insideTag.match(/^(\w+)/);
      if (!tagNameMatch) return [];
      const tagName = tagNameMatch[1].toLowerCase();

      // Check if we're completing an attribute value (after =)
      const attrValueMatch = textBefore.match(/(\w+)=["']?([^"'\s]*)$/);
      if (attrValueMatch) {
        return this.completeAttributeValue(tagName, attrValueMatch[1], attrValueMatch[2], document);
      }

      // Complete attribute names
      return this.completeAttributeNames(tagName, insideTag);
    }

    // Label completion after *
    if (textBefore.endsWith('*')) {
      return this.completeLabels();
    }

    return [];
  }

  private completeTagNames(prefix: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const [name, tagDef] of TAG_DATABASE) {
      if (!name.startsWith(prefix.toLowerCase())) continue;

      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = `[${name}] — ${tagDef.category}`;
      item.documentation = new vscode.MarkdownString(
        `${tagDef.description}\n\n${tagDef.descriptionJa ?? ''}`
      );

      // Build snippet with required params
      const requiredParams = tagDef.params.filter(p => p.required);
      if (requiredParams.length > 0) {
        const paramSnippets = requiredParams.map((p, i) => `${p.name}="\${${i + 1}:${p.default ?? ''}}"`);
        item.insertText = new vscode.SnippetString(`${name} ${paramSnippets.join(' ')}`);
      } else {
        item.insertText = name;
      }

      item.sortText = tagDef.isClosing ? `zzz_${name}` : name;
      items.push(item);
    }

    // Also complete user-defined macros
    const index = this.getIndex();
    if (index) {
      for (const [macroName] of index.globalMacros) {
        if (!macroName.startsWith(prefix.toLowerCase())) continue;
        const item = new vscode.CompletionItem(macroName, vscode.CompletionItemKind.Method);
        item.detail = `[${macroName}] — user macro`;
        item.sortText = `macro_${macroName}`;
        items.push(item);
      }
    }

    return items;
  }

  private completeAttributeNames(tagName: string, insideTag: string): vscode.CompletionItem[] {
    const tagDef = TAG_DATABASE.get(tagName);
    if (!tagDef) return this.completeGenericAttributes();

    // Find which attributes are already used
    const usedAttrs = new Set<string>();
    const attrMatches = insideTag.matchAll(/(\w+)\s*=/g);
    for (const match of attrMatches) {
      usedAttrs.add(match[1]);
    }

    const items: vscode.CompletionItem[] = [];
    for (const param of tagDef.params) {
      if (usedAttrs.has(param.name)) continue;

      const item = new vscode.CompletionItem(param.name, vscode.CompletionItemKind.Property);
      item.detail = `${param.type}${param.required ? ' (required)' : ''}`;
      item.documentation = new vscode.MarkdownString(
        `${param.description}\n\n${param.descriptionJa ?? ''}${param.default ? `\n\nDefault: \`${param.default}\`` : ''}`
      );
      item.insertText = new vscode.SnippetString(`${param.name}="\${1:${param.default ?? ''}}"`);
      item.sortText = param.required ? `0_${param.name}` : `1_${param.name}`;
      items.push(item);
    }

    return items;
  }

  private completeAttributeValue(
    tagName: string,
    attrName: string,
    currentValue: string,
    document: vscode.TextDocument,
  ): vscode.CompletionItem[] {
    const tagDef = TAG_DATABASE.get(tagName);
    if (!tagDef) return [];

    const paramDef = tagDef.params.find(p => p.name === attrName);
    if (!paramDef) return [];

    const items: vscode.CompletionItem[] = [];

    // Enum values
    if (paramDef.type === 'enum' && paramDef.enumValues) {
      for (const val of paramDef.enumValues) {
        items.push(new vscode.CompletionItem(val, vscode.CompletionItemKind.EnumMember));
      }
    }

    // Boolean values
    if (paramDef.type === 'boolean') {
      items.push(new vscode.CompletionItem('true', vscode.CompletionItemKind.Value));
      items.push(new vscode.CompletionItem('false', vscode.CompletionItemKind.Value));
    }

    // File references — search the project
    if (paramDef.type === 'file') {
      return this.completeFileReferences(tagDef, attrName, document);
    }

    // Label targets
    if (attrName === 'target') {
      return this.completeLabels();
    }

    return items;
  }

  private completeLabels(): vscode.CompletionItem[] {
    const index = this.getIndex();
    if (!index) return [];

    const items: vscode.CompletionItem[] = [];
    for (const [name, locations] of index.globalLabels) {
      const item = new vscode.CompletionItem(`*${name}`, vscode.CompletionItemKind.Reference);
      const loc = locations[0];
      if (loc) {
        item.detail = `${loc.file}:${loc.node.range.start.line + 1}`;
      }
      items.push(item);
    }
    return items;
  }

  private completeFileReferences(
    tagDef: TagDef,
    attrName: string,
    document: vscode.TextDocument,
  ): vscode.CompletionItem[] {
    // This will be populated by the workspace file scanner
    // For now, return empty — the file scanner runs asynchronously
    return [];
  }

  private completeGenericAttributes(): vscode.CompletionItem[] {
    // Common attributes that appear on many tags
    const common = ['cond', 'time', 'wait', 'name'];
    return common.map(name => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
      item.insertText = new vscode.SnippetString(`${name}="\${1}"`);
      return item;
    });
  }
}
