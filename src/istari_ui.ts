
import * as vscode from 'vscode';
import path = require('path');
import { IstariTerminal, IstariTask, IstariInputCommand, IstariCommand } from './istari_terminal';
import { IstariWebview } from './istari_webview';

const decorationBlueArrowGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'blue-dot.svg')),
    // gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'green-bar.svg')),
    gutterIconSize: '80%',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const decorationBlueHourglassGutter = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'blue-hourglass.svg')),
    // gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', 'media', 'green-bar.svg')),
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

export class IstariUI {
    document: vscode.TextDocument;
    terminal: IstariTerminal;
    currentLine: number;
    requestedLine: number;
    status: "ready" | "working" | "partialReady";
    webview: IstariWebview;
    diagnostics: vscode.DiagnosticCollection;

    editor: vscode.TextEditor;

    constructor(document: vscode.TextDocument) {
        this.document = document;
        let editor = vscode.window.visibleTextEditors.find(x => x.document === this.document);
        if (!editor) {
            console.error("[c] Istari not found for the current active text file. Try save or reopen this file.", this.document.fileName);
            vscode.window.showInformationMessage("[C] Istari not found for the current active text file. Try save or reopen this file.");
            throw new Error("[e] Istari not found for the current active text file. Try save or reopen this file.");
        }
        this.editor = editor;
        this.webview = new IstariWebview(document);
        this.currentLine = 1;
        this.requestedLine = 1;
        this.status = "ready";
        this.terminal = new IstariTerminal(document,
            this.defaultCallback.bind(this),
            this.tasksUpdated.bind(this));
        this.diagnostics = vscode.languages.createDiagnosticCollection("istari");
    }

    restartIstariTerminal() {
        this.terminal.proc.kill();
        this.terminal = new IstariTerminal(this.document,
            this.defaultCallback.bind(this),
            this.tasksUpdated.bind(this));
        this.webview.resetText();
        this.currentLine = 1;
        this.requestedLine = 1;
        this.status = "ready";
        this.updateDecorations();
        this.diagnostics.clear();
    }

    tasksUpdated() {
        if (this.terminal.tasks.length > 0 || this.terminal.taskInflight) {
            this.webview.changeTasks((this.terminal.tasks.length + 1).toString() + " Remaining");
        } else {
            this.webview.changeTasks("Ready");
        }
    }

    updateDecorations() {
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
            // let rangeColor = this.status === "ready" ? decorationRedGutter : this.status === "partialReady" ? decorationBlueGutter : decorationYellowGutter;
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

    updateCurrentLine(line: number) {
        this.currentLine = line;
        this.updateDecorations();
        this.webview.changeCursor(this.currentLine.toString());
    }

    setEditor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.updateCurrentLine(this.currentLine);
    }

    // called on send lines, also gets diagnostic information 
    respondToSendLineResponse(text: string) {
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

    defaultCallback(cmd: IstariCommand, data: string) {
        switch (cmd) {
            case IstariCommand.textOutput: {
                this.webview.appendText(data);
                break;
            }
            case IstariCommand.lineNumber: {
                this.updateCurrentLine(Number(data));
                break;
            }
            case IstariCommand.working: {
                this.webview.changeStatus("Working " + data);
                this.status = "working";
                break;
            }
            case IstariCommand.partialReady: {
                this.webview.changeStatus("Partial Ready " + data);
                this.status = "partialReady";
                this.updateDecorations();
                break;
            }
            case IstariCommand.ready: {
                this.webview.changeStatus("Ready " + data);
                this.status = "ready";
                this.updateDecorations();
                break;
            }

            default: {
                console.error("Unknown command: " + cmd);
                break;
            }
        }
    }

    revealWebview() {
        this.webview.webview.reveal(vscode.ViewColumn.Beside, true);
    }

    interject(text: string) {
        // console.log("Interjecting: ", text);
        // this.write_stdin('\x02' + text + '\n');
        this.terminal.enqueueTask(new IstariTask(IstariInputCommand.interject, text, (data) => {
            this.webview.appendText(data);
            return true;
        }));
    }

    interjectWithCallback(text: string, callback: (data: string) => boolean) {
        this.terminal.enqueueTask(new IstariTask(IstariInputCommand.interject, text, callback));
    }

    getTypeForConstant(constant: string, callback: (type: string) => void) {
        this.interjectWithCallback("Report.showType (parseLongident /" + constant + "/);", (data) => {
            callback(data);
            return true;
        });
    }

    getTypeAndDefinitionForConstant(constant: string, callback: (typeAndDefinition: string) => void) {
        // this.getTypeForConstant(constant, (data) => {
        this.interjectWithCallback("Report.show' (parseLongident /" + constant + "/);", (typeAndDefinition) => {
            // callback(data, definition);
            callback(typeAndDefinition);
            return true;
        });
        // return true;
        // });
    }

    sendLines(text: string) {
        this.terminal.enqueueTask(new IstariTask(IstariInputCommand.textInput, text, (data) => {
            this.webview.appendText(data);
            this.respondToSendLineResponse(data);
            return true;
        }));
    }

    rewindToLine(line: number) {
        this.terminal.enqueueTask(new IstariTask(IstariInputCommand.rewind, line.toString(), (data) => {
            this.webview.appendText(data);
            return true;
        }));
    }

    jumpToRequestedLine() {
        if (this.requestedLine > this.currentLine) {
            let wordAtCurorRange = new vscode.Range(new vscode.Position(this.currentLine - 1, 0), new vscode.Position(this.requestedLine - 1, 0));
            this.sendLines(this.editor.document.getText(wordAtCurorRange));
        } else if (this.requestedLine < this.currentLine) {
            this.rewindToLine(this.requestedLine);
        } else if (this.requestedLine === this.currentLine && vscode.workspace.getConfiguration().get<boolean>('istari.continueJumpingForward')?.valueOf()) {
            // special: if we already jumped to the requested line, just jump the next line past ;
            // currentLine and requestedLine is 1 indexed, nextline is zero-indexed
            let nextline = this.currentLine;
            while (nextline < this.editor.document.lineCount) {
                let line = this.editor.document.lineAt(nextline).text;
                nextline++;
                if (line.includes(";")) {
                    break;
                }
            }
            if (nextline + 1 !== this.requestedLine
                // && nextline < this.editor.document.lineCount
            ) {
                this.requestedLine = nextline + 1;
                this.jumpToRequestedLine();
            }
        }
    }

    jumpToCursor() {
        let cursorLine = this.editor.selection.active.line;
        this.requestedLine = cursorLine + 1;
        this.jumpToRequestedLine();
    }

    nextLine() {
        console.log("nextLine not implemented");
        if (this.currentLine < this.editor.document.lineCount) {
            let wordAtCurorRange = new vscode.Range(new vscode.Position(this.currentLine - 1, 0), new vscode.Position(this.currentLine, 0));
            this.sendLines(this.editor.document.getText(wordAtCurorRange));
        } else {
            console.log("error");
        }
    }

    prevLine() {
        console.log("prevLine not implemented");
        if (this.currentLine > 1) {
            this.rewindToLine(this.currentLine - 1);
        } else {
            console.log("error");
        }
    }


    edit(e: vscode.TextDocumentChangeEvent) {
        if (e.document === this.editor.document) {
            if (e.contentChanges.length > 0) {
                if (e.contentChanges[0].range.end.line < this.currentLine - 1) {
                    // skip if just inserting a trailing newline (possibly followed by spaces) right before this line
                    if (e.contentChanges[0].text.includes("\n")
                        && e.contentChanges[0].text.trim() === ""
                        && e.contentChanges[0].range.end.line === this.currentLine - 2
                        // ensures line after insertion is empty to prevent insertion in the middle
                        && e.document.lineAt(e.contentChanges[0].range.end.line + 1).text.trim() === ""
                    ) {
                        return;
                    }
                    this.rewindToLine(e.contentChanges[0].range.start.line + 1);
                }
            }
        }
    }
}