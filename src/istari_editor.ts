import * as vscode from 'vscode';
import path = require('path');

const decorationBlueArrowGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'blue-dot.svg')),
    gutterIconSize: '80%',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationBlueHourglassGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'blue-hourglass.svg')),
    gutterIconSize: '80%',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationBlueBackground = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(0, 122, 204, 0.1)', // VS Code blue
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationGreenGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'green-bar.svg')),
    gutterIconSize: 'contain',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationGreenBackground = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(0, 215, 86, 0.1)', // green
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationYellowGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'yellow-bar.svg')),
    gutterIconSize: 'contain',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationRedGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'red-bar.svg')),
    gutterIconSize: 'contain',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationBlueGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'blue-bar.svg')),
    gutterIconSize: 'contain',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

export type IstariStatus = "ready" | "working" | "partialReady";

export class IstariEditor {
    editor: vscode.TextEditor;
    private diagnostics: vscode.DiagnosticCollection;
    private currentLine: number;
    private requestedLine: number;
    private status: IstariStatus;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.diagnostics = vscode.languages.createDiagnosticCollection("istari");
        this.currentLine = 1;
        this.requestedLine = 1;
        this.status = "ready";
    }

    get document(): vscode.TextDocument {
        return this.editor.document;
    }

    getCurrentLine(): number {
        return this.currentLine;
    }

    getRequestedLine(): number {
        return this.requestedLine;
    }

    getStatus(): IstariStatus {
        return this.status;
    }

    setStatus(status: IstariStatus): void {
        this.status = status;
        this.updateDecorations();
    }

    setEditor(editor: vscode.TextEditor): void {
        this.editor = editor;
        this.updateCurrentLine(this.currentLine);
    }

    updateCurrentLine(line: number): void {
        this.currentLine = line;
        this.updateDecorations();
    }

    setRequestedLine(line: number): void {
        this.requestedLine = line;
    }

    getCursorLine(): number {
        return this.editor.selection.active.line;
    }

    updateDecorations(): void {
        // blue dot on current line
        let range = this.currentLine > 1 ? [
            new vscode.Range(new vscode.Position(this.currentLine - 1, 0), new vscode.Position(this.currentLine - 1, 0))
        ] : [];
        let colorCurrentLine = vscode.workspace.getConfiguration().get<boolean>('istari.colorCurrentLine');
        if (colorCurrentLine && colorCurrentLine.valueOf()) {
            this.editor.setDecorations(decorationBlueBackground, range);
        }
        let colorGutter = vscode.workspace.getConfiguration().get<boolean>('istari.colorGutter');
        if (colorGutter && colorGutter.valueOf()) {
            if (this.status === "working") {
                this.editor.setDecorations(decorationBlueHourglassGutter, range);
                this.editor.setDecorations(decorationBlueArrowGutter, []);
            } else {
                this.editor.setDecorations(decorationBlueHourglassGutter, []);
                this.editor.setDecorations(decorationBlueArrowGutter, range);
            }
        }
        // all previous line green
        let greenRange = this.currentLine > 1 ? [
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(this.currentLine - 2, 0))
        ] : [];
        if (colorGutter && colorGutter.valueOf()) {
            this.editor.setDecorations(decorationGreenGutter, greenRange);
        }
        let colorCompleted = vscode.workspace.getConfiguration().get<boolean>('istari.colorCompleted');
        if (colorCompleted && colorCompleted.valueOf()) {
            this.editor.setDecorations(decorationGreenBackground, greenRange);
        }
        if (colorGutter && colorGutter.valueOf()) {
            // current line - requested line, based on status
            // ready -> red (this indicates a failure if this range is non empty)
            // partial ready -> blue
            // working -> yellow
            let requestedLine = this.requestedLine > 0 ? this.requestedLine : this.currentLine;
            let range2 = requestedLine > this.currentLine ? [
                new vscode.Range(new vscode.Position(this.currentLine, 0), new vscode.Position(requestedLine - 2, 0))
            ] : [];
            switch (this.status) {
                case "ready": {
                    this.editor.setDecorations(decorationRedGutter, range2);
                    this.editor.setDecorations(decorationBlueGutter, []);
                    this.editor.setDecorations(decorationYellowGutter, []);
                    break;
                }
                case "partialReady": {
                    this.editor.setDecorations(decorationRedGutter, []);
                    // force adding range on partial ready status
                    if (range2.length === 0) {
                        range2 = [new vscode.Range(new vscode.Position(this.currentLine, 0), new vscode.Position(this.currentLine, 0))];
                    }
                    this.editor.setDecorations(decorationBlueGutter, range2);
                    this.editor.setDecorations(decorationYellowGutter, []);
                    break;
                }
                case "working": {
                    this.editor.setDecorations(decorationRedGutter, []);
                    this.editor.setDecorations(decorationBlueGutter, []);
                    this.editor.setDecorations(decorationYellowGutter, range2);
                    break;
                }
            }
        }
    }

    setDiagnostic(text: string): void {
        // format: ... error ...  <line>.<col>.
        let diagnostic = text.match(/error.*?(\d+)\.(\d+)\.\s$/);
        if (diagnostic) {
            let line = parseInt(diagnostic[1]);
            let col = parseInt(diagnostic[2]);
            // get the range for single word (seems istari uses 1 based line number and 0 based col number)
            let wordRange = this.editor.document.getWordRangeAtPosition(new vscode.Position(line - 1, col))
                || new vscode.Range(new vscode.Position(line - 1, col), new vscode.Position(line - 1, col + 10));
            let diagnosticInfo = new vscode.Diagnostic(wordRange, text, vscode.DiagnosticSeverity.Error);
            this.diagnostics.set(this.document.uri, [diagnosticInfo]);
        } else {
            this.diagnostics.clear();
        }
    }

    clearDiagnostics(): void {
        this.diagnostics.clear();
    }

    reset(): void {
        this.currentLine = 1;
        this.requestedLine = 1;
        this.status = "ready";
        this.updateDecorations();
        this.clearDiagnostics();
    }

    getTextRange(startLine: number, endLine: number): string {
        let range = new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(endLine, 0));
        return this.editor.document.getText(range);
    }

    getLineAt(line: number): vscode.TextLine {
        return this.editor.document.lineAt(line);
    }

    get lineCount(): number {
        return this.editor.document.lineCount;
    }

    dispose(): void {
        this.diagnostics.dispose();
    }
}