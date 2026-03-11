/**
 * TyranoCode Debug Bridge
 * Injected into the TyranoScript runtime to enable debugging.
 *
 * This script hooks into TYRANO.kag's event system and tag execution loop,
 * communicating state back to the VS Code debug adapter via WebSocket.
 *
 * Injection: Add <script src="tyranocode-debug-bridge.js"></script> to index.html
 * or inject via NW.js/Electron devtools.
 */
(function () {
  'use strict';

  // ── Configuration ──
  var DEBUG_PORT = window.__TYRANOCODE_DEBUG_PORT__ || 9871;
  var ws = null;
  var connected = false;

  // ── State ──
  var breakpoints = {};   // { "file.ks": Set([line1, line2, ...]) }
  var paused = false;
  var stepMode = null;    // null | 'next' | 'stepIn' | 'stepOut'
  var stepDepth = 0;      // call stack depth at time of step command
  var pauseResolveFn = null;

  // Wait for TYRANO.kag to be ready
  var waitInterval = setInterval(function () {
    if (typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.ftag) {
      clearInterval(waitInterval);
      init();
    }
  }, 100);

  function init() {
    connect();
    hookExecution();
    console.log('[TyranoCode Debug Bridge] Initialized on port ' + DEBUG_PORT);
  }

  // ── WebSocket connection ──

  function connect() {
    try {
      ws = new WebSocket('ws://localhost:' + DEBUG_PORT);
    } catch (e) {
      console.warn('[TyranoCode Debug Bridge] WebSocket connection failed:', e);
      return;
    }

    ws.onopen = function () {
      connected = true;
      console.log('[TyranoCode Debug Bridge] Connected to debug adapter');
      send('connected', { version: 1 });
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        handleCommand(msg);
      } catch (e) {
        console.error('[TyranoCode Debug Bridge] Invalid message:', e);
      }
    };

    ws.onclose = function () {
      connected = false;
      paused = false;
      if (pauseResolveFn) {
        pauseResolveFn();
        pauseResolveFn = null;
      }
      console.log('[TyranoCode Debug Bridge] Disconnected');
      // Attempt reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = function () {
      // onclose will handle reconnection
    };
  }

  function send(type, data) {
    if (!connected || !ws) return;
    ws.send(JSON.stringify({ type: type, data: data || {} }));
  }

  // ── Command handling ──

  function handleCommand(msg) {
    switch (msg.command) {
      case 'setBreakpoints':
        breakpoints = {};
        (msg.breakpoints || []).forEach(function (bp) {
          var file = bp.file;
          if (!breakpoints[file]) breakpoints[file] = new Set();
          breakpoints[file].add(bp.line);
        });
        send('breakpointsSet', { count: msg.breakpoints ? msg.breakpoints.length : 0 });
        break;

      case 'continue':
        paused = false;
        stepMode = null;
        resumeExecution();
        break;

      case 'next':
        stepMode = 'next';
        stepDepth = getCallStackDepth();
        resumeExecution();
        break;

      case 'stepIn':
        stepMode = 'stepIn';
        stepDepth = getCallStackDepth();
        resumeExecution();
        break;

      case 'stepOut':
        stepMode = 'stepOut';
        stepDepth = getCallStackDepth();
        resumeExecution();
        break;

      case 'evaluate':
        var result;
        try {
          // Evaluate in game context
          result = { value: String(eval(msg.expression)), type: typeof eval(msg.expression) };
        } catch (e) {
          result = { value: e.message, type: 'error' };
        }
        send('evaluateResult', { id: msg.id, result: result });
        break;

      case 'getVariables':
        send('variables', {
          id: msg.id,
          f: safeClone(TYRANO.kag.stat.f || {}),
          sf: safeClone(TYRANO.kag.variable.sf || {}),
          tf: safeClone(TYRANO.kag.stat.tf || {}),
        });
        break;

      case 'setVariable':
        try {
          var scope = msg.scope;
          var name = msg.name;
          var value = JSON.parse(msg.value);
          if (scope === 'f') TYRANO.kag.stat.f[name] = value;
          else if (scope === 'sf') TYRANO.kag.variable.sf[name] = value;
          else if (scope === 'tf') TYRANO.kag.stat.tf[name] = value;
          send('variableSet', { success: true });
        } catch (e) {
          send('variableSet', { success: false, error: e.message });
        }
        break;

      case 'disconnect':
        paused = false;
        stepMode = null;
        resumeExecution();
        break;
    }
  }

  // ── Execution hooks ──

  function hookExecution() {
    var ftag = TYRANO.kag.ftag;
    var originalNextOrder = ftag.nextOrder.bind(ftag);

    ftag.nextOrder = function () {
      var tag = ftag.array_tag[ftag.current_order_index];
      if (!tag) {
        return originalNextOrder();
      }

      var currentFile = TYRANO.kag.stat.current_scenario || '';
      var tagLine = tag.line != null ? tag.line : 0;
      var tagName = tag.name || '';

      // Check if we should pause
      var shouldPause = false;
      var reason = '';

      // Breakpoint check
      var bps = breakpoints[currentFile];
      if (bps && bps.has(tagLine)) {
        shouldPause = true;
        reason = 'breakpoint';
      }

      // Step mode checks
      if (stepMode === 'next' || stepMode === 'stepIn') {
        shouldPause = true;
        reason = 'step';
        if (stepMode === 'next' && getCallStackDepth() > stepDepth) {
          // We stepped into a call — keep going until we come back
          shouldPause = false;
        }
      }
      if (stepMode === 'stepOut') {
        if (getCallStackDepth() < stepDepth) {
          shouldPause = true;
          reason = 'step';
        }
      }

      if (shouldPause && connected) {
        paused = true;
        stepMode = null;

        // Send stopped event with full state
        send('stopped', {
          reason: reason,
          file: currentFile,
          line: tagLine,
          tag: tagName,
          params: safeClone(tag.pm || {}),
          callStack: getCallStack(),
          variables: {
            f: safeClone(TYRANO.kag.stat.f || {}),
            sf: safeClone(TYRANO.kag.variable.sf || {}),
            tf: safeClone(TYRANO.kag.stat.tf || {}),
          },
        });

        // Pause execution — store resolve function to be called by resume
        return new Promise(function (resolve) {
          pauseResolveFn = function () {
            paused = false;
            resolve();
            originalNextOrder();
          };
        });
      }

      return originalNextOrder();
    };

    // Also hook startTag for programmatic invocations
    var originalStartTag = ftag.startTag.bind(ftag);
    ftag.startTag = function (name, pm, cb) {
      if (connected) {
        send('tagExec', {
          name: name,
          params: safeClone(pm || {}),
          file: TYRANO.kag.stat.current_scenario || '',
        });
      }
      return originalStartTag(name, pm, cb);
    };
  }

  function resumeExecution() {
    if (pauseResolveFn) {
      var fn = pauseResolveFn;
      pauseResolveFn = null;
      fn();
    }
  }

  // ── Helpers ──

  function getCallStackDepth() {
    try {
      var stack = TYRANO.kag.stat.stack || {};
      var callStack = stack.call || [];
      return callStack.length;
    } catch (e) {
      return 0;
    }
  }

  function getCallStack() {
    try {
      var stack = TYRANO.kag.stat.stack || {};
      var callStack = stack.call || [];
      return callStack.map(function (frame) {
        return {
          file: frame.storage || '',
          index: frame.index || 0,
          tag: frame.caller || 'call',
        };
      });
    } catch (e) {
      return [];
    }
  }

  function safeClone(obj) {
    try {
      var result = {};
      for (var key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        var val = obj[key];
        if (val === null || val === undefined) {
          result[key] = String(val);
        } else if (typeof val === 'object') {
          result[key] = JSON.stringify(val);
        } else {
          result[key] = String(val);
        }
      }
      return result;
    } catch (e) {
      return {};
    }
  }
})();
