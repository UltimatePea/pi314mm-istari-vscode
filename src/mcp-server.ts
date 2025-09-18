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
import { IstariDocument, getIstariDocumentByUri, istariDocuments } from './global';

export class IstariMCPServer {
  private server: Server;
  private httpServer?: http.Server;
  private port: number;
  private isHttpMode: boolean;
  private activeDocumentUri?: string;

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
          name: 'goto_line',
          description: 'Navigate to a specific line in the Istari proof document',
          inputSchema: {
            type: 'object',
            properties: {
              line: {
                type: 'number',
                description: 'The line number to navigate to (1-indexed)',
              },
            },
            required: ['line'],
          },
        },
        {
          name: 'get_current_output',
          description: 'Get the current output from the Istari proof assistant, including goals and messages',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_current_goals',
          description: 'Get the current proof goals',
          inputSchema: {
            type: 'object',
            properties: {
              verbose: {
                type: 'boolean',
                description: 'Whether to show verbose output with full types',
                default: false,
              },
            },
          },
        },
        {
          name: 'list_constants',
          description: 'List all available constants in the current context',
          inputSchema: {
            type: 'object',
            properties: {
              module: {
                type: 'string',
                description: 'Optional module name to filter constants',
              },
            },
          },
        },
        {
          name: 'get_type',
          description: 'Get the type of a constant',
          inputSchema: {
            type: 'object',
            properties: {
              constant: {
                type: 'string',
                description: 'The constant name to get the type of',
              },
            },
            required: ['constant'],
          },
        },
        {
          name: 'get_definition',
          description: 'Get the definition of a constant',
          inputSchema: {
            type: 'object',
            properties: {
              constant: {
                type: 'string',
                description: 'The constant name to get the definition of',
              },
            },
            required: ['constant'],
          },
        },
        {
          name: 'search_constants',
          description: 'Search for constants that mention a target type or constant',
          inputSchema: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: 'The target to search for in constant types',
              },
            },
            required: ['target'],
          },
        },
        {
          name: 'next_line',
          description: 'Process the next line in the Istari proof',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'prev_line',
          description: 'Go back to the previous line in the Istari proof',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'interject',
          description: 'Execute arbitrary IML code',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'The IML code to execute',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'get_document_status',
          description: 'Get the current status of the active Istari document',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_diagnostics',
          description: 'Get diagnostics (errors/warnings) for the current document',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'restart_terminal',
          description: 'Restart the Istari terminal',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'interrupt',
          description: 'Interrupt the current Istari execution',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_documents',
          description: 'List all open Istari documents',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'switch_document',
          description: 'Switch to a different Istari document',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'The filename or URI of the document to switch to',
              },
            },
            required: ['filename'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      // Get the active document
      const activeDoc = this.activeDocumentUri ?
        getIstariDocumentByUri(this.activeDocumentUri) :
        undefined;

      if (!activeDoc) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'No active Istari document. Please open an .ist file first.'
        );
      }

      try {
        switch (name) {
          case 'goto_line':
            return await this.gotoLine(activeDoc, (args as any).line);

          case 'get_current_output':
            return await this.getCurrentOutput(activeDoc);

          case 'get_current_goals':
            return await this.getCurrentGoals(activeDoc, (args as any)?.verbose || false);

          case 'list_constants':
            return await this.listConstants(activeDoc, (args as any)?.module);

          case 'get_type':
            return await this.getType(activeDoc, (args as any).constant);

          case 'get_definition':
            return await this.getDefinition(activeDoc, (args as any).constant);

          case 'search_constants':
            return await this.searchConstants(activeDoc, (args as any).target);

          case 'next_line':
            return await this.nextLine(activeDoc);

          case 'prev_line':
            return await this.prevLine(activeDoc);

          case 'interject':
            return await this.interject(activeDoc, (args as any).code);

          case 'get_document_status':
            return await this.getDocumentStatus(activeDoc);

          case 'get_diagnostics':
            return await this.getDiagnostics(activeDoc);

          case 'restart_terminal':
            return await this.restartTerminal(activeDoc);

          case 'interrupt':
            return await this.interrupt(activeDoc);

          case 'list_documents':
            return await this.listDocuments();

          case 'switch_document':
            return await this.switchDocument((args as any).filename);

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

  public updateDocument(doc: IstariDocument) {
    // Just track the active document if needed
    // The actual state is managed in global.ts
  }

  private async gotoLine(doc: IstariDocument, line: number): Promise<any> {
    doc.ui.requestedLine = line;
    doc.ui.jumpToRequestedLine();

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to line ${line}. Status: ${doc.ui.status}`,
        },
      ],
    };
  }

  private async getCurrentOutput(doc: IstariDocument): Promise<any> {
    const messages = doc.ui.webview?.messageHistory || [];
    const latestMessage = messages[messages.length - 1] || {};

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
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

  private async getCurrentGoals(doc: IstariDocument, verbose: boolean): Promise<any> {
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

  private async listConstants(doc: IstariDocument, module?: string): Promise<any> {
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

  private async getType(doc: IstariDocument, constant: string): Promise<any> {
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

  private async getDefinition(doc: IstariDocument, constant: string): Promise<any> {
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

  private async searchConstants(doc: IstariDocument, target: string): Promise<any> {
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

  private async nextLine(doc: IstariDocument): Promise<any> {
    doc.ui.nextLine();

    return {
      content: [
        {
          type: 'text',
          text: `Moved to next line. Current line: ${doc.ui.currentLine}`,
        },
      ],
    };
  }

  private async prevLine(doc: IstariDocument): Promise<any> {
    doc.ui.prevLine();

    return {
      content: [
        {
          type: 'text',
          text: `Moved to previous line. Current line: ${doc.ui.currentLine}`,
        },
      ],
    };
  }

  private async interject(doc: IstariDocument, code: string): Promise<any> {
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

  private async getDocumentStatus(doc: IstariDocument): Promise<any> {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fileName: doc.document.fileName,
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

  private async getDiagnostics(doc: IstariDocument): Promise<any> {
    const diagnostics = vscode.languages.getDiagnostics(doc.document.uri);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            diagnostics.map(d => ({
              severity: vscode.DiagnosticSeverity[d.severity],
              message: d.message,
              range: {
                start: { line: d.range.start.line + 1, character: d.range.start.character },
                end: { line: d.range.end.line + 1, character: d.range.end.character },
              },
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  private async restartTerminal(doc: IstariDocument): Promise<any> {
    doc.ui.restartIstariTerminal();

    return {
      content: [
        {
          type: 'text',
          text: 'Istari terminal restarted',
        },
      ],
    };
  }

  private async interrupt(doc: IstariDocument): Promise<any> {
    doc.ui.terminal.interrupt();

    return {
      content: [
        {
          type: 'text',
          text: 'Istari execution interrupted',
        },
      ],
    };
  }

  private async listDocuments(): Promise<any> {
    const documents = Array.from(istariDocuments.entries()).map(([uri, doc]) => {
      const isActive = this.activeDocumentUri === uri;

      return {
        id: doc.id,
        uri: uri,
        filename: doc.document.fileName,
        basename: doc.document.fileName.split(/[/\\]/).pop() || doc.document.fileName,
        isActive: isActive,
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
            activeDocument: this.activeDocumentUri
          }, null, 2),
        },
      ],
    };
  }

  private async switchDocument(filename: string): Promise<any> {
    // Try to find by filename or URI
    let targetDoc: IstariDocument | undefined;

    for (const [uri, doc] of istariDocuments.entries()) {
      if (doc.document.fileName === filename || uri === filename) {
        targetDoc = doc;
        break;
      }
    }

    if (!targetDoc) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Document not found: ${filename}`
      );
    }

    this.activeDocumentUri = targetDoc.uri;

    return {
      content: [
        {
          type: 'text',
          text: `Switched to document: ${targetDoc.document.fileName}`,
        },
      ],
    };
  }

  async start() {
    if (this.isHttpMode) {
      this.httpServer = http.createServer((req, res) => {
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