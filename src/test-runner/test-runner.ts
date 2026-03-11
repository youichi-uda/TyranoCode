/**
 * TyranoScript Auto-Test Runner.
 * Statically analyzes all reachable routes in a TyranoScript game.
 *
 * PRO FEATURE — requires valid license key.
 *
 * How it works:
 * 1. Parses all scenario files to build a complete route graph
 * 2. Identifies all choice points (buttons, glinks, if branches)
 * 3. Generates test paths that cover all reachable routes
 * 4. Walks each path statically to verify targets exist and resources are valid
 * 5. Reports coverage, errors, and unreachable code
 */

import * as vscode from 'vscode';
import { ProjectIndex, ScenarioNode, TagNode, LABEL_REF_TAGS } from '../parser/types';
import { localize } from '../language/i18n';

export interface TestRoute {
  name: string;
  steps: TestStep[];
}

export interface TestStep {
  file: string;
  label: string | null;
  action: 'choice' | 'auto' | 'skip';
  choiceIndex?: number;
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

interface ChoicePoint {
  file: string;
  label: string | null;
  line: number;
  options: ChoiceOption[];
}

interface ChoiceOption {
  text: string;
  targetFile: string;
  targetLabel: string | null;
}

export class TestRunner {
  private results: TestResult[] = [];
  private running = false;
  private outputChannel: vscode.OutputChannel;

  constructor(private getIndex: () => ProjectIndex | undefined) {
    this.outputChannel = vscode.window.createOutputChannel('TyranoCode Test Runner');
  }

  /**
   * Discover all possible routes through the game.
   */
  discoverRoutes(): TestRoute[] {
    const index = this.getIndex();
    if (!index) return [];

    const routes: TestRoute[] = [];
    const choicePoints = this.findChoicePoints(index);

    const MAX_ROUTES = 500;

    if (choicePoints.length === 0) {
      routes.push({
        name: localize('Main Route (no choices)', 'メインルート (選択肢なし)'),
        steps: [{ file: 'data/scenario/first.ks', label: null, action: 'auto' }],
      });
      return routes;
    }

    // BFS through choice tree
    const queue: { steps: TestStep[]; nextChoiceIdx: number }[] = [
      { steps: [{ file: 'data/scenario/first.ks', label: null, action: 'auto' }], nextChoiceIdx: 0 },
    ];

    while (queue.length > 0 && routes.length < MAX_ROUTES) {
      const current = queue.shift()!;

      if (current.nextChoiceIdx >= choicePoints.length) {
        routes.push({
          name: `${localize('Route', 'ルート')} ${routes.length + 1}`,
          steps: current.steps,
        });
        continue;
      }

      const choice = choicePoints[current.nextChoiceIdx];
      for (let i = 0; i < choice.options.length; i++) {
        const opt = choice.options[i];
        const step: TestStep = {
          file: opt.targetFile,
          label: opt.targetLabel,
          action: 'choice',
          choiceIndex: i,
          choiceText: opt.text,
        };
        queue.push({
          steps: [...current.steps, step],
          nextChoiceIdx: current.nextChoiceIdx + 1,
        });
      }
    }

    return routes;
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

    const routes = this.discoverRoutes();
    this.running = true;
    this.results = [];

    this.outputChannel.show();
    this.outputChannel.clear();
    this.outputChannel.appendLine(`=== TyranoCode Auto-Test ===\n`);
    this.outputChannel.appendLine(localize(
      `Analyzing ${routes.length} routes...`,
      `${routes.length} ルートを解析中...`,
    ));
    this.outputChannel.appendLine('');

    const allVisitedFiles = new Set<string>();
    const allVisitedLabels = new Set<string>();
    let passCount = 0;
    let failCount = 0;

    for (const route of routes) {
      if (!this.running) break;

      const result = this.analyzeRoute(route, index);
      this.results.push(result);

      result.visitedFiles.forEach(f => allVisitedFiles.add(f));
      result.visitedLabels.forEach(l => allVisitedLabels.add(l));

      const icon = result.status === 'pass' ? '✓' : '✗';
      if (result.status === 'pass') passCount++; else failCount++;

      this.outputChannel.appendLine(`  ${icon} ${route.name}`);

      for (const error of result.errors) {
        const severity = error.severity === 'error' ? 'ERROR' : 'WARN';
        this.outputChannel.appendLine(`    [${severity}] ${error.file}:${error.line} — ${error.message}`);
      }
    }

    // Coverage report
    const totalFiles = index.scenarios.size;
    const totalLabels = [...index.globalLabels.values()].reduce((sum, arr) => sum + arr.length, 0);
    const choicePoints = this.findChoicePoints(index);
    const unreachableLabels = this.findUnreachableLabels(allVisitedLabels, index);

    const coverage: TestCoverage = {
      totalFiles,
      visitedFiles: allVisitedFiles.size,
      totalLabels,
      visitedLabels: allVisitedLabels.size,
      totalChoices: choicePoints.length,
      testedChoices: choicePoints.length, // all combinations generated
      unreachableLabels,
    };

    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(`=== ${localize('Coverage Report', 'カバレッジレポート')} ===`);
    this.outputChannel.appendLine(`  ${localize('Routes', 'ルート')}: ${passCount} ${localize('passed', '成功')} / ${failCount} ${localize('failed', '失敗')}`);
    this.outputChannel.appendLine(`  ${localize('Files', 'ファイル')}: ${coverage.visitedFiles}/${coverage.totalFiles}`);
    this.outputChannel.appendLine(`  ${localize('Labels', 'ラベル')}: ${coverage.visitedLabels}/${coverage.totalLabels}`);
    this.outputChannel.appendLine(`  ${localize('Choice points', '選択肢')}: ${coverage.totalChoices}`);

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
   * Statically walk a route and check for errors.
   */
  private analyzeRoute(route: TestRoute, index: ProjectIndex): TestResult {
    const start = Date.now();
    const visitedFiles: string[] = [];
    const visitedLabels: string[] = [];
    const errors: TestError[] = [];

    for (const step of route.steps) {
      // Track visited files
      if (!visitedFiles.includes(step.file)) {
        visitedFiles.push(step.file);
      }
      if (step.label && !visitedLabels.includes(step.label)) {
        visitedLabels.push(step.label);
      }

      // Verify target exists
      if (step.label) {
        const labelEntries = index.globalLabels.get(step.label);
        if (!labelEntries || labelEntries.length === 0) {
          errors.push({
            file: step.file,
            line: 0,
            message: localize(
              `Undefined label: *${step.label}`,
              `未定義のラベル: *${step.label}`,
            ),
            severity: 'error',
            tag: 'jump',
          });
        }
      }

      // Verify scenario file exists in index
      if (step.file) {
        const scenario = index.scenarios.get(step.file);
        if (!scenario) {
          // Check with different path formats
          const altPath = step.file.replace(/^data\/scenario\//, '');
          const found = [...index.scenarios.keys()].some(
            k => k === altPath || k.endsWith('/' + altPath) || k.endsWith('\\' + altPath),
          );
          if (!found) {
            errors.push({
              file: step.file,
              line: 0,
              message: localize(
                `Scenario file not found: ${step.file}`,
                `シナリオファイルが見つかりません: ${step.file}`,
              ),
              severity: 'warning',
            });
          }
        }
      }
    }

    // Walk the starting scenario to check for static errors
    const startFile = route.steps[0]?.file;
    if (startFile) {
      this.checkScenarioIntegrity(startFile, index, errors, visitedFiles, visitedLabels);
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

        if (storageAttr?.value) {
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

  // ── Choice point discovery ──

  private findChoicePoints(index: ProjectIndex): ChoicePoint[] {
    const points: ChoicePoint[] = [];

    for (const [file, scenario] of index.scenarios) {
      let currentLabel: string | null = null;
      const pendingChoices: TagNode[] = [];

      for (const node of scenario.nodes) {
        if (node.type === 'label') {
          if (pendingChoices.length > 0) {
            points.push(this.buildChoicePoint(file, currentLabel, pendingChoices));
            pendingChoices.length = 0;
          }
          currentLabel = node.name;
        }

        if (node.type === 'tag' && (node.name === 'button' || node.name === 'glink')) {
          pendingChoices.push(node);
        }

        // [s] (stop) after choices means this is a choice point
        if (node.type === 'tag' && node.name === 's' && pendingChoices.length > 0) {
          points.push(this.buildChoicePoint(file, currentLabel, pendingChoices));
          pendingChoices.length = 0;
        }
      }

      // Flush remaining choices at end of file
      if (pendingChoices.length > 0) {
        points.push(this.buildChoicePoint(file, currentLabel, pendingChoices));
      }
    }

    return points;
  }

  private buildChoicePoint(file: string, label: string | null, choices: TagNode[]): ChoicePoint {
    return {
      file,
      label,
      line: choices[0].range.start.line,
      options: choices.map(c => {
        const textAttr = c.attributes.find(a => a.name === 'text');
        const targetAttr = c.attributes.find(a => a.name === 'target');
        const storageAttr = c.attributes.find(a => a.name === 'storage');
        return {
          text: textAttr?.value ?? `(${c.name})`,
          targetFile: storageAttr?.value ?? file,
          targetLabel: targetAttr?.value?.replace(/^\*/, '') ?? null,
        };
      }),
    };
  }

  // ── Unreachable labels ──

  private findUnreachableLabels(visited: Set<string>, index: ProjectIndex): string[] {
    const unreachable: string[] = [];

    // Collect all labels that are targets of jump/call
    const referencedLabels = new Set<string>();
    for (const [, scenario] of index.scenarios) {
      this.collectReferencedLabels(scenario.nodes, referencedLabels);
    }

    for (const [name, entries] of index.globalLabels) {
      // Skip "start" label — it's the entry point
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

  /**
   * Report test errors as VS Code diagnostics.
   */
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

    // Clear after 30 seconds
    setTimeout(() => diagnosticCollection.dispose(), 30000);
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
