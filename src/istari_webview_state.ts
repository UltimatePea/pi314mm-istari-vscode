import * as vscode from 'vscode';
import path = require('path');
import { IstariWebview } from './istari_webview';

export class IstariWebviewState {
    private document: vscode.TextDocument;
    private webview: IstariWebview | null = null;
    private messages: any[] = [];
    private currentStatus: string = '';
    private currentTasks: string = '';
    private currentCursor: string = '';

    constructor(document: vscode.TextDocument) {
        this.document = document;

        // Show notification when state is created
        vscode.window.showInformationMessage(
            `Istari session started for ${path.basename(document.fileName)}`,
            'Open Webview'
        ).then(selection => {
            if (selection === 'Open Webview') {
                this.showWebview();
            }
        });
    }

    public showWebview(): void {
        if (this.webview) {
            // Webview exists, just reveal it
            this.webview.reveal();
        } else {
            // Create new webview
            this.createWebview();
        }
    }

    private createWebview(): void {
        this.webview = new IstariWebview(
            path.basename(this.document.fileName),
            () => {
                // Handle disposal - set webview to null
                this.webview = null;
            }
        );

        // Restore all state to the new webview
        this.restoreState();
    }

    private restoreState(): void {
        if (!this.webview) return;

        // Restore status, tasks, cursor
        if (this.currentStatus) {
            this.webview.postMessage({ command: 'changeStatus', text: this.currentStatus });
        }
        if (this.currentTasks) {
            this.webview.postMessage({ command: 'changeTasks', text: this.currentTasks });
        }
        if (this.currentCursor) {
            this.webview.postMessage({ command: 'changeCursor', text: this.currentCursor });
        }

        // Restore all messages
        this.messages.forEach((message) => {
            this.webview!.postMessage(message);
        });

        // Scroll to bottom
        this.webview.postMessage({ command: 'scrollToBottom' });
    }

    public resetText(): void {
        this.messages = [];
        if (this.webview) {
            this.webview.postMessage({ command: 'resetText' });
        }
    }

    public appendText(text: string): void {
        const message = { command: 'appendText', text: text };
        this.messages.push(message);
        if (this.messages.length > 100) {
            this.messages.shift();
        }

        if (this.webview) {
            this.webview.postMessage(message);
            this.webview.postMessage({ command: 'scrollToBottom' });
        }
    }

    public changeStatus(text: string): void {
        this.currentStatus = text;
        if (this.webview) {
            this.webview.postMessage({ command: 'changeStatus', text: text });
        }
    }

    public changeTasks(text: string): void {
        this.currentTasks = text;
        if (this.webview) {
            this.webview.postMessage({ command: 'changeTasks', text: text });
        }
    }

    public changeCursor(text: string): void {
        this.currentCursor = text;
        if (this.webview) {
            this.webview.postMessage({ command: 'changeCursor', text: text });
        }
    }

    // For MCP server access
    public get messageHistory(): any[] {
        return [...this.messages];
    }
}