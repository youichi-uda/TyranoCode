/**
 * TyranoScript signature help provider.
 * Shows parameter hints when editing tag attributes inside [ ... ] brackets.
 */

import * as vscode from 'vscode';
import { TAG_DATABASE } from './tag-database';
import { localize } from './i18n';

export class TyranoSignatureProvider implements vscode.SignatureHelpProvider {

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.SignatureHelpContext,
  ): vscode.SignatureHelp | undefined {
    const line = document.lineAt(position).text;
    const textBefore = line.substring(0, position.character);

    // Determine if the cursor is inside a tag: find the last unmatched '['
    const tagOpenIdx = textBefore.lastIndexOf('[');
    const tagCloseIdx = textBefore.lastIndexOf(']');

    if (tagOpenIdx < 0 || tagCloseIdx > tagOpenIdx) {
      // Not inside a tag bracket
      return undefined;
    }

    const insideTag = textBefore.substring(tagOpenIdx + 1);

    // Extract the tag name (first word after '[')
    const tagNameMatch = insideTag.match(/^(\w+)/);
    if (!tagNameMatch) return undefined;

    const tagName = tagNameMatch[1].toLowerCase();

    // Must be past the tag name (in the attributes area) to show signature
    if (insideTag.length <= tagNameMatch[1].length && !insideTag.endsWith(' ')) {
      return undefined;
    }

    const tagDef = TAG_DATABASE.get(tagName);
    if (!tagDef || tagDef.params.length === 0) return undefined;

    // Build the signature label: [tagname param1="..." param2="..." ...]
    const paramLabels: [number, number][] = [];
    let signatureLabel = `[${tagDef.name}`;

    for (const param of tagDef.params) {
      const paramText = ` ${param.name}="${param.type}"`;
      const startOffset = signatureLabel.length;
      signatureLabel += paramText;
      // The parameter span covers just "name=\"type\"" (skip leading space)
      paramLabels.push([startOffset + 1, signatureLabel.length]);
    }
    signatureLabel += ']';

    const signatureInfo = new vscode.SignatureInformation(signatureLabel, localize(tagDef.description, tagDef.descriptionJa));

    for (let i = 0; i < tagDef.params.length; i++) {
      const param = tagDef.params[i];
      const doc = new vscode.MarkdownString();
      doc.appendMarkdown(`**${param.name}** — \`${param.type}\``);
      if (param.required) {
        doc.appendMarkdown(localize(' _(required)_', ' _(必須)_'));
      }
      doc.appendMarkdown(`\n\n${localize(param.description, param.descriptionJa)}`);
      if (param.default) {
        doc.appendMarkdown(`\n\n${localize('Default', '既定値')}: \`${param.default}\``);
      }
      if (param.enumValues && param.enumValues.length > 0) {
        doc.appendMarkdown(`\n\nValues: ${param.enumValues.map(v => `\`${v}\``).join(', ')}`);
      }

      signatureInfo.parameters.push(
        new vscode.ParameterInformation(paramLabels[i], doc),
      );
    }

    // Determine which parameter is currently active
    const activeParam = this.findActiveParameter(insideTag, tagDef.params.map(p => p.name));

    const help = new vscode.SignatureHelp();
    help.signatures = [signatureInfo];
    help.activeSignature = 0;
    help.activeParameter = activeParam;

    return help;
  }

  /**
   * Determine which parameter index the cursor is closest to.
   * If the user is currently typing an attribute name or value, highlight that param.
   * Otherwise highlight the next unused param.
   */
  private findActiveParameter(insideTag: string, paramNames: string[]): number {
    // Check if we're currently typing an attribute (name or name=value)
    // Look for the last attribute name being typed or just completed
    const currentAttrMatch = insideTag.match(/(\w+)\s*=?\s*"?[^"]*$/);
    if (currentAttrMatch) {
      const currentAttr = currentAttrMatch[1].toLowerCase();
      const idx = paramNames.findIndex(p => p.toLowerCase() === currentAttr);
      if (idx >= 0) return idx;
    }

    // Find which attributes are already used, return the index of the first unused one
    const usedAttrs = new Set<string>();
    const attrMatches = insideTag.matchAll(/(\w+)\s*=/g);
    for (const match of attrMatches) {
      usedAttrs.add(match[1].toLowerCase());
    }

    for (let i = 0; i < paramNames.length; i++) {
      if (!usedAttrs.has(paramNames[i].toLowerCase())) {
        return i;
      }
    }

    return 0;
  }
}
