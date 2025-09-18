import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import * as http from 'http';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import * as vscode from 'vscode';
import { IstariDocument, getIstariDocumentByUri, istariDocuments, getOrCreateIstariUI } from './global';
import * as IstariHelper from './istari_ui_helper';

export class IstariMCPServer {
  private server: Server;
  private httpServer?: http.Server;
  private port: number;

  constructor(port: number = 47821) {
    this.port = port;
    this.server = new Server(
      {
        name: 'istari-vscode',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'open_document',
          description: 'Open an Istari document and add it to the managed documents',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'The file path to open',
              },
            },
            required: ['file_path'],
          },
        },
        {
          name: 'list_documents',
          description: 'List all open Istari documents with their IDs',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'goto_line',
          description: 'Navigate to a specific line in the Istari proof document',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              line: {
                type: 'number',
                description: 'The line number to navigate to (1-indexed)',
              },
            },
            required: ['document_id', 'line'],
          },
        },
        {
          name: 'show_details',
          description: 'Show current proof state details (equivalent to Prover.detail())',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'list_constants',
          description: 'List all available constants in a specific module',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              module: {
                type: 'string',
                description: 'Module name to list constants from',
              },
            },
            required: ['document_id', 'module'],
          },
        },
        {
          name: 'get_type',
          description: 'Get the type of a constant',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              constant: {
                type: 'string',
                description: 'The constant name to get the type of',
              },
            },
            required: ['document_id', 'constant'],
          },
        },
        {
          name: 'get_definition',
          description: 'Get the definition of a constant',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              constant: {
                type: 'string',
                description: 'The constant name to get the definition of',
              },
            },
            required: ['document_id', 'constant'],
          },
        },
        {
          name: 'search_constants',
          description: 'Search for constants that mention a target type or constant',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              target: {
                type: 'string',
                description: 'The target to search for in constant types',
              },
            },
            required: ['document_id', 'target'],
          },
        },
        {
          name: 'next_line',
          description: 'Process the next line in the Istari proof',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'prev_line',
          description: 'Go back to the previous line in the Istari proof',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'get_document_status',
          description: 'Get the current status of an Istari document',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'get_diagnostics',
          description: 'Get diagnostics (errors/warnings) for a document',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'restart_terminal',
          description: 'Restart the Istari terminal',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'interrupt',
          description: 'Interrupt the current Istari execution',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'restart_mcp_server',
          description: 'Restart the MCP server (kills current server and starts a new one)',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'open_document':
            return await this.openDocument((args as any).file_path);

          case 'list_documents':
            return await this.listDocuments();

          case 'goto_line':
            return await this.gotoLine((args as any).document_id, (args as any).line);

          case 'show_details':
            return await this.showDetails((args as any).document_id);

          case 'list_constants':
            return await this.listConstants((args as any).document_id, (args as any).module);

          case 'get_type':
            return await this.getType((args as any).document_id, (args as any).constant);

          case 'get_definition':
            return await this.getDefinition((args as any).document_id, (args as any).constant);

          case 'search_constants':
            return await this.searchConstants((args as any).document_id, (args as any).target);

          case 'next_line':
            return await this.nextLine((args as any).document_id);

          case 'prev_line':
            return await this.prevLine((args as any).document_id);

          case 'get_document_status':
            return await this.getDocumentStatus((args as any).document_id);

          case 'get_diagnostics':
            return await this.getDiagnostics((args as any).document_id);

          case 'restart_terminal':
            return await this.restartTerminal((args as any).document_id);

          case 'interrupt':
            return await this.interrupt((args as any).document_id);

          case 'restart_mcp_server':
            return await this.restartMcpServer();

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${(error as Error).message}`
        );
      }
    });
  }

  private getDocumentById(id: number): IstariDocument {
    for (const doc of istariDocuments.values()) {
      if (doc.id === id) {
        return doc;
      }
    }
    throw new McpError(ErrorCode.InvalidRequest, `Document with ID ${id} not found`);
  }

  public updateDocument() {
    // No longer needed - documents are managed globally
  }

  private async openDocument(filePath: string): Promise<any> {
    try {
      // Convert file path to URI
      const uri = vscode.Uri.file(filePath);

      // Open the document in VSCode
      const document = await vscode.workspace.openTextDocument(uri);

      if (document.languageId !== 'istari') {
        throw new McpError(ErrorCode.InvalidRequest, `File ${filePath} is not an Istari document`);
      }

      // Create or get the UI for this document
      getOrCreateIstariUI(uri.toString());
      const istariDoc = getIstariDocumentByUri(uri.toString());

      if (!istariDoc) {
        throw new McpError(ErrorCode.InternalError, 'Failed to create Istari document');
      }

      return {
        content: [
          {
            type: 'text',
            text: `Document opened successfully. ID: ${istariDoc.id}, File: ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to open document: ${(error as Error).message}`
      );
    }
  }

  private async gotoLine(documentId: number, line: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = await IstariHelper.gotoLine(doc.ui, line);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async showDetails(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const result = await IstariHelper.showDetails(doc.ui);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  private async listConstants(documentId: number, module: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const result = await IstariHelper.listConstantsModule(doc.ui, module);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  }

  private async getType(documentId: number, constant: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = await IstariHelper.getType(doc.ui, constant);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async getDefinition(documentId: number, constant: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = await IstariHelper.getDefinition(doc.ui, constant);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async searchConstants(documentId: number, target: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = await IstariHelper.searchConstants(doc.ui, target);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async nextLine(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = await IstariHelper.nextLine(doc.ui);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async prevLine(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = await IstariHelper.prevLine(doc.ui);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async getDocumentStatus(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const status = IstariHelper.getDocumentStatus(doc.ui);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: doc.id,
            uri: doc.uri,
            ...status
          }, null, 2),
        },
      ],
    };
  }

  private async getDiagnostics(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const diagnostics = IstariHelper.getDiagnostics(doc.ui);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            documentId: documentId,
            ...diagnostics
          }, null, 2),
        },
      ],
    };
  }

  private async restartTerminal(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = IstariHelper.restartTerminal(doc.ui);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async interrupt(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const output = IstariHelper.interrupt(doc.ui);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async listDocuments(): Promise<any> {
    const documents = Array.from(istariDocuments.entries()).map(([uri, doc]) => {
      return {
        id: doc.id,
        uri: uri,
        filename: doc.document.fileName,
        basename: doc.document.fileName.split(/[/\\]/).pop() || doc.document.fileName,
        status: doc.ui.status,
        currentLine: doc.ui.currentLine,
        totalLines: doc.document.lineCount
      };
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            documents: documents,
            totalDocuments: documents.length,
          }, null, 2),
        },
      ],
    };
  }

  async start() {
    await this.startHttpServer();
  }

  private async startHttpServer() {
    this.httpServer = http.createServer(async (req, res) => {
      // Enable CORS for browser clients
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const mcpRequest = JSON.parse(body);
            const response = await this.handleMcpRequest(mcpRequest);

            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(response));
          } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    return new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.port, 'localhost', () => {
        console.log(`Istari MCP HTTP server started on http://localhost:${this.port}`);
        resolve();
      });

      this.httpServer!.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async handleMcpRequest(request: any): Promise<any> {
    // Handle MCP JSON-RPC 2.0 protocol requests
    try {
      let result;
      switch (request.method) {
        case 'tools/list':
          result = await this.handleListTools();
          break;

        case 'tools/call':
          result = await this.handleCallTool(request.params);
          break;

        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'istari-vscode',
              version: '1.0.0'
            }
          };
          break;

        case 'notifications/initialized':
          result = {};
          break;

        default:
          throw new Error(`Unknown method: ${request.method}`);
      }

      // Return JSON-RPC 2.0 response format
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: result
      };
    } catch (error) {
      // Return JSON-RPC 2.0 error response
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
    }
  }

  private async handleListTools(): Promise<any> {
    // Use the existing server's handler
    const handler = this.server as any;
    const toolsResponse = await handler._requestHandlers.get('tools/list')({
      method: 'tools/list',
      params: {}
    });
    return toolsResponse;
  }

  private async handleCallTool(params: any): Promise<any> {
    // Use the existing server's handler
    const handler = this.server as any;
    const callResponse = await handler._requestHandlers.get('tools/call')({
      method: 'tools/call',
      params: params
    });
    return callResponse;
  }

  private async restartMcpServer(): Promise<any> {
    // Import the global restart function to avoid circular dependencies
    const { restartMcpServer } = require('./global');

    // Schedule restart after sending response
    setTimeout(() => {
      restartMcpServer();
    }, 100);

    return {
      content: [
        {
          type: 'text',
          text: 'MCP server restart initiated. The server will be stopped and restarted momentarily.',
        },
      ],
    };
  }

  async stop() {
    if (this.httpServer) {
      this.httpServer.close();
    }
    await this.server.close();
  }
}