/**
 * Call hierarchy provider for TyranoScript .ks files.
 * Tracks scenario flow via [jump], [call], and [link] tags,
 * showing incoming and outgoing calls between label sections.
 */

import * as vscode from 'vscode';
import {
  ProjectIndex,
  ScenarioNode,
  TagNode,
  LabelNode,
  Range as AstRange,
} from '../parser/types';

/** Tag names that represent scenario flow transitions. */
const FLOW_TAGS = new Set(['jump', 'call', 'link']);

/**
 * Convert a 0-based AST Range to a VS Code Range.
 */
function toVscodeRange(r: AstRange): vscode.Range {
  return new vscode.Range(
    new vscode.Position(r.start.line, r.start.column),
    new vscode.Position(r.end.line, r.end.column),
  );
}

/**
 * Extract the target label name from a flow tag's attributes.
 * Strips the leading '*' if present.
 */
function getTargetLabel(tag: TagNode): string | undefined {
  for (const attr of tag.attributes) {
    if (attr.name === 'target' && attr.value) {
      return attr.value.replace(/^\*/, '');
    }
  }
  return undefined;
}

/**
 * Extract the storage (file) attribute from a flow tag.
 */
function getStorageAttr(tag: TagNode): string | undefined {
  for (const attr of tag.attributes) {
    if (attr.name === 'storage' && attr.value) {
      return attr.value;
    }
  }
  return undefined;
}

/**
 * Resolve an index file path to a VS Code Uri using workspace folders.
 */
function resolveUri(filePath: string): vscode.Uri {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
  }
  return vscode.Uri.file(filePath);
}

/**
 * Find the nearest preceding label for a given line in a flat list of nodes.
 * Returns undefined if the position is before any label.
 */
function findEnclosingLabel(nodes: ScenarioNode[], line: number): LabelNode | undefined {
  let best: LabelNode | undefined;
  for (const node of nodes) {
    if (node.type === 'label' && node.range.start.line <= line) {
      best = node;
    }
    if (node.range.start.line > line) break;
  }
  return best;
}

/**
 * Collect all top-level nodes that belong to a label section:
 * from the label node up to (but not including) the next label.
 */
function getNodesInLabelSection(
  nodes: ScenarioNode[],
  labelName: string,
): ScenarioNode[] {
  const result: ScenarioNode[] = [];
  let collecting = false;

  for (const node of nodes) {
    if (node.type === 'label') {
      if (collecting) break;
      if (node.name === labelName) {
        collecting = true;
      }
      continue;
    }
    if (collecting) {
      result.push(node);
    }
  }

  return result;
}

/**
 * Recursively collect flow tags ([jump], [call], [link]) from a list of nodes.
 */
function collectFlowTags(nodes: ScenarioNode[]): TagNode[] {
  const tags: TagNode[] = [];
  for (const node of nodes) {
    if (node.type === 'tag' && FLOW_TAGS.has(node.name)) {
      tags.push(node);
    } else if (node.type === 'if_block') {
      tags.push(...collectFlowTags(node.thenBranch));
      for (const branch of node.elsifBranches) {
        tags.push(...collectFlowTags(branch.body));
      }
      if (node.elseBranch) {
        tags.push(...collectFlowTags(node.elseBranch));
      }
    } else if (node.type === 'macro_def') {
      tags.push(...collectFlowTags(node.body));
    }
  }
  return tags;
}

/**
 * Create a CallHierarchyItem for a label node in a given file.
 */
function createItemForLabel(label: LabelNode, file: string): vscode.CallHierarchyItem {
  const uri = resolveUri(file);
  return new vscode.CallHierarchyItem(
    vscode.SymbolKind.Key,
    `*${label.name}`,
    file,
    uri,
    toVscodeRange(label.range),
    toVscodeRange(label.nameRange),
  );
}

/**
 * Provides call hierarchy support for TyranoScript .ks files.
 *
 * A "call" in TyranoScript is a [jump], [call], or [link] tag that
 * transitions from one label section to another. The hierarchy allows
 * navigating these transitions in both directions.
 */
export class TyranoCallHierarchyProvider implements vscode.CallHierarchyProvider {
  constructor(private getIndex: () => ProjectIndex | undefined) {}

  prepareCallHierarchy(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.CallHierarchyItem | undefined {
    const index = this.getIndex();
    if (!index) return undefined;

    const line = document.lineAt(position).text;

    // Case 1: Cursor is on a *label line
    const labelMatch = line.match(/^\*(\w+)/);
    if (labelMatch) {
      const labelName = labelMatch[1];
      const entries = index.globalLabels.get(labelName);
      if (entries && entries.length > 0) {
        // Prefer the entry from the current file
        const currentFile = this.findFileInIndex(document.uri, index);
        const entry = entries.find(e => this.isSameUri(e.file, document.uri)) ?? entries[0];
        return createItemForLabel(entry.node, entry.file);
      }
      return undefined;
    }

    // Case 2: Cursor is on a [jump], [call], or [link] tag — resolve its target
    const tagMatch = line.match(/\[\s*(jump|call|link)\b/);
    if (tagMatch) {
      const targetMatch = line.match(/target\s*=\s*["']?\*?(\w+)/);
      if (targetMatch) {
        const targetLabel = targetMatch[1];
        const storageMatch = line.match(/storage\s*=\s*["']?(\S+?)["'\s\]]/);

        // If a storage attribute is given, look for the label in that file
        if (storageMatch) {
          const storageFile = storageMatch[1];
          for (const [file, scenario] of index.scenarios) {
            if (file.endsWith(storageFile) || file === storageFile) {
              const label = scenario.labels.get(targetLabel);
              if (label) {
                return createItemForLabel(label, file);
              }
            }
          }
        }

        // Otherwise search globally
        const entries = index.globalLabels.get(targetLabel);
        if (entries && entries.length > 0) {
          return createItemForLabel(entries[0].node, entries[0].file);
        }
      }
    }

    return undefined;
  }

  provideCallHierarchyIncomingCalls(
    item: vscode.CallHierarchyItem,
    _token: vscode.CancellationToken,
  ): vscode.CallHierarchyIncomingCall[] {
    const index = this.getIndex();
    if (!index) return [];

    // Extract the label name from the item (strip leading '*')
    const labelName = item.name.replace(/^\*/, '');
    const results: vscode.CallHierarchyIncomingCall[] = [];

    // Search all scenarios for flow tags targeting this label
    for (const [file, scenario] of index.scenarios) {
      const flowTags = collectFlowTags(scenario.nodes);

      for (const tag of flowTags) {
        const target = getTargetLabel(tag);
        if (target !== labelName) continue;

        // If the tag specifies a storage file, check it matches the item's file
        const storage = getStorageAttr(tag);
        if (storage) {
          const itemFile = item.detail;
          if (itemFile && !itemFile.endsWith(storage) && itemFile !== storage) {
            continue;
          }
        }

        // Find which label section this tag belongs to
        const enclosingLabel = findEnclosingLabel(scenario.nodes, tag.range.start.line);
        let callerItem: vscode.CallHierarchyItem;

        if (enclosingLabel) {
          callerItem = createItemForLabel(enclosingLabel, file);
        } else {
          // Tag is before any label — represent as the file itself
          const uri = resolveUri(file);
          callerItem = new vscode.CallHierarchyItem(
            vscode.SymbolKind.File,
            file,
            '',
            uri,
            new vscode.Range(0, 0, 0, 0),
            new vscode.Range(0, 0, 0, 0),
          );
        }

        const fromRange = toVscodeRange(tag.range);
        results.push(new vscode.CallHierarchyIncomingCall(callerItem, [fromRange]));
      }
    }

    return results;
  }

  provideCallHierarchyOutgoingCalls(
    item: vscode.CallHierarchyItem,
    _token: vscode.CancellationToken,
  ): vscode.CallHierarchyOutgoingCall[] {
    const index = this.getIndex();
    if (!index) return [];

    const labelName = item.name.replace(/^\*/, '');
    const results: vscode.CallHierarchyOutgoingCall[] = [];

    // Find the scenario file containing this label
    const itemFile = item.detail;
    let targetScenario: { file: string; nodes: ScenarioNode[] } | undefined;

    for (const [file, scenario] of index.scenarios) {
      if (file === itemFile || this.isSameUri(file, item.uri)) {
        targetScenario = { file, nodes: scenario.nodes };
        break;
      }
    }

    if (!targetScenario) return results;

    // Collect nodes in this label's section
    const sectionNodes = getNodesInLabelSection(targetScenario.nodes, labelName);
    const flowTags = collectFlowTags(sectionNodes);

    for (const tag of flowTags) {
      const targetLabel = getTargetLabel(tag);
      if (!targetLabel) continue;

      const storage = getStorageAttr(tag);

      // Resolve the target label
      let targetEntry: { file: string; node: LabelNode } | undefined;

      if (storage) {
        // Look for the label in the specified storage file
        for (const [file, scenario] of index.scenarios) {
          if (file.endsWith(storage) || file === storage) {
            const label = scenario.labels.get(targetLabel);
            if (label) {
              targetEntry = { file, node: label };
              break;
            }
          }
        }
      }

      if (!targetEntry) {
        // Search globally
        const entries = index.globalLabels.get(targetLabel);
        if (entries && entries.length > 0) {
          targetEntry = entries[0];
        }
      }

      if (targetEntry) {
        const calleeItem = createItemForLabel(targetEntry.node, targetEntry.file);
        const fromRange = toVscodeRange(tag.range);
        results.push(new vscode.CallHierarchyOutgoingCall(calleeItem, [fromRange]));
      }
    }

    return results;
  }

  /**
   * Find the index file path that corresponds to a document URI.
   */
  private findFileInIndex(uri: vscode.Uri, index: ProjectIndex): string | undefined {
    for (const file of index.scenarios.keys()) {
      if (this.isSameUri(file, uri)) {
        return file;
      }
    }
    return undefined;
  }

  /**
   * Check whether an index file path corresponds to the given Uri.
   */
  private isSameUri(indexPath: string, uri: vscode.Uri): boolean {
    const resolved = resolveUri(indexPath);
    return resolved.fsPath === uri.fsPath;
  }
}
