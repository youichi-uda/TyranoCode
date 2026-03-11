/**
 * TyranoScript autocompletion provider.
 * Provides tag names, attribute names, attribute values, and label/file completions.
 */

import * as vscode from 'vscode';
import { TAG_DATABASE, TagDef } from './tag-database';
import { ProjectIndex } from '../parser/types';
import { localize } from './i18n';

export class TyranoCompletionProvider implements vscode.CompletionItemProvider {
  /**
   * Maps tag names to the project-relative directories (under data/) and file
   * extensions that should be suggested for their storage= (or file=) attribute.
   */
  private static readonly RESOURCE_DIRS: ReadonlyMap<string, { dirs: string[]; extensions: string[] }> = new Map([
    ['jump',       { dirs: ['data/scenario'],  extensions: ['ks'] }],
    ['call',       { dirs: ['data/scenario'],  extensions: ['ks'] }],
    ['bg',         { dirs: ['data/bgimage'],   extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    ['image',      { dirs: ['data/image', 'data/fgimage'], extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    ['chara_new',  { dirs: ['data/fgimage'],   extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    ['chara_face', { dirs: ['data/fgimage'],   extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    ['chara_mod',  { dirs: ['data/fgimage'],   extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    ['playbgm',    { dirs: ['data/bgm'],       extensions: ['mp3', 'ogg', 'wav', 'm4a'] }],
    ['fadeinbgm',  { dirs: ['data/bgm'],       extensions: ['mp3', 'ogg', 'wav', 'm4a'] }],
    ['playse',     { dirs: ['data/sound'],      extensions: ['mp3', 'ogg', 'wav', 'm4a'] }],
    ['fadeinse',   { dirs: ['data/sound'],      extensions: ['mp3', 'ogg', 'wav', 'm4a'] }],
    ['movie',      { dirs: ['data/video'],      extensions: ['mp4', 'webm', 'ogv'] }],
    ['bgmovie',    { dirs: ['data/video'],      extensions: ['mp4', 'webm', 'ogv'] }],
    ['loadcss',    { dirs: ['data/others'],     extensions: ['css'] }],
    ['loadjs',     { dirs: ['data/others'],     extensions: ['js'] }],
  ]);

  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
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

      // Check if we're inside a storage= or file= attribute value — offer resource file completions
      const resourceAttrMatch = textBefore.match(/(?:storage|file)=(?:["']([^"']*)|(\S*))$/);
      if (resourceAttrMatch) {
        const partial = resourceAttrMatch[1] ?? resourceAttrMatch[2] ?? '';
        return this.completeResourceFiles(tagName, partial);
      }

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

    // Snippets are provided via package.json native snippet contribution
    return [];
  }

  private completeTagNames(prefix: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    for (const [name, tagDef] of TAG_DATABASE) {
      if (!name.startsWith(prefix.toLowerCase())) continue;

      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = `[${name}] — ${tagDef.category}`;
      item.documentation = new vscode.MarkdownString(
        localize(tagDef.description, tagDef.descriptionJa)
      );

      // Build snippet with required params
      const requiredParams = tagDef.params.filter(p => p.required);
      if (requiredParams.length > 0) {
        const paramSnippets = requiredParams.map((p, i) => `${p.name}="\${${i + 1}:${p.default ?? ''}}"`);
        item.insertText = new vscode.SnippetString(`${name} ${paramSnippets.join(' ')}`);
        // Re-trigger completion so the user sees value candidates (files, labels, etc.)
        item.command = { command: 'editor.action.triggerSuggest', title: 'Trigger Suggest' };
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
      item.detail = `${param.type}${param.required ? localize(' (required)', ' (必須)') : ''}`;
      item.documentation = new vscode.MarkdownString(
        `${localize(param.description, param.descriptionJa)}${param.default ? `\n\n${localize('Default', '既定値')}: \`${param.default}\`` : ''}`
      );
      item.insertText = new vscode.SnippetString(`${param.name}="\${1:${param.default ?? ''}}"`);
      item.sortText = param.required ? `0_${param.name}` : `1_${param.name}`;

      // For file/enum/boolean attributes, re-trigger completion after insertion
      // so the user immediately sees value candidates (resource files, enum values, etc.)
      if (param.type === 'file' || param.type === 'enum' || param.type === 'boolean'
          || param.name === 'storage' || param.name === 'target') {
        item.command = { command: 'editor.action.triggerSuggest', title: 'Trigger Suggest' };
      }

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

  /**
   * Asynchronously list resource files from the project directory that match
   * the given tag's expected resource type and return them as CompletionItems.
   */
  private async completeResourceFiles(
    tagName: string,
    currentValue: string,
  ): Promise<vscode.CompletionItem[]> {
    const resourceInfo = TyranoCompletionProvider.RESOURCE_DIRS.get(tagName);
    if (!resourceInfo) return [];

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return [];

    const items: vscode.CompletionItem[] = [];
    const seen = new Set<string>();

    for (const dir of resourceInfo.dirs) {
      const extGlob = resourceInfo.extensions.length === 1
        ? resourceInfo.extensions[0]
        : `{${resourceInfo.extensions.join(',')}}`;
      const pattern = new vscode.RelativePattern(
        workspaceFolders[0],
        `${dir}/**/*.${extGlob}`,
      );

      const files = await vscode.workspace.findFiles(pattern);

      for (const fileUri of files) {
        const fileName = fileUri.path.split('/').pop() ?? '';
        if (!fileName) continue;
        if (seen.has(fileName)) continue;
        seen.add(fileName);

        // Filter by what the user has typed so far
        if (currentValue && !fileName.toLowerCase().startsWith(currentValue.toLowerCase())) {
          continue;
        }

        const item = new vscode.CompletionItem(fileName, vscode.CompletionItemKind.File);
        item.detail = dir;
        items.push(item);
      }
    }

    return items;
  }

  private completeFileReferences(
    tagDef: TagDef,
    attrName: string,
    document: vscode.TextDocument,
  ): vscode.CompletionItem[] {
    // Retained for paramDef.type === 'file' fallback; resource completion is
    // handled by completeResourceFiles() which is invoked earlier in the chain.
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
