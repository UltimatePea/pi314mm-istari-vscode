import * as vscode from 'vscode';
import { IstariUI } from './istari_ui';
import { IstariMCPServer } from './mcp-server';

export interface IstariDocument {
    id: number;
    uri: string;  // Document URI as unique identifier
    ui: IstariUI;
    document: vscode.TextDocument;
}

// Track documents by URI for reliable lookup
export let istariDocuments: Map<string, IstariDocument> = new Map();
// Also keep a Map for quick TextDocument lookup (for compatibility)
export let istariUIs: Map<vscode.TextDocument, IstariUI> = new Map();
export let mcpServer: IstariMCPServer | undefined;

let nextDocumentId = 1;

export function getOrCreateIstariUI(document: vscode.TextDocument): IstariUI {
    const uri = document.uri.toString();

    // Check if UI already exists for this URI
    const existingDoc = istariDocuments.get(uri);
    if (existingDoc) {
        // Update the document reference in case it changed
        existingDoc.document = document;
        istariUIs.set(document, existingDoc.ui);
        return existingDoc.ui;
    }

    // Create new UI only if it doesn't exist
    const ui = new IstariUI(document);

    // Create document entry
    const istariDoc: IstariDocument = {
        id: nextDocumentId++,
        uri: uri,
        ui: ui,
        document: document
    };

    // Register in both maps
    istariDocuments.set(uri, istariDoc);
    istariUIs.set(document, ui);

    // Update MCP server if it exists
    if (mcpServer) {
        mcpServer.updateDocument(istariDoc);
    }

    return ui;
}

export function getIstariDocumentByUri(uri: string): IstariDocument | undefined {
    return istariDocuments.get(uri);
}

export function getActiveIstariDocument(): IstariDocument | undefined {
    let editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === "istari") {
        return istariDocuments.get(editor.document.uri.toString());
    }
    return undefined;
}

export function setMcpServer(server: IstariMCPServer | undefined) {
    mcpServer = server;
}

// Legacy compatibility functions
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