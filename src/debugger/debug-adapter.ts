/**
 * TyranoScript Debug Adapter.
 * Implements VS Code Debug Adapter Protocol (DAP) for TyranoScript.
 *
 * Architecture:
 * 1. Starts a WebSocket server on the configured port
 * 2. The debug bridge (injected into the game runtime) connects via WebSocket
 * 3. Bridge intercepts tag execution and communicates state
 * 4. This adapter translates between DAP and the bridge protocol
 *
 * PRO FEATURE — requires valid license key.
 */

import {
  LoggingDebugSession,
  InitializedEvent,
  StoppedEvent,
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
import { WebSocketServer, WebSocket } from 'ws';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  projectRoot: string;
  scene: string;
  port: number;
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

const THREAD_ID = 1;

export class TyranoDebugSession extends LoggingDebugSession {
  private wss: WebSocketServer | null = null;
  private bridgeSocket: WebSocket | null = null;
  private bridgeState: BridgeState | null = null;
  private projectRoot: string = '';
  private nextBreakpointId: number = 1;
  private pendingBreakpoints: Map<string, number[]> = new Map();
  private pendingEvals: Map<number, (result: { value: string; type: string }) => void> = new Map();
  private nextEvalId: number = 1;

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
    response.body.supportsConditionalBreakpoints = false;
    response.body.supportsEvaluateForHovers = true;
    response.body.supportsStepBack = false;
    response.body.supportsSetVariable = true;
    response.body.supportsRestartRequest = false;
    response.body.supportsModulesRequest = false;

    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): Promise<void> {
    this.projectRoot = args.projectRoot;
    const port = args.port || 9871;

    this.sendEvent(new OutputEvent(
      `TyranoCode Debugger: Starting WebSocket server on port ${port}...\n`,
      'console',
    ));

    // Start WebSocket server
    try {
      this.wss = new WebSocketServer({ port });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.sendEvent(new OutputEvent(`Failed to start WebSocket server: ${msg}\n`, 'stderr'));
      this.sendResponse(response);
      this.sendEvent(new TerminatedEvent());
      return;
    }

    this.wss.on('connection', (socket) => {
      this.bridgeSocket = socket;
      this.sendEvent(new OutputEvent('Debug bridge connected.\n', 'console'));

      // Send pending breakpoints
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
        this.bridgeSocket = null;
        this.sendEvent(new OutputEvent('Debug bridge disconnected.\n', 'console'));
        this.sendEvent(new TerminatedEvent());
      });
    });

    this.sendEvent(new OutputEvent(
      `Waiting for debug bridge connection...\n` +
      `Add the following to your game's index.html:\n` +
      `  <script>window.__TYRANOCODE_DEBUG_PORT__=${port};</script>\n` +
      `  <script src="tyranocode-debug-bridge.js"></script>\n`,
      'console',
    ));

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

    const lines = clientBreakpoints.map(bp => bp.line);
    this.pendingBreakpoints.set(relativePath, lines);

    // Send to bridge if connected
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

  private syncBreakpoints(): void {
    if (!this.bridgeSocket) return;

    const allBps: Array<{ file: string; line: number }> = [];
    for (const [file, lines] of this.pendingBreakpoints) {
      for (const line of lines) {
        allBps.push({ file, line });
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
      // Current position
      frames.push(new StackFrame(
        0,
        `[${this.bridgeState.tag}]`,
        new Source(
          path.basename(this.bridgeState.file),
          this.toAbsolutePath(this.bridgeState.file),
        ),
        this.bridgeState.line,
      ));

      // Call stack from bridge
      for (let i = 0; i < this.bridgeState.callStack.length; i++) {
        const frame = this.bridgeState.callStack[i];
        frames.push(new StackFrame(
          i + 1,
          `[${frame.tag}]`,
          new Source(
            path.basename(frame.file),
            this.toAbsolutePath(frame.file),
          ),
          0, // line not available from call stack
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

    // Timeout after 5 seconds
    setTimeout(() => {
      if (this.pendingEvals.has(evalId)) {
        this.pendingEvals.delete(evalId);
        response.body = { result: '(evaluation timed out)', variablesReference: 0 };
        this.sendResponse(response);
      }
    }, 5000);
  }

  // ── Disconnect ──

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    _args: DebugProtocol.DisconnectArguments,
  ): void {
    this.sendToBridge('disconnect', {});
    this.cleanup();
    this.sendResponse(response);
  }

  // ── Bridge communication ──

  private handleBridgeMessage(msg: BridgeMessage): void {
    switch (msg.type) {
      case 'connected':
        this.sendEvent(new OutputEvent(
          `Bridge v${msg.data.version} connected.\n`, 'console',
        ));
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

        this.sendEvent(new StoppedEvent(
          data.reason === 'breakpoint' ? 'breakpoint' : 'step',
          THREAD_ID,
        ));
        break;
      }

      case 'tagExec':
        // Optional: log tag execution for profiling
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
        // Could be used for async variable requests
        break;
    }
  }

  private sendToBridge(command: string, data: Record<string, unknown>): void {
    if (!this.bridgeSocket || this.bridgeSocket.readyState !== WebSocket.OPEN) return;
    this.bridgeSocket.send(JSON.stringify({ command, ...data }));
  }

  private cleanup(): void {
    if (this.bridgeSocket) {
      try { this.bridgeSocket.close(); } catch { /* ignore */ }
      this.bridgeSocket = null;
    }
    if (this.wss) {
      try { this.wss.close(); } catch { /* ignore */ }
      this.wss = null;
    }
    this.pendingEvals.clear();
  }

  // ── Path helpers ──

  private toGamePath(absolutePath: string): string {
    // Convert absolute path to game-relative path (e.g., "data/scenario/first.ks")
    const relative = path.relative(this.projectRoot, absolutePath);
    return relative.replace(/\\/g, '/');
  }

  private toAbsolutePath(gamePath: string): string {
    return path.join(this.projectRoot, gamePath);
  }
}
