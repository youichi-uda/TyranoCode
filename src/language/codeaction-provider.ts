/**
 * TyranoScript code action provider.
 * Offers quick fixes for diagnostics such as unknown tags, undefined labels,
 * and unknown parameters.
 */

import * as vscode from 'vscode';

export class TyranoCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      const message = diagnostic.message;

      // Unknown tag → offer "Define as macro"
      const unknownTagMatch = message.match(
        /^Unknown tag or undefined macro: \[(\w+)\]$/,
      );
      if (unknownTagMatch) {
        const tagName = unknownTagMatch[1];
        const action = this.createDefineAsMacroAction(document, tagName, diagnostic);
        if (action) {
          actions.push(action);
        }
      }

      // Undefined label → offer "Create label"
      const undefinedLabelMatch = message.match(/^Undefined label: \*(\w+)$/);
      if (undefinedLabelMatch) {
        const labelName = undefinedLabelMatch[1];
        const action = this.createInsertLabelAction(document, labelName, diagnostic);
        if (action) {
          actions.push(action);
        }
      }

      // Unknown parameter → offer "Ignore this warning"
      const unknownParamMatch = message.match(
        /^Unknown parameter "(\w+)" for \[(\w+)\]$/,
      );
      if (unknownParamMatch) {
        const action = this.createSuppressWarningAction(document, diagnostic);
        if (action) {
          actions.push(action);
        }
      }
    }

    return actions;
  }

  /**
   * Create an action that inserts a [macro name="xxx"]...[endmacro] template
   * at the end of the current file.
   */
  private createDefineAsMacroAction(
    document: vscode.TextDocument,
    tagName: string,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Define [${tagName}] as macro`,
      vscode.CodeActionKind.QuickFix,
    );

    const lastLine = document.lineAt(document.lineCount - 1);
    const insertPosition = lastLine.range.end;

    const macroTemplate = [
      '',
      '',
      `[macro name="${tagName}"]`,
      `; TODO: implement [${tagName}]`,
      '[endmacro]',
      '',
    ].join('\n');

    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(document.uri, insertPosition, macroTemplate);
    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    return action;
  }

  /**
   * Create an action that inserts *labelname at the end of the current file.
   */
  private createInsertLabelAction(
    document: vscode.TextDocument,
    labelName: string,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Create label *${labelName}`,
      vscode.CodeActionKind.QuickFix,
    );

    const lastLine = document.lineAt(document.lineCount - 1);
    const insertPosition = lastLine.range.end;

    const labelTemplate = [
      '',
      '',
      `*${labelName}`,
      '',
    ].join('\n');

    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(document.uri, insertPosition, labelTemplate);
    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    return action;
  }

  /**
   * Create an action that suppresses the warning by inserting a comment line
   * above the diagnostic location.
   */
  private createSuppressWarningAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Ignore this warning',
      vscode.CodeActionKind.QuickFix,
    );

    const line = diagnostic.range.start.line;
    const insertPosition = new vscode.Position(line, 0);
    const indent = document.lineAt(line).text.match(/^(\s*)/)?.[1] ?? '';

    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(
      document.uri,
      insertPosition,
      `${indent}; tyrano-ignore-next-line\n`,
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = false;

    return action;
  }
}
