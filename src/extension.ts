import { ChildProcess, spawn } from 'child_process';
import { get } from 'http';
import * as vscode from 'vscode';
import { dirname } from 'path';
import path = require('path');
import { assert, time } from 'console';
import * as fs from 'fs';
import { IstariMCPServer } from './mcp-server';

let istariUIs: Map<vscode.TextDocument, IstariUI> = new Map();
let mcpServer: IstariMCPServer | undefined;

function getIstari(): IstariUI | undefined {
	let editor = vscode.window.activeTextEditor;
	if (editor && editor.document.languageId === "istari") {
		let istari = istariUIs.get(editor.document);
		if (!istari) {
			console.error("[f] Istari not found for the current active text file. Try save or reopen this file.", editor.document.fileName, istariUIs);
			vscode.window.showInformationMessage("[B] Istari not found for the current active text file. Try save or reopen this file.");
		}
		return istari;
	}
	return undefined;
}

function getIstariForDocument(doc: vscode.TextDocument): IstariUI {
	let istari = istariUIs.get(doc);
	if (!istari) {
		console.error("[e] Istari not found for the current active text file. Try save or reopen this file.", doc.fileName, istariUIs);
		throw new Error("[e] Istari not found for the current active text file. Try save or reopen this file.");
	}
	return istari;
}

function registerDoc(doc: vscode.TextDocument, editor: vscode.TextEditor | undefined = undefined) {
	if (doc.languageId === "istari") {
		if (!istariUIs.has(doc)) {
			const ui = new IstariUI(doc);
			istariUIs.set(doc, ui);
			// Set active context in MCP server if it exists
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
			istariUIs.get(doc)?.revealWebview();
		}

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

	vscode.workspace.onDidCloseTextDocument((doc) => {
		istariUIs.delete(doc);
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
			mcpServer = new IstariMCPServer();
			// Set active context if there's an active Istari document
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document.languageId === "istari") {
				const ui = istariUIs.get(activeEditor.document);
				if (ui) {
					mcpServer.setActiveContext(activeEditor.document, ui, ui.terminal);
				}
			}
			mcpServer.start().then(() => {
				vscode.window.showInformationMessage('Istari MCP server started');
			}).catch((error) => {
				vscode.window.showErrorMessage(`Failed to start MCP server: ${error.message}`);
			});
		} else {
			vscode.window.showInformationMessage('MCP server is already running');
		}
	}));

	// LSP
	startLSP();

}

// this method is called when your extension is deactivated
export function deactivate() { }
