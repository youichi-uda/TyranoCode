/**
 * TyranoScript Debug Adapter.
 * Implements VS Code Debug Adapter Protocol (DAP) for TyranoScript.
 *
 * Architecture:
 * 1. Starts an HTTP server to serve the game (with debug bridge auto-injected)
 * 2. Opens a browser to play/test the game
 * 3. Starts a WebSocket server for debug communication
 * 4. The debug bridge (auto-injected) connects via WebSocket
 * 5. Bridge intercepts tag execution and communicates state
 * 6. This adapter translates between DAP and the bridge protocol
 *
 * PRO FEATURE — requires valid license key.
 */

import {
  LoggingDebugSession,
  InitializedEvent,
  StoppedEvent,
  ContinuedEvent,
  OutputEvent,
  TerminatedEvent,
  Thread,
  StackFrame,
  Scope,
  Source,
  Variable,
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  projectRoot: string;
  scene: string;
  port: number;
  httpPort: number;
  browser: 'external' | 'simple-browser';
}

interface BridgeMessage {
  type: string;
  data: Record<string, unknown>;
}

interface BridgeState {
  file: string;
  line: number;
  tag: string;
  params: Record<string, string>;
  callStack: Array<{ file: string; index: number; tag: string }>;
  variables: {
    f: Record<string, string>;
    sf: Record<string, string>;
    tf: Record<string, string>;
  };
}

interface BreakpointInfo {
  line: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

const THREAD_ID = 1;

export class TyranoDebugSession extends LoggingDebugSession {
  /** Set to true when the bridge connects — checked by extension.ts to skip browser open */
  public static bridgeConnected = false;

  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private bridgeSocket: WebSocket | null = null;
  private bridgeConnectedOnce = false;
  private bridgeState: BridgeState | null = null;
  private projectRoot: string = '';
  private nextBreakpointId: number = 1;
  private pendingBreakpoints: Map<string, BreakpointInfo[]> = new Map();
  private pendingEvals: Map<number, (result: { value: string; type: string }) => void> = new Map();
  private nextEvalId: number = 1;
  private exceptionBreakOnIscript: boolean = true;

  constructor() {
    super('tyranoscript-debug.log');
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    _args: DebugProtocol.InitializeRequestArguments,
  ): void {
    response.body = response.body ?? {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsFunctionBreakpoints = false;
    response.body.supportsConditionalBreakpoints = true;
    response.body.supportsHitConditionalBreakpoints = true;
    response.body.supportsLogPoints = true;
    response.body.supportsEvaluateForHovers = true;
    response.body.supportsStepBack = false;
    response.body.supportsSetVariable = true;
    response.body.supportsRestartRequest = true;
    response.body.supportsModulesRequest = false;
    response.body.supportsTerminateRequest = true;
    response.body.supportsExceptionInfoRequest = true;
    response.body.supportsExceptionOptions = true;
    response.body.exceptionBreakpointFilters = [
      {
        filter: 'iscript',
        label: 'Exceptions in [iscript] blocks',
        default: true,
      },
    ];

    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): Promise<void> {
    this.projectRoot = args.projectRoot;
    const wsPort = args.port || 9871;
    const httpPort = args.httpPort || 3871;

    // ── 1. Start WebSocket server ──
    this.sendEvent(new OutputEvent(
      `TyranoCode Debugger: Starting on ports WS:${wsPort} HTTP:${httpPort}...\n`,
      'console',
    ));

    try {
      this.wss = new WebSocketServer({ port: wsPort });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.sendEvent(new OutputEvent(`Failed to start WebSocket server: ${msg}\n`, 'stderr'));
      this.sendResponse(response);
      this.sendEvent(new TerminatedEvent());
      return;
    }

    this.wss.on('connection', (socket) => {
      // Reject duplicate connections — only one game tab allowed
      if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
        try { socket.close(); } catch { /* ignore */ }
        return;
      }
      this.bridgeSocket = socket;

      this.syncBreakpoints();

      socket.on('message', (data) => {
        try {
          const msg: BridgeMessage = JSON.parse(data.toString());
          this.handleBridgeMessage(msg);
        } catch {
          // Ignore invalid messages
        }
      });

      socket.on('close', () => {
        // Only clear if this is still the active socket
        if (this.bridgeSocket === socket) {
          this.bridgeSocket = null;
        }
      });
    });

    // ── 2. Start HTTP server with auto-injected debug bridge ──
    const bridgePath = path.join(path.dirname(__dirname), 'debugger', 'debug-bridge.js');
    let bridgeScript = '';
    try {
      bridgeScript = fs.readFileSync(bridgePath, 'utf-8');
    } catch {
      // Try alternative path (when running from out/)
      const altPath = path.join(__dirname, 'debug-bridge.js');
      try {
        bridgeScript = fs.readFileSync(altPath, 'utf-8');
      } catch {
        this.sendEvent(new OutputEvent(
          `Warning: debug-bridge.js not found at ${bridgePath} or ${altPath}\n`, 'stderr',
        ));
      }
    }

    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.ks': 'text/plain',
    };

    this.httpServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${httpPort}`);
      let filePath = path.join(this.projectRoot, decodeURIComponent(url.pathname));

      // Default to index.html
      if (url.pathname === '/' || url.pathname === '') {
        filePath = path.join(this.projectRoot, 'index.html');
      }

      // Security: prevent path traversal
      if (!filePath.startsWith(this.projectRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found: ' + url.pathname);
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        // Auto-inject debug bridge into index.html
        if (filePath.endsWith('index.html') && bridgeScript) {
          let html = data.toString('utf-8');
          const injection = `
<!-- TyranoCode Debug Bridge (auto-injected) -->
<script>window.__TYRANOCODE_DEBUG_PORT__=${wsPort};</script>
<script>${bridgeScript}</script>
`;
          html = html.replace('</body>', injection + '</body>');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          res.end(html);
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });

    try {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(httpPort, () => resolve());
        this.httpServer!.on('error', reject);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.sendEvent(new OutputEvent(`Failed to start HTTP server: ${msg}\n`, 'stderr'));
      this.cleanup();
      this.sendResponse(response);
      this.sendEvent(new TerminatedEvent());
      return;
    }

    const gameUrl = `http://localhost:${httpPort}/`;
    this.sendEvent(new OutputEvent(`Game: ${gameUrl}\n`, 'console'));

    // ── 3. Open browser ──
    // Send a custom event that extension.ts can handle to open Simple Browser
    this.sendEvent(new OutputEvent(`\x1b]tyranocode:openBrowser;${gameUrl}\x1b\\`, 'console'));

    this.sendResponse(response);
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    _args: DebugProtocol.ConfigurationDoneArguments,
  ): void {
    this.sendResponse(response);
  }

  // ── Breakpoints ──

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): void {
    const filePath = args.source.path ?? '';
    const relativePath = this.toGamePath(filePath);
    const clientBreakpoints = args.breakpoints ?? [];

    const bpInfos: BreakpointInfo[] = clientBreakpoints.map(bp => ({
      line: bp.line,
      condition: bp.condition,
      hitCondition: bp.hitCondition,
      logMessage: bp.logMessage,
    }));
    this.pendingBreakpoints.set(relativePath, bpInfos);

    this.syncBreakpoints();

    response.body = {
      breakpoints: clientBreakpoints.map(bp => ({
        id: this.nextBreakpointId++,
        verified: this.bridgeSocket !== null,
        line: bp.line,
        source: args.source,
      } as DebugProtocol.Breakpoint)),
    };

    this.sendResponse(response);
  }

  protected setExceptionBreakPointsRequest(
    response: DebugProtocol.SetExceptionBreakpointsResponse,
    args: DebugProtocol.SetExceptionBreakpointsArguments,
  ): void {
    this.exceptionBreakOnIscript = (args.filters || []).includes('iscript');
    this.sendToBridge('setExceptionBreakpoints', { iscript: this.exceptionBreakOnIscript });
    this.sendResponse(response);
  }

  private syncBreakpoints(): void {
    if (!this.bridgeSocket) return;

    const allBps: Array<{
      file: string;
      line: number;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }> = [];
    for (const [file, bps] of this.pendingBreakpoints) {
      for (const bp of bps) {
        allBps.push({ file, line: bp.line, condition: bp.condition, hitCondition: bp.hitCondition, logMessage: bp.logMessage });
      }
    }

    this.sendToBridge('setBreakpoints', { breakpoints: allBps });
  }

  // ── Threads / Stack / Scopes / Variables ──

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(THREAD_ID, 'TyranoScript Main')],
    };
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    _args: DebugProtocol.StackTraceArguments,
  ): void {
    const frames: StackFrame[] = [];

    if (this.bridgeState) {
      frames.push(new StackFrame(
        0,
        `[${this.bridgeState.tag}]`,
        new Source(
          path.basename(this.bridgeState.file),
          this.toAbsolutePath(this.bridgeState.file),
        ),
        this.bridgeState.line,
      ));

      for (let i = 0; i < this.bridgeState.callStack.length; i++) {
        const frame = this.bridgeState.callStack[i];
        frames.push(new StackFrame(
          i + 1,
          `[${frame.tag}]`,
          new Source(
            path.basename(frame.file),
            this.toAbsolutePath(frame.file),
          ),
          0,
        ));
      }
    }

    response.body = {
      stackFrames: frames,
      totalFrames: frames.length,
    };
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    _args: DebugProtocol.ScopesArguments,
  ): void {
    response.body = {
      scopes: [
        new Scope('Game Variables (f.)', 1, false),
        new Scope('System Variables (sf.)', 2, false),
        new Scope('Temporary Variables (tf.)', 3, false),
      ],
    };
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): void {
    const variables: Variable[] = [];

    if (this.bridgeState) {
      let scope: Record<string, string> = {};
      switch (args.variablesReference) {
        case 1: scope = this.bridgeState.variables.f; break;
        case 2: scope = this.bridgeState.variables.sf; break;
        case 3: scope = this.bridgeState.variables.tf; break;
      }

      for (const [name, value] of Object.entries(scope)) {
        variables.push(new Variable(name, value, 0));
      }
    }

    response.body = { variables };
    this.sendResponse(response);
  }

  protected setVariableRequest(
    response: DebugProtocol.SetVariableResponse,
    args: DebugProtocol.SetVariableArguments,
  ): void {
    const scopeNames: Record<number, string> = { 1: 'f', 2: 'sf', 3: 'tf' };
    const scope = scopeNames[args.variablesReference];

    if (scope) {
      this.sendToBridge('setVariable', {
        scope,
        name: args.name,
        value: args.value,
      });
    }

    response.body = { value: args.value };
    this.sendResponse(response);
  }

  // ── Execution control ──

  protected pauseRequest(
    response: DebugProtocol.PauseResponse,
    _args: DebugProtocol.PauseArguments,
  ): void {
    this.sendToBridge('pause', {});
    this.sendResponse(response);
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    _args: DebugProtocol.ContinueArguments,
  ): void {
    this.sendToBridge('continue', {});
    this.sendResponse(response);
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    _args: DebugProtocol.NextArguments,
  ): void {
    this.sendToBridge('next', {});
    this.sendResponse(response);
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    _args: DebugProtocol.StepInArguments,
  ): void {
    this.sendToBridge('stepIn', {});
    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    _args: DebugProtocol.StepOutArguments,
  ): void {
    this.sendToBridge('stepOut', {});
    this.sendResponse(response);
  }

  // ── Evaluate ──

  protected evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): void {
    if (!this.bridgeSocket) {
      response.body = { result: '(debugger not connected)', variablesReference: 0 };
      this.sendResponse(response);
      return;
    }

    const evalId = this.nextEvalId++;
    this.pendingEvals.set(evalId, (result) => {
      response.body = { result: result.value, variablesReference: 0 };
      this.sendResponse(response);
    });

    this.sendToBridge('evaluate', { id: evalId, expression: args.expression });

    setTimeout(() => {
      if (this.pendingEvals.has(evalId)) {
        this.pendingEvals.delete(evalId);
        response.body = { result: '(evaluation timed out)', variablesReference: 0 };
        this.sendResponse(response);
      }
    }, 5000);
  }

  // ── Restart / Terminate / Disconnect ──

  protected restartRequest(
    response: DebugProtocol.RestartResponse,
    _args: DebugProtocol.RestartArguments,
  ): void {
    this.sendToBridge('restart', {});
    this.sendResponse(response);
  }

  protected terminateRequest(
    response: DebugProtocol.TerminateResponse,
    _args: DebugProtocol.TerminateArguments,
  ): void {
    this.sendToBridge('closeTab', {});
    this.cleanup();
    this.sendResponse(response);
    this.sendEvent(new TerminatedEvent());
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    _args: DebugProtocol.DisconnectArguments,
  ): void {
    this.sendToBridge('closeTab', {});
    this.cleanup();
    this.sendResponse(response);
  }

  // ── Bridge communication ──

  private handleBridgeMessage(msg: BridgeMessage): void {
    switch (msg.type) {
      case 'connected':
        TyranoDebugSession.bridgeConnected = true;
        if (!this.bridgeConnectedOnce) {
          this.bridgeConnectedOnce = true;
          this.sendEvent(new OutputEvent(
            `Debug bridge v${msg.data.version} connected.\n`, 'console',
          ));
        }
        this.syncBreakpoints();
        break;

      case 'stopped': {
        const data = msg.data as unknown as BridgeState & { reason: string };
        this.bridgeState = {
          file: data.file,
          line: data.line,
          tag: data.tag,
          params: data.params,
          callStack: data.callStack,
          variables: data.variables,
        };

        this.sendEvent(new OutputEvent(
          `Paused at ${data.file}:${data.line} [${data.tag}] (${data.reason})\n`,
          'console',
        ));

        const stopReason = data.reason === 'breakpoint' ? 'breakpoint'
          : data.reason === 'pause' ? 'pause' : 'step';
        this.sendEvent(new StoppedEvent(stopReason, THREAD_ID));
        break;
      }

      case 'logpoint': {
        const logMsg = msg.data.message as string;
        this.sendEvent(new OutputEvent(logMsg + '\n', 'console'));
        break;
      }

      case 'exception': {
        const excData = msg.data as unknown as BridgeState & { reason: string; message: string };
        this.bridgeState = {
          file: excData.file,
          line: excData.line,
          tag: excData.tag,
          params: excData.params,
          callStack: excData.callStack,
          variables: excData.variables,
        };
        this.sendEvent(new OutputEvent(
          `Exception in [iscript] at ${excData.file}:${excData.line}: ${excData.message}\n`,
          'stderr',
        ));
        this.sendEvent(new StoppedEvent('exception', THREAD_ID, excData.message));
        break;
      }

      case 'positionUpdate': {
        // Game advanced while paused (user clicked in game)
        const posData = msg.data as unknown as BridgeState;
        this.bridgeState = {
          file: posData.file,
          line: posData.line,
          tag: posData.tag,
          params: posData.params,
          callStack: posData.callStack,
          variables: posData.variables,
        };
        // VS Code needs ContinuedEvent then StoppedEvent to refresh the stopped UI
        this.sendEvent(new ContinuedEvent(THREAD_ID));
        setTimeout(() => {
          this.sendEvent(new StoppedEvent('pause', THREAD_ID));
        }, 50);
        break;
      }

      case 'debugLog':
        // Required for WebSocket message framing — do not remove
        break;

      case 'consoleOutput': {
        const output = msg.data.output as string;
        const category = (msg.data.category as string) || 'console';
        const method = (msg.data.method as string) || 'log';
        // Prefix with method for clarity (except plain 'log')
        const prefix = (method === 'error' || method === 'warn' || method === 'alert') ? `[${method}] ` : '';
        this.sendEvent(new OutputEvent(
          `${prefix}${output}\n`,
          category as 'console' | 'stdout' | 'stderr',
        ));
        break;
      }

      case 'tagExec':
        break;

      case 'evaluateResult': {
        const evalId = msg.data.id as number;
        const result = msg.data.result as { value: string; type: string };
        const resolver = this.pendingEvals.get(evalId);
        if (resolver) {
          this.pendingEvals.delete(evalId);
          resolver(result);
        }
        break;
      }

      case 'variables':
        break;
    }
  }

  private sendToBridge(command: string, data: Record<string, unknown>): void {
    if (!this.bridgeSocket || this.bridgeSocket.readyState !== WebSocket.OPEN) return;
    this.bridgeSocket.send(JSON.stringify({ command, ...data }));
  }

  private cleanup(): void {
    TyranoDebugSession.bridgeConnected = false;
    if (this.bridgeSocket) {
      try { this.bridgeSocket.close(); } catch { /* ignore */ }
      this.bridgeSocket = null;
    }
    if (this.wss) {
      try { this.wss.close(); } catch { /* ignore */ }
      this.wss = null;
    }
    if (this.httpServer) {
      try { this.httpServer.close(); } catch { /* ignore */ }
      this.httpServer = null;
    }
    this.pendingEvals.clear();
  }

  // ── Path helpers ──

  private toGamePath(absolutePath: string): string {
    // TyranoScript uses bare filenames for current_scenario (e.g. "first.ks")
    // so breakpoints must be keyed by bare filename to match
    return path.basename(absolutePath);
  }

  private toAbsolutePath(gamePath: string): string {
    // Try direct path first
    const direct = path.join(this.projectRoot, gamePath);
    if (fs.existsSync(direct)) return direct;

    // TyranoScript's current_scenario is often a bare filename like "first.ks"
    // The actual file lives under data/scenario/
    const scenarioPath = path.join(this.projectRoot, 'data', 'scenario', gamePath);
    if (fs.existsSync(scenarioPath)) return scenarioPath;

    // Fallback: search common subdirectories
    const searchDirs = ['data/scenario', 'data/others', 'data'];
    for (const dir of searchDirs) {
      const candidate = path.join(this.projectRoot, dir, gamePath);
      if (fs.existsSync(candidate)) return candidate;
    }

    return direct;
  }
}
