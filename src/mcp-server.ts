import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as http from 'http';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import * as vscode from 'vscode';
import { IstariDocument, getIstariDocumentByUri, istariDocuments, getOrCreateIstariUI } from './global';

export class IstariMCPServer {
  private server: Server;
  private httpServer?: http.Server;
  private port: number;
  private isHttpMode: boolean;

  constructor(port: number = 47821, useHttp: boolean = false) {
    this.port = port;
    this.isHttpMode = useHttp;
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
          name: 'get_current_output',
          description: 'Get the current output from the Istari proof assistant',
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
          name: 'get_current_goals',
          description: 'Get the current proof goals',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              verbose: {
                type: 'boolean',
                description: 'Whether to show verbose output with full types',
                default: false,
              },
            },
            required: ['document_id'],
          },
        },
        {
          name: 'list_constants',
          description: 'List all available constants in the current context',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              module: {
                type: 'string',
                description: 'Optional module name to filter constants',
              },
            },
            required: ['document_id'],
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
          name: 'interject',
          description: 'Execute arbitrary IML code',
          inputSchema: {
            type: 'object',
            properties: {
              document_id: {
                type: 'number',
                description: 'The document ID to operate on',
              },
              code: {
                type: 'string',
                description: 'The IML code to execute',
              },
            },
            required: ['document_id', 'code'],
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

          case 'get_current_output':
            return await this.getCurrentOutput((args as any).document_id);

          case 'get_current_goals':
            return await this.getCurrentGoals((args as any).document_id, (args as any)?.verbose || false);

          case 'list_constants':
            return await this.listConstants((args as any).document_id, (args as any)?.module);

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

          case 'interject':
            return await this.interject((args as any).document_id, (args as any).code);

          case 'get_document_status':
            return await this.getDocumentStatus((args as any).document_id);

          case 'get_diagnostics':
            return await this.getDiagnostics((args as any).document_id);

          case 'restart_terminal':
            return await this.restartTerminal((args as any).document_id);

          case 'interrupt':
            return await this.interrupt((args as any).document_id);

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
    doc.ui.requestedLine = line;
    doc.ui.jumpToRequestedLine('mcp');

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to line ${line} in document ${documentId}. Status: ${doc.ui.status}`,
        },
      ],
    };
  }

  private async getCurrentOutput(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const messages = doc.ui.webview?.messageHistory || [];
    const latestMessage = messages[messages.length - 1] || {};

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            documentId: documentId,
            status: doc.ui.status,
            currentLine: doc.ui.currentLine,
            requestedLine: doc.ui.requestedLine,
            output: latestMessage.text || 'No output available',
            taskQueueLength: doc.ui.terminal.tasks.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getCurrentGoals(documentId: number, verbose: boolean): Promise<any> {
    const doc = this.getDocumentById(documentId);
    return new Promise((resolve) => {
      const callback = (data: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: data,
            },
          ],
        });
        return true;
      };

      if (verbose) {
        doc.ui.interjectWithCallback("Goals.printCurrent printLongGoal;", callback);
      } else {
        doc.ui.interjectWithCallback("Goals.printCurrent printGoal;", callback);
      }
    });
  }

  private async listConstants(documentId: number, module?: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    return new Promise((resolve) => {
      const code = module
        ? `Report.listConstants (Symbol.fromValue "${module}");`
        : "Report.listConstants (Symbol.fromValue \"Main\");";

      doc.ui.interjectWithCallback(code, (data: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: data,
            },
          ],
        });
        return true;
      });
    });
  }

  private async getType(documentId: number, constant: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    return new Promise((resolve) => {
      doc.ui.getTypeForConstant(constant, (type: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: type,
            },
          ],
        });
      });
    });
  }

  private async getDefinition(documentId: number, constant: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    return new Promise((resolve) => {
      doc.ui.getTypeAndDefinitionForConstant(constant, (data: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: data,
            },
          ],
        });
      });
    });
  }

  private async searchConstants(documentId: number, target: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    return new Promise((resolve) => {
      doc.ui.interjectWithCallback(
        `Report.search (parseConstants /${target}/) [];`,
        (data: string) => {
          resolve({
            content: [
              {
                type: 'text',
                text: data,
              },
            ],
          });
          return true;
        }
      );
    });
  }

  private async nextLine(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    doc.ui.nextLine();

    return {
      content: [
        {
          type: 'text',
          text: `Moved to next line in document ${documentId}. Current line: ${doc.ui.currentLine}`,
        },
      ],
    };
  }

  private async prevLine(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    doc.ui.prevLine();

    return {
      content: [
        {
          type: 'text',
          text: `Moved to previous line in document ${documentId}. Current line: ${doc.ui.currentLine}`,
        },
      ],
    };
  }

  private async interject(documentId: number, code: string): Promise<any> {
    const doc = this.getDocumentById(documentId);
    return new Promise((resolve) => {
      doc.ui.interjectWithCallback(code, (output: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        });
        return true;
      });
    });
  }

  private async getDocumentStatus(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: doc.id,
            fileName: doc.document.fileName,
            uri: doc.uri,
            status: doc.ui.status,
            currentLine: doc.ui.currentLine,
            requestedLine: doc.ui.requestedLine,
            totalLines: doc.document.lineCount,
            taskQueueLength: doc.ui.terminal.tasks.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getDiagnostics(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    const diagnostics = vscode.languages.getDiagnostics(doc.document.uri);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              documentId: documentId,
              diagnostics: diagnostics.map(d => ({
                severity: vscode.DiagnosticSeverity[d.severity],
                message: d.message,
                range: {
                  start: { line: d.range.start.line + 1, character: d.range.start.character },
                  end: { line: d.range.end.line + 1, character: d.range.end.character },
                },
              }))
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async restartTerminal(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    doc.ui.restartIstariTerminal();

    return {
      content: [
        {
          type: 'text',
          text: `Istari terminal restarted for document ${documentId}`,
        },
      ],
    };
  }

  private async interrupt(documentId: number): Promise<any> {
    const doc = this.getDocumentById(documentId);
    doc.ui.terminal.interrupt();

    return {
      content: [
        {
          type: 'text',
          text: `Istari execution interrupted for document ${documentId}`,
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
    if (this.isHttpMode) {
      this.httpServer = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'MCP server is running' }));
      });

      this.httpServer.listen(this.port, () => {
        console.log(`Istari MCP HTTP server listening on port ${this.port}`);
      });
    } else {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log('Istari MCP server started on stdio');
    }
  }

  async stop() {
    if (this.httpServer) {
      this.httpServer.close();
    }
    await this.server.close();
  }
}