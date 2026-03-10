/**
 * TyranoScript Debug Adapter.
 * Implements VS Code Debug Adapter Protocol (DAP) for TyranoScript.
 *
 * Architecture:
 * 1. Injects a debug bridge script into the TyranoScript runtime (via NW.js/Electron devtools)
 * 2. Bridge communicates with this adapter via WebSocket
 * 3. Adapter translates between DAP and TyranoScript execution state
 *
 * PRO FEATURE — requires valid license key.
 */

import {
  LoggingDebugSession,
  InitializedEvent,
  StoppedEvent,
  BreakpointEvent,
  OutputEvent,
  TerminatedEvent,
  Thread,
  StackFrame,
  Scope,
  Source,
  Variable,
  Breakpoint,
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import * as http from 'http';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  projectRoot: string;
  scene: string;
  port: number;
}

interface TyranoBreakpoint {
  id: number;
  file: string;
  line: number;
  verified: boolean;
}

interface TyranoRuntimeState {
  currentFile: string;
  currentLine: number;
  currentTag: string;
  callStack: Array<{ file: string; line: number; tag: string }>;
  variables: {
    f: Record<string, unknown>;
    sf: Record<string, unknown>;
    tf: Record<string, unknown>;
  };
  paused: boolean;
}

const THREAD_ID = 1;

export class TyranoDebugSession extends LoggingDebugSession {
  private breakpoints: Map<string, TyranoBreakpoint[]> = new Map();
  private nextBreakpointId: number = 1;
  private runtimeState: TyranoRuntimeState | null = null;
  private server: http.Server | null = null;
  private wsConnected: boolean = false;
  private projectRoot: string = '';

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
    response.body.supportsEvaluateForHovers = true;
    response.body.supportsStepBack = false;
    response.body.supportsSetVariable = true;
    response.body.supportsRestartRequest = true;
    response.body.supportsModulesRequest = false;

    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): Promise<void> {
    this.projectRoot = args.projectRoot;

    this.sendEvent(new OutputEvent(
      `TyranoDev Debugger: Launching from ${args.projectRoot}\n`,
      'console',
    ));

    // TODO: Implementation phases:
    // 1. Inject debug bridge into tyrano/tyrano.js
    // 2. Start HTTP/WebSocket server on args.port
    // 3. Launch the game in NW.js/Electron with devtools enabled
    // 4. Wait for bridge connection
    // 5. Send initial breakpoints
    // 6. Begin execution

    this.sendEvent(new OutputEvent(
      'Debug bridge injection and runtime connection will be implemented in next iteration.\n',
      'console',
    ));

    this.sendResponse(response);
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): void {
    const filePath = args.source.path ?? '';
    const relativePath = path.relative(this.projectRoot, filePath);
    const clientBreakpoints = args.breakpoints ?? [];

    const newBreakpoints: TyranoBreakpoint[] = clientBreakpoints.map(bp => ({
      id: this.nextBreakpointId++,
      file: relativePath,
      line: bp.line,
      verified: true, // will be re-verified when runtime connects
    }));

    this.breakpoints.set(relativePath, newBreakpoints);

    response.body = {
      breakpoints: newBreakpoints.map(bp => ({
        id: bp.id,
        verified: bp.verified,
        line: bp.line,
        source: args.source,
      } as DebugProtocol.Breakpoint)),
    };

    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(THREAD_ID, 'TyranoScript Main')],
    };
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
  ): void {
    const frames: StackFrame[] = [];

    if (this.runtimeState) {
      // Current position
      frames.push(new StackFrame(
        0,
        `[${this.runtimeState.currentTag}]`,
        new Source(
          path.basename(this.runtimeState.currentFile),
          path.join(this.projectRoot, this.runtimeState.currentFile),
        ),
        this.runtimeState.currentLine,
      ));

      // Call stack
      for (let i = 0; i < this.runtimeState.callStack.length; i++) {
        const frame = this.runtimeState.callStack[i];
        frames.push(new StackFrame(
          i + 1,
          `[${frame.tag}]`,
          new Source(
            path.basename(frame.file),
            path.join(this.projectRoot, frame.file),
          ),
          frame.line,
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
    args: DebugProtocol.ScopesArguments,
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

    if (this.runtimeState) {
      let scope: Record<string, unknown> = {};
      switch (args.variablesReference) {
        case 1: scope = this.runtimeState.variables.f; break;
        case 2: scope = this.runtimeState.variables.sf; break;
        case 3: scope = this.runtimeState.variables.tf; break;
      }

      for (const [name, value] of Object.entries(scope)) {
        variables.push(new Variable(
          name,
          String(value),
          typeof value === 'object' ? 1 : 0,
        ));
      }
    }

    response.body = { variables };
    this.sendResponse(response);
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
  ): void {
    // TODO: Send continue command to runtime bridge
    this.sendResponse(response);
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments,
  ): void {
    // TODO: Send step-over (next tag) command to runtime bridge
    this.sendResponse(response);
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments,
  ): void {
    // TODO: Send step-in (into macro/call) command to runtime bridge
    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments,
  ): void {
    // TODO: Send step-out (return from macro/call) command to runtime bridge
    this.sendResponse(response);
  }

  protected evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): void {
    // Evaluate JS expressions in the game context
    // TODO: Send eval to runtime bridge and return result
    response.body = {
      result: '(debugger not connected)',
      variablesReference: 0,
    };
    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments,
  ): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.sendResponse(response);
  }
}
