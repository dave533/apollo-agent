import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * MCP Client Manager - Connects to external MCP servers
 *
 * Connects to:
 * - Serena (https://github.com/oraios/serena) - Semantic code retrieval/editing
 * - Sequential Thinking (https://github.com/modelcontextprotocol/servers) - Structured problem solving
 */
export class MCPClientManager {
  constructor() {
    this.clients = new Map();
    this.transports = new Map();
  }

  /**
   * Connect to Serena MCP server
   * Uses: uvx --from git+https://github.com/oraios/serena serena start-mcp-server
   */
  async connectSerena(projectPath) {
    this.serenaProjectPath = projectPath || process.cwd();

    const transport = new StdioClientTransport({
      command: 'uvx',
      args: [
        '--from', 'git+https://github.com/oraios/serena',
        'serena', 'start-mcp-server',
        '--project', this.serenaProjectPath,
        '--log-level', 'WARNING',  // Reduce log noise on stdout
        '--enable-web-dashboard', 'false',  // Disable dashboard that might interfere
      ],
      // Pass full environment to ensure Python/uv work correctly
      env: { ...process.env },
      stderr: 'pipe', // Capture stderr to debug issues
    });

    // Handle transport events
    transport.onerror = (error) => {
      console.error('Serena transport error:', error.message);
    };

    transport.onclose = () => {
      console.error('Serena MCP connection closed');
      this.clients.delete('serena');
      this.transports.delete('serena');
    };

    // Log stderr for debugging
    if (transport.stderr) {
      transport.stderr.on('data', (data) => {
        // Only log non-INFO messages (errors/warnings)
        const msg = data.toString();
        if (!msg.includes('INFO') && msg.trim()) {
          console.error('Serena stderr:', msg.trim());
        }
      });
    }

    const client = new Client(
      { name: 'apollo-agent', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    this.clients.set('serena', client);
    this.transports.set('serena', transport);

    return client;
  }

  /**
   * Connect to Sequential Thinking MCP server
   * Uses: npx @modelcontextprotocol/server-sequential-thinking
   */
  async connectSequentialThinking() {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '--quiet', '@modelcontextprotocol/server-sequential-thinking'],
      stderr: 'pipe', // Capture stderr to suppress startup message
    });

    // Consume stderr to prevent it from printing (server prints startup message there)
    const stderrStream = transport.stderr;
    if (stderrStream) {
      stderrStream.on('data', () => {
        // Silently discard - the "Sequential Thinking MCP Server running on stdio" message
      });
    }

    const client = new Client(
      { name: 'apollo-agent', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    this.clients.set('sequential-thinking', client);
    this.transports.set('sequential-thinking', transport);

    return client;
  }

  /**
   * Connect to all MCP servers
   */
  async connectAll(projectPath) {
    const results = { serena: null, sequentialThinking: null, errors: [] };

    try {
      results.serena = await this.connectSerena(projectPath);
    } catch (error) {
      results.errors.push({ server: 'serena', error: error.message });
    }

    try {
      results.sequentialThinking = await this.connectSequentialThinking();
    } catch (error) {
      results.errors.push({ server: 'sequential-thinking', error: error.message });
    }

    return results;
  }

  getClient(name) {
    return this.clients.get(name);
  }

  isConnected(name) {
    return this.clients.has(name);
  }

  /**
   * List all tools from a specific MCP server
   */
  async listTools(serverName) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Not connected to ${serverName}`);
    return await client.listTools();
  }

  /**
   * List all tools from all connected servers
   */
  async listAllTools() {
    const allTools = {};
    for (const [name, client] of this.clients) {
      try {
        const response = await client.listTools();
        allTools[name] = response.tools || [];
      } catch (error) {
        allTools[name] = { error: error.message };
      }
    }
    return allTools;
  }

  /**
   * Sleep helper for retry delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Call a tool on a specific MCP server with retry logic
   * @param {string} serverName - Name of the MCP server
   * @param {string} toolName - Name of the tool to call
   * @param {object} args - Tool arguments
   * @param {object} options - Options including timeout and retries
   */
  async callTool(serverName, toolName, args = {}, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelayMs = options.retryDelayMs || 1000;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let client = this.clients.get(serverName);

        // Attempt reconnection if not connected
        if (!client) {
          if (serverName === 'serena' && this.serenaProjectPath) {
            console.log('Serena disconnected, attempting to reconnect...');
            await this.connectSerena(this.serenaProjectPath);
            client = this.clients.get(serverName);
          } else if (serverName === 'sequential-thinking') {
            console.log('Sequential Thinking disconnected, attempting to reconnect...');
            await this.connectSequentialThinking();
            client = this.clients.get(serverName);
          } else {
            throw new Error(`Not connected to ${serverName}`);
          }
        }

        // Use longer timeout for shell commands (they can take a while)
        const isShellCommand = toolName === 'execute_shell_command';
        const timeout = options.timeout || (isShellCommand ? 120000 : 60000); // 2 min for shell, 1 min default

        return await client.callTool(
          {
            name: toolName,
            arguments: args,
          },
          undefined, // resultSchema - use default
          { timeout }
        );
      } catch (error) {
        lastError = error;
        const isRetryable = error.message.includes('fetch failed') ||
                           error.message.includes('ECONNRESET') ||
                           error.message.includes('ETIMEDOUT') ||
                           error.message.includes('timeout') ||
                           error.message.includes('disconnected');

        if (attempt < maxRetries && isRetryable) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`MCP tool call attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else if (attempt >= maxRetries) {
          throw new Error(`MCP tool '${toolName}' failed after ${attempt} attempts: ${error.message}`);
        } else {
          throw error; // Non-retryable error
        }
      }
    }

    throw lastError;
  }

  /**
   * Sequential Thinking: Record a thought step
   */
  async recordThought({ thought, thoughtNumber, totalThoughts, nextThoughtNeeded, isRevision, revisesThought, branchFromThought, branchId, needsMoreThoughts }) {
    return await this.callTool('sequential-thinking', 'sequential_thinking', {
      thought,
      thoughtNumber,
      totalThoughts,
      nextThoughtNeeded,
      isRevision,
      revisesThought,
      branchFromThought,
      branchId,
      needsMoreThoughts
    });
  }

  /**
   * Serena: Find a symbol in the codebase
   */
  async findSymbol(symbolName) {
    return await this.callTool('serena', 'find_symbol', { symbol_name: symbolName });
  }

  /**
   * Serena: Get symbol definition
   */
  async getSymbolDefinition(symbolName, filePath) {
    return await this.callTool('serena', 'get_symbol_definition', {
      symbol_name: symbolName,
      file_path: filePath
    });
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll() {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error disconnecting from ${name}:`, error.message);
      }
    }
    this.clients.clear();
    this.transports.clear();
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(serverName) {
    const client = this.clients.get(serverName);
    if (client) {
      await client.close();
      this.clients.delete(serverName);
      this.transports.delete(serverName);
    }
  }
}

