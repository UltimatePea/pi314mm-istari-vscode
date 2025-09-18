import * as vscode from 'vscode';
import { IstariUI } from './istari_ui';
import { IstariMCPServer } from './mcp-server';

export interface IstariDocument {
    id: number;
    uri: string;  // Document URI as unique identifier
    ui: IstariUI;
    document: vscode.TextDocument;
}

// Track documents by URI
export let istariDocuments: Map<string, IstariDocument> = new Map();
export let mcpServer: IstariMCPServer | undefined;
export let currentIstariUri: string | undefined;

let nextDocumentId = 1;

export function getOrCreateIstariUI(uri: string): IstariUI {
    // Check if UI already exists for this URI
    const existingDoc = istariDocuments.get(uri);
    if (existingDoc) {
        // Refresh the TextDocument reference
        const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri);
        if (document) {
            existingDoc.document = document;
        }
        return existingDoc.ui;
    }

    // Find the TextDocument for this URI
    const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri);
    if (!document) {
        throw new Error(`Document not found for URI: ${uri}`);
    }

    // Create new UI only if it doesn't exist
    const ui = new IstariUI(uri);

    // Create document entry
    const istariDoc: IstariDocument = {
        id: nextDocumentId++,
        uri: uri,
        ui: ui,
        document: document
    };

    // Register document
    istariDocuments.set(uri, istariDoc);

    // Update MCP server if it exists
    if (mcpServer) {
        mcpServer.updateDocument();
    }

    return ui;
}

export function getIstariDocumentByUri(uri: string): IstariDocument | undefined {
    return istariDocuments.get(uri);
}

export function getCurrentIstari(): IstariUI | undefined {
    if (currentIstariUri) {
        return getIstariByUri(currentIstariUri);
    }
    // No current Istari document selected
    // issue a warning notification
    vscode.window.showWarningMessage('No Istari document selected');
    return undefined;
}

export function setCurrentIstariUri(uri: string): void {
    if (istariDocuments.has(uri)) {
        currentIstariUri = uri;
    }
}

export function getIstariByUri(uri: string): IstariUI | undefined {
    const istariDoc = istariDocuments.get(uri);
    return istariDoc?.ui;
}

export function getDocumentByUri(uri: string): vscode.TextDocument | undefined {
    const istariDoc = istariDocuments.get(uri);
    return istariDoc?.document;
}

export function setMcpServer(server: IstariMCPServer | undefined) {
    mcpServer = server;
}