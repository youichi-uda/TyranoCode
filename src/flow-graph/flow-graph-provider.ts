/**
 * Scenario Flow Graph — visual representation of game flow.
 * Shows all jump/call/if connections between labels and scenes.
 *
 * PRO FEATURE — requires valid license key.
 */

import * as vscode from 'vscode';
import { ProjectIndex, ScenarioNode, TagNode, IfBlockNode } from '../parser/types';

interface FlowNode {
  id: string;
  label: string;
  file: string;
  line: number;
  type: 'label' | 'scene-start' | 'choice' | 'end';
}

interface FlowEdge {
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

export class FlowGraphProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private getIndex: () => ProjectIndex | undefined,
    private extensionUri: vscode.Uri,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    this.refresh();
  }

  refresh(): void {
    if (!this.view) return;
    const graph = this.buildGraph();
    this.view.webview.html = this.getHtml(graph);
  }

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

    return { nodes, edges };
  }

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
    if (node.name !== 'jump' && node.name !== 'call' && node.name !== 'button' && node.name !== 'glink') {
      return;
    }

    const storageAttr = node.attributes.find(a => a.name === 'storage');
    const targetAttr = node.attributes.find(a => a.name === 'target');
    const condAttr = node.attributes.find(a => a.name === 'cond');

    const targetFile = storageAttr?.value ?? file;
    const targetLabel = targetAttr?.value?.replace(/^\*/, '') ?? null;

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

  private getHtml(graph: FlowGraph): string {
    const graphJson = JSON.stringify(graph);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TyranoDev Flow Graph</title>
  <style>
    body { margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); overflow: hidden; }
    #graph { width: 100vw; height: 100vh; }
    .node { cursor: pointer; }
    .node rect { fill: var(--vscode-badge-background); stroke: var(--vscode-badge-foreground); stroke-width: 1.5; rx: 6; }
    .node.scene-start rect { fill: var(--vscode-statusBarItem-prominentBackground); }
    .node.choice rect { fill: var(--vscode-inputValidation-warningBackground); }
    .node text { fill: var(--vscode-badge-foreground); font-size: 12px; }
    .edge line, .edge path { stroke: var(--vscode-editor-foreground); stroke-width: 1.5; fill: none; }
    .edge.call path { stroke-dasharray: 5,5; }
    .edge.choice path { stroke: var(--vscode-charts-yellow); }
    .edge text { fill: var(--vscode-descriptionForeground); font-size: 10px; }
    .toolbar { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }
    .toolbar button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-size: 12px; }
    .toolbar button:hover { background: var(--vscode-button-hoverBackground); }
    #info { position: absolute; bottom: 8px; left: 8px; font-size: 11px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <div id="graph">
    <svg id="svg" width="100%" height="100%"></svg>
  </div>
  <div class="toolbar">
    <button onclick="zoomIn()">+</button>
    <button onclick="zoomOut()">-</button>
    <button onclick="fitAll()">Fit</button>
  </div>
  <div id="info">Nodes: ${graph.nodes.length} | Edges: ${graph.edges.length}</div>
  <script>
    const vscode = acquireVsCodeApi();
    const graph = ${graphJson};

    // Simple force-directed layout
    // Full implementation would use d3-force or dagre
    const svg = document.getElementById('svg');
    const ns = 'http://www.w3.org/2000/svg';
    let scale = 1;
    let tx = 0, ty = 0;

    function render() {
      svg.innerHTML = '';
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');

      // Layout nodes in a grid for now (dagre layout in full implementation)
      const nodePositions = new Map();
      const cols = Math.ceil(Math.sqrt(graph.nodes.length));
      graph.nodes.forEach((node, i) => {
        const x = (i % cols) * 200 + 50;
        const y = Math.floor(i / cols) * 100 + 50;
        nodePositions.set(node.id, { x, y });

        const group = document.createElementNS(ns, 'g');
        group.setAttribute('class', 'node ' + node.type);
        group.setAttribute('transform', 'translate(' + x + ',' + y + ')');
        group.onclick = () => {
          vscode.postMessage({ type: 'navigate', file: node.file, line: node.line });
        };

        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', '-60');
        rect.setAttribute('y', '-18');
        rect.setAttribute('width', '120');
        rect.setAttribute('height', '36');
        group.appendChild(rect);

        const text = document.createElementNS(ns, 'text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dy', '4');
        text.textContent = node.label.length > 14 ? node.label.substring(0, 13) + '…' : node.label;
        group.appendChild(text);

        g.appendChild(group);
      });

      // Edges
      graph.edges.forEach(edge => {
        const from = nodePositions.get(edge.from);
        const to = nodePositions.get(edge.to);
        if (!from || !to) return;

        const line = document.createElementNS(ns, 'line');
        line.setAttribute('class', 'edge ' + edge.type);
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y + 18);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y - 18);
        line.setAttribute('stroke', edge.type === 'choice' ? '#e0a030' : '#888');
        if (edge.type === 'call') line.setAttribute('stroke-dasharray', '5,5');
        line.setAttribute('marker-end', 'url(#arrow)');
        g.appendChild(line);
      });

      // Arrow marker
      const defs = document.createElementNS(ns, 'defs');
      const marker = document.createElementNS(ns, 'marker');
      marker.setAttribute('id', 'arrow');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '8');
      marker.setAttribute('orient', 'auto');
      const arrowPath = document.createElementNS(ns, 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      arrowPath.setAttribute('fill', '#888');
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
      svg.appendChild(defs);

      svg.appendChild(g);
    }

    function zoomIn() { scale *= 1.2; render(); }
    function zoomOut() { scale /= 1.2; render(); }
    function fitAll() { scale = 1; tx = 0; ty = 0; render(); }

    render();

    // Handle pan with mouse drag
    let dragging = false, lastX = 0, lastY = 0;
    svg.onmousedown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    svg.onmousemove = (e) => {
      if (!dragging) return;
      tx += e.clientX - lastX;
      ty += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      render();
    };
    svg.onmouseup = () => { dragging = false; };
    svg.onwheel = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn(); else zoomOut();
    };
  </script>
</body>
</html>`;
  }
}
