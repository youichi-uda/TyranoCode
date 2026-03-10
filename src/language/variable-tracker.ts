/**
 * TyranoScript variable tracker.
 * Provides a TreeView showing all tracked variables from the ProjectIndex,
 * organized by scope, name, and usage location.
 */

import * as vscode from 'vscode';
import { ProjectIndex, VariableInfo } from '../parser/types';

type VariableScope = 'f' | 'sf' | 'tf' | 'mp';

const SCOPE_LABELS: Record<VariableScope, string> = {
  f: 'f. (Game Variables)',
  sf: 'sf. (System Variables)',
  tf: 'tf. (Temporary Variables)',
  mp: 'mp. (Macro Parameters)',
};

const SCOPE_ICONS: Record<VariableScope, vscode.ThemeIcon> = {
  f: new vscode.ThemeIcon('database'),
  sf: new vscode.ThemeIcon('settings-gear'),
  tf: new vscode.ThemeIcon('clock'),
  mp: new vscode.ThemeIcon('symbol-parameter'),
};

/**
 * Tree item types to distinguish between the three levels of the tree.
 */
type TreeElement =
  | { kind: 'scope'; scope: VariableScope }
  | { kind: 'variable'; scope: VariableScope; name: string; infos: VariableInfo[] }
  | { kind: 'usage'; info: VariableInfo };

export class VariableTreeDataProvider implements vscode.TreeDataProvider<TreeElement> {

  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly getIndex: () => ProjectIndex | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    switch (element.kind) {
      case 'scope':
        return this.buildScopeItem(element);
      case 'variable':
        return this.buildVariableItem(element);
      case 'usage':
        return this.buildUsageItem(element);
    }
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.getRootElements();
    }

    switch (element.kind) {
      case 'scope':
        return this.getVariablesForScope(element.scope);
      case 'variable':
        return element.infos.map(info => ({ kind: 'usage' as const, info }));
      case 'usage':
        return [];
    }
  }

  /**
   * Root level: one item per scope that has variables.
   */
  private getRootElements(): TreeElement[] {
    const index = this.getIndex();
    if (!index) return [];
    const scopesWithVars = new Set<VariableScope>();

    for (const infos of index.variables.values()) {
      for (const info of infos) {
        scopesWithVars.add(info.scope);
      }
    }

    const order: VariableScope[] = ['f', 'sf', 'tf', 'mp'];
    return order
      .filter(s => scopesWithVars.has(s))
      .map(scope => ({ kind: 'scope' as const, scope }));
  }

  /**
   * Second level: unique variable names under a scope.
   */
  private getVariablesForScope(scope: VariableScope): TreeElement[] {
    const index = this.getIndex();
    if (!index) return [];
    const variableMap = new Map<string, VariableInfo[]>();

    for (const [fullName, infos] of index.variables) {
      for (const info of infos) {
        if (info.scope === scope) {
          const existing = variableMap.get(info.name) ?? [];
          existing.push(info);
          variableMap.set(info.name, existing);
        }
      }
    }

    const sorted = [...variableMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([name, infos]) => ({
      kind: 'variable' as const,
      scope,
      name,
      infos,
    }));
  }

  private buildScopeItem(element: { scope: VariableScope }): vscode.TreeItem {
    const item = new vscode.TreeItem(
      SCOPE_LABELS[element.scope],
      vscode.TreeItemCollapsibleState.Expanded,
    );
    item.iconPath = SCOPE_ICONS[element.scope];
    item.contextValue = 'scope';
    return item;
  }

  private buildVariableItem(
    element: { scope: VariableScope; name: string; infos: VariableInfo[] },
  ): vscode.TreeItem {
    const readCount = element.infos.filter(i => i.usage === 'read').length;
    const writeCount = element.infos.filter(i => i.usage === 'write').length;

    const item = new vscode.TreeItem(
      `${element.scope}.${element.name}`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    item.description = `${writeCount} write, ${readCount} read`;
    item.iconPath = new vscode.ThemeIcon('symbol-variable');
    item.contextValue = 'variable';
    return item;
  }

  private buildUsageItem(element: { info: VariableInfo }): vscode.TreeItem {
    const { info } = element;
    const line = info.range.start.line + 1; // display as 1-based
    const label = `${info.file}:${line}`;

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = info.usage;
    item.iconPath = info.usage === 'write'
      ? new vscode.ThemeIcon('edit')
      : new vscode.ThemeIcon('eye');
    item.contextValue = 'usage';

    // Click to navigate to the usage location.
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const uri = vscode.Uri.joinPath(workspaceFolder.uri, info.file);
      const startPos = new vscode.Position(info.range.start.line, info.range.start.column);
      const endPos = new vscode.Position(info.range.end.line, info.range.end.column);
      item.command = {
        command: 'vscode.open',
        title: 'Go to usage',
        arguments: [uri, { selection: new vscode.Range(startPos, endPos) }],
      };
    }

    return item;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

/**
 * Register the variable tracker TreeView and the tyranodev.showVariables command.
 */
export function registerVariableTracker(
  context: vscode.ExtensionContext,
  getIndex: () => ProjectIndex | undefined,
): VariableTreeDataProvider {
  const treeDataProvider = new VariableTreeDataProvider(getIndex);

  const treeView = vscode.window.createTreeView('tyranodev.variablesView', {
    treeDataProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    treeView,
    { dispose: () => treeDataProvider.dispose() },
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.showVariables', () => {
      // Reveal the tree view in the sidebar.
      vscode.commands.executeCommand('tyranodev.variablesView.focus');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.refreshVariables', () => {
      treeDataProvider.refresh();
    }),
  );

  return treeDataProvider;
}
