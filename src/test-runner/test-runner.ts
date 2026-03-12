/**
 * TyranoScript Auto-Test Runner.
 * Statically analyzes all reachable routes in a TyranoScript game.
 *
 * PRO FEATURE — requires valid license key.
 *
 * How it works:
 * 1. Walks the scenario flow graph starting from first.ks
 * 2. Follows [jump], [call], [button], [glink] to trace reachable paths
 * 3. At choice points (button/glink before [s]), branches into separate routes
 * 4. Checks each route for undefined labels, missing files, and integrity errors
 * 5. Reports coverage, errors, and unreachable code
 */

import * as vscode from 'vscode';
import { ProjectIndex, ScenarioNode, TagNode, LabelNode, LABEL_REF_TAGS } from '../parser/types';
import { localize } from '../language/i18n';

export interface TestRoute {
  name: string;
  steps: TestStep[];
}

export interface TestStep {
  file: string;
  label: string | null;
  line: number;
  action: 'jump' | 'call' | 'choice' | 'start';
  tag?: string;
  choiceText?: string;
}

export interface TestResult {
  route: TestRoute;
  status: 'pass' | 'fail' | 'error';
  duration: number;
  visitedFiles: string[];
  visitedLabels: string[];
  errors: TestError[];
}

export interface TestError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
  tag?: string;
}

export interface TestCoverage {
  totalFiles: number;
  visitedFiles: number;
  totalLabels: number;
  visitedLabels: number;
  totalChoices: number;
  testedChoices: number;
  unreachableLabels: string[];
}

interface WalkState {
  file: string;
  nodeIndex: number;
  steps: TestStep[];
  visited: Set<string>;  // "file:nodeIndex" to detect loops
  callStack: string[];   // return targets for [call]
}

const MAX_ROUTES = 200;
const MAX_WALK_DEPTH = 1000;

export class TestRunner {
  private results: TestResult[] = [];
  private running = false;
  private outputChannel: vscode.OutputChannel;

  constructor(private getIndex: () => ProjectIndex | undefined) {
    this.outputChannel = vscode.window.createOutputChannel('TyranoCode Test Runner');
  }

  /**
   * Discover all possible routes by walking the flow graph.
   */
  discoverRoutes(): TestRoute[] {
    const index = this.getIndex();
    if (!index) return [];

    const routes: TestRoute[] = [];
    const entryFile = this.findEntryFile(index);
    if (!entryFile) return [];

    // DFS walk through the scenario graph
    const initialState: WalkState = {
      file: entryFile,
      nodeIndex: 0,
      steps: [{ file: entryFile, label: null, line: 1, action: 'start' }],
      visited: new Set(),
      callStack: [],
    };

    const stack: WalkState[] = [initialState];

    while (stack.length > 0 && routes.length < MAX_ROUTES) {
      const state = stack.pop()!;
      const result = this.walkUntilBranch(state, index);

      if (result.type === 'end' || result.type === 'loop') {
        // Route completed (loop = returned to title screen, still a valid route)
        routes.push({
          name: `${localize('Route', 'ルート')} ${routes.length + 1}`,
          steps: result.steps,
        });
      } else if (result.type === 'choice') {
        // Branch: push each option as a new walk state
        for (const branch of result.branches) {
          if (routes.length + stack.length >= MAX_ROUTES) break;
          stack.push(branch);
        }
      }
    }

    if (routes.length === 0) {
      routes.push({
        name: localize('Main Route (no branches)', 'メインルート (分岐なし)'),
        steps: [{ file: entryFile, label: null, line: 1, action: 'start' }],
      });
    }

    return routes;
  }

  /**
   * Walk the scenario nodes until we hit a branch point, end, or loop.
   */
  private walkUntilBranch(
    state: WalkState,
    index: ProjectIndex,
  ): { type: 'end'; steps: TestStep[] }
    | { type: 'choice'; branches: WalkState[] }
    | { type: 'loop'; steps: TestStep[] } {

    let { file, nodeIndex } = state;
    const steps = [...state.steps];
    const visited = new Set(state.visited);
    const callStack = [...state.callStack];
    let depth = 0;

    while (depth++ < MAX_WALK_DEPTH) {
      let scenario = index.scenarios.get(file);
      if (!scenario) {
        // Try bare filename lookup
        const bareFile = file.replace(/^data\/scenario\//, '');
        const found = this.findScenarioByName(bareFile, index);
        if (!found) {
          return { type: 'end', steps };
        }
        file = found;
        scenario = index.scenarios.get(file)!;
      }
      const nodes = scenario.nodes;

      if (nodeIndex >= nodes.length) {
        // End of file
        return { type: 'end', steps };
      }

      // Loop detection
      const posKey = `${file}:${nodeIndex}`;
      if (visited.has(posKey)) {
        return { type: 'loop', steps };
      }
      visited.add(posKey);

      const node = nodes[nodeIndex];

      if (node.type === 'label') {
        // Track label visit in steps
      }

      if (node.type === 'tag') {
        const name = node.name;

        // [jump] — transfer control
        if (name === 'jump') {
          const target = this.resolveTarget(node, file, index);
          if (!target) {
            nodeIndex++;
            continue;
          }
          steps.push({
            file: target.file,
            label: target.label,
            line: node.range.start.line + 1,
            action: 'jump',
            tag: 'jump',
          });
          file = target.file;
          nodeIndex = target.nodeIndex;
          continue;
        }

        // [call] — push return address, jump to target
        if (name === 'call') {
          const target = this.resolveTarget(node, file, index);
          if (!target) {
            nodeIndex++;
            continue;
          }
          callStack.push(`${file}:${nodeIndex + 1}`);
          steps.push({
            file: target.file,
            label: target.label,
            line: node.range.start.line + 1,
            action: 'call',
            tag: 'call',
          });
          file = target.file;
          nodeIndex = target.nodeIndex;
          continue;
        }

        // [return] — pop call stack
        if (name === 'return') {
          const returnTarget = callStack.pop();
          if (!returnTarget) {
            return { type: 'end', steps };
          }
          const [retFile, retIdx] = returnTarget.split(':');
          file = retFile;
          nodeIndex = parseInt(retIdx, 10);
          continue;
        }

        // [button] / [glink] — collect choices until [s]
        if (name === 'button' || name === 'glink') {
          const choices = this.collectChoices(nodes, nodeIndex);
          if (choices.length > 0) {
            const branches: WalkState[] = [];
            for (const choice of choices) {
              const target = this.resolveTarget(choice.node, file, index);
              if (!target) continue;

              const textAttr = choice.node.attributes.find(a => a.name === 'text');
              const choiceText = textAttr?.value ?? `(${choice.node.name})`;

              const branchSteps = [...steps, {
                file: target.file,
                label: target.label,
                line: choice.node.range.start.line + 1,
                action: 'choice' as const,
                tag: choice.node.name,
                choiceText,
              }];

              branches.push({
                file: target.file,
                nodeIndex: target.nodeIndex,
                steps: branchSteps,
                visited: new Set(visited),
                callStack: [...callStack],
              });
            }

            if (branches.length > 0) {
              return { type: 'choice', branches };
            }
            // If no valid targets, skip past the [s]
            nodeIndex = this.findNextAfterStop(nodes, nodeIndex);
            continue;
          }
        }

        // [s] — stop (end of route if not preceded by choices)
        if (name === 's') {
          return { type: 'end', steps };
        }

        // [end] — end
        if (name === 'end') {
          return { type: 'end', steps };
        }
      }

      nodeIndex++;
    }

    // Max depth reached
    return { type: 'end', steps };
  }

  /**
   * Collect consecutive button/glink nodes (a choice group).
   * Stops at [s] or a non-button/glink/text/comment node.
   */
  private collectChoices(nodes: ScenarioNode[], startIdx: number): { node: TagNode; index: number }[] {
    const choices: { node: TagNode; index: number }[] = [];
    for (let i = startIdx; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.type === 'tag' && (n.name === 'button' || n.name === 'glink')) {
        choices.push({ node: n, index: i });
      } else if (n.type === 'tag' && n.name === 's') {
        break;
      } else if (n.type === 'text' || n.type === 'comment') {
        // Skip text/comments between choices
        continue;
      } else if (n.type === 'tag' && (n.name === 'l' || n.name === 'p' || n.name === 'r' ||
        n.name === 'cm' || n.name === 'ct' || n.name === 'er' ||
        n.name === 'locate' || n.name === 'font' || n.name === 'resetfont' ||
        n.name === 'position' || n.name === 'current' || n.name === 'layopt')) {
        // Skip layout/display tags that can appear between choices
        continue;
      } else {
        break;
      }
    }
    return choices;
  }

  /**
   * Find the node index after the next [s] tag.
   */
  private findNextAfterStop(nodes: ScenarioNode[], startIdx: number): number {
    for (let i = startIdx; i < nodes.length; i++) {
      if (nodes[i].type === 'tag' && (nodes[i] as TagNode).name === 's') {
        return i + 1;
      }
    }
    return nodes.length;
  }

  /**
   * Resolve a jump/call/button/glink target to a file + node index.
   */
  private resolveTarget(
    node: TagNode,
    currentFile: string,
    index: ProjectIndex,
  ): { file: string; label: string | null; nodeIndex: number } | null {
    const storageAttr = node.attributes.find(a => a.name === 'storage');
    const targetAttr = node.attributes.find(a => a.name === 'target');

    // Dynamic targets (& prefix) — can't resolve statically
    if (storageAttr?.value?.startsWith('&') || targetAttr?.value?.startsWith('&')) {
      return null;
    }

    // Role-based buttons (load, save, etc.) — not navigation
    const roleAttr = node.attributes.find(a => a.name === 'role');
    if (roleAttr?.value) return null;

    let targetFile = currentFile;
    if (storageAttr?.value) {
      targetFile = this.findScenarioByName(storageAttr.value, index) ?? storageAttr.value;
    }

    const targetLabel = targetAttr?.value?.replace(/^\*/, '') ?? null;

    const scenario = index.scenarios.get(targetFile);
    if (!scenario) return null;

    let nodeIndex = 0;
    if (targetLabel) {
      // Find the label node index
      for (let i = 0; i < scenario.nodes.length; i++) {
        const n = scenario.nodes[i];
        if (n.type === 'label' && n.name === targetLabel) {
          nodeIndex = i;
          break;
        }
      }
    }

    return { file: targetFile, label: targetLabel, nodeIndex };
  }

  /**
   * Find a scenario file by bare filename in the index.
   */
  private findScenarioByName(name: string, index: ProjectIndex): string | null {
    // Direct match
    if (index.scenarios.has(name)) return name;

    // Try with data/scenario/ prefix
    const withPrefix = `data/scenario/${name}`;
    if (index.scenarios.has(withPrefix)) return withPrefix;

    // Search by basename
    for (const key of index.scenarios.keys()) {
      const base = key.replace(/\\/g, '/').split('/').pop();
      if (base === name) return key;
    }

    return null;
  }

  /**
   * Find the entry file (first.ks).
   */
  private findEntryFile(index: ProjectIndex): string | null {
    return this.findScenarioByName('first.ks', index);
  }

  /**
   * Run all discovered routes (static analysis).
   */
  async runAllRoutes(): Promise<TestCoverage> {
    const index = this.getIndex();
    if (!index) {
      this.outputChannel.show();
      this.outputChannel.appendLine(localize(
        'No project index available. Open a .ks file first.',
        'プロジェクトインデックスがありません。先に .ks ファイルを開いてください。',
      ));
      return {
        totalFiles: 0, visitedFiles: 0, totalLabels: 0, visitedLabels: 0,
        totalChoices: 0, testedChoices: 0, unreachableLabels: [],
      };
    }

    let routes: TestRoute[];
    try {
      routes = this.discoverRoutes();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.stack || e.message : String(e);
      this.outputChannel.show();
      this.outputChannel.appendLine(`=== TyranoCode Auto-Test ===\n`);
      this.outputChannel.appendLine(`Error discovering routes: ${msg}`);
      return {
        totalFiles: 0, visitedFiles: 0, totalLabels: 0, visitedLabels: 0,
        totalChoices: 0, testedChoices: 0, unreachableLabels: [],
      };
    }
    this.running = true;
    this.results = [];

    this.outputChannel.show();
    this.outputChannel.clear();
    this.outputChannel.appendLine(`=== TyranoCode Auto-Test ===\n`);
    this.outputChannel.appendLine(localize(
      `Discovered ${routes.length} routes.`,
      `${routes.length} ルートを検出しました。`,
    ));
    this.outputChannel.appendLine('');

    const allVisitedFiles = new Set<string>();
    const allVisitedLabels = new Set<string>();
    let passCount = 0;
    let failCount = 0;
    let choicePointCount = 0;

    for (const route of routes) {
      if (!this.running) break;

      const result = this.analyzeRoute(route, index);
      this.results.push(result);

      result.visitedFiles.forEach(f => allVisitedFiles.add(f));
      result.visitedLabels.forEach(l => allVisitedLabels.add(l));

      const icon = result.status === 'pass' ? '✓' : '✗';
      if (result.status === 'pass') passCount++; else failCount++;

      // Build route description from choices made
      const choiceSteps = route.steps.filter(s => s.action === 'choice');
      choicePointCount = Math.max(choicePointCount, choiceSteps.length);
      const choiceDesc = choiceSteps.map(s => s.choiceText ?? '?').join(' → ');
      const routeDesc = choiceDesc || localize('(linear)', '(一本道)');

      this.outputChannel.appendLine(`  ${icon} ${route.name}: ${routeDesc}`);

      for (const error of result.errors) {
        const severity = error.severity === 'error' ? 'ERROR' : 'WARN';
        this.outputChannel.appendLine(`    [${severity}] ${error.file}:${error.line} — ${error.message}`);
      }
    }

    // Coverage report
    const totalFiles = index.scenarios.size;
    const totalLabels = [...index.globalLabels.values()].reduce((sum, arr) => sum + arr.length, 0);
    const unreachableLabels = this.findUnreachableLabels(allVisitedLabels, index);

    const coverage: TestCoverage = {
      totalFiles,
      visitedFiles: allVisitedFiles.size,
      totalLabels,
      visitedLabels: allVisitedLabels.size,
      totalChoices: choicePointCount,
      testedChoices: choicePointCount,
      unreachableLabels,
    };

    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(`=== ${localize('Coverage Report', 'カバレッジレポート')} ===`);
    this.outputChannel.appendLine(`  ${localize('Routes', 'ルート')}: ${passCount} ${localize('passed', '成功')} / ${failCount} ${localize('failed', '失敗')}`);
    this.outputChannel.appendLine(`  ${localize('Files', 'ファイル')}: ${coverage.visitedFiles}/${coverage.totalFiles}`);
    this.outputChannel.appendLine(`  ${localize('Labels', 'ラベル')}: ${coverage.visitedLabels}/${coverage.totalLabels}`);

    if (unreachableLabels.length > 0) {
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`  ${localize('Unreachable labels', '到達不能ラベル')}:`);
      for (const label of unreachableLabels) {
        this.outputChannel.appendLine(`    - ${label}`);
      }
    }

    // Also show results as diagnostics
    this.reportDiagnostics();

    this.running = false;
    return coverage;
  }

  stop(): void {
    this.running = false;
  }

  // ── Route analysis ──

  /**
   * Analyze a discovered route for errors.
   */
  private analyzeRoute(route: TestRoute, index: ProjectIndex): TestResult {
    const start = Date.now();
    const visitedFiles: string[] = [];
    const visitedLabels: string[] = [];
    const errors: TestError[] = [];

    for (const step of route.steps) {
      if (!visitedFiles.includes(step.file)) {
        visitedFiles.push(step.file);
      }
      if (step.label && !visitedLabels.includes(step.label)) {
        visitedLabels.push(step.label);
      }

      // Verify label exists
      if (step.label) {
        const labelEntries = index.globalLabels.get(step.label);
        if (!labelEntries || labelEntries.length === 0) {
          errors.push({
            file: step.file,
            line: step.line,
            message: localize(
              `Undefined label: *${step.label}`,
              `未定義のラベル: *${step.label}`,
            ),
            severity: 'error',
            tag: step.tag,
          });
        }
      }

      // Verify file exists
      if (step.file && !index.scenarios.has(step.file)) {
        const found = this.findScenarioByName(step.file, index);
        if (!found) {
          errors.push({
            file: step.file,
            line: step.line,
            message: localize(
              `Scenario file not found: ${step.file}`,
              `シナリオファイルが見つかりません: ${step.file}`,
            ),
            severity: 'warning',
          });
        }
      }
    }

    // Walk all visited files for integrity checks
    for (const file of visitedFiles) {
      this.checkScenarioIntegrity(file, index, errors, visitedFiles, visitedLabels);
    }

    return {
      route,
      status: errors.some(e => e.severity === 'error') ? 'fail' : 'pass',
      duration: Date.now() - start,
      visitedFiles,
      visitedLabels,
      errors,
    };
  }

  /**
   * Walk a scenario file and check for common issues.
   */
  private checkScenarioIntegrity(
    file: string,
    index: ProjectIndex,
    errors: TestError[],
    visitedFiles: string[],
    visitedLabels: string[],
  ): void {
    const scenario = index.scenarios.get(file);
    if (!scenario) return;

    this.checkNodesIntegrity(scenario.nodes, file, index, errors, visitedFiles, visitedLabels);
  }

  private checkNodesIntegrity(
    nodes: ScenarioNode[],
    file: string,
    index: ProjectIndex,
    errors: TestError[],
    visitedFiles: string[],
    visitedLabels: string[],
  ): void {
    for (const node of nodes) {
      if (node.type === 'tag' && LABEL_REF_TAGS.has(node.name)) {
        const targetAttr = node.attributes.find(a => a.name === 'target');
        const storageAttr = node.attributes.find(a => a.name === 'storage');

        if (targetAttr?.value) {
          const labelName = targetAttr.value.replace(/^\*/, '');
          if (!labelName.startsWith('&')) {
            if (!visitedLabels.includes(labelName)) {
              visitedLabels.push(labelName);
            }

            const entries = index.globalLabels.get(labelName);
            if (!entries || entries.length === 0) {
              errors.push({
                file,
                line: node.range.start.line + 1,
                message: localize(
                  `[${node.name}] target *${labelName} is undefined`,
                  `[${node.name}] のターゲット *${labelName} が未定義`,
                ),
                severity: 'error',
                tag: node.name,
              });
            }
          }
        }

        if (storageAttr?.value && !storageAttr.value.startsWith('&')) {
          const targetFile = storageAttr.value;
          if (!visitedFiles.includes(targetFile)) {
            visitedFiles.push(targetFile);
          }
        }
      }

      if (node.type === 'if_block') {
        this.checkNodesIntegrity(node.thenBranch, file, index, errors, visitedFiles, visitedLabels);
        for (const branch of node.elsifBranches) {
          this.checkNodesIntegrity(branch.body, file, index, errors, visitedFiles, visitedLabels);
        }
        if (node.elseBranch) {
          this.checkNodesIntegrity(node.elseBranch, file, index, errors, visitedFiles, visitedLabels);
        }
      }

      if (node.type === 'macro_def') {
        this.checkNodesIntegrity(node.body, file, index, errors, visitedFiles, visitedLabels);
      }
    }
  }

  // ── Unreachable labels ──

  private findUnreachableLabels(visited: Set<string>, index: ProjectIndex): string[] {
    const unreachable: string[] = [];

    const referencedLabels = new Set<string>();
    for (const [, scenario] of index.scenarios) {
      this.collectReferencedLabels(scenario.nodes, referencedLabels);
    }

    for (const [name, entries] of index.globalLabels) {
      if (name === 'start') continue;

      if (!visited.has(name) && !referencedLabels.has(name)) {
        const files = entries.map(e => e.file).join(', ');
        unreachable.push(`*${name} (${files})`);
      }
    }

    return unreachable;
  }

  private collectReferencedLabels(nodes: ScenarioNode[], labels: Set<string>): void {
    for (const node of nodes) {
      if (node.type === 'tag' && LABEL_REF_TAGS.has(node.name)) {
        const targetAttr = node.attributes.find(a => a.name === 'target');
        if (targetAttr?.value) {
          labels.add(targetAttr.value.replace(/^\*/, ''));
        }
      }
      if (node.type === 'if_block') {
        this.collectReferencedLabels(node.thenBranch, labels);
        for (const b of node.elsifBranches) this.collectReferencedLabels(b.body, labels);
        if (node.elseBranch) this.collectReferencedLabels(node.elseBranch, labels);
      }
      if (node.type === 'macro_def') {
        this.collectReferencedLabels(node.body, labels);
      }
    }
  }

  // ── Diagnostics ──

  private reportDiagnostics(): void {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('tyranocode-test');
    const diagnosticMap = new Map<string, vscode.Diagnostic[]>();

    for (const result of this.results) {
      for (const error of result.errors) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) continue;

        const uri = vscode.Uri.joinPath(workspaceFolder.uri, error.file).toString();
        const line = Math.max(0, error.line - 1);
        const diag = new vscode.Diagnostic(
          new vscode.Range(line, 0, line, 100),
          `[Auto-Test] ${error.message}`,
          error.severity === 'error'
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );
        diag.source = 'TyranoCode Test Runner';

        const existing = diagnosticMap.get(uri) ?? [];
        existing.push(diag);
        diagnosticMap.set(uri, existing);
      }
    }

    for (const [uriStr, diags] of diagnosticMap) {
      diagnosticCollection.set(vscode.Uri.parse(uriStr), diags);
    }

    setTimeout(() => diagnosticCollection.dispose(), 30000);
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
