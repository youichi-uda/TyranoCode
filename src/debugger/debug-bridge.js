/**
 * TyranoCode Debug Bridge
 * Injected into the TyranoScript runtime to enable debugging.
 *
 * This script hooks into TYRANO.kag's event system and tag execution loop,
 * communicating state back to the VS Code debug adapter via WebSocket.
 */
(function () {
  'use strict';

  // ── Configuration ──
  var DEBUG_PORT = window.__TYRANOCODE_DEBUG_PORT__ || 9871;
  var ws = null;
  var connected = false;

  // ── State ──
  var breakpoints = {};   // { "file.ks": { line: { condition, hitCondition, logMessage, hitCount } } }
  var paused = false;
  var stepMode = null;    // null | 'next' | 'stepIn' | 'stepOut'
  var stepDepth = 0;      // call stack depth at time of step command
  var pauseResolveFn = null;
  var originalNextOrder = null; // captured in hookExecution, used by command handlers
  var exceptionBreakOnIscript = true;
  var closing = false;       // set when closeTab received — suppress reconnect

  // Hook alert() immediately (available before TYRANO loads)
  hookConsole();
  hookAlerts();

  // Wait for TYRANO.kag to be ready
  var waitInterval = setInterval(function () {
    if (typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.ftag) {
      clearInterval(waitInterval);
      init();
    }
  }, 100);

  function init() {
    // hookConsole/hookAlerts already called early (before TYRANO loads)
    // Re-hook $.alert/$.error_message now that jQuery/libs are loaded
    hookAlerts();
    connect();
    hookExecution();
    hookIscriptErrors();
    hookEngineErrors(); // capture TYRANO.kag.error/warning
    // Bridge initialized
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
      // Connected
      send('connected', { version: 2 });
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
      // Reconnect unless tab is being closed
      if (!closing) {
        setTimeout(connect, 3000);
      }
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
    send('debugLog', { message: 'command received: ' + msg.command });
    switch (msg.command) {
      case 'setBreakpoints':
        breakpoints = {};
        (msg.breakpoints || []).forEach(function (bp) {
          var file = bp.file;
          if (!breakpoints[file]) breakpoints[file] = {};
          breakpoints[file][bp.line] = {
            condition: bp.condition || null,
            hitCondition: bp.hitCondition || null,
            logMessage: bp.logMessage || null,
            hitCount: 0,
          };
        });
        send('breakpointsSet', { count: msg.breakpoints ? msg.breakpoints.length : 0 });
        break;

      case 'setExceptionBreakpoints':
        exceptionBreakOnIscript = !!msg.iscript;
        break;

      case 'pause':
        // Send stopped with current position immediately.
        // Also set stepMode so next nextOrder call will pause too.
        paused = true;
        stepMode = 'stepIn';
        (function () {
          var currentFile = '';
          var currentLine = 1;
          var currentTag = '(idle)';
          var currentParams = {};
          try {
            currentFile = TYRANO.kag.stat.current_scenario || '';
            var ftag = TYRANO.kag.ftag;
            var tag = ftag.array_tag[ftag.current_order_index];
            if (tag) {
              currentLine = (tag.line || 0) + 1;
              currentTag = tag.name || '(idle)';
              currentParams = tag.pm || {};
            }
          } catch (e) {}
          send('stopped', {
            reason: 'pause',
            file: currentFile,
            line: currentLine,
            tag: currentTag,
            params: safeClone(currentParams),
            callStack: getCallStack(),
            variables: {
              f: safeClone(TYRANO.kag.stat.f || {}),
              sf: safeClone(TYRANO.kag.variable.sf || {}),
              tf: safeClone(TYRANO.kag.stat.tf || {}),
            },
          });
        })();
        break;

      case 'continue':
        paused = false;
        stepMode = null;
        resumeExecution();
        break;

      case 'next':
        stepMode = 'next';
        stepDepth = getCallStackDepth();
        forceResume();
        break;

      case 'stepIn':
        stepMode = 'stepIn';
        stepDepth = getCallStackDepth();
        forceResume();
        break;

      case 'stepOut':
        stepMode = 'stepOut';
        stepDepth = getCallStackDepth();
        forceResume();
        break;

      case 'evaluate':
        var result;
        try {
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

      case 'restart':
        paused = false;
        stepMode = null;
        resumeExecution();
        // Reload the page to restart the game
        setTimeout(function () { location.reload(); }, 100);
        break;

      case 'disconnect':
        paused = false;
        stepMode = null;
        resumeExecution();
        break;

      case 'closeTab':
        // Debug session ended — close this browser tab
        paused = false;
        stepMode = null;
        closing = true;
        resumeExecution();
        connected = false;
        try { ws.close(); } catch (e) {}
        ws = null;
        window.close();
        break;
    }
  }

  // ── Console forwarding ──

  var consoleHooked = false;
  function hookConsole() {
    if (consoleHooked) return;
    consoleHooked = true;
    var methods = ['warn', 'error'];
    methods.forEach(function (method) {
      var original = console[method].bind(console);
      console[method] = function () {
        // Call original first so browser console still works
        original.apply(console, arguments);

        if (!connected || !ws) return;

        // Build message string from all arguments
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
          var arg = arguments[i];
          if (arg === null) {
            parts.push('null');
          } else if (arg === undefined) {
            parts.push('undefined');
          } else if (typeof arg === 'object') {
            try { parts.push(JSON.stringify(arg, null, 2)); } catch (e) { parts.push(String(arg)); }
          } else {
            parts.push(String(arg));
          }
        }
        var text = parts.join(' ');

        // Map console method to DAP output category
        var category = 'console';
        if (method === 'error') category = 'stderr';
        else if (method === 'warn') category = 'stderr';

        send('consoleOutput', { category: category, output: text, method: method });
      };
    });
  }

  // ── Alert / dialog interception ──

  // Suppress duplicate forwarding: kag.error → $.error_message → alert() chain
  var suppressAlertForward = false;

  var alertHooked = false;
  var $alertHooked = false;
  function hookAlerts() {
    // Hook native alert() once
    if (!alertHooked) {
      alertHooked = true;
      var originalAlert = window.alert.bind(window);
      window.alert = function (message) {
        // Only forward if not already sent by kag.error/warning
        if (!suppressAlertForward) {
          send('consoleOutput', { category: 'stderr', output: String(message), method: 'alert' });
        }
        originalAlert(String(message));
      };
    }

    // Hook $.alert and $.error_message — may not exist on first call
    if (!$alertHooked && typeof $ !== 'undefined') {
      if ($.alert) {
        $alertHooked = true;
        var original$Alert = $.alert;
        $.alert = function (title, on_ok) {
          if (!suppressAlertForward) {
            send('consoleOutput', { category: 'stderr', output: String(title), method: 'alert' });
          }
          return original$Alert(title, on_ok);
        };
      }
      if ($.error_message) {
        var originalErrorMessage = $.error_message;
        $.error_message = function (str) {
          // Always suppressed — called from kag.error which already forwarded
          suppressAlertForward = true;
          var ret = originalErrorMessage(str);
          suppressAlertForward = false;
          return ret;
        };
      }
    }
  }

  function hookEngineErrors() {
    try {
      var kag = TYRANO.kag;

      if (kag.error) {
        var originalError = kag.error.bind(kag);
        kag.error = function (message, replace_map) {
          var errorStr = message;
          try {
            if (typeof $ !== 'undefined' && $.lang && typeof tyrano_lang !== 'undefined' && message in tyrano_lang.word) {
              errorStr = $.lang(message, replace_map);
            }
            var currentStorage = kag.stat.current_scenario || '';
            var line = parseInt(kag.stat.current_line) + 1;
            errorStr = 'Error: ' + currentStorage + ':line ' + line + '\n' + errorStr;
          } catch (e) {
            errorStr = 'Error: ' + String(message);
          }
          send('consoleOutput', { category: 'stderr', output: errorStr, method: 'error' });
          // Suppress downstream alert/$.error_message forwarding
          suppressAlertForward = true;
          var ret = originalError(message, replace_map);
          suppressAlertForward = false;
          return ret;
        };
      }

      if (kag.warning) {
        var originalWarning = kag.warning.bind(kag);
        kag.warning = function (message, replace_map, is_alert) {
          var warnStr = message;
          try {
            if (typeof $ !== 'undefined' && $.lang && typeof tyrano_lang !== 'undefined' && message in tyrano_lang.word) {
              warnStr = $.lang(message, replace_map);
            }
            warnStr = 'Warning: ' + warnStr;
          } catch (e) {
            warnStr = 'Warning: ' + String(message);
          }
          send('consoleOutput', { category: 'stderr', output: warnStr, method: 'warn' });
          suppressAlertForward = true;
          var ret = originalWarning(message, replace_map, is_alert);
          suppressAlertForward = false;
          return ret;
        };
      }
    } catch (e) {
      // TYRANO.kag may not have error/warning methods in some versions
    }
  }

  // ── Execution hooks ──

  function hookExecution() {
    var ftag = TYRANO.kag.ftag;
    originalNextOrder = ftag.nextOrder.bind(ftag);

    ftag.nextOrder = function () {
      // If paused, block all execution — only debugger commands can resume
      if (paused) {
        return false;
      }

      // nextOrder() increments current_order_index THEN executes the tag.
      // We check the NEXT tag (index + 1) which is the one about to execute.
      var nextIndex = ftag.current_order_index + 1;
      var tag = ftag.array_tag[nextIndex];
      if (!tag) {
        return originalNextOrder();
      }

      var currentFile = TYRANO.kag.stat.current_scenario || '';
      var tagLine = tag.line != null ? (tag.line + 1) : 1;
      var tagName = tag.name || '';

      // Check if we should pause
      var shouldPause = false;
      var reason = '';

      // Breakpoint check
      var fileBps = breakpoints[currentFile];
      if (fileBps && fileBps[tagLine]) {
        var bp = fileBps[tagLine];
        bp.hitCount++;

        var bpMatches = true;

        if (bp.condition) {
          try { bpMatches = !!eval(bp.condition); }
          catch (e) { bpMatches = false; }
        }

        if (bpMatches && bp.hitCondition) {
          try {
            var hitExpr = bp.hitCondition.trim();
            if (hitExpr.charAt(0) === '>') {
              if (hitExpr.charAt(1) === '=') {
                bpMatches = bp.hitCount >= parseInt(hitExpr.substring(2));
              } else {
                bpMatches = bp.hitCount > parseInt(hitExpr.substring(1));
              }
            } else if (hitExpr.charAt(0) === '%') {
              bpMatches = bp.hitCount % parseInt(hitExpr.substring(1)) === 0;
            } else if (hitExpr.substring(0, 2) === '==') {
              bpMatches = bp.hitCount === parseInt(hitExpr.substring(2));
            } else {
              bpMatches = bp.hitCount === parseInt(hitExpr);
            }
          } catch (e) { bpMatches = false; }
        }

        if (bpMatches) {
          if (bp.logMessage) {
            var logMsg = bp.logMessage.replace(/\{([^}]+)\}/g, function (_, expr) {
              try { return String(eval(expr)); } catch (e) { return '{' + expr + '}'; }
            });
            send('logpoint', { message: logMsg, file: currentFile, line: tagLine });
          } else {
            shouldPause = true;
            reason = 'breakpoint';
          }
        }
      }

      // Step mode checks
      if (stepMode === 'next' || stepMode === 'stepIn') {
        shouldPause = true;
        reason = 'step';
        if (stepMode === 'next' && getCallStackDepth() > stepDepth) {
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
        var stateData = {
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
        };

        if (paused) {
          // Already paused — block game from advancing on click
          return false;
        } else {
          paused = true;
          stateData.reason = reason;
          send('stopped', stateData);
        }

        stepMode = null;

        pauseResolveFn = function () {
          paused = false;
          originalNextOrder();
        };
        return false;
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

  // ── Exception breakpoints for [iscript] ──

  function hookIscriptErrors() {
    // Override window.onerror to catch iscript errors
    var originalOnError = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
      if (exceptionBreakOnIscript && connected) {
        var currentFile = '';
        var currentLine = 0;
        try {
          currentFile = TYRANO.kag.stat.current_scenario || '';
          var ftag = TYRANO.kag.ftag;
          var tag = ftag.array_tag[ftag.current_order_index];
          if (tag) currentLine = (tag.line || 0) + 1;
        } catch (e) {}

        send('exception', {
          reason: 'exception',
          message: String(message),
          file: currentFile,
          line: currentLine,
          tag: 'iscript',
          params: {},
          callStack: getCallStack(),
          variables: {
            f: safeClone(TYRANO.kag.stat.f || {}),
            sf: safeClone(TYRANO.kag.variable.sf || {}),
            tf: safeClone(TYRANO.kag.stat.tf || {}),
          },
        });
      }

      if (originalOnError) {
        return originalOnError.call(window, message, source, lineno, colno, error);
      }
      return false;
    };
  }

  function resumeExecution() {
    if (pauseResolveFn) {
      var fn = pauseResolveFn;
      pauseResolveFn = null;
      fn();
    }
  }

  /** Resume for step commands — if no pauseResolveFn (manual Pause), force advance */
  function forceResume() {
    if (pauseResolveFn) {
      resumeExecution();
    } else if (originalNextOrder) {
      paused = false;
      originalNextOrder();
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
