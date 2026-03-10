# TyranoCode — TyranoScript Development Suite

Professional VS Code extension for TyranoScript / TyranoBuilder game development.

## Free Features

- **Syntax Highlighting** — Full TyranoScript grammar with embedded JS/HTML support
- **Tag Autocompletion** — All built-in tags with parameter snippets and documentation
- **Hover Documentation** — Bilingual (EN/JP) docs for tags, attributes, and variables
- **Real-time Diagnostics** — Undefined labels/macros, missing parameters, unreachable code
- **Go to Definition** — Navigate to label and macro definitions
- **Find All References** — Find all usages of labels, macros, and variables
- **Project-wide Analysis** — Index all `.ks` files for cross-file intelligence

## Pro Features (License Key)

Purchase a license on [Gumroad](https://tyranocode.gumroad.com/) to unlock:

- **Breakpoint Debugger** — Set breakpoints, step through tags, inspect variables and call stack
- **Scenario Flow Graph** — Visual graph of all jumps, calls, and choices across the entire game
- **Auto-Test Runner** — Discover and execute all reachable routes, coverage reporting
- **Performance Profiler** — Identify slow scenes and resource bottlenecks
- **Refactoring Tools** — Safe rename for labels, variables, and macros across all files

## Getting Started

1. Install from VS Code Marketplace
2. Open a TyranoScript project (folder containing `.ks` files)
3. The extension activates automatically

For Pro features, run `TyranoCode: Activate Pro License` from the command palette.

## Development

```bash
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## License

MIT (extension code) — Pro features require a purchased license key.
