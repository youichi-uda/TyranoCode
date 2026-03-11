/**
 * TyranoScript snippet completions.
 * Provides commonly used TyranoScript patterns as VS Code snippet completions,
 * covering scene setup, branching, macros, characters, audio, and transitions.
 */

import * as vscode from 'vscode';
import { localize } from './i18n';

interface SnippetDef {
  prefix: string;
  label: string;
  description: string;
  descriptionJa?: string;
  body: string;
}

const SNIPPETS: SnippetDef[] = [
  {
    prefix: 'scene',
    label: 'scene',
    description: 'Full scene template with background, character, and dialog',
    descriptionJa: '背景・キャラクター・セリフを含むシーンテンプレート',
    body: [
      '*${1:scene_name}',
      '[bg storage="${2:background.jpg}" time=1000]',
      '[chara_show name="${3:character}" left=400]',
      '[#${3:character}]',
      '${4:Dialog text}[p]',
      '[cm]',
    ].join('\n'),
  },
  {
    prefix: 'choice',
    label: 'choice',
    description: 'Choice/branching template with glink options',
    descriptionJa: 'glink を使った選択肢テンプレート',
    body: [
      '[glink text="${1:Choice 1}" target="*${2:label1}" color="0x4488ff"]',
      '[glink text="${3:Choice 2}" target="*${4:label2}" color="0x4488ff"]',
      '[s]',
    ].join('\n'),
  },
  {
    prefix: 'ifblock',
    label: 'ifblock',
    description: 'If/else conditional block',
    descriptionJa: 'if/else 条件分岐ブロック',
    body: [
      '[if exp="${1:condition}"]',
      '${2:then content}',
      '[else]',
      '${3:else content}',
      '[endif]',
    ].join('\n'),
  },
  {
    prefix: 'macro',
    label: 'macro',
    description: 'Macro definition block',
    descriptionJa: 'マクロ定義ブロック',
    body: [
      '[macro name="${1:macro_name}"]',
      '${2:body}',
      '[endmacro]',
    ].join('\n'),
  },
  {
    prefix: 'chara',
    label: 'chara',
    description: 'Character introduction (define and show)',
    descriptionJa: 'キャラクター登場（定義＋表示）',
    body: [
      '[chara_new name="${1:name}" storage="${2:default.png}" jname="${3:Display Name}"]',
      '[chara_show name="${1:name}" left=${4:400} top=${5:80} time=600]',
    ].join('\n'),
  },
  {
    prefix: 'bgm',
    label: 'bgm',
    description: 'Play background music with fade-in',
    descriptionJa: 'BGM をフェードイン再生',
    body: '[playbgm storage="${1:music.ogg}" loop=true time=${2:2000}]',
  },
  {
    prefix: 'transition',
    label: 'transition',
    description: 'Scene transition with mask effect',
    descriptionJa: 'マスクエフェクトによるシーン切替',
    body: [
      '[mask time=${1:1000} effect="${2:fadeIn}" color=0x000000]',
      '[bg storage="${3:background.jpg}"]',
      '[mask_off time=${1:1000}]',
    ].join('\n'),
  },
];

/**
 * Registers a CompletionItemProvider that supplies TyranoScript snippet completions.
 * Snippets trigger when the user types a matching prefix at the start of a line
 * or after whitespace.
 *
 * @param context The extension context to push the disposable subscription into.
 * @param languageId The language identifier to register for (typically 'tyranoscript').
 */
export function registerSnippets(
  context: vscode.ExtensionContext,
  languageId: string,
): void {
  const provider: vscode.CompletionItemProvider = {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken,
      _completionContext: vscode.CompletionContext,
    ): vscode.CompletionItem[] {
      const lineText = document.lineAt(position).text;
      const textBefore = lineText.substring(0, position.character);

      // Only offer snippets when the cursor is at the beginning of a line
      // or the typed text looks like the start of a snippet prefix.
      // Skip if we appear to be inside a tag (after an unmatched [).
      const lastOpen = textBefore.lastIndexOf('[');
      const lastClose = textBefore.lastIndexOf(']');
      if (lastOpen > lastClose) {
        return [];
      }

      const items: vscode.CompletionItem[] = [];

      for (const snippet of SNIPPETS) {
        const item = new vscode.CompletionItem(
          snippet.label,
          vscode.CompletionItemKind.Snippet,
        );
        item.detail = `TyranoScript: ${localize(snippet.description, snippet.descriptionJa)}`;
        item.documentation = new vscode.MarkdownString(
          '```tyranoscript\n' + snippet.body.replace(/\$\{\d+:([^}]*)}/g, '$1') + '\n```',
        );
        item.insertText = new vscode.SnippetString(snippet.body);
        item.sortText = `!snippet_${snippet.prefix}`;
        item.filterText = snippet.prefix;
        items.push(item);
      }

      return items;
    },
  };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: languageId },
      provider,
    ),
  );
}
