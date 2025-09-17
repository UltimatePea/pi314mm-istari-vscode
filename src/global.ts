import * as vscode from 'vscode';
import { IstariUI } from './istari_ui';
import { IstariMCPServer } from './mcp-server';

export let istariUIs: Map<vscode.TextDocument, IstariUI> = new Map();
export let mcpServer: IstariMCPServer | undefined;

export function setMcpServer(server: IstariMCPServer | undefined) {
    mcpServer = server;
}

export function getIstari(): IstariUI | undefined {
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

export function getIstariForDocument(doc: vscode.TextDocument): IstariUI {
    let istari = istariUIs.get(doc);
    if (!istari) {
        console.error("[e] Istari not found for the current active text file. Try save or reopen this file.", doc.fileName, istariUIs);
        throw new Error("[e] Istari not found for the current active text file. Try save or reopen this file.");
    }
    return istari;
}