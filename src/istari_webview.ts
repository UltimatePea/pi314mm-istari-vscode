
import * as vscode from 'vscode';
import path = require('path');

let webviewHTML = `
			<script>
			window.addEventListener('message', event => {
				const message = event.data;
				switch (message.command) {
					case 'scrollToBottom':
						window.scrollTo(0, document.body.scrollHeight);
						break;
					case 'appendText': {
						const mainText = document.getElementById('main_text');
						if (mainText) {
							const new_hr = document.createElement("hr");
							const new_pre = document.createElement("pre");
							m = message.text; 
							// Optionally "Clean up" the message
							// m = m.replace(/\\n(\=+)/g, "");
							// m = m.replace(/\\n(\-+)/g, "");
							new_pre.textContent = m.trim();
							main_text.appendChild(new_hr);
							main_text.appendChild(new_pre);
						}
						break;
					}
					case 'resetText': {
						const mainText = document.getElementById('main_text');
						if (mainText) {
							mainText.innerHTML = '';
						}
						break
					}
					case 'changeStatus': {
						const status = document.getElementById('status');
						if (status) {
							status.innerHTML = message.text;
						}
						break;
					}
					case 'changeTasks': {
						const tasks = document.getElementById('tasks');
						if (tasks) {
							tasks.innerHTML = message.text;
						}
						break;
					}
					case 'changeCursor': {
						const cursor = document.getElementById('cursor');
						if (cursor) {
							cursor.innerHTML = message.text;
						}
						break;
					}
				}
			});
			</script>
			<body style="font-family: monospace; margin-bottom: 20px;">
			<div style="position: fixed; top: 0; left: 0; width: 100%; padding-left: 2px; opacity: 1; 
			background-color: rgb(255, 255, 255);
			 z-index: 10;">
				Status: <span id="status"></span> 
				| Tasks: <span id="tasks"></span>
				| Cursor: <span id="cursor"></span>
			</div>
			<div id="main_text" style="margin-top: 2em"></div>
			</body>
			`;

export class IstariWebview {
    webview: vscode.WebviewPanel;
    messages: any[] = [];
    constructor(document: vscode.TextDocument) {
        this.webview = vscode.window.createWebviewPanel("istari",
            path.basename(document.fileName),
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true
            }, { enableScripts: true });
        // I haven't figured out this yet, but webview is strangely reloading when not visible
        // so I recoreded events and replay them when the webview is visible
        this.webview.onDidChangeViewState((e) => {
            if (e.webviewPanel.visible) {
                this.webview.webview.html = webviewHTML;
                this.webview.webview.postMessage({ command: 'resetText' });
                this.messages.forEach((message) => {
                    this.webview.webview.postMessage(message);
                });
                this.webview.webview.postMessage({ command: 'scrollToBottom' });

            }
        });
    }

    postMessage(message: any) {
        if (message.command === 'appendText') {
            this.messages.push(message);
            if (this.messages.length > 100) {
                this.messages.shift();
            }
        }
        this.webview.webview.postMessage(message);
    }

    resetText() {
        this.messages = [];
        this.postMessage({ command: 'resetText' });
    }


    appendText(text: string) {
        this.postMessage({ command: 'appendText', text: text });
        this.postMessage({ command: 'scrollToBottom' });
    }

    changeStatus(text: string) {
        this.postMessage({ command: 'changeStatus', text: text });
    }

    changeTasks(text: string) {
        this.postMessage({ command: 'changeTasks', text: text });
    }

    changeCursor(text: string) {
        this.postMessage({ command: 'changeCursor', text: text });
    }

}