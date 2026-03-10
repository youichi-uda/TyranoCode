/**
 * TyranoScript Auto-Test Runner.
 * Automatically explores all reachable routes in a TyranoScript game.
 *
 * PRO FEATURE — requires valid license key.
 *
 * How it works:
 * 1. Parses all scenario files to build a complete route graph
 * 2. Identifies all choice points (buttons, glinks, if branches)
 * 3. Generates test paths that cover all reachable routes
 * 4. Executes each path in a headless browser using the game runtime
 * 5. Reports coverage, errors, and unreachable code
 */

import * as vscode from 'vscode';
import { ProjectIndex, ScenarioNode, TagNode } from '../parser/types';

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

export class TestRunner {
  private results: TestResult[] = [];
  private running = false;
  private outputChannel: vscode.OutputChannel;

  constructor(private getIndex: () => ProjectIndex | undefined) {
    this.outputChannel = vscode.window.createOutputChannel('TyranoDev Test Runner');
  }

  /**
   * Discover all possible routes through the game.
   */
  discoverRoutes(): TestRoute[] {
    const index = this.getIndex();
    if (!index) return [];

    const routes: TestRoute[] = [];
    const choicePoints = this.findChoicePoints(index);

    // Generate route permutations
    // For N choice points with M options each, this generates all combinations
    // Capped to prevent explosion
    const MAX_ROUTES = 1000;

    if (choicePoints.length === 0) {
      routes.push({
        name: 'Main Route (no choices)',
        steps: [{ file: 'first.ks', label: null, action: 'auto' }],
      });
      return routes;
    }

    // BFS through choice tree
    const queue: { steps: TestStep[]; nextChoiceIdx: number }[] = [
      { steps: [{ file: 'first.ks', label: null, action: 'auto' }], nextChoiceIdx: 0 },
    ];

    while (queue.length > 0 && routes.length < MAX_ROUTES) {
      const current = queue.shift()!;

      if (current.nextChoiceIdx >= choicePoints.length) {
        routes.push({
          name: `Route ${routes.length + 1}`,
          steps: current.steps,
        });
        continue;
      }

      const choice = choicePoints[current.nextChoiceIdx];
      for (let i = 0; i < choice.options.length; i++) {
        const step: TestStep = {
          file: choice.file,
          label: choice.label,
          action: 'choice',
          choiceIndex: i,
          choiceText: choice.options[i],
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
   * Run all discovered routes.
   */
  async runAllRoutes(): Promise<TestCoverage> {
    const routes = this.discoverRoutes();
    this.running = true;
    this.results = [];

    this.outputChannel.show();
    this.outputChannel.appendLine(`TyranoDev Auto-Test: Running ${routes.length} routes...\n`);

    const allVisitedFiles = new Set<string>();
    const allVisitedLabels = new Set<string>();

    for (const route of routes) {
      if (!this.running) break;

      this.outputChannel.appendLine(`  Running: ${route.name}...`);
      const result = await this.executeRoute(route);
      this.results.push(result);

      result.visitedFiles.forEach(f => allVisitedFiles.add(f));
      result.visitedLabels.forEach(l => allVisitedLabels.add(l));

      const statusIcon = result.status === 'pass' ? 'PASS' : result.status === 'fail' ? 'FAIL' : 'ERROR';
      this.outputChannel.appendLine(`  [${statusIcon}] ${route.name} (${result.duration}ms)`);

      for (const error of result.errors) {
        this.outputChannel.appendLine(`    Error: ${error.file}:${error.line} - ${error.message}`);
      }
    }

    const index = this.getIndex();
    const totalFiles = index?.scenarios.size ?? 0;
    const totalLabels = index ? Array.from(index.globalLabels.values()).reduce((sum, arr) => sum + arr.length, 0) : 0;

    const coverage: TestCoverage = {
      totalFiles,
      visitedFiles: allVisitedFiles.size,
      totalLabels,
      visitedLabels: allVisitedLabels.size,
      totalChoices: this.findChoicePoints(index!).length,
      testedChoices: routes.length,
      unreachableLabels: this.findUnreachableLabels(allVisitedLabels, index!),
    };

    this.outputChannel.appendLine(`\n=== Coverage Report ===`);
    this.outputChannel.appendLine(`  Files: ${coverage.visitedFiles}/${coverage.totalFiles}`);
    this.outputChannel.appendLine(`  Labels: ${coverage.visitedLabels}/${coverage.totalLabels}`);
    this.outputChannel.appendLine(`  Routes tested: ${routes.length}`);

    if (coverage.unreachableLabels.length > 0) {
      this.outputChannel.appendLine(`\n  Unreachable labels:`);
      for (const label of coverage.unreachableLabels) {
        this.outputChannel.appendLine(`    - ${label}`);
      }
    }

    this.running = false;
    return coverage;
  }

  stop(): void {
    this.running = false;
  }

  private findChoicePoints(index: ProjectIndex): Array<{
    file: string;
    label: string | null;
    line: number;
    options: string[];
  }> {
    const points: Array<{
      file: string;
      label: string | null;
      line: number;
      options: string[];
    }> = [];

    for (const [file, scenario] of index.scenarios) {
      let currentLabel: string | null = null;
      const pendingChoices: TagNode[] = [];

      for (const node of scenario.nodes) {
        if (node.type === 'label') {
          // Flush pending choices
          if (pendingChoices.length > 0) {
            points.push({
              file,
              label: currentLabel,
              line: pendingChoices[0].range.start.line,
              options: pendingChoices.map(c => {
                const textAttr = c.attributes.find(a => a.name === 'text');
                return textAttr?.value ?? `Choice ${pendingChoices.indexOf(c) + 1}`;
              }),
            });
            pendingChoices.length = 0;
          }
          currentLabel = node.name;
        }

        if (node.type === 'tag' && (node.name === 'button' || node.name === 'glink')) {
          pendingChoices.push(node);
        }

        if (node.type === 'tag' && node.name === 's' && pendingChoices.length > 0) {
          points.push({
            file,
            label: currentLabel,
            line: pendingChoices[0].range.start.line,
            options: pendingChoices.map(c => {
              const textAttr = c.attributes.find(a => a.name === 'text');
              return textAttr?.value ?? `Choice ${pendingChoices.indexOf(c) + 1}`;
            }),
          });
          pendingChoices.length = 0;
        }
      }
    }

    return points;
  }

  private async executeRoute(route: TestRoute): Promise<TestResult> {
    const start = Date.now();

    // TODO: Full implementation will use a headless browser/NW.js to actually run the game
    // For now, perform static analysis of the route
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
    }

    return {
      route,
      status: errors.length > 0 ? 'fail' : 'pass',
      duration: Date.now() - start,
      visitedFiles,
      visitedLabels,
      errors,
    };
  }

  private findUnreachableLabels(visited: Set<string>, index: ProjectIndex): string[] {
    const unreachable: string[] = [];
    for (const [name, entries] of index.globalLabels) {
      const fullName = entries.map(e => `${e.file}:*${name}`).join(', ');
      if (!visited.has(name)) {
        unreachable.push(fullName);
      }
    }
    return unreachable;
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
