/**
 * TyranoCode Dashboard — sidebar WebView panel.
 * Provides GUI buttons for all major commands so users don't need Ctrl+Shift+P.
 *
 * IMPORTANT: webview.html is set exactly ONCE in resolveWebviewView().
 * All subsequent updates use postMessage() to avoid VS Code Service Worker
 * re-registration errors that occur when html is reassigned.
 */

import * as vscode from 'vscode';
import { localize } from '../language/i18n';

export class DashboardProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'tyranodev.dashboard';
  private view?: vscode.WebviewView;
  private isProLicensed = false;
  private scenarioCount = 0;
  private labelCount = 0;
  private macroCount = 0;
  private variableCount = 0;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    const nonce = this.getNonce();
    webviewView.webview.html = this.getHtml(webviewView.webview, nonce);

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'command') {
        vscode.commands.executeCommand(msg.command);
      }
    });

    // Send current state once webview is ready
    this.postUpdate();
  }

  updateLicense(isValid: boolean): void {
    this.isProLicensed = isValid;
    this.postUpdate();
  }

  updateStats(scenarios: number, labels: number, macros: number, variables: number): void {
    this.scenarioCount = scenarios;
    this.labelCount = labels;
    this.macroCount = macros;
    this.variableCount = variables;
    this.postUpdate();
  }

  private postUpdate(): void {
    this.view?.webview.postMessage({
      type: 'update',
      pro: this.isProLicensed,
      scenarios: this.scenarioCount,
      labels: this.labelCount,
      macros: this.macroCount,
      variables: this.variableCount,
      // Localized license bar text (changes at runtime)
      licenseProText: '\u2605 TyranoCode Pro',
      licenseFreeText: localize(
        '\uD83D\uDD11 Free \u2014 Activate Pro',
        '\uD83D\uDD11 Free \u2014 Pro\u3092\u6709\u52B9\u5316',
      ),
    });
  }

  private getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  private getHtml(webview: vscode.Webview, nonce: string): string {
    // Pre-localize all static strings at HTML generation time
    const t = {
      project: localize('Project', '\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8'),
      scenarios: localize('Scenarios', '\u30B7\u30CA\u30EA\u30AA'),
      labels: localize('Labels', '\u30E9\u30D9\u30EB'),
      macros: localize('Macros', '\u30DE\u30AF\u30ED'),
      variables: localize('Variables', '\u5909\u6570'),
      game: localize('Game', '\u30B2\u30FC\u30E0'),
      debugRun: localize('Debug Run', '\u30C7\u30D0\u30C3\u30B0\u5B9F\u884C'),
      scenePreview: localize('Scene Preview', '\u30B7\u30FC\u30F3\u30D7\u30EC\u30D3\u30E5\u30FC'),
      analysis: localize('Analysis', '\u89E3\u6790'),
      analyzeProject: localize('Analyze Project', '\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u89E3\u6790'),
      flowGraph: localize('Flow Graph', '\u30D5\u30ED\u30FC\u30B0\u30E9\u30D5'),
      allRouteTest: localize('All Route Test', '\u5168\u30EB\u30FC\u30C8\u30C6\u30B9\u30C8'),
      profiling: localize('Performance Profiling', '\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u8A08\u6E2C'),
      editing: localize('Editing', '\u7DE8\u96C6'),
      goToDefinition: localize('Go to Definition', '\u5B9A\u7FA9\u3078\u79FB\u52D5'),
      findReferences: localize('Find References', '\u53C2\u7167\u3092\u691C\u7D22'),
      variableList: localize('Variable List', '\u5909\u6570\u4E00\u89A7'),
    };

    return /* html */ `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 12px;
  }
  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-sideBarSectionHeader-foreground);
    padding: 4px 0 8px 0;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
    margin-bottom: 6px;
  }
  .btn {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 6px 10px; margin: 2px 0;
    border: none; border-radius: 4px; background: transparent;
    color: var(--vscode-foreground);
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
    cursor: pointer; text-align: left; line-height: 1.4;
  }
  .btn:hover { background: var(--vscode-list-hoverBackground); }
  .btn:active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }
  .btn .icon { flex-shrink: 0; width: 18px; text-align: center; font-size: 14px; }
  .btn .label { flex: 1; }
  .btn.pro-locked { opacity: 0.6; }
  .pro-badge {
    font-size: 9px; padding: 1px 4px; border-radius: 3px;
    background: var(--vscode-editorWarning-foreground, #cca700);
    color: var(--vscode-editor-background); font-weight: 600;
  }
  .stats {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 4px;
  }
  .stat {
    padding: 6px 8px; border-radius: 4px;
    background: var(--vscode-input-background); text-align: center;
  }
  .stat-value { font-size: 18px; font-weight: 600; color: var(--vscode-foreground); }
  .stat-label { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
  .license-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; border-radius: 4px; margin-bottom: 12px; font-size: 12px;
  }
  .license-bar.pro {
    background: rgba(0, 180, 100, 0.12);
    color: var(--vscode-testing-iconPassed, #4ec949);
  }
  .license-bar.free {
    background: var(--vscode-input-background);
    color: var(--vscode-descriptionForeground); cursor: pointer;
  }
  .license-bar.free:hover { background: var(--vscode-list-hoverBackground); }
</style>
</head>
<body>

<div id="license-bar" class="license-bar free" data-cmd="tyranodev.activateLicense"></div>

<div class="section">
  <div class="section-title">${t.project}</div>
  <div class="stats">
    <div class="stat"><div class="stat-value" id="s-scenarios">0</div><div class="stat-label">${t.scenarios}</div></div>
    <div class="stat"><div class="stat-value" id="s-labels">0</div><div class="stat-label">${t.labels}</div></div>
    <div class="stat"><div class="stat-value" id="s-macros">0</div><div class="stat-label">${t.macros}</div></div>
    <div class="stat"><div class="stat-value" id="s-variables">0</div><div class="stat-label">${t.variables}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">${t.game}</div>
  <button class="btn" id="btn-debug" data-cmd="workbench.action.debug.start">
    <span class="icon">&#x25B6;&#xFE0F;</span><span class="label">${t.debugRun}</span><span class="pro-badge" id="badge-debug" hidden>PRO</span>
  </button>
  <button class="btn" data-cmd="tyranodev.previewScene">
    <span class="icon">&#x1F441;</span><span class="label">${t.scenePreview}</span>
  </button>
</div>

<div class="section">
  <div class="section-title">${t.analysis}</div>
  <button class="btn" data-cmd="tyranodev.analyzeProject">
    <span class="icon">&#x1F50D;</span><span class="label">${t.analyzeProject}</span>
  </button>
  <button class="btn" id="btn-flow" data-cmd="tyranodev.showFlowGraph">
    <span class="icon">&#x1F4CA;</span><span class="label">${t.flowGraph}</span><span class="pro-badge" id="badge-flow" hidden>PRO</span>
  </button>
  <button class="btn" id="btn-routes" data-cmd="tyranodev.runAllRoutes">
    <span class="icon">&#x1F9EA;</span><span class="label">${t.allRouteTest}</span><span class="pro-badge" id="badge-routes" hidden>PRO</span>
  </button>
  <button class="btn" id="btn-profile" data-cmd="tyranodev.profileScene">
    <span class="icon">&#x23F1;</span><span class="label">${t.profiling}</span><span class="pro-badge" id="badge-profile" hidden>PRO</span>
  </button>
</div>

<div class="section">
  <div class="section-title">${t.editing}</div>
  <button class="btn" data-cmd="tyranodev.goToDefinition">
    <span class="icon">&#x27A1;&#xFE0F;</span><span class="label">${t.goToDefinition}</span>
  </button>
  <button class="btn" data-cmd="tyranodev.findAllReferences">
    <span class="icon">&#x1F517;</span><span class="label">${t.findReferences}</span>
  </button>
  <button class="btn" data-cmd="tyranodev.showVariables">
    <span class="icon">&#x1F4DD;</span><span class="label">${t.variableList}</span>
  </button>
</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  // Event delegation: all clicks with data-cmd fire a command
  document.body.addEventListener('click', e => {
    const el = e.target.closest('[data-cmd]');
    if (el) {
      vscode.postMessage({ type: 'command', command: el.dataset.cmd });
    }
  });

  const proButtons = ['btn-debug','btn-flow','btn-routes','btn-profile'];
  const proBadges = ['badge-debug','badge-flow','badge-routes','badge-profile'];

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'update') {
      // License
      const bar = document.getElementById('license-bar');
      if (msg.pro) {
        bar.className = 'license-bar pro';
        bar.textContent = msg.licenseProText;
        bar.removeAttribute('data-cmd');
      } else {
        bar.className = 'license-bar free';
        bar.textContent = msg.licenseFreeText;
        bar.dataset.cmd = 'tyranodev.activateLicense';
      }
      // Stats
      document.getElementById('s-scenarios').textContent = msg.scenarios;
      document.getElementById('s-labels').textContent = msg.labels;
      document.getElementById('s-macros').textContent = msg.macros;
      document.getElementById('s-variables').textContent = msg.variables;
      // Pro badges
      proButtons.forEach(id => {
        document.getElementById(id).classList.toggle('pro-locked', !msg.pro);
      });
      proBadges.forEach(id => {
        document.getElementById(id).hidden = msg.pro;
      });
    }
  });
</script>
</body>
</html>`;
  }
}
