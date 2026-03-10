/**
 * TyranoCode — TyranoScript Development Suite
 *
 * Main extension entry point. Registers all providers and commands.
 *
 * FREE features:
 *   - Syntax highlighting (via TextMate grammar)
 *   - Tag autocompletion with documentation
 *   - Hover documentation for tags, attributes, variables
 *   - Real-time diagnostics / linting
 *   - Go-to-definition for labels and macros
 *   - Find all references
 *   - Project-wide indexing
 *
 * PRO features (license key required):
 *   - Breakpoint debugger with step execution
 *   - Scenario flow graph visualization
 *   - Auto-test runner (all routes)
 *   - Performance profiler
 *   - Refactoring tools (safe rename)
 */

import * as vscode from 'vscode';
import { TyranoCompletionProvider } from './language/completion-provider';
import { TyranoHoverProvider } from './language/hover-provider';
import { TyranoDiagnosticsProvider, DiagnosticsConfig } from './language/diagnostics';
import { TyranoDefinitionProvider, TyranoReferenceProvider } from './language/definition-provider';
import { ProjectIndexer } from './analyzer/project-indexer';
import { LicenseManager } from './license/license-manager';
import { FlowGraphProvider } from './flow-graph/flow-graph-provider';
import { TestRunner } from './test-runner/test-runner';

const LANGUAGE_ID = 'tyranoscript';

export function activate(context: vscode.ExtensionContext): void {
  console.log('TyranoCode activating...');

  // ── Core services ──
  const licenseManager = new LicenseManager();
  licenseManager.initialize();

  const indexer = new ProjectIndexer();
  const getIndex = () => indexer.getIndex();

  const getDiagConfig = (): DiagnosticsConfig => {
    const config = vscode.workspace.getConfiguration('tyranodev.diagnostics');
    return {
      enable: config.get('enable', true),
      undefinedLabel: config.get('undefinedLabel', true),
      undefinedMacro: config.get('undefinedMacro', true),
      missingResource: config.get('missingResource', true),
      unusedLabel: config.get('unusedLabel', true),
      unreachableCode: config.get('unreachableCode', true),
    };
  };

  const diagnostics = new TyranoDiagnosticsProvider(getIndex, getDiagConfig);

  // ── FREE: Language features ──

  // Autocompletion
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: LANGUAGE_ID },
      new TyranoCompletionProvider(getIndex),
      '[', '@', '=', '"', "'", '*',
    ),
  );

  // Hover
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: LANGUAGE_ID },
      new TyranoHoverProvider(getIndex),
    ),
  );

  // Go-to-definition
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: LANGUAGE_ID },
      new TyranoDefinitionProvider(getIndex),
    ),
  );

  // Find all references
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(
      { language: LANGUAGE_ID },
      new TyranoReferenceProvider(getIndex),
    ),
  );

  // Diagnostics — real-time analysis on document change
  context.subscriptions.push(diagnostics.collection);

  const analyzeDocument = (document: vscode.TextDocument) => {
    if (document.languageId !== LANGUAGE_ID) return;
    const parsed = diagnostics.analyzeDocument(document);
    indexer.indexDocument(document);
  };

  // Analyze open documents on activation
  vscode.workspace.textDocuments.forEach(analyzeDocument);

  // Analyze on change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => analyzeDocument(e.document)),
  );

  // Analyze on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(analyzeDocument),
  );

  // Remove from index on close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.languageId === LANGUAGE_ID) {
        diagnostics.collection.delete(doc.uri);
      }
    }),
  );

  // Re-analyze on config change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('tyranodev')) {
        vscode.workspace.textDocuments.forEach(analyzeDocument);
      }
    }),
  );

  // ── FREE: Analyze project command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.analyzeProject', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'TyranoCode: Indexing project...' },
        async () => {
          await indexer.indexWorkspace();
          const idx = indexer.getIndex();
          vscode.window.showInformationMessage(
            `TyranoCode: Indexed ${idx.scenarios.size} files, ${idx.globalLabels.size} labels, ${idx.globalMacros.size} macros, ${idx.variables.size} variables.`,
          );
        },
      );
    }),
  );

  // ── PRO: Flow Graph ──
  const flowGraphProvider = new FlowGraphProvider(getIndex, context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.showFlowGraph', async () => {
      if (!(await licenseManager.requirePro('flow-graph'))) return;

      // Ensure project is indexed
      if (indexer.getIndex().scenarios.size === 0) {
        await indexer.indexWorkspace();
      }

      const panel = vscode.window.createWebviewPanel(
        'tyranodev.flowGraph',
        'TyranoCode: Scenario Flow Graph',
        vscode.ViewColumn.Beside,
        { enableScripts: true },
      );

      const graph = flowGraphProvider.buildGraph();
      panel.webview.html = (flowGraphProvider as any).getHtml(graph);

      panel.webview.onDidReceiveMessage(msg => {
        if (msg.type === 'navigate') {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, msg.file);
            vscode.window.showTextDocument(uri, {
              selection: new vscode.Range(msg.line, 0, msg.line, 0),
            });
          }
        }
      });
    }),
  );

  // ── PRO: Auto-Test Runner ──
  const testRunner = new TestRunner(getIndex);

  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.runAllRoutes', async () => {
      if (!(await licenseManager.requirePro('auto-test'))) return;

      if (indexer.getIndex().scenarios.size === 0) {
        await indexer.indexWorkspace();
      }

      await testRunner.runAllRoutes();
    }),
  );

  // ── PRO: Profiler (stub) ──
  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.profileScene', async () => {
      if (!(await licenseManager.requirePro('profiler'))) return;
      vscode.window.showInformationMessage('TyranoCode Profiler: Coming soon in next release.');
    }),
  );

  // ── PRO: Refactoring ──
  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.renameSymbol', async () => {
      if (!(await licenseManager.requirePro('refactoring'))) return;
      // Will use workspace edit to rename across files
      vscode.window.showInformationMessage('TyranoCode Rename: Coming soon in next release.');
    }),
  );

  // ── Go to definition command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.goToDefinition', () => {
      vscode.commands.executeCommand('editor.action.revealDefinition');
    }),
  );

  // ── Find all references command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.findAllReferences', () => {
      vscode.commands.executeCommand('editor.action.goToReferences');
    }),
  );

  // ── License activation command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('tyranodev.activateLicense', () => {
      licenseManager.activateLicense();
    }),
  );

  // ── Cleanup ──
  context.subscriptions.push(
    { dispose: () => licenseManager.dispose() },
    { dispose: () => indexer.dispose() },
    { dispose: () => diagnostics.dispose() },
    { dispose: () => testRunner.dispose() },
  );

  // ── Initial workspace index ──
  indexer.indexWorkspace();

  // ── Status bar ──
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.text = licenseManager.isProLicensed ? '$(star-full) TyranoCode Pro' : '$(code) TyranoCode';
  statusBar.tooltip = licenseManager.isProLicensed
    ? 'TyranoCode Pro — All features unlocked'
    : 'TyranoCode Free — Click to activate Pro license';
  statusBar.command = licenseManager.isProLicensed ? undefined : 'tyranodev.activateLicense';
  statusBar.show();
  context.subscriptions.push(statusBar);

  licenseManager.onDidChange(isValid => {
    statusBar.text = isValid ? '$(star-full) TyranoCode Pro' : '$(code) TyranoCode';
    statusBar.tooltip = isValid
      ? 'TyranoCode Pro — All features unlocked'
      : 'TyranoCode Free — Click to activate Pro license';
    statusBar.command = isValid ? undefined : 'tyranodev.activateLicense';
  });

  console.log('TyranoCode activated successfully.');
}

export function deactivate(): void {
  console.log('TyranoCode deactivated.');
}
