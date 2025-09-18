import * as vscode from 'vscode';
import { IstariUI } from './istari_ui';

/**
 * Centralized helper functions for Istari UI operations.
 * Used by both extension.ts commands and MCP server to avoid duplication.
 */

export async function gotoLine(istari: IstariUI, line: number): Promise<string> {
    istari.requestedLine = line;
    return await istari.jumpToRequestedLine('mcp');
}

export async function nextLine(istari: IstariUI): Promise<string> {
    return await istari.nextLine('mcp');
}

export async function prevLine(istari: IstariUI): Promise<string> {
    return await istari.prevLine('mcp');
}

export async function jumpToCursor(istari: IstariUI): Promise<string> {
    let cursorLine = istari.editor.selection.active.line;
    istari.requestedLine = cursorLine + 1;
    return await istari.jumpToRequestedLine('user');
}

export async function jumpToPreviouslyRequested(istari: IstariUI): Promise<string> {
    return await istari.jumpToRequestedLine('user');
}

export async function interject(istari: IstariUI, code: string): Promise<string> {
    return await istari.interject(code);
}

export async function getType(istari: IstariUI, constant: string): Promise<string> {
    return await istari.interject(`Report.showType (parseLongident /${constant}/);`);
}

export async function getDefinition(istari: IstariUI, constant: string): Promise<string> {
    return await istari.interject(`Report.show (parseLongident /${constant}/);`);
}

export async function searchConstants(istari: IstariUI, target: string): Promise<string> {
    return await istari.interject(`Report.search (parseConstants /${target}/) [];`);
}

export async function showCurrentGoals(istari: IstariUI): Promise<string> {
    return await istari.interject("Prover.show ();");
}

export async function showCurrentGoalsVerbosely(istari: IstariUI): Promise<string> {
    return await istari.interject("Prover.showFull ();");
}

export async function getCurrentGoals(istari: IstariUI, verbose: boolean): Promise<string> {
    if (verbose) {
        return await istari.interject("Goals.printCurrent printLongGoal;");
    } else {
        return await istari.interject("Goals.printCurrent printGoal;");
    }
}

export async function showDetails(istari: IstariUI): Promise<string> {
    return await istari.interject("Prover.detail ();");
}

export async function listConstants(istari: IstariUI): Promise<string> {
    return await istari.interject("Report.showAll ();");
}

export async function listConstantsModule(istari: IstariUI, module: string): Promise<string> {
    return await istari.interject(`Report.showModule (parseLongident /${module}/);`);
}

export async function showImplicitArguments(istari: IstariUI): Promise<string> {
    return await istari.interject('Show.showImplicits := not (!Show.showImplicits); if !Show.showImplicits then print "Display of implicit arguments enabled.\\n" else print "Display of implicit arguments disabled.\\n";');
}

export async function showSubstitutions(istari: IstariUI): Promise<string> {
    return await istari.interject('Show.showSubstitutions := not (!Show.showSubstitutions); if !Show.showSubstitutions then print "Display of evar substitutions enabled.\\n" else print "Display of evar substitutions disabled.\\n";');
}

export function restartTerminal(istari: IstariUI): string {
    istari.restartIstariTerminal();
    return "Istari terminal restarted";
}

export function interrupt(istari: IstariUI): string {
    istari.terminal.interrupt();
    return "Istari execution interrupted";
}

export function jumpCursor(istari: IstariUI): string {
    let pos = new vscode.Position(istari.currentLine - 1, 0);
    istari.editor.selection = new vscode.Selection(pos, pos);
    istari.editor.revealRange(new vscode.Range(pos, pos));
    return `Cursor jumped to line ${istari.currentLine}`;
}

export function getDocumentStatus(istari: IstariUI): any {
    return {
        fileName: istari.document.fileName,
        status: istari.status,
        currentLine: istari.currentLine,
        requestedLine: istari.requestedLine,
        totalLines: istari.document.lineCount,
        taskQueueLength: istari.terminal.tasks.length,
    };
}

export function getDiagnostics(istari: IstariUI): any {
    const diagnostics = vscode.languages.getDiagnostics(istari.document.uri);
    return {
        diagnostics: diagnostics.map(d => ({
            severity: vscode.DiagnosticSeverity[d.severity],
            message: d.message,
            range: {
                start: { line: d.range.start.line + 1, character: d.range.start.character },
                end: { line: d.range.end.line + 1, character: d.range.end.character },
            },
        }))
    };
}

export function getCurrentOutput(istari: IstariUI): any {
    const messages = istari.webview?.messageHistory || [];
    const latestMessage = messages[messages.length - 1] || {};

    return {
        status: istari.status,
        currentLine: istari.currentLine,
        requestedLine: istari.requestedLine,
        output: latestMessage.text || 'No output available',
        taskQueueLength: istari.terminal.tasks.length,
    };
}