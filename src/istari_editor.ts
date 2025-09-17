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

/**
 * IstariEditor is a stateless class that manages visual decorations for an editor.
 * All state is passed in from IstariUI, allowing the editor to be swapped without losing state.
 */
export class IstariEditor {
    editor: vscode.TextEditor;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
    }

    get document(): vscode.TextDocument {
        return this.editor.document;
    }

    setEditor(editor: vscode.TextEditor): void {
        this.editor = editor;
    }

    updateDecorations(currentLine: number, requestedLine: number, status: IstariStatus): void {
        // blue dot on current line
        let range = currentLine > 1 ? [
            new vscode.Range(new vscode.Position(currentLine - 1, 0), new vscode.Position(currentLine - 1, 0))
        ] : [];
        let colorCurrentLine = vscode.workspace.getConfiguration().get<boolean>('istari.colorCurrentLine');
        if (colorCurrentLine && colorCurrentLine.valueOf()) {
            this.editor.setDecorations(decorationBlueBackground, range);
        }
        let colorGutter = vscode.workspace.getConfiguration().get<boolean>('istari.colorGutter');
        if (colorGutter && colorGutter.valueOf()) {
            if (status === "working") {
                this.editor.setDecorations(decorationBlueHourglassGutter, range);
                this.editor.setDecorations(decorationBlueArrowGutter, []);
            } else {
                this.editor.setDecorations(decorationBlueHourglassGutter, []);
                this.editor.setDecorations(decorationBlueArrowGutter, range);
            }
        }
        // all previous line green
        let greenRange = currentLine > 1 ? [
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(currentLine - 2, 0))
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
            let reqLine = requestedLine > 0 ? requestedLine : currentLine;
            let range2 = reqLine > currentLine ? [
                new vscode.Range(new vscode.Position(currentLine, 0), new vscode.Position(reqLine - 2, 0))
            ] : [];
            switch (status) {
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
                        range2 = [new vscode.Range(new vscode.Position(currentLine, 0), new vscode.Position(currentLine, 0))];
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

    clearDecorations(): void {
        this.editor.setDecorations(decorationBlueArrowGutter, []);
        this.editor.setDecorations(decorationBlueHourglassGutter, []);
        this.editor.setDecorations(decorationBlueBackground, []);
        this.editor.setDecorations(decorationGreenGutter, []);
        this.editor.setDecorations(decorationGreenBackground, []);
        this.editor.setDecorations(decorationYellowGutter, []);
        this.editor.setDecorations(decorationRedGutter, []);
        this.editor.setDecorations(decorationBlueGutter, []);
    }

    getCursorLine(): number {
        return this.editor.selection.active.line;
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
}