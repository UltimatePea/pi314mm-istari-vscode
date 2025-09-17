import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import * as vscode from 'vscode';
import { IstariTerminal, IstariUI } from './extension';

interface IstariMCPState {
  activeDocument?: vscode.TextDocument;
  activeUI?: IstariUI;
  activeTerminal?: IstariTerminal;
}

interface IstariWebview {
  messages: any[];
}

interface ExtendedIstariUI {
  status: string;
  currentLine: number;
  requestedLine: number;
  terminal: IstariTerminal;
  webview?: IstariWebview;
  interjectWithCallback(text: string, callback: (data: string) => boolean): void;
  jumpToRequestedLine(): void;
  restartIstariTerminal(): void;
  nextLine(): void;
  prevLine(): void;
}

export class IstariMCPServer {
  private server: Server;
  private state: IstariMCPState = {};

  constructor() {
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
                description: 'The name of the constant to query',
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
                description: 'The name of the constant to query',
              },
            },
            required: ['constant'],
          },
        },
        {
          name: 'search_constants',
          description: 'Search for constants mentioning a specific target',
          inputSchema: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: 'The target to search for in constant definitions',
              },
            },
            required: ['target'],
          },
        },
        {
          name: 'next_line',
          description: 'Move to the next line in the proof',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'prev_line',
          description: 'Move to the previous line in the proof',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'interject',
          description: 'Execute arbitrary IML code in the current proof context',
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
          description: 'Get the current status of the document including line numbers and verification state',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_diagnostics',
          description: 'Get current diagnostics (errors, warnings) for the document',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'restart_terminal',
          description: 'Restart the Istari REPL',
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.state.activeDocument || !this.state.activeUI || !this.state.activeTerminal) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'No active Istari document. Please open an .ist file first.'
        );
      }

      try {
        switch (name) {
          case 'goto_line':
            return await this.gotoLine((args as any).line);

          case 'get_current_output':
            return await this.getCurrentOutput();

          case 'get_current_goals':
            return await this.getCurrentGoals((args as any)?.verbose || false);

          case 'list_constants':
            return await this.listConstants((args as any)?.module);

          case 'get_type':
            return await this.getType((args as any).constant);

          case 'get_definition':
            return await this.getDefinition((args as any).constant);

          case 'search_constants':
            return await this.searchConstants((args as any).target);

          case 'next_line':
            return await this.nextLine();

          case 'prev_line':
            return await this.prevLine();

          case 'interject':
            return await this.interject((args as any).code);

          case 'get_document_status':
            return await this.getDocumentStatus();

          case 'get_diagnostics':
            return await this.getDiagnostics();

          case 'restart_terminal':
            return await this.restartTerminal();

          case 'interrupt':
            return await this.interrupt();

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

  public setActiveContext(document: vscode.TextDocument, ui: IstariUI, terminal: IstariTerminal) {
    this.state.activeDocument = document;
    this.state.activeUI = ui;
    this.state.activeTerminal = terminal;
  }

  private async gotoLine(line: number): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;
    extUI.requestedLine = line;
    extUI.jumpToRequestedLine();

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to line ${line}. Status: ${extUI.status}`,
        },
      ],
    };
  }

  private async getCurrentOutput(): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;
    const messages = extUI.webview?.messages || [];
    const latestMessage = messages[messages.length - 1] || {};

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: extUI.status,
            currentLine: extUI.currentLine + 1,
            requestedLine: extUI.requestedLine + 1,
            output: latestMessage.text || 'No output available',
            taskQueueLength: extUI.terminal.tasks.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getCurrentGoals(verbose: boolean): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;

    return new Promise((resolve) => {
      const command = verbose ? 'Prover.showFull ()' : 'Prover.show ()';
      extUI.interjectWithCallback(command, (output: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: output || 'No goals to display',
            },
          ],
        });
        return true;
      });
    });
  }

  private async listConstants(module?: string): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;

    return new Promise((resolve) => {
      const command = module
        ? `Report.showModule (parseLongident /${module}/)`
        : 'Report.showAll ()';

      extUI.interjectWithCallback(command, (output: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: output || 'No constants found',
            },
          ],
        });
        return true;
      });
    });
  }

  private async getType(constant: string): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;

    return new Promise((resolve) => {
      extUI.interjectWithCallback(`Report.showType (parseLongident /${constant}/)`, (output: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: output || `Type not found for ${constant}`,
            },
          ],
        });
        return true;
      });
    });
  }

  private async getDefinition(constant: string): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;

    return new Promise((resolve) => {
      extUI.interjectWithCallback(`Report.show (parseLongident /${constant}/)`, (output: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: output || `Definition not found for ${constant}`,
            },
          ],
        });
        return true;
      });
    });
  }

  private async searchConstants(target: string): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;

    return new Promise((resolve) => {
      extUI.interjectWithCallback(`Report.search (parseConstants /${target}/) []`, (output: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: output || `No constants found mentioning ${target}`,
            },
          ],
        });
        return true;
      });
    });
  }

  private async nextLine(): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    activeUI.nextLine();

    return {
      content: [
        {
          type: 'text',
          text: `Moved to line ${activeUI.currentLine + 1}. Ready`,
        },
      ],
    };
  }

  private async prevLine(): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    activeUI.prevLine();

    return {
      content: [
        {
          type: 'text',
          text: `Moved to line ${activeUI.currentLine + 1}. Ready`,
        },
      ],
    };
  }

  private async interject(code: string): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;

    return new Promise((resolve) => {
      extUI.interjectWithCallback(code, (output: string) => {
        resolve({
          content: [
            {
              type: 'text',
              text: output || 'Command executed',
            },
          ],
        });
        return true;
      });
    });
  }

  private async getDocumentStatus(): Promise<any> {
    const { activeUI, activeDocument } = this.state;
    if (!activeUI || !activeDocument) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI or document');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fileName: activeDocument.fileName,
            status: activeUI.status,
            currentLine: activeUI.currentLine + 1,
            requestedLine: activeUI.requestedLine + 1,
            totalLines: activeDocument.lineCount,
            taskQueueLength: activeUI.terminal.tasks.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getDiagnostics(): Promise<any> {
    const { activeDocument } = this.state;
    if (!activeDocument) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active document');
    }

    const diagnostics = vscode.languages.getDiagnostics(activeDocument.uri);

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

  private async restartTerminal(): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    const extUI = activeUI as ExtendedIstariUI;
    extUI.restartIstariTerminal();

    return {
      content: [
        {
          type: 'text',
          text: 'Istari terminal restarted',
        },
      ],
    };
  }

  private async interrupt(): Promise<any> {
    const { activeUI } = this.state;
    if (!activeUI) {
      throw new McpError(ErrorCode.InvalidRequest, 'No active UI');
    }

    activeUI.terminal.interrupt();

    return {
      content: [
        {
          type: 'text',
          text: 'Istari execution interrupted',
        },
      ],
    };
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Istari MCP server started');
  }
}

export function startMCPServer() {
  const server = new IstariMCPServer();
  server.start().catch(console.error);
  return server;
}