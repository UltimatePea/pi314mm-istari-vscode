
import * as vscode from 'vscode';
import { IstariTerminal, IstariTask, IstariInputCommand, IstariCommand } from './istari_terminal';
import { IstariWebviewState } from './istari_webview_state';
import { IstariEditor, IstariStatus } from './istari_editor';

export class IstariUI {
    document: vscode.TextDocument;
    terminal: IstariTerminal;
    webview: IstariWebviewState;
    istariEditor: IstariEditor;

    // Getters for commonly accessed properties
    get editor(): vscode.TextEditor {
        return this.istariEditor.editor;
    }

    get currentLine(): number {
        return this.istariEditor.getCurrentLine();
    }

    get requestedLine(): number {
        return this.istariEditor.getRequestedLine();
    }

    set requestedLine(line: number) {
        this.istariEditor.setRequestedLine(line);
    }

    get status(): IstariStatus {
        return this.istariEditor.getStatus();
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
        this.istariEditor.reset();
    }

    tasksUpdated() {
        if (this.terminal.tasks.length > 0 || this.terminal.taskInflight) {
            this.webview.changeTasks((this.terminal.tasks.length + 1).toString() + " Remaining");
        } else {
            this.webview.changeTasks("Ready");
        }
    }

    updateCurrentLine(line: number) {
        this.istariEditor.updateCurrentLine(line);
        this.webview.changeCursor(line.toString());
    }

    setEditor(editor: vscode.TextEditor) {
        this.istariEditor.setEditor(editor);
        this.webview.changeCursor(this.istariEditor.getCurrentLine().toString());
    }

    // called on send lines, also gets diagnostic information
    respondToSendLineResponse(text: string) {
        this.istariEditor.setDiagnostic(text);
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
                this.istariEditor.setStatus("working");
                break;
            }
            case IstariCommand.partialReady: {
                this.webview.changeStatus("Partial Ready " + data);
                this.istariEditor.setStatus("partialReady");
                break;
            }
            case IstariCommand.ready: {
                this.webview.changeStatus("Ready " + data);
                this.istariEditor.setStatus("ready");
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
        let currentLine = this.istariEditor.getCurrentLine();
        let requestedLine = this.istariEditor.getRequestedLine();
        if (requestedLine > currentLine) {
            let text = this.istariEditor.getTextRange(currentLine - 1, requestedLine - 1);
            this.sendLines(text);
        } else if (requestedLine < currentLine) {
            this.rewindToLine(requestedLine);
        } else if (requestedLine === currentLine && vscode.workspace.getConfiguration().get<boolean>('istari.continueJumpingForward')?.valueOf()) {
            // special: if we already jumped to the requested line, just jump the next line past ;
            // currentLine and requestedLine is 1 indexed, nextline is zero-indexed
            let nextline = currentLine;
            while (nextline < this.istariEditor.lineCount) {
                let line = this.istariEditor.getLineAt(nextline).text;
                nextline++;
                if (line.includes(";")) {
                    break;
                }
            }
            if (nextline + 1 !== requestedLine) {
                this.istariEditor.setRequestedLine(nextline + 1);
                this.jumpToRequestedLine();
            }
        }
    }

    jumpToCursor() {
        let cursorLine = this.istariEditor.getCursorLine();
        this.istariEditor.setRequestedLine(cursorLine + 1);
        this.jumpToRequestedLine();
    }

    nextLine() {
        console.log("nextLine not implemented");
        let currentLine = this.istariEditor.getCurrentLine();
        if (currentLine < this.istariEditor.lineCount) {
            let text = this.istariEditor.getTextRange(currentLine - 1, currentLine);
            this.sendLines(text);
        } else {
            console.log("error");
        }
    }

    prevLine() {
        console.log("prevLine not implemented");
        let currentLine = this.istariEditor.getCurrentLine();
        if (currentLine > 1) {
            this.rewindToLine(currentLine - 1);
        } else {
            console.log("error");
        }
    }


    edit(e: vscode.TextDocumentChangeEvent) {
        if (e.document === this.istariEditor.document) {
            if (e.contentChanges.length > 0) {
                let currentLine = this.istariEditor.getCurrentLine();
                if (e.contentChanges[0].range.end.line < currentLine - 1) {
                    // skip if just inserting a trailing newline (possibly followed by spaces) right before this line
                    if (e.contentChanges[0].text.includes("\n")
                        && e.contentChanges[0].text.trim() === ""
                        && e.contentChanges[0].range.end.line === currentLine - 2
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