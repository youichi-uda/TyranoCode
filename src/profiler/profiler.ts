/**
 * TyranoScript Scene Profiler.
 * Performs static analysis to identify potential performance bottlenecks.
 *
 * PRO FEATURE — requires valid license key.
 *
 * Analyzes:
 * - Tag count per scene (complexity metric)
 * - Resource usage (images, audio, video loaded)
 * - Transition density (many transitions = potential lag)
 * - Variable write frequency (excessive eval = slowdowns)
 * - Macro expansion depth
 * - Choice complexity (branch explosion)
 */

import * as vscode from 'vscode';
import { ProjectIndex, ScenarioNode, TagNode, LABEL_REF_TAGS } from '../parser/types';
import { localize } from '../language/i18n';

interface SceneProfile {
  file: string;
  tagCount: number;
  labelCount: number;
  macroUsages: number;
  resourceLoads: ResourceLoad[];
  evalCount: number;
  transitionCount: number;
  choicePoints: number;
  branchDepth: number;
  estimatedComplexity: 'low' | 'medium' | 'high' | 'critical';
  warnings: ProfileWarning[];
}

interface ResourceLoad {
  type: 'image' | 'audio' | 'video' | 'script' | 'css';
  file: string;
  tag: string;
  line: number;
}

interface ProfileWarning {
  line: number;
  message: string;
  severity: 'info' | 'warning' | 'performance';
}

interface ProjectProfile {
  scenes: SceneProfile[];
  totalTags: number;
  totalResources: number;
  totalLabels: number;
  heaviestScene: string;
  resourceSummary: { type: string; count: number }[];
}

const RESOURCE_TAGS: Record<string, 'image' | 'audio' | 'video' | 'script' | 'css'> = {
  bg: 'image',
  image: 'image',
  chara_new: 'image',
  chara_face: 'image',
  chara_show: 'image',
  chara_mod: 'image',
  playbgm: 'audio',
  fadeinbgm: 'audio',
  playse: 'audio',
  fadeinse: 'audio',
  movie: 'video',
  bgmovie: 'video',
  loadjs: 'script',
  loadcss: 'css',
};

const TRANSITION_TAGS = new Set([
  'bg', 'mask', 'mask_off', 'trans', 'quake', 'vibrate',
  'chara_show', 'chara_hide', 'chara_move', 'chara_mod',
  'anim', 'kanim', 'keyframe',
]);

export class SceneProfiler {
  private outputChannel: vscode.OutputChannel;

  constructor(private getIndex: () => ProjectIndex | undefined) {
    this.outputChannel = vscode.window.createOutputChannel('TyranoCode Profiler');
  }

  /**
   * Profile the current scene (active editor).
   */
  profileCurrentScene(document: vscode.TextDocument): SceneProfile | undefined {
    const index = this.getIndex();
    if (!index) return undefined;

    const relativePath = vscode.workspace.asRelativePath(document.uri);
    const scenario = index.scenarios.get(relativePath);
    if (!scenario) return undefined;

    return this.analyzeScene(relativePath, scenario.nodes);
  }

  /**
   * Profile the entire project and show results.
   */
  profileProject(): ProjectProfile {
    const index = this.getIndex();
    if (!index) {
      return {
        scenes: [], totalTags: 0, totalResources: 0, totalLabels: 0,
        heaviestScene: '', resourceSummary: [],
      };
    }

    const scenes: SceneProfile[] = [];

    for (const [file, scenario] of index.scenarios) {
      scenes.push(this.analyzeScene(file, scenario.nodes));
    }

    // Sort by complexity (heaviest first)
    scenes.sort((a, b) => b.tagCount - a.tagCount);

    const totalTags = scenes.reduce((sum, s) => sum + s.tagCount, 0);
    const allResources = scenes.flatMap(s => s.resourceLoads);
    const totalLabels = scenes.reduce((sum, s) => sum + s.labelCount, 0);

    // Resource summary by type
    const typeCounts = new Map<string, number>();
    for (const r of allResources) {
      typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
    }

    const profile: ProjectProfile = {
      scenes,
      totalTags,
      totalResources: allResources.length,
      totalLabels,
      heaviestScene: scenes[0]?.file ?? '',
      resourceSummary: [...typeCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    };

    this.showProjectReport(profile);
    return profile;
  }

  private analyzeScene(file: string, nodes: ScenarioNode[]): SceneProfile {
    const stats = {
      tagCount: 0,
      labelCount: 0,
      macroUsages: 0,
      evalCount: 0,
      transitionCount: 0,
      choicePoints: 0,
      maxBranchDepth: 0,
    };
    const resourceLoads: ResourceLoad[] = [];
    const warnings: ProfileWarning[] = [];

    this.walkForProfile(nodes, stats, resourceLoads, warnings, file, 0);

    // Determine complexity
    let complexity: SceneProfile['estimatedComplexity'];
    if (stats.tagCount > 500 || stats.transitionCount > 50 || resourceLoads.length > 30) {
      complexity = 'critical';
    } else if (stats.tagCount > 200 || stats.transitionCount > 20 || resourceLoads.length > 15) {
      complexity = 'high';
    } else if (stats.tagCount > 80 || stats.transitionCount > 10) {
      complexity = 'medium';
    } else {
      complexity = 'low';
    }

    // Add complexity-specific warnings
    if (stats.transitionCount > 20) {
      warnings.push({
        line: 0,
        message: localize(
          `High transition density (${stats.transitionCount} transitions) — may cause frame drops`,
          `トランジション密度が高い (${stats.transitionCount}回) — フレームドロップの可能性`,
        ),
        severity: 'performance',
      });
    }

    if (stats.evalCount > 15) {
      warnings.push({
        line: 0,
        message: localize(
          `Many [eval] calls (${stats.evalCount}) — consider caching computed values`,
          `[eval] 呼び出しが多い (${stats.evalCount}回) — 計算結果のキャッシュを検討`,
        ),
        severity: 'performance',
      });
    }

    if (resourceLoads.filter(r => r.type === 'image').length > 20) {
      warnings.push({
        line: 0,
        message: localize(
          'Many image loads in one scene — consider preloading or lazy loading',
          'シーン内の画像読込が多い — プリロードまたは遅延読込を検討',
        ),
        severity: 'performance',
      });
    }

    return {
      file,
      tagCount: stats.tagCount,
      labelCount: stats.labelCount,
      macroUsages: stats.macroUsages,
      resourceLoads,
      evalCount: stats.evalCount,
      transitionCount: stats.transitionCount,
      choicePoints: stats.choicePoints,
      branchDepth: stats.maxBranchDepth,
      estimatedComplexity: complexity,
      warnings,
    };
  }

  private walkForProfile(
    nodes: ScenarioNode[],
    stats: {
      tagCount: number;
      labelCount: number;
      macroUsages: number;
      evalCount: number;
      transitionCount: number;
      choicePoints: number;
      maxBranchDepth: number;
    },
    resources: ResourceLoad[],
    warnings: ProfileWarning[],
    file: string,
    depth: number,
  ): void {
    for (const node of nodes) {
      if (node.type === 'label') {
        stats.labelCount++;
      }

      if (node.type === 'tag') {
        stats.tagCount++;

        // Resource loads
        const resourceType = RESOURCE_TAGS[node.name];
        if (resourceType) {
          const storageAttr = node.attributes.find(a => a.name === 'storage');
          if (storageAttr?.value) {
            resources.push({
              type: resourceType,
              file: storageAttr.value,
              tag: node.name,
              line: node.range.start.line + 1,
            });
          }
        }

        // Transitions
        if (TRANSITION_TAGS.has(node.name)) {
          stats.transitionCount++;
        }

        // Eval calls
        if (node.name === 'eval' || node.name === 'iscript') {
          stats.evalCount++;
        }

        // Choice points
        if (node.name === 'button' || node.name === 'glink') {
          stats.choicePoints++;
        }

        // Detect potential issues
        if (node.name === 'wait') {
          const timeAttr = node.attributes.find(a => a.name === 'time');
          const waitTime = parseInt(timeAttr?.value ?? '0', 10);
          if (waitTime > 5000) {
            warnings.push({
              line: node.range.start.line + 1,
              message: localize(
                `Long wait (${waitTime}ms) — player may lose interest`,
                `長い待機 (${waitTime}ms) — プレイヤーが離脱する可能性`,
              ),
              severity: 'warning',
            });
          }
        }
      }

      if (node.type === 'if_block') {
        const newDepth = depth + 1;
        stats.maxBranchDepth = Math.max(stats.maxBranchDepth, newDepth);
        this.walkForProfile(node.thenBranch, stats, resources, warnings, file, newDepth);
        for (const b of node.elsifBranches) {
          this.walkForProfile(b.body, stats, resources, warnings, file, newDepth);
        }
        if (node.elseBranch) {
          this.walkForProfile(node.elseBranch, stats, resources, warnings, file, newDepth);
        }
      }

      if (node.type === 'macro_def') {
        this.walkForProfile(node.body, stats, resources, warnings, file, depth);
      }
    }
  }

  private showProjectReport(profile: ProjectProfile): void {
    this.outputChannel.clear();
    this.outputChannel.show();

    this.outputChannel.appendLine(`=== TyranoCode ${localize('Performance Profile', 'パフォーマンスプロファイル')} ===\n`);

    this.outputChannel.appendLine(`${localize('Project Summary', 'プロジェクト概要')}:`);
    this.outputChannel.appendLine(`  ${localize('Total scenes', '合計シーン')}: ${profile.scenes.length}`);
    this.outputChannel.appendLine(`  ${localize('Total tags', '合計タグ')}: ${profile.totalTags}`);
    this.outputChannel.appendLine(`  ${localize('Total labels', '合計ラベル')}: ${profile.totalLabels}`);
    this.outputChannel.appendLine(`  ${localize('Total resources', '合計リソース')}: ${profile.totalResources}`);

    if (profile.resourceSummary.length > 0) {
      this.outputChannel.appendLine(`\n  ${localize('Resources by type', 'リソース種別')}:`);
      for (const r of profile.resourceSummary) {
        this.outputChannel.appendLine(`    ${r.type}: ${r.count}`);
      }
    }

    this.outputChannel.appendLine(`\n${localize('Scene Complexity Ranking', 'シーン複雑度ランキング')}:\n`);

    const complexityIcon: Record<string, string> = {
      low: '○',
      medium: '△',
      high: '▲',
      critical: '●',
    };

    for (const scene of profile.scenes) {
      const icon = complexityIcon[scene.estimatedComplexity] ?? '?';
      this.outputChannel.appendLine(
        `  ${icon} [${scene.estimatedComplexity.toUpperCase().padEnd(8)}] ${scene.file}` +
        `  — ${scene.tagCount} tags, ${scene.resourceLoads.length} resources, ${scene.transitionCount} transitions`,
      );

      for (const w of scene.warnings) {
        const prefix = w.severity === 'performance' ? '⚡' : '⚠';
        const lineStr = w.line > 0 ? `:${w.line}` : '';
        this.outputChannel.appendLine(`      ${prefix} ${w.message}${lineStr}`);
      }
    }

    this.outputChannel.appendLine(`\n${localize('Legend', '凡例')}: ○ low  △ medium  ▲ high  ● critical`);
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
