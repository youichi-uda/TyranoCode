/**
 * TyranoScript hover documentation provider.
 * Shows tag/attribute docs on hover, including image previews for storage attributes.
 */

import * as vscode from 'vscode';
import { TAG_DATABASE } from './tag-database';
import { ProjectIndex } from '../parser/types';
import { localize } from './i18n';

/** Maps tag names to the asset subdirectory for their storage attribute. */
const STORAGE_DIRS: ReadonlyMap<string, string[]> = new Map([
  ['bg',         ['data/bgimage']],
  ['image',      ['data/image', 'data/fgimage']],
  ['chara_new',  ['data/fgimage']],
  ['chara_face', ['data/fgimage']],
  ['chara_show', ['data/fgimage']],
  ['chara_mod',  ['data/fgimage']],
  ['playbgm',    ['data/bgm']],
  ['fadeinbgm',  ['data/bgm']],
  ['playse',     ['data/sound']],
  ['fadeinse',   ['data/sound']],
  ['movie',      ['data/video']],
  ['bgmovie',    ['data/video']],
]);

/** Image extensions for which a thumbnail preview is meaningful. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);

export class TyranoHoverProvider implements vscode.HoverProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.Hover | vscode.ProviderResult<vscode.Hover> {
    const line = document.lineAt(position).text;
    const wordRange = document.getWordRangeAtPosition(position, /[\w_.]+/);
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

      // Is this an attribute value for storage/file? → image preview
      const tagNameMatch = insideTag.match(/^(\w+)/);
      if (tagNameMatch) {
        const attrValueMatch = textBefore.match(/(\w+)\s*=\s*["']?([^"'\s\]]*)$/);
        if (attrValueMatch) {
          const attrName = attrValueMatch[1];
          if (attrName === 'storage' || attrName === 'file') {
            const imageHover = this.hoverImagePreview(tagNameMatch[1], word);
            if (imageHover) return imageHover;
          }
        }

        // Is this an attribute name?
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
              `**[${name}]** — ${localize('user macro', 'ユーザーマクロ')}\n\n${localize('Defined in', '定義場所')}: \`${macroDef.file}:${macroDef.node.range.start.line + 1}\``
            )
          );
        }
      }
      return undefined;
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**[${tagDef.name}]** — _${tagDef.category}_\n\n`);
    md.appendMarkdown(`${localize(tagDef.description, tagDef.descriptionJa)}\n\n`);

    if (tagDef.params.length > 0) {
      md.appendMarkdown(`### ${localize('Parameters', 'パラメータ')}\n\n`);
      md.appendMarkdown(`| ${localize('Name', '名前')} | ${localize('Type', '型')} | ${localize('Required', '必須')} | ${localize('Default', '既定値')} | ${localize('Description', '説明')} |\n`);
      md.appendMarkdown('|------|------|----------|---------|-------------|\n');
      for (const p of tagDef.params) {
        md.appendMarkdown(
          `| \`${p.name}\` | ${p.type} | ${p.required ? '**yes**' : 'no'} | ${p.default ?? '—'} | ${localize(p.description, p.descriptionJa)} |\n`
        );
      }
    }

    if (tagDef.closingTag) {
      md.appendMarkdown(`\n\n${localize('Closing tag', '閉じタグ')}: \`[${tagDef.closingTag}]\``);
    }

    return new vscode.Hover(md);
  }

  /**
   * Show an image thumbnail preview when hovering over a storage/file attribute value.
   */
  private hoverImagePreview(
    tagName: string,
    fileName: string,
  ): vscode.ProviderResult<vscode.Hover> {
    const dirs = STORAGE_DIRS.get(tagName.toLowerCase());
    if (!dirs) return undefined;

    // Only preview image files
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!IMAGE_EXTENSIONS.has(ext)) return undefined;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;

    // Try each candidate directory; return the first that exists
    return this.findImageAndBuildHover(dirs, fileName, workspaceFolder.uri);
  }

  private async findImageAndBuildHover(
    dirs: string[],
    fileName: string,
    workspaceUri: vscode.Uri,
  ): Promise<vscode.Hover | undefined> {
    for (const dir of dirs) {
      const fileUri = vscode.Uri.joinPath(workspaceUri, dir, fileName);
      try {
        await vscode.workspace.fs.stat(fileUri);
        const md = new vscode.MarkdownString();
        md.supportHtml = true;
        md.isTrusted = true;
        md.appendMarkdown(`**${fileName}**\n\n`);
        md.appendMarkdown(`\`${dir}/${fileName}\`\n\n`);
        md.appendMarkdown(`![${fileName}](${fileUri.toString()}|width=320)`);
        return new vscode.Hover(md);
      } catch {
        // File not found in this directory — try next.
      }
    }
    return undefined;
  }

  private hoverAttribute(tagName: string, attrName: string): vscode.Hover | undefined {
    const tagDef = TAG_DATABASE.get(tagName.toLowerCase());
    if (!tagDef) return undefined;

    const param = tagDef.params.find(p => p.name === attrName);
    if (!param) return undefined;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${param.name}** — \`${param.type}\`${param.required ? ' _(required)_' : ''}\n\n`);
    md.appendMarkdown(`${localize(param.description, param.descriptionJa)}\n\n`);
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
    md.appendMarkdown(`**\\*${name}** — ${localize('label', 'ラベル')}\n\n`);
    for (const loc of locations) {
      md.appendMarkdown(`- \`${loc.file}:${loc.node.range.start.line + 1}\`\n`);
    }
    return new vscode.Hover(md);
  }

  private hoverVariable(scope: 'f' | 'sf' | 'tf', name: string): vscode.Hover | undefined {
    const scopeNames: Record<string, string> = {
      f: localize('Game variable (saved with save data)', 'ゲーム変数（セーブデータと共に保存）'),
      sf: localize('System variable (persistent across saves)', 'システム変数（セーブを跨いで永続化）'),
      tf: localize('Temporary variable (lost on page change)', '一時変数（ページ遷移で消滅）'),
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
        md.appendMarkdown(`${localize('Writes', '書込')}: ${writes.length} | ${localize('Reads', '読取')}: ${reads.length}\n`);
      }
    }

    return new vscode.Hover(md);
  }
}
