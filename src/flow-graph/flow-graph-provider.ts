/**
 * Scenario Flow Graph — visual representation of game flow.
 * Shows all jump/call/if connections between labels and scenes.
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
  constructor(
    private getIndex: () => ProjectIndex | undefined,
  ) {}

  /**
   * Build the flow graph from the project index.
   */
  buildGraph(): FlowGraph {
    const index = this.getIndex();
    if (!index) return { nodes: [], edges: [] };

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const nodeIds = new Set<string>();

    for (const [file, scenario] of index.scenarios) {
      // Scene start node
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

      // Label nodes
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

      // Extract edges from tags
      this.extractEdges(scenario.nodes, file, null, edges, nodes, nodeIds);
    }

    // Add fallthrough edges from scene-start to the first label in each file
    for (const [file, scenario] of index.scenarios) {
      const labels = [...scenario.labels.entries()];
      if (labels.length > 0) {
        const firstLabel = labels[0];
        const sceneId = `scene:${file}`;
        const labelId = `${file}:*${firstLabel[0]}`;
        // Only add if no explicit jump from scene start already exists
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
   * Render the flow graph as an HTML page for a WebviewPanel.
   */
  renderHtml(graph: FlowGraph): string {
    // Compute layout
    const layout = this.computeLayout(graph);
    const graphJson = JSON.stringify({ ...graph, layout });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${localize('Scenario Flow Graph', 'シナリオフローグラフ')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #ccc);
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: 13px;
      overflow: hidden;
    }

    #canvas { width: 100vw; height: 100vh; }

    svg { display: block; }

    /* ── Nodes ── */
    .node { cursor: pointer; }
    .node:hover rect, .node:hover ellipse { filter: brightness(1.3); }

    .node-scene rect {
      fill: #2d5a3d;
      stroke: #4caf50;
      stroke-width: 2;
      rx: 8;
    }

    .node-label rect {
      fill: #2a3a5c;
      stroke: #569cd6;
      stroke-width: 1.5;
      rx: 6;
    }

    .node-choice rect {
      fill: #5a4a2d;
      stroke: #e0a030;
      stroke-width: 1.5;
      rx: 6;
    }

    .node-end ellipse {
      fill: #5a2d2d;
      stroke: #e05050;
      stroke-width: 2;
    }

    .node text {
      fill: #eee;
      font-size: 12px;
      pointer-events: none;
    }

    .node .file-label {
      fill: #888;
      font-size: 9px;
    }

    /* ── Edges ── */
    .edge path {
      fill: none;
      stroke-width: 1.5;
    }

    .edge-jump path { stroke: #888; }
    .edge-call path { stroke: #88c0d0; stroke-dasharray: 6,3; }
    .edge-choice path { stroke: #e0a030; }
    .edge-fallthrough path { stroke: #555; stroke-dasharray: 2,4; }

    .edge text {
      fill: var(--vscode-descriptionForeground, #888);
      font-size: 10px;
      pointer-events: none;
    }

    /* ── Toolbar ── */
    .toolbar {
      position: fixed;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 4px;
      z-index: 100;
    }

    .toolbar button {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 5px 10px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
    }

    .toolbar button:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
    }

    /* ── Legend ── */
    .legend {
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(30,30,30,0.85);
      border: 1px solid #444;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 11px;
      z-index: 100;
      display: flex;
      gap: 14px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-line {
      width: 24px;
      height: 2px;
      display: inline-block;
    }

    .legend-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      display: inline-block;
    }

    /* ── Info bar ── */
    .info {
      position: fixed;
      bottom: 10px;
      right: 10px;
      font-size: 11px;
      color: #666;
      z-index: 100;
    }
  </style>
</head>
<body>
  <svg id="svg" width="100%" height="100%"></svg>

  <div class="toolbar">
    <button id="btn-zoom-in" title="Zoom In">+</button>
    <button id="btn-zoom-out" title="Zoom Out">−</button>
    <button id="btn-fit" title="Fit All">⊞</button>
  </div>

  <div class="legend">
    <div class="legend-item"><span class="legend-box" style="background:#2d5a3d;border:1px solid #4caf50"></span> ${localize('Scene', 'シーン')}</div>
    <div class="legend-item"><span class="legend-box" style="background:#2a3a5c;border:1px solid #569cd6"></span> ${localize('Label', 'ラベル')}</div>
    <div class="legend-item"><span class="legend-line" style="background:#888"></span> jump</div>
    <div class="legend-item"><span class="legend-line" style="background:#88c0d0;border-top:2px dashed #88c0d0;height:0"></span> call</div>
    <div class="legend-item"><span class="legend-line" style="background:#e0a030"></span> ${localize('choice', '選択肢')}</div>
  </div>

  <div class="info" id="info">
    ${localize('Nodes', 'ノード')}: ${graph.nodes.length} | ${localize('Edges', 'エッジ')}: ${graph.edges.length}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const data = ${graphJson};
    const graph = data;
    const layout = data.layout; // { positions: { id: {x,y} }, width, height }

    const svgEl = document.getElementById('svg');
    const ns = 'http://www.w3.org/2000/svg';

    const NODE_W = 140;
    const NODE_H = 44;
    const PADDING = 40;

    let scale = 1;
    let tx = 0, ty = 0;

    function render() {
      svgEl.innerHTML = '';

      // Defs (arrow markers)
      const defs = document.createElementNS(ns, 'defs');
      const edgeTypes = [
        { id: 'arrow-jump', color: '#888' },
        { id: 'arrow-call', color: '#88c0d0' },
        { id: 'arrow-choice', color: '#e0a030' },
        { id: 'arrow-fallthrough', color: '#555' },
      ];
      for (const et of edgeTypes) {
        const marker = document.createElementNS(ns, 'marker');
        marker.setAttribute('id', et.id);
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '7');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', et.color);
        marker.appendChild(path);
        defs.appendChild(marker);
      }
      svgEl.appendChild(defs);

      const root = document.createElementNS(ns, 'g');
      root.setAttribute('transform', \`translate(\${tx},\${ty}) scale(\${scale})\`);

      // Draw edges first (below nodes)
      for (const edge of graph.edges) {
        const fromPos = layout.positions[edge.from];
        const toPos = layout.positions[edge.to];
        if (!fromPos || !toPos) continue;

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'edge edge-' + edge.type);

        const x1 = fromPos.x + NODE_W / 2;
        const y1 = fromPos.y + NODE_H;
        const x2 = toPos.x + NODE_W / 2;
        const y2 = toPos.y;

        // Bezier curve
        const dy = Math.abs(y2 - y1);
        const cp = Math.max(30, dy * 0.4);
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', \`M \${x1} \${y1} C \${x1} \${y1 + cp}, \${x2} \${y2 - cp}, \${x2} \${y2}\`);
        path.setAttribute('marker-end', 'url(#arrow-' + edge.type + ')');
        g.appendChild(path);

        // Edge label
        if (edge.label) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const text = document.createElementNS(ns, 'text');
          text.setAttribute('x', mx + 4);
          text.setAttribute('y', my);
          text.textContent = edge.condition ? edge.label + ' ?' : edge.label;
          g.appendChild(text);
        }

        root.appendChild(g);
      }

      // Draw nodes
      for (const node of graph.nodes) {
        const pos = layout.positions[node.id];
        if (!pos) continue;

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'node node-' + node.type);
        g.setAttribute('transform', \`translate(\${pos.x},\${pos.y})\`);
        g.onclick = () => {
          vscode.postMessage({ type: 'navigate', file: node.file, line: node.line });
        };

        if (node.type === 'end') {
          const ellipse = document.createElementNS(ns, 'ellipse');
          ellipse.setAttribute('cx', String(NODE_W / 2));
          ellipse.setAttribute('cy', String(NODE_H / 2));
          ellipse.setAttribute('rx', String(NODE_W / 2));
          ellipse.setAttribute('ry', String(NODE_H / 2));
          g.appendChild(ellipse);
        } else {
          const rect = document.createElementNS(ns, 'rect');
          rect.setAttribute('width', String(NODE_W));
          rect.setAttribute('height', String(NODE_H));
          g.appendChild(rect);
        }

        // Node label
        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', String(NODE_W / 2));
        text.setAttribute('y', String(NODE_H / 2 - 2));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        const displayLabel = node.label.length > 16 ? node.label.substring(0, 15) + '…' : node.label;
        text.textContent = displayLabel;
        g.appendChild(text);

        // File name (small, below label)
        if (node.type === 'label') {
          const fileText = document.createElementNS(ns, 'text');
          fileText.setAttribute('class', 'file-label');
          fileText.setAttribute('x', String(NODE_W / 2));
          fileText.setAttribute('y', String(NODE_H / 2 + 12));
          fileText.setAttribute('text-anchor', 'middle');
          fileText.setAttribute('dominant-baseline', 'middle');
          fileText.textContent = node.file.replace(/\\.ks$/, '');
          g.appendChild(fileText);
        }

        root.appendChild(g);
      }

      svgEl.appendChild(root);
    }

    function fitAll() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gw = layout.width + PADDING * 2;
      const gh = layout.height + PADDING * 2;
      scale = Math.min(vw / gw, vh / gh, 1.5);
      tx = (vw - gw * scale) / 2 + PADDING * scale;
      ty = (vh - gh * scale) / 2 + PADDING * scale;
      render();
    }

    document.getElementById('btn-zoom-in').onclick = () => { scale *= 1.25; render(); };
    document.getElementById('btn-zoom-out').onclick = () => { scale /= 1.25; render(); };
    document.getElementById('btn-fit').onclick = fitAll;

    // Pan with mouse drag
    let dragging = false, lastX = 0, lastY = 0;
    svgEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node')) return; // don't pan when clicking nodes
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      svgEl.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      tx += e.clientX - lastX;
      ty += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      render();
    });
    window.addEventListener('mouseup', () => { dragging = false; svgEl.style.cursor = 'default'; });

    // Zoom with scroll wheel
    svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svgEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      tx = mx - factor * (mx - tx);
      ty = my - factor * (my - ty);
      scale *= factor;
      render();
    }, { passive: false });

    // Initial render
    fitAll();
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

    const targetFile = storageAttr?.value ?? file;
    const targetLabel = targetAttr?.value?.replace(/^\*/, '') ?? null;

    // Skip dynamic targets
    if (targetLabel?.startsWith('&')) return;

    const fromId = currentLabel ? `${file}:*${currentLabel}` : `scene:${file}`;
    const toId = targetLabel ? `${targetFile}:*${targetLabel}` : `scene:${targetFile}`;

    // Ensure target node exists
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

  // ── Layout algorithm ──

  /**
   * Compute a hierarchical (top-to-bottom) layout for the DAG.
   * Uses a simplified Sugiyama-style algorithm:
   * 1. Assign layers via longest-path layering
   * 2. Order nodes within layers to minimize crossings (barycenter heuristic)
   * 3. Assign X/Y positions
   */
  private computeLayout(graph: FlowGraph): {
    positions: Record<string, { x: number; y: number }>;
    width: number;
    height: number;
  } {
    const NODE_W = 140;
    const NODE_H = 44;
    const H_GAP = 40;
    const V_GAP = 60;

    if (graph.nodes.length === 0) {
      return { positions: {}, width: 0, height: 0 };
    }

    // Build adjacency
    const children = new Map<string, string[]>();
    const parents = new Map<string, string[]>();
    for (const node of graph.nodes) {
      children.set(node.id, []);
      parents.set(node.id, []);
    }
    for (const edge of graph.edges) {
      children.get(edge.from)?.push(edge.to);
      parents.get(edge.to)?.push(edge.from);
    }

    // Step 1: Layer assignment (longest path from roots)
    const layers = new Map<string, number>();
    const visited = new Set<string>();

    const assignLayer = (id: string): number => {
      if (layers.has(id)) return layers.get(id)!;
      if (visited.has(id)) return 0; // cycle guard
      visited.add(id);

      const pars = parents.get(id) ?? [];
      let maxParent = -1;
      for (const p of pars) {
        maxParent = Math.max(maxParent, assignLayer(p));
      }
      const layer = maxParent + 1;
      layers.set(id, layer);
      return layer;
    };

    for (const node of graph.nodes) {
      assignLayer(node.id);
    }

    // Group nodes by layer
    const layerGroups = new Map<number, string[]>();
    for (const [id, layer] of layers) {
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      layerGroups.get(layer)!.push(id);
    }

    // Step 2: Order within layers (barycenter heuristic, 2 passes)
    const order = new Map<string, number>();

    // Initial order: by file name then label name for stability
    for (const [, group] of layerGroups) {
      group.sort();
      group.forEach((id, i) => order.set(id, i));
    }

    // Barycenter passes
    const maxLayer = Math.max(...layerGroups.keys());
    for (let pass = 0; pass < 4; pass++) {
      // Forward pass
      for (let l = 1; l <= maxLayer; l++) {
        const group = layerGroups.get(l);
        if (!group) continue;
        const barycenters = group.map(id => {
          const pars = parents.get(id) ?? [];
          if (pars.length === 0) return { id, bc: order.get(id) ?? 0 };
          const sum = pars.reduce((s, p) => s + (order.get(p) ?? 0), 0);
          return { id, bc: sum / pars.length };
        });
        barycenters.sort((a, b) => a.bc - b.bc);
        barycenters.forEach((item, i) => {
          const idx = layerGroups.get(l)!.indexOf(item.id);
          layerGroups.get(l)![i] = item.id;
          order.set(item.id, i);
        });
      }

      // Backward pass
      for (let l = maxLayer - 1; l >= 0; l--) {
        const group = layerGroups.get(l);
        if (!group) continue;
        const barycenters = group.map(id => {
          const kids = children.get(id) ?? [];
          if (kids.length === 0) return { id, bc: order.get(id) ?? 0 };
          const sum = kids.reduce((s, c) => s + (order.get(c) ?? 0), 0);
          return { id, bc: sum / kids.length };
        });
        barycenters.sort((a, b) => a.bc - b.bc);
        barycenters.forEach((item, i) => {
          layerGroups.get(l)![i] = item.id;
          order.set(item.id, i);
        });
      }
    }

    // Step 3: Assign coordinates
    const positions: Record<string, { x: number; y: number }> = {};
    let maxX = 0;

    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups.get(l) ?? [];
      const totalWidth = group.length * NODE_W + (group.length - 1) * H_GAP;
      const startX = 0; // will center later

      group.forEach((id, i) => {
        const x = i * (NODE_W + H_GAP);
        const y = l * (NODE_H + V_GAP);
        positions[id] = { x, y };
        maxX = Math.max(maxX, x + NODE_W);
      });
    }

    // Center each layer
    const globalMaxWidth = Math.max(...[...layerGroups.values()].map(
      g => g.length * NODE_W + (g.length - 1) * H_GAP
    ));
    for (let l = 0; l <= maxLayer; l++) {
      const group = layerGroups.get(l) ?? [];
      const layerWidth = group.length * NODE_W + (group.length - 1) * H_GAP;
      const offset = (globalMaxWidth - layerWidth) / 2;
      for (const id of group) {
        positions[id].x += offset;
      }
    }

    const height = (maxLayer + 1) * (NODE_H + V_GAP) - V_GAP;

    return { positions, width: globalMaxWidth, height };
  }
}
