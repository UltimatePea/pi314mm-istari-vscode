import * as vscode from 'vscode';
import { IstariMCPServer } from './mcp-server';
import { startLSP } from './istari_lsp';
import { mcpServer, setMcpServer, getCurrentIstari, getOrCreateIstariUI, setCurrentIstariUri, getIstariByUri } from './global';



function registerDoc(doc: vscode.TextDocument, editor: vscode.TextEditor | undefined = undefined) {
	if (doc.languageId === "istari") {
		// This will either get existing UI or create new one
		const ui = getOrCreateIstariUI(doc.uri.toString());

		// Update editor if provided
		if (editor) {
			ui.setEditor(editor);
		}

		// Auto-start MCP server if it doesn't exist yet
		if (!mcpServer) {
			startMcpServer();
		}
	}
}

function startMcpServer() {
	if (!mcpServer) {
		// Start HTTP server by default for Claude Code integration
		const port = vscode.workspace.getConfiguration().get<number>('istari.mcpPort') || 47821;
		const newServer = new IstariMCPServer(port, true);
		setMcpServer(newServer);

		// Set active context if there's an active Istari document
		// MCP server will automatically use global state, no need to set context

		newServer.start().then(() => {
			console.log(`Istari MCP HTTP server started on port ${port}`);
			vscode.window.showInformationMessage(`Istari MCP server running on http://localhost:${port}`);
		}).catch((error: any) => {
			console.error(`Failed to start MCP server: ${error.message}`);
			vscode.window.showErrorMessage(`Failed to start MCP server: ${error.message}`);
		});
	}
}

export function activate(context: vscode.ExtensionContext) {

	// listen for file open on istari langauge files
	vscode.workspace.onDidOpenTextDocument((_doc) => {
		// registerDoc(doc);
	});

	vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			registerDoc(editor.document, editor);
			// Update current Istari URI when switching editors
			if (editor.document.languageId === "istari") {
				setCurrentIstariUri(editor.document.uri.toString());
			}
		}
	}
	);

	vscode.workspace.onDidSaveTextDocument((_doc) => {
		// registerDoc(doc);
	});

	vscode.workspace.onDidCloseTextDocument((_doc) => {
		// Do nothing - keep UI/terminal running in background for MCP access
	});

	vscode.window.visibleTextEditors.forEach((editor) => {
		registerDoc(editor.document);
	});

	// Set current Istari URI for active editor on activation
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor && activeEditor.document.languageId === "istari") {
		registerDoc(activeEditor.document, activeEditor);
		setCurrentIstariUri(activeEditor.document.uri.toString());
	}


	vscode.workspace.onDidChangeTextDocument(e => {
		if (e.document.languageId === "istari") {
			const uri = e.document.uri.toString();
			let istari = getIstariByUri(uri);
			if (istari) {
				istari.edit(e);
			} else {
				console.error("[C] Istari not found for the document.", e.document.fileName);
			}
		}
	});


	context.subscriptions.push(vscode.commands.registerCommand('istari.jumpToCursor', () => {
		let istari = getCurrentIstari();
		istari?.editor.document.save();
		istari?.jumpToCursor();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.jumpToPreviouslyRequested', () => {
		let istari = getCurrentIstari();
		istari?.editor.document.save();
		istari?.jumpToRequestedLine();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.restartTerminal', () => {
		let istari = getCurrentIstari();
		istari?.restartIstariTerminal();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.prevLine', () => {
		getCurrentIstari()?.prevLine();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.nextLine', () => {
		getCurrentIstari()?.nextLine();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.getType', () => {
		vscode.window.showInputBox({ title: "Get the type of a constant", prompt: "constant", ignoreFocusOut: true }).then((expr) => {
			if (expr) {
				getCurrentIstari()?.interject("Report.showType (parseLongident /" + expr + "/);");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.getDefinition', () => {
		vscode.window.showInputBox({ title: "Get the definition of a constant", prompt: "constant", ignoreFocusOut: true }).then((expr) => {
			if (expr) {
				getCurrentIstari()?.interject("Report.show (parseLongident /" + expr + "/);");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.search', () => {
		vscode.window.showInputBox({ title: "Find all constants that mention targets", prompt: "targets", ignoreFocusOut: true }).then((expr) => {
			if (expr) {
				getCurrentIstari()?.interject("Report.search (parseConstants /" + expr + "/) [];");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.interrupt', () => {
		let istari = getCurrentIstari();
		if (istari) {
			istari.terminal.interrupt();
		}
	}));


	// context.subscriptions.push(vscode.commands.registerCommand('istari.init', () => {
	// 	editor = vscode.window.activeTextEditor;
	// 	istari = editor ? new IstariTerminal(editor) : undefined;
	// }));

	context.subscriptions.push(vscode.commands.registerCommand('istari.jumpCursor', () => {
		let istari = getCurrentIstari();
		if (istari) {
			let pos = new vscode.Position(istari.currentLine - 1, 0);
			istari.editor.selection = new vscode.Selection(pos, pos);
			istari.editor.revealRange(new vscode.Range(pos, pos));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.interject', () => {
		vscode.window.showInputBox({ title: "Interject with IML code", prompt: "IML code", ignoreFocusOut: true }).then((code) => {
			if (code) {
				getCurrentIstari()?.interject(code);
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showCurrentGoals', () => {
		getCurrentIstari()?.interject("Prover.show ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showCurrentGoalsVerbosely', () => {
		getCurrentIstari()?.interject("Prover.showFull ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.details', () => {
		getCurrentIstari()?.interject("Prover.detail ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.listConstants', () => {
		getCurrentIstari()?.interject("Report.showAll ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.listConstantsModule', () => {
		vscode.window.showInputBox({ title: "Module to list constants from", prompt: "module", ignoreFocusOut: true }).then((code) => {
			if (code) {
				getCurrentIstari()?.interject("Report.showModule (parseLongident /" + code + "/);");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showImplicitArguments', () => {
		getCurrentIstari()?.interject("Show.showImplicits := not (!Show.showImplicits); if !Show.showImplicits then print \"Display of implicit arguments enabled.\\n\" else print \"Display of implicit arguments disabled.\\n\";");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showSubstitutions', () => {
		getCurrentIstari()?.interject("Show.showSubstitutions := not (!Show.showSubstitutions); if !Show.showSubstitutions then print \"Display of evar substitutions enabled.\\n\" else print \"Display of evar substitutions disabled.\\n\";");
	}));

	// MCP Server
	context.subscriptions.push(vscode.commands.registerCommand('istari.startMcpServer', () => {
		if (!mcpServer) {
			startMcpServer();
			vscode.window.showInformationMessage('Istari MCP server started');
		} else {
			vscode.window.showInformationMessage('MCP server is already running');
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.installClaudeMcp', () => {
		const command = 'claude mcp add istari-vscode http://localhost:47821/mcp -s user -t http';

		vscode.window.showInformationMessage(
			`This will run: ${command}`,
			'Install', 'Cancel'
		).then(selection => {
			if (selection === 'Install') {
				// Start MCP server if not running
				if (!mcpServer) {
					startMcpServer();
				}

				// Execute the Claude MCP install command
				const terminal = vscode.window.createTerminal('Claude MCP Install');
				terminal.show();
				terminal.sendText(command);

				vscode.window.showInformationMessage('Claude MCP installation command executed. Check terminal for results.');
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showWebview', () => {
		let istari = getCurrentIstari();
		if (istari) {
			istari.webview.showWebview();
		} else {
			vscode.window.showInformationMessage('No active Istari document. Open an .ist file first.');
		}
	}));


	// LSP
	startLSP();

}

// this method is called when your extension is deactivated
export function deactivate() { }
