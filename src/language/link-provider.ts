/**
 * DocumentLinkProvider for TyranoScript .ks files.
 * Makes file references in storage/file attributes clickable.
 */

import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import { ScenarioNode, TagNode } from '../parser/types';
import { localize } from './i18n';

/** Map tag names to their default asset subdirectory (or directories for fallback). */
const TAG_FOLDERS: ReadonlyMap<string, readonly string[]> = new Map([
  ['jump', ['data/scenario']],
  ['call', ['data/scenario']],
  ['bg', ['data/bgimage']],
  ['image', ['data/image', 'data/fgimage']],
  ['chara_new', ['data/fgimage']],
  ['chara_face', ['data/fgimage']],
  ['chara_mod', ['data/fgimage']],
  ['chara_show', ['data/fgimage']],
  ['playbgm', ['data/bgm']],
  ['fadeinbgm', ['data/bgm']],
  ['xchgbgm', ['data/bgm']],
  ['playse', ['data/sound']],
  ['fadeinse', ['data/sound']],
  ['movie', ['data/video']],
  ['bgmovie', ['data/video']],
  ['loadjs', ['data/others']],
  ['loadcss', ['data/others']],
]);

/** Attribute names that reference files. */
const FILE_ATTR_NAMES = new Set(['storage', 'file']);

/**
 * Extended DocumentLink that carries candidate URIs for lazy resolution.
 * When multiple folders are possible (e.g. image tag), we defer the
 * final target until resolveDocumentLink checks which file exists.
 */
interface TyranoDocumentLink extends vscode.DocumentLink {
  candidateUris?: vscode.Uri[];
}

export class TyranoLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.DocumentLink[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];

    const parser = new Parser(document.uri.fsPath);
    const scenario = parser.parse(document.getText());
    const links: vscode.DocumentLink[] = [];

    this.collectLinks(scenario.nodes, workspaceFolder.uri, links);

    return links;
  }

  async resolveDocumentLink(
    link: TyranoDocumentLink,
    _token: vscode.CancellationToken,
  ): Promise<vscode.DocumentLink> {
    if (!link.candidateUris || link.candidateUris.length === 0) {
      return link;
    }

    // Try each candidate URI; use the first that exists on disk.
    for (const uri of link.candidateUris) {
      try {
        await vscode.workspace.fs.stat(uri);
        link.target = uri;
        return link;
      } catch {
        // File not found — try next candidate.
      }
    }

    // None found; fall back to the first candidate so the user still
    // gets a clickable link (VS Code will show "file not found").
    link.target = link.candidateUris[0];
    return link;
  }

  private collectLinks(
    nodes: ScenarioNode[],
    workspaceUri: vscode.Uri,
    links: vscode.DocumentLink[],
  ): void {
    for (const node of nodes) {
      if (node.type === 'tag') {
        this.processTag(node, workspaceUri, links);
      } else if (node.type === 'macro_def') {
        this.collectLinks(node.body, workspaceUri, links);
      } else if (node.type === 'if_block') {
        this.collectLinks(node.thenBranch, workspaceUri, links);
        for (const branch of node.elsifBranches) {
          this.collectLinks(branch.body, workspaceUri, links);
        }
        if (node.elseBranch) {
          this.collectLinks(node.elseBranch, workspaceUri, links);
        }
      }
    }
  }

  private processTag(
    tag: TagNode,
    workspaceUri: vscode.Uri,
    links: vscode.DocumentLink[],
  ): void {
    const folders = TAG_FOLDERS.get(tag.name);
    if (!folders) return;

    for (const attr of tag.attributes) {
      if (!FILE_ATTR_NAMES.has(attr.name) || !attr.value || !attr.valueRange) {
        continue;
      }

      const filename = stripQuotes(attr.value);
      if (!filename) continue;

      const range = new vscode.Range(
        new vscode.Position(attr.valueRange.start.line, attr.valueRange.start.column),
        new vscode.Position(attr.valueRange.end.line, attr.valueRange.end.column),
      );

      const candidateUris = folders.map(folder =>
        vscode.Uri.joinPath(workspaceUri, folder, filename),
      );

      if (candidateUris.length === 1) {
        // Single folder — set target immediately, no resolve needed.
        const link = new vscode.DocumentLink(range, candidateUris[0]);
        link.tooltip = localize(`Open ${filename}`, `${filename} を開く`);
        links.push(link);
      } else {
        // Multiple candidates — defer resolution to resolveDocumentLink.
        const link: TyranoDocumentLink = new vscode.DocumentLink(range);
        link.tooltip = localize(`Open ${filename}`, `${filename} を開く`);
        link.candidateUris = candidateUris;
        links.push(link);
      }
    }
  }
}

/**
 * Remove surrounding quotes from an attribute value if present.
 * The parser may include quotes as part of the value string.
 */
function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
