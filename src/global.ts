import * as vscode from 'vscode';
import { IstariUI } from './istari_ui';
import { IstariMCPServer } from './mcp-server';

export interface IstariDocument {
    id: number;
    uri: string;  // Document URI as unique identifier
    ui: IstariUI;
    // Document is not stored - always fetch fresh from workspace by uri
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
        return existingDoc.ui;
    }

    // Verify the TextDocument exists for this URI
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
        ui: ui
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
    // Always fetch document fresh from workspace
    return vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri);
}

export function setMcpServer(server: IstariMCPServer | undefined) {
    mcpServer = server;
}

export async function restartMcpServer() {
    console.log('Restarting MCP server...');

    // Stop current server if it exists
    if (mcpServer) {
        await mcpServer.stop();
        mcpServer = undefined;
    }

    // Start new server
    const newServer = new IstariMCPServer();
    await newServer.start();
    setMcpServer(newServer);

    console.log('MCP server restarted successfully');
}