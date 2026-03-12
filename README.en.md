# TyranoCode — TyranoScript Development Suite

[日本語](./README.md)

A professional VS Code extension for TyranoScript / TyranoBuilder game development.

## Demo

[![Debugger Demo](https://img.youtube.com/vi/Vq3XXGVpGKw/maxresdefault.jpg)](https://youtu.be/Vq3XXGVpGKw)

▶ Breakpoint Debugger in action (click to play)

## Free Features

| Feature | Description |
|---------|-------------|
| **Syntax Highlighting** | Full TyranoScript grammar with embedded JS/HTML support |
| **Tag Autocompletion** | All built-in tags with parameter snippets and documentation |
| **Hover Documentation** | Bilingual (EN/JP) docs for tags, attributes, and variables |
| **Real-time Diagnostics** | Undefined labels/macros, missing parameters, unreachable code detection |
| **Go to Definition** | Jump to label and macro definitions |
| **Find All References** | Find all usages of labels, macros, and variables |
| **Project-wide Analysis** | Cross-file indexing of all `.ks` files |

## Pro Features (Paid License)

[Purchase a license on Gumroad](https://tyranocode.gumroad.com/) to unlock:

| Feature | Description |
|---------|-------------|
| **Breakpoint Debugger** | Set breakpoints, step through tags, inspect variables and call stack |
| **Scenario Flow Graph** | Visual graph of all jumps, calls, and choices across the entire game |
| **Auto-Test Runner** | Discover and execute all reachable routes with coverage reporting |
| **Performance Profiler** | Identify slow scenes and resource bottlenecks |
| **Refactoring Tools** | Safe rename for labels, variables, and macros across all files |

> Pro features are provided under a **commercial license**. See [LICENSE.md](./LICENSE.md) for details.

## Getting Started

1. Install from VS Code Marketplace
2. Open a TyranoScript project (folder containing `.ks` files)
3. The extension activates automatically

For Pro features, run `TyranoCode: Activate Pro License` from the command palette.

## License Key Setup

You can set your license key in any of the following ways:

1. **Command Palette** → `TyranoCode: Activate Pro License`
2. **Settings** → `tyranodev.license.key`
3. **Status Bar** → Click `TyranoCode` in the bottom-left corner

## Development

```bash
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## License

This software is provided under a commercial license. Free features can be used without restriction.
Pro features require a purchased license key. See [LICENSE.md](./LICENSE.md) for details.
