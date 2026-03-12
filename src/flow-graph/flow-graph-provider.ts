/**
 * Scenario Flow Graph — visual representation of game flow.
 * Uses Mermaid.js for professional flowchart rendering.
 *
 * PRO FEATURE — requires valid license key.
 */

import * as vscode from 'vscode';
import { ProjectIndex, ScenarioNode, TagNode, IfBlockNode, LABEL_REF_TAGS } from '../parser/types';
import { localize } from '../language/i18n';

export interface FlowNode {
  id: string;
  label: string;
  file: string;
  line: number;
  type: 'label' | 'scene-start' | 'choice' | 'end';
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
  type: 'jump' | 'call' | 'return' | 'choice' | 'fallthrough';
  condition?: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export class FlowGraphProvider {
  private filePathLookup = new Map<string, string>();

  constructor(
    private getIndex: () => ProjectIndex | undefined,
    private extensionUri?: vscode.Uri,
  ) {}

  /**
   * Build the flow graph from the project index.
   */
  buildGraph(): FlowGraph {
    const index = this.getIndex();
    if (!index) return { nodes: [], edges: [] };

    // Build a lookup: bare filename → full relative path from the index
    // e.g. "scene1.ks" → "data/scenario/scene1.ks"
    this.filePathLookup = new Map<string, string>();
    for (const key of index.scenarios.keys()) {
      const bare = key.replace(/^.*[/\\]/, ''); // extract filename
      this.filePathLookup.set(bare, key);
      this.filePathLookup.set(key, key); // also map full path to itself
    }

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const nodeIds = new Set<string>();

    for (const [file, scenario] of index.scenarios) {
      const sceneId = `scene:${file}`;
      if (!nodeIds.has(sceneId)) {
        nodes.push({
          id: sceneId,
          label: file.replace(/\.ks$/, ''),
          file,
          line: 0,
          type: 'scene-start',
        });
        nodeIds.add(sceneId);
      }

      for (const [labelName, labelNode] of scenario.labels) {
        const labelId = `${file}:*${labelName}`;
        if (!nodeIds.has(labelId)) {
          nodes.push({
            id: labelId,
            label: `*${labelName}`,
            file,
            line: labelNode.range.start.line,
            type: 'label',
          });
          nodeIds.add(labelId);
        }
      }

      this.extractEdges(scenario.nodes, file, null, edges, nodes, nodeIds);
    }

    for (const [file, scenario] of index.scenarios) {
      const labels = [...scenario.labels.entries()];
      if (labels.length > 0) {
        const firstLabel = labels[0];
        const sceneId = `scene:${file}`;
        const labelId = `${file}:*${firstLabel[0]}`;
        if (!edges.some(e => e.from === sceneId && e.to === labelId)) {
          edges.push({
            from: sceneId,
            to: labelId,
            label: '',
            type: 'fallthrough',
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Generate Mermaid flowchart definition from graph.
   */
  private toMermaid(graph: FlowGraph): string {
    const lines: string[] = ['graph TD'];

    // Sanitize ID for mermaid (only alphanum and underscore)
    const idMap = new Map<string, string>();
    let idCounter = 0;
    const mid = (rawId: string): string => {
      if (!idMap.has(rawId)) {
        idMap.set(rawId, `n${idCounter++}`);
      }
      return idMap.get(rawId)!;
    };

    // Escape mermaid label text
    const esc = (s: string): string =>
      s.replace(/"/g, '#quot;').replace(/[<>{}|]/g, ' ');

    // Node definitions
    for (const node of graph.nodes) {
      const id = mid(node.id);
      const label = esc(node.label);
      switch (node.type) {
        case 'scene-start':
          // Stadium shape (rounded)
          lines.push(`  ${id}(["\u{1F4C4} ${label}"])`);
          break;
        case 'label':
          // Rectangle
          lines.push(`  ${id}["${label}"]`);
          break;
        case 'choice':
          // Diamond
          lines.push(`  ${id}{"${label}"}`);
          break;
        case 'end':
          // Circle
          lines.push(`  ${id}(("${label}"))`);
          break;
      }
    }

    // Edge definitions
    for (const edge of graph.edges) {
      const from = mid(edge.from);
      const to = mid(edge.to);
      const label = esc(edge.label);

      switch (edge.type) {
        case 'jump':
          lines.push(label
            ? `  ${from} -->|"${label}"| ${to}`
            : `  ${from} --> ${to}`);
          break;
        case 'call':
          lines.push(label
            ? `  ${from} -.->|"${label}"| ${to}`
            : `  ${from} -.-> ${to}`);
          break;
        case 'choice':
          lines.push(label
            ? `  ${from} ==>|"${label}"| ${to}`
            : `  ${from} ==> ${to}`);
          break;
        case 'fallthrough':
          lines.push(`  ${from} -.-> ${to}`);
          break;
        case 'return':
          lines.push(label
            ? `  ${from} -. "${label}" .-> ${to}`
            : `  ${from} -.-> ${to}`);
          break;
      }
    }

    // Style classes
    lines.push('');
    // Collect IDs by type
    const sceneIds = graph.nodes.filter(n => n.type === 'scene-start').map(n => mid(n.id));
    const labelIds = graph.nodes.filter(n => n.type === 'label').map(n => mid(n.id));
    const choiceIds = graph.nodes.filter(n => n.type === 'choice').map(n => mid(n.id));
    const endIds = graph.nodes.filter(n => n.type === 'end').map(n => mid(n.id));

    lines.push('  classDef sceneNode fill:#1a3a28,stroke:#4caf50,stroke-width:2px,color:#eee');
    lines.push('  classDef labelNode fill:#1e2d4a,stroke:#569cd6,stroke-width:1.5px,color:#eee');
    lines.push('  classDef choiceNode fill:#3d3520,stroke:#e0a030,stroke-width:1.5px,color:#eee');
    lines.push('  classDef endNode fill:#3d1a1a,stroke:#e05050,stroke-width:2px,color:#eee');

    if (sceneIds.length) lines.push(`  class ${sceneIds.join(',')} sceneNode`);
    if (labelIds.length) lines.push(`  class ${labelIds.join(',')} labelNode`);
    if (choiceIds.length) lines.push(`  class ${choiceIds.join(',')} choiceNode`);
    if (endIds.length) lines.push(`  class ${endIds.join(',')} endNode`);

    return lines.join('\n');
  }

  /**
   * Render the flow graph as an HTML page for a WebviewPanel.
   */
  renderHtml(graph: FlowGraph, webview: vscode.Webview): string {
    const mermaidDef = this.toMermaid(graph);
    const nonce = getNonce();

    // Mermaid JS URI
    const mermaidUri = this.extensionUri
      ? webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'mermaid.min.js'))
      : '';

    // Node click data (mermaid ID → file/line)
    const idMap = new Map<string, string>();
    let idCounter = 0;
    const mid = (rawId: string): string => {
      if (!idMap.has(rawId)) idMap.set(rawId, `n${idCounter++}`);
      return idMap.get(rawId)!;
    };
    const clickData: Record<string, { file: string; line: number }> = {};
    for (const node of graph.nodes) {
      clickData[mid(node.id)] = { file: node.file, line: node.line };
    }
    const clickDataJson = JSON.stringify(clickData);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>${localize('Scenario Flow Graph', 'シナリオフローグラフ')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; overflow: hidden; }

    body {
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #ccc);
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    }

    #container {
      width: 100%; height: 100%;
      overflow: auto;
      cursor: grab;
    }
    #container.dragging { cursor: grabbing; }

    #graph-wrapper {
      transform-origin: 0 0;
      display: inline-block;
      min-width: 100%;
      min-height: 100%;
      padding: 20px;
    }

    /* Mermaid overrides for dark theme */
    .mermaid svg { max-width: none !important; }
    .node rect, .node polygon, .node circle { cursor: pointer; }
    .edgeLabel { font-size: 11px !important; }

    /* ── Toolbar ── */
    .toolbar {
      position: fixed; top: 10px; right: 10px;
      display: flex; gap: 4px; z-index: 100;
    }
    .toolbar button {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none; padding: 6px 12px; cursor: pointer;
      border-radius: 3px; font-size: 13px; font-family: inherit;
    }
    .toolbar button:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    /* ── Legend ── */
    .legend {
      position: fixed; bottom: 10px; left: 10px;
      background: rgba(30,30,30,0.92); border: 1px solid #444;
      border-radius: 4px; padding: 8px 12px; font-size: 11px;
      z-index: 100; display: flex; gap: 14px;
    }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-box { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    .legend-line { width: 24px; height: 2px; display: inline-block; }

    .info {
      position: fixed; bottom: 10px; right: 10px;
      font-size: 11px; color: #666; z-index: 100;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="graph-wrapper">
      <pre class="mermaid">
${mermaidDef}
      </pre>
    </div>
  </div>

  <div class="toolbar">
    <button id="btn-zoom-in" title="Zoom In">+</button>
    <button id="btn-zoom-out" title="Zoom Out">\u2212</button>
    <button id="btn-fit" title="Fit All">\u229e</button>
  </div>

  <div class="legend">
    <div class="legend-item"><span class="legend-box" style="background:#1a3a28;border:1px solid #4caf50"></span> ${localize('Scene', 'シーン')}</div>
    <div class="legend-item"><span class="legend-box" style="background:#1e2d4a;border:1px solid #569cd6"></span> ${localize('Label', 'ラベル')}</div>
    <div class="legend-item"><span class="legend-line" style="background:#888"></span> jump</div>
    <div class="legend-item"><span class="legend-line" style="background:#88c0d0;border-top:1px dashed #88c0d0;height:0"></span> call</div>
    <div class="legend-item"><span class="legend-line" style="background:#e0a030;height:3px"></span> ${localize('choice', '選択肢')}</div>
  </div>

  <div class="info" id="info">
    ${localize('Nodes', 'ノード')}: ${graph.nodes.length} | ${localize('Edges', 'エッジ')}: ${graph.edges.length}
  </div>

  <script nonce="${nonce}" src="${mermaidUri}"></script>
  <script nonce="${nonce}">
    try {
    const vsApi = acquireVsCodeApi();
    const clickData = ${clickDataJson};

    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      flowchart: {
        curve: 'basis',
        padding: 12,
        nodeSpacing: 30,
        rankSpacing: 50,
        useMaxWidth: false,
        htmlLabels: true,
      },
      themeVariables: {
        darkMode: true,
        background: 'transparent',
        primaryColor: '#1e2d4a',
        primaryBorderColor: '#569cd6',
        primaryTextColor: '#eee',
        lineColor: '#666',
        secondaryColor: '#1a3a28',
        tertiaryColor: '#3d3520',
        fontSize: '12px',
      },
    });

    // ── Pan & Zoom ──
    const container = document.getElementById('container');
    const wrapper = document.getElementById('graph-wrapper');
    let scale = 1;

    function setTransform() {
      wrapper.style.transform = 'scale(' + scale + ')';
    }

    function zoomAt(newScale, clientX, clientY) {
      // Point in content coordinates before zoom
      const cx = (container.scrollLeft + clientX) / scale;
      const cy = (container.scrollTop + clientY) / scale;
      const oldScale = scale;
      scale = Math.max(0.15, Math.min(3, newScale));
      // Adjust scroll so the point under cursor stays fixed
      container.scrollLeft = cx * scale - clientX;
      container.scrollTop = cy * scale - clientY;
      setTransform();
    }

    function fitAll() {
      const svg = wrapper.querySelector('svg');
      if (!svg) return;

      // Reset scale to measure natural size
      scale = 1;
      setTransform();

      const vw = container.clientWidth;
      const vh = container.clientHeight;
      const sw = svg.scrollWidth || svg.getBoundingClientRect().width;
      const sh = svg.scrollHeight || svg.getBoundingClientRect().height;

      // Scale to fit with some padding
      scale = Math.min(vw / (sw + 40), vh / (sh + 40), 1.5);
      scale = Math.max(scale, 0.2);
      setTransform();

      // Center: if scaled content is smaller than viewport, center it
      const scaledW = sw * scale;
      const scaledH = sh * scale;
      container.scrollLeft = scaledW > vw ? (scaledW - vw) / 2 : 0;
      container.scrollTop = scaledH > vh ? (scaledH - vh) / 2 : 0;
    }

    // Wait for mermaid to render, then attach click handlers
    setTimeout(() => {
      // Debug: log all node IDs to find the pattern
      const allNodes = document.querySelectorAll('.node');
      const foundIds = [];
      allNodes.forEach(el => { if (el.id) foundIds.push(el.id); });

      allNodes.forEach(el => {
        // Mermaid generates IDs like "flowchart-n0-123" — extract the middle part
        const raw = el.id || '';
        // Try multiple patterns
        let mId = null;
        const m1 = raw.match(/^flowchart-(\\w+)-\\d+$/);
        if (m1) mId = m1[1];
        if (!mId) {
          const m2 = raw.match(/^(\\w+)-\\d+$/);
          if (m2) mId = m2[1];
        }
        if (!mId) mId = raw;

        if (mId && clickData[mId]) {
          el.style.cursor = 'pointer';
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            vsApi.postMessage({ type: 'navigate', file: clickData[mId].file, line: clickData[mId].line });
          });
        }
      });

      fitAll();
    }, 500);

    document.getElementById('btn-zoom-in').onclick = () => {
      const vw = container.clientWidth;
      const vh = container.clientHeight;
      zoomAt(scale * 1.25, vw / 2, vh / 2);
    };
    document.getElementById('btn-zoom-out').onclick = () => {
      const vw = container.clientWidth;
      const vh = container.clientHeight;
      zoomAt(scale / 1.25, vw / 2, vh / 2);
    };
    document.getElementById('btn-fit').onclick = fitAll;

    // Mouse wheel zoom — centered on cursor
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = container.getBoundingClientRect();
      zoomAt(scale * factor, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    // Drag to pan
    let dragging = false, startX = 0, startY = 0, scrollX0 = 0, scrollY0 = 0;
    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node')) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      scrollX0 = container.scrollLeft; scrollY0 = container.scrollTop;
      container.classList.add('dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      container.scrollLeft = scrollX0 - (e.clientX - startX);
      container.scrollTop = scrollY0 - (e.clientY - startY);
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      container.classList.remove('dragging');
    });

    } catch (err) {
      document.getElementById('info').textContent = 'ERROR: ' + err.message;
      document.getElementById('info').style.cssText = 'position:fixed;top:10px;left:10px;color:red;font-size:14px;white-space:pre-wrap;max-width:90vw;z-index:999;';
    }
  </script>
</body>
</html>`;
  }

  // ── Graph extraction ──

  private extractEdges(
    nodesAst: ScenarioNode[],
    file: string,
    currentLabel: string | null,
    edges: FlowEdge[],
    graphNodes: FlowNode[],
    nodeIds: Set<string>,
  ): void {
    for (const node of nodesAst) {
      if (node.type === 'label') {
        currentLabel = node.name;
      }

      if (node.type === 'tag') {
        this.extractEdgeFromTag(node, file, currentLabel, edges, graphNodes, nodeIds);
      }

      if (node.type === 'if_block') {
        this.extractEdges(node.thenBranch, file, currentLabel, edges, graphNodes, nodeIds);
        for (const branch of node.elsifBranches) {
          this.extractEdges(branch.body, file, currentLabel, edges, graphNodes, nodeIds);
        }
        if (node.elseBranch) {
          this.extractEdges(node.elseBranch, file, currentLabel, edges, graphNodes, nodeIds);
        }
      }

      if (node.type === 'macro_def') {
        this.extractEdges(node.body, file, currentLabel, edges, graphNodes, nodeIds);
      }
    }
  }

  private extractEdgeFromTag(
    node: TagNode,
    file: string,
    currentLabel: string | null,
    edges: FlowEdge[],
    graphNodes: FlowNode[],
    nodeIds: Set<string>,
  ): void {
    if (!LABEL_REF_TAGS.has(node.name)) {
      return;
    }

    const storageAttr = node.attributes.find(a => a.name === 'storage');
    const targetAttr = node.attributes.find(a => a.name === 'target');
    const condAttr = node.attributes.find(a => a.name === 'cond');

    const rawTarget = storageAttr?.value;
    // Resolve bare filename (e.g. "scene1.ks") to indexed path (e.g. "data/scenario/scene1.ks")
    const targetFile = rawTarget
      ? (this.filePathLookup.get(rawTarget) ?? rawTarget)
      : file;
    const targetLabel = targetAttr?.value?.replace(/^\*/, '') ?? null;

    if (targetLabel?.startsWith('&')) return;

    const fromId = currentLabel ? `${file}:*${currentLabel}` : `scene:${file}`;
    const toId = targetLabel ? `${targetFile}:*${targetLabel}` : `scene:${targetFile}`;

    if (!nodeIds.has(toId)) {
      graphNodes.push({
        id: toId,
        label: targetLabel ? `*${targetLabel}` : targetFile.replace(/\.ks$/, ''),
        file: targetFile,
        line: 0,
        type: targetLabel ? 'label' : 'scene-start',
      });
      nodeIds.add(toId);
    }

    const edgeType: FlowEdge['type'] =
      (node.name === 'button' || node.name === 'glink') ? 'choice' :
      node.name === 'call' ? 'call' : 'jump';

    edges.push({
      from: fromId,
      to: toId,
      label: `[${node.name}]`,
      type: edgeType,
      condition: condAttr?.value,
    });
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
