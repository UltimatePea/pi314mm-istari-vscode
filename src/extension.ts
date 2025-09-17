import * as vscode from 'vscode';
import { IstariMCPServer } from './mcp-server';
import { IstariUI } from './istari_ui';
import { startLSP } from './istari_lsp';
import { istariUIs, mcpServer, setMcpServer, getIstari } from './global';



function registerDoc(doc: vscode.TextDocument, editor: vscode.TextEditor | undefined = undefined) {
	if (doc.languageId === "istari") {
		if (!istariUIs.has(doc)) {
			const ui = new IstariUI(doc);
			istariUIs.set(doc, ui);

			// Auto-start MCP server if it doesn't exist yet
			if (!mcpServer) {
				startMcpServer();
			}

			// Set active context in MCP server
			if (mcpServer) {
				mcpServer.setActiveContext(doc, ui, ui.terminal);
			}
		} else {
			if (editor) {
				let ui = istariUIs.get(doc);
				if (ui) {
					ui.setEditor(editor);
					// Update active context in MCP server if it exists
					if (mcpServer) {
						mcpServer.setActiveContext(doc, ui, ui.terminal);
					}
				}
			}
			// Webview is only revealed on first creation, not on repeated selections
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
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && activeEditor.document.languageId === "istari") {
			const ui = istariUIs.get(activeEditor.document);
			if (ui) {
				newServer.setActiveContext(activeEditor.document, ui, ui.terminal);
			}
		}

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
	vscode.workspace.onDidOpenTextDocument((doc) => {
		registerDoc(doc);
	});

	vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			registerDoc(editor.document, editor);
		}
	}
	);

	vscode.workspace.onDidSaveTextDocument((doc) => {
		registerDoc(doc);
	});

	vscode.workspace.onDidCloseTextDocument((_doc) => {
		// Do nothing - keep UI/terminal running in background for MCP access
	});

	vscode.window.visibleTextEditors.forEach((editor) => {
		registerDoc(editor.document);
	});

	vscode.workspace.onDidChangeTextDocument(e => {
		if (e.document.languageId === "istari") {
			let istari = getIstari();
			if (istari) {
				istari.edit(e);
			} else {
				console.error("[C] Istari not found for the current active text file. Try save or reopen this file.", e.document.fileName, istariUIs);
			}
		}
	});


	context.subscriptions.push(vscode.commands.registerCommand('istari.jumpToCursor', () => {
		let istari = getIstari();
		istari?.editor.document.save();
		istari?.jumpToCursor();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.jumpToPreviouslyRequested', () => {
		let istari = getIstari();
		istari?.editor.document.save();
		istari?.jumpToRequestedLine();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.restartTerminal', () => {
		let istari = getIstari();
		istari?.restartIstariTerminal();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.prevLine', () => {
		getIstari()?.prevLine();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.nextLine', () => {
		getIstari()?.nextLine();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.getType', () => {
		vscode.window.showInputBox({ title: "Get the type of a constant", prompt: "constant", ignoreFocusOut: true }).then((expr) => {
			if (expr) {
				getIstari()?.interject("Report.showType (parseLongident /" + expr + "/);");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.getDefinition', () => {
		vscode.window.showInputBox({ title: "Get the definition of a constant", prompt: "constant", ignoreFocusOut: true }).then((expr) => {
			if (expr) {
				getIstari()?.interject("Report.show (parseLongident /" + expr + "/);");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.search', () => {
		vscode.window.showInputBox({ title: "Find all constants that mention targets", prompt: "targets", ignoreFocusOut: true }).then((expr) => {
			if (expr) {
				getIstari()?.interject("Report.search (parseConstants /" + expr + "/) [];");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.interrupt', () => {
		let istari = getIstari();
		if (istari) {
			istari.terminal.interrupt();
		}
	}));


	// context.subscriptions.push(vscode.commands.registerCommand('istari.init', () => {
	// 	editor = vscode.window.activeTextEditor;
	// 	istari = editor ? new IstariTerminal(editor) : undefined;
	// }));

	context.subscriptions.push(vscode.commands.registerCommand('istari.jumpCursor', () => {
		let istari = getIstari();
		if (istari) {
			let pos = new vscode.Position(istari.currentLine - 1, 0);
			istari.editor.selection = new vscode.Selection(pos, pos);
			istari.editor.revealRange(new vscode.Range(pos, pos));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.interject', () => {
		vscode.window.showInputBox({ title: "Interject with IML code", prompt: "IML code", ignoreFocusOut: true }).then((code) => {
			if (code) {
				getIstari()?.interject(code);
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showCurrentGoals', () => {
		getIstari()?.interject("Prover.show ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showCurrentGoalsVerbosely', () => {
		getIstari()?.interject("Prover.showFull ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.details', () => {
		getIstari()?.interject("Prover.detail ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.listConstants', () => {
		getIstari()?.interject("Report.showAll ();");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.listConstantsModule', () => {
		vscode.window.showInputBox({ title: "Module to list constants from", prompt: "module", ignoreFocusOut: true }).then((code) => {
			if (code) {
				getIstari()?.interject("Report.showModule (parseLongident /" + code + "/);");
			}
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showImplicitArguments', () => {
		getIstari()?.interject("Show.showImplicits := not (!Show.showImplicits); if !Show.showImplicits then print \"Display of implicit arguments enabled.\\n\" else print \"Display of implicit arguments disabled.\\n\";");
	}));

	context.subscriptions.push(vscode.commands.registerCommand('istari.showSubstitutions', () => {
		getIstari()?.interject("Show.showSubstitutions := not (!Show.showSubstitutions); if !Show.showSubstitutions then print \"Display of evar substitutions enabled.\\n\" else print \"Display of evar substitutions disabled.\\n\";");
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

	context.subscriptions.push(vscode.commands.registerCommand('istari.showWebview', () => {
		let istari = getIstari();
		if (istari) {
			istari.webview.webview.reveal(vscode.ViewColumn.Beside, false);
		} else {
			vscode.window.showInformationMessage('No active Istari document. Open an .ist file first.');
		}
	}));


	// LSP
	startLSP();

}

// this method is called when your extension is deactivated
export function deactivate() { }
