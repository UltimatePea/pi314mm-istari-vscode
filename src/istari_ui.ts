import * as vscode from 'vscode';
import { IstariTerminal, IstariTask, IstariInputCommand, IstariCommand } from './istari_terminal';
import { IstariWebviewState } from './istari_webview_state';
import { IstariEditor, IstariStatus } from './istari_editor';

export class IstariUI {
    document: vscode.TextDocument;
    terminal: IstariTerminal;
    webview: IstariWebviewState;
    istariEditor: IstariEditor;
    diagnostics: vscode.DiagnosticCollection;

    // State properties that persist across editor changes
    private _currentLine: number;
    private _requestedLine: number;
    private _status: IstariStatus;

    // Getters for commonly accessed properties
    get editor(): vscode.TextEditor {
        return this.istariEditor.editor;
    }

    get currentLine(): number {
        return this._currentLine;
    }

    get requestedLine(): number {
        return this._requestedLine;
    }

    set requestedLine(line: number) {
        this._requestedLine = line;
    }

    get status(): IstariStatus {
        return this._status;
    }

    constructor(document: vscode.TextDocument) {
        this.document = document;
        let editor = vscode.window.visibleTextEditors.find(x => x.document === this.document);
        if (!editor) {
            console.error("[c] Istari not found for the current active text file. Try save or reopen this file.", this.document.fileName);
            vscode.window.showInformationMessage("[C] Istari not found for the current active text file. Try save or reopen this file.");
            throw new Error("[e] Istari not found for the current active text file. Try save or reopen this file.");
        }
        this.istariEditor = new IstariEditor(editor);
        this.webview = new IstariWebviewState(document);
        this.diagnostics = vscode.languages.createDiagnosticCollection("istari");

        // Initialize state
        this._currentLine = 1;
        this._requestedLine = 1;
        this._status = "ready";

        this.terminal = new IstariTerminal(document,
            this.defaultCallback.bind(this),
            this.tasksUpdated.bind(this));
    }

    restartIstariTerminal() {
        this.terminal.proc.kill();
        this.terminal = new IstariTerminal(this.document,
            this.defaultCallback.bind(this),
            this.tasksUpdated.bind(this));
        this.webview.resetText();
        this._currentLine = 1;
        this._requestedLine = 1;
        this._status = "ready";
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
        this.istariEditor.updateDecorations(this._currentLine, this._requestedLine, this._status);
    }

    updateCurrentLine(line: number) {
        this._currentLine = line;
        this.updateDecorations();
        this.webview.changeCursor(line.toString());
    }

    setEditor(editor: vscode.TextEditor) {
        this.istariEditor.setEditor(editor);
        this.updateDecorations();
        this.webview.changeCursor(this._currentLine.toString());
    }

    // called on send lines, also gets diagnostic information
    respondToSendLineResponse(text: string) {
        // format: ... error ...  <line>.<col>.
        let diagnostic = text.match(/error.*?(\d+)\.(\d+)\.\s$/);
        if (diagnostic) {
            let line = parseInt(diagnostic[1]);
            let col = parseInt(diagnostic[2]);
            // get the range for single word (seems istari uses 1 based line number and 0 based col number)
            let wordRange = this.istariEditor.document.getWordRangeAtPosition(new vscode.Position(line - 1, col))
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
                this._status = "working";
                this.updateDecorations();
                break;
            }
            case IstariCommand.partialReady: {
                this.webview.changeStatus("Partial Ready " + data);
                this._status = "partialReady";
                this.updateDecorations();
                break;
            }
            case IstariCommand.ready: {
                this.webview.changeStatus("Ready " + data);
                this._status = "ready";
                this.updateDecorations();
                break;
            }

            default: {
                console.error("Unknown command: " + cmd);
                break;
            }
        }
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
        if (this._requestedLine > this._currentLine) {
            let text = this.istariEditor.getTextRange(this._currentLine - 1, this._requestedLine - 1);
            this.sendLines(text);
        } else if (this._requestedLine < this._currentLine) {
            this.rewindToLine(this._requestedLine);
        } else if (this._requestedLine === this._currentLine && vscode.workspace.getConfiguration().get<boolean>('istari.continueJumpingForward')?.valueOf()) {
            // special: if we already jumped to the requested line, just jump the next line past ;
            // currentLine and requestedLine is 1 indexed, nextline is zero-indexed
            let nextline = this._currentLine;
            while (nextline < this.istariEditor.lineCount) {
                let line = this.istariEditor.getLineAt(nextline).text;
                nextline++;
                if (line.includes(";")) {
                    break;
                }
            }
            if (nextline + 1 !== this._requestedLine) {
                this._requestedLine = nextline + 1;
                this.jumpToRequestedLine();
            }
        }
    }

    jumpToCursor() {
        let cursorLine = this.istariEditor.getCursorLine();
        this._requestedLine = cursorLine + 1;
        this.jumpToRequestedLine();
    }

    nextLine() {
        console.log("nextLine not implemented");
        if (this._currentLine < this.istariEditor.lineCount) {
            let text = this.istariEditor.getTextRange(this._currentLine - 1, this._currentLine);
            this.sendLines(text);
        } else {
            console.log("error");
        }
    }

    prevLine() {
        console.log("prevLine not implemented");
        if (this._currentLine > 1) {
            this.rewindToLine(this._currentLine - 1);
        } else {
            console.log("error");
        }
    }


    edit(e: vscode.TextDocumentChangeEvent) {
        if (e.document === this.istariEditor.document) {
            if (e.contentChanges.length > 0) {
                if (e.contentChanges[0].range.end.line < this._currentLine - 1) {
                    // skip if just inserting a trailing newline (possibly followed by spaces) right before this line
                    if (e.contentChanges[0].text.includes("\n")
                        && e.contentChanges[0].text.trim() === ""
                        && e.contentChanges[0].range.end.line === this._currentLine - 2
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