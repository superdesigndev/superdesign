import * as vscode from 'vscode';
import { ToolRegistry, ToolResult, ExecutionContext } from '../tools/base-tool';
import { LLMService, LLMServiceConfig, ConversationMessage } from './llm-service';
import { MessageAdapter } from '../utils/message-adapter';


/**
 * Message types for SuperDesign compatibility
 */
export interface SDKMessage {
  type: 'user' | 'assistant' | 'system' | 'result';
  subtype?: string;
  message?: any;
  content?: string;
  session_id?: string;
  parent_tool_use_id?: string;
  duration_ms?: number;
  total_cost_usd?: number;
}

/**
 * Agent options for task execution
 */
export interface AgentOptions {
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
  systemPrompt?: string;
  abortController?: AbortController;
  onMessage?: (message: SDKMessage) => void;
  sessionId?: string;
}

/**
 * Task execution result
 */
export interface TaskResult {
  success: boolean;
  messages: SDKMessage[];
  finalMessage?: string;
  toolsUsed: string[];
  duration: number;
  totalCost?: number;
  error?: string;
}

/**
 * Project analysis result
 */
export interface ProjectAnalysis {
  projectType: string;
  techStack: string[];
  structure: {
    directories: string[];
    files: string[];
    entryPoints: string[];
  };
  dependencies: {
    [key: string]: string;
  };
  scripts: {
    [key: string]: string;
  };
  supportsTypeScript: boolean;
  hasTests: boolean;
  buildSystem: string;
}

/**
 * Agent response for conversation
 */
export interface AgentResponse {
  messages: SDKMessage[];
  isComplete: boolean;
  suggestedActions?: string[];
  context?: any;
}

/**
 * Conversation turn for maintaining context
 */
export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userMessage: string;
  agentResponse: AgentResponse;
  toolResults: ToolResult[];
}

/**
 * Agent session for maintaining conversation context
 */
export interface AgentSession {
  id: string;
  startTime: Date;
  lastActivity: Date;
  projectPath: string;
  turns: ConversationTurn[];
  context: Map<string, any>;
}

/**
 * Core coding agent interface
 */
export interface CodingAgent {
  /**
   * Execute a coding task with streaming support
   */
  executeTaskWithStreaming(
    request: string,
    options?: AgentOptions
  ): Promise<TaskResult>;

  /**
   * Execute a simple coding task
   */
  executeTask(
    request: string,
    projectPath: string,
    options?: AgentOptions
  ): Promise<TaskResult>;

  /**
   * Analyze a codebase and return project information
   */
  analyzeCodbase(projectPath: string): Promise<ProjectAnalysis>;

  /**
   * Continue an existing conversation
   */
  continueConversation(
    message: string,
    conversationId: string,
    options?: AgentOptions
  ): Promise<AgentResponse>;

  /**
   * Get or create a session
   */
  getSession(sessionId: string, projectPath: string): AgentSession;

  /**
   * Clean up old sessions
   */
  cleanupSessions(maxAge?: number): void;

  /**
   * Get available tools
   */
  getAvailableTools(): string[];

  /**
   * Check if agent is ready
   */
  isReady(): boolean;
}

/**
 * SuperDesign specific agent interface extending CodingAgent
 * This matches the ClaudeCodeService interface for drop-in replacement
 */
export interface SuperDesignAgent extends CodingAgent {
  /**
   * Main query method matching ClaudeCodeService interface
   */
  query(
    prompt: string,
    options?: Partial<AgentOptions>,
    abortController?: AbortController,
    onMessage?: (message: SDKMessage) => void
  ): Promise<SDKMessage[]>;

  /**
   * Wait for agent initialization
   */
  waitForInitialization(): Promise<boolean>;

  /**
   * Get the current working directory
   */
  getWorkingDirectory(): string;

  /**
   * Set the working directory
   */
  setWorkingDirectory(path: string): void;

  /**
   * Check if agent is initialized
   */
  readonly isInitialized: boolean;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  workingDirectory: string;
  outputChannel: vscode.OutputChannel;
  toolRegistry: ToolRegistry;
  llmConfig: {
    provider: string;
    model: string;
    apiKey: string;
    maxTokens?: number;
    temperature?: number;
  };
  systemPrompts: {
    default: string;
    design: string;
    coding: string;
  };
  security: {
    allowedPaths: string[];
    restrictToWorkspace: boolean;
  };
}

/**
 * Tool execution context for agents
 */
export interface AgentExecutionContext {
  sessionId: string;
  workingDirectory: string;
  outputChannel: vscode.OutputChannel;
  abortController?: AbortController;
  currentTurn: number;
  maxTurns: number;
  toolRegistry: ToolRegistry;
}

/**
 * Agent factory interface for creating different types of agents
 */
export interface AgentFactory {
  /**
   * Create a custom coding agent
   */
  createCustomAgent(config: AgentConfig): Promise<SuperDesignAgent>;

  /**
   * Create a Claude Code agent wrapper for compatibility
   */
  createClaudeCodeAgent(outputChannel: vscode.OutputChannel): Promise<SuperDesignAgent>;

  /**
   * Get the appropriate agent based on configuration
   */
  getAgent(type: 'custom' | 'claude-code', config?: AgentConfig): Promise<SuperDesignAgent>;
}

/**
 * Events that agents can emit
 */
export interface AgentEvents {
  'task-started': { sessionId: string; task: string };
  'task-completed': { sessionId: string; result: TaskResult };
  'task-failed': { sessionId: string; error: string };
  'tool-executed': { sessionId: string; tool: string; result: ToolResult };
  'message-received': { sessionId: string; message: SDKMessage };
}

/**
 * Agent event emitter interface
 */
export interface AgentEventEmitter {
  on<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): void;
  off<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): void;
  emit<K extends keyof AgentEvents>(event: K, data: AgentEvents[K]): void;
}

/**
 * Base agent implementation class
 */
export abstract class BaseAgent implements SuperDesignAgent {
  protected config: AgentConfig;
  protected sessions = new Map<string, AgentSession>();
  protected isInitializedFlag = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  // Abstract methods that must be implemented
  abstract executeTaskWithStreaming(request: string, options?: AgentOptions): Promise<TaskResult>;
  abstract executeTask(request: string, projectPath: string, options?: AgentOptions): Promise<TaskResult>;
  abstract query(prompt: string, options?: Partial<AgentOptions>, abortController?: AbortController, onMessage?: (message: SDKMessage) => void): Promise<SDKMessage[]>;

  // Concrete implementations
  async analyzeCodbase(projectPath: string): Promise<ProjectAnalysis> {
    // Default implementation - can be overridden
    const fs = require('fs');
    const path = require('path');

    const analysis: ProjectAnalysis = {
      projectType: 'unknown',
      techStack: [],
      structure: { directories: [], files: [], entryPoints: [] },
      dependencies: {},
      scripts: {},
      supportsTypeScript: false,
      hasTests: false,
      buildSystem: 'unknown'
    };

    try {
      // Check for package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        analysis.dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        analysis.scripts = packageJson.scripts || {};
        analysis.projectType = 'node';
        
        // Detect tech stack
        if (analysis.dependencies['react']) {
          analysis.techStack.push('React');
        }
        if (analysis.dependencies['vue']) {
          analysis.techStack.push('Vue');
        }
        if (analysis.dependencies['angular']) {
          analysis.techStack.push('Angular');
        }
        if (analysis.dependencies['typescript']) {
          analysis.techStack.push('TypeScript');
          analysis.supportsTypeScript = true;
        }
      }

      // Check for tests
      analysis.hasTests = fs.existsSync(path.join(projectPath, 'test')) ||
                        fs.existsSync(path.join(projectPath, 'tests')) ||
                        fs.existsSync(path.join(projectPath, '__tests__'));

    } catch (error) {
      this.config.outputChannel.appendLine(`[Agent] Error analyzing project: ${error}`);
    }

    return analysis;
  }

  async continueConversation(message: string, conversationId: string, options?: AgentOptions): Promise<AgentResponse> {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`Session ${conversationId} not found`);
    }

    // Update session activity
    session.lastActivity = new Date();

    // Execute the task and convert to AgentResponse
    const result = await this.executeTaskWithStreaming(message, {
      ...options,
      sessionId: conversationId
    });

    const response: AgentResponse = {
      messages: result.messages,
      isComplete: result.success,
      suggestedActions: result.success ? [] : ['retry', 'clarify'],
      context: session.context
    };

    // Add turn to session
    const turn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      timestamp: new Date(),
      userMessage: message,
      agentResponse: response,
      toolResults: []
    };

    session.turns.push(turn);

    return response;
  }

  getSession(sessionId: string, projectPath: string): AgentSession {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        id: sessionId,
        startTime: new Date(),
        lastActivity: new Date(),
        projectPath,
        turns: [],
        context: new Map()
      };
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  cleanupSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > maxAge) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getAvailableTools(): string[] {
    return this.config.toolRegistry.getAllTools().map(tool => tool.name);
  }

  isReady(): boolean {
    return this.isInitializedFlag;
  }

  async waitForInitialization(): Promise<boolean> {
    // Simple implementation - can be enhanced with proper Promise-based waiting
    return this.isInitializedFlag;
  }

  getWorkingDirectory(): string {
    return this.config.workingDirectory;
  }

  setWorkingDirectory(path: string): void {
    this.config.workingDirectory = path;
  }

  get isInitialized(): boolean {
    return this.isInitializedFlag;
  }

  protected setInitialized(value: boolean): void {
    this.isInitializedFlag = value;
  }
}

/**
 * SuperDesign Coding Agent - Full implementation with tool integration
 */
export class SuperDesignCodingAgent extends BaseAgent {
  private llmService: LLMService;
  private conversationHistory = new Map<string, ConversationMessage[]>();

  constructor(config: AgentConfig) {
    super(config);
    
    // Initialize LLM service with config (tools will be set per request)
    const llmConfig: LLMServiceConfig = {
      provider: {
        name: config.llmConfig.provider as any,
        model: config.llmConfig.model,
        apiKey: config.llmConfig.apiKey
      },
      maxTokens: config.llmConfig.maxTokens || 4000,
      temperature: config.llmConfig.temperature || 0.7,
      systemPrompt: this.getSystemPrompt(),
      tools: [] // Will be set per request with proper session context
    };

    this.llmService = new LLMService(llmConfig, config.outputChannel);
    
    this.config.outputChannel.appendLine('[SuperDesignAgent] Initialized with tool integration');
    this.setInitialized(true);
  }

  /**
   * Main query method matching ClaudeCodeService interface
   */
  async query(
    prompt: string,
    options?: Partial<AgentOptions>,
    abortController?: AbortController,
    onMessage?: (message: SDKMessage) => void
  ): Promise<SDKMessage[]> {
    const sessionId = options?.sessionId || `session-${Date.now()}`;
    
    try {
      this.config.outputChannel.appendLine(`[SuperDesignAgent] Processing query: ${prompt.substring(0, 100)}...`);
      
      const result = await this.executeTaskWithStreaming(prompt, {
        ...options,
        sessionId,
        abortController,
        onMessage
      });

      return result.messages;
      
    } catch (error) {
      this.config.outputChannel.appendLine(`[SuperDesignAgent] Error in query: ${error}`);
      
      const errorMessage = MessageAdapter.createErrorMessage(
        error instanceof Error ? error : new Error(String(error)),
        sessionId
      );
      
      return [errorMessage];
    }
  }

  /**
   * Execute a task with streaming and tool integration
   */
  async executeTaskWithStreaming(
    request: string,
    options?: AgentOptions
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const sessionId = options?.sessionId || `session-${Date.now()}`;
    const maxTurns = options?.maxTurns || 10;
    
    const messages: SDKMessage[] = [];
    const toolsUsed: string[] = [];
    let currentTurn = 0;
    
    try {
      // Get or create conversation history for this session
      if (!this.conversationHistory.has(sessionId)) {
        this.conversationHistory.set(sessionId, []);
      }
      
      const history = this.conversationHistory.get(sessionId)!;
      
      // Add user message to history
      const userMessage: ConversationMessage = {
        role: 'user',
        content: request,
        timestamp: new Date()
      };
      history.push(userMessage);

      // Add user message to response
      messages.push(MessageAdapter.createUserMessage(request, sessionId));
      
      // Generate response with tools (Vercel AI SDK handles tool execution automatically)
      const llmResponse = await this.generateWithTools(history, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        maxSteps: options?.maxSteps || 25, // Default to 25 steps for multi-step tool calling
        abortController: options?.abortController,
        onMessage: options?.onMessage,
        sessionId
      });

      // Add assistant response to history if there's content
      if (llmResponse.content) {
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: llmResponse.content,
          timestamp: new Date()
        };
        history.push(assistantMessage);
        
        // Add to messages
        messages.push(MessageAdapter.createAssistantMessage(
          llmResponse.content,
          sessionId,
          { duration: Date.now() - startTime }
        ));
      }

      // Process tool calls and results from Vercel AI SDK steps
      if (llmResponse.steps && llmResponse.steps.length > 0) {
        for (const step of llmResponse.steps) {
          // Process tool calls in this step
          if (step.toolCalls) {
            for (const toolCall of step.toolCalls) {
              this.config.outputChannel.appendLine(`[DEBUG] Tool call structure: ${JSON.stringify(toolCall, null, 2)}`);
              
              const toolName = toolCall.toolName || toolCall.function?.name || toolCall.name || 'unknown';
              toolsUsed.push(toolName);
              
              // Add tool call message
              const toolCallMessage = MessageAdapter.createToolCallMessage({
                toolCallId: toolCall.toolCallId || toolCall.id,
                toolName: toolName,
                args: toolCall.args || toolCall.function?.arguments
              }, sessionId);
              messages.push(toolCallMessage);
              
              if (options?.onMessage) {
                options.onMessage(toolCallMessage);
              }
            }
          }
          
          // Process tool results in this step
          if (step.toolResults) {
            for (const toolResult of step.toolResults) {
              // Add tool result message
              const toolResultMessage = MessageAdapter.createToolResultMessage(toolResult, sessionId);
              messages.push(toolResultMessage);
              
              if (options?.onMessage) {
                options.onMessage(toolResultMessage);
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      const totalCost = MessageAdapter.calculateTotalCost(messages);

      this.config.outputChannel.appendLine(
        `[SuperDesignAgent] Task completed in ${duration}ms using ${toolsUsed.length} tools`
      );

      // Find the final LLM response message (not tool results)
      let finalMessage = llmResponse.content || '';
      if (!finalMessage) {
        // If LLM didn't provide final text, use the last assistant message
        const lastAssistantMessage = messages.slice().reverse().find(m => m.type === 'assistant' && !m.subtype);
        finalMessage = lastAssistantMessage?.content || 'Task completed';
      }

      return {
        success: true,
        messages,
        finalMessage,
        toolsUsed: [...new Set(toolsUsed)],
        duration,
        totalCost
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.config.outputChannel.appendLine(`[SuperDesignAgent] Task failed: ${errorMessage}`);
      
      messages.push(MessageAdapter.createErrorMessage(errorMessage, sessionId));
      
      return {
        success: false,
        messages,
        finalMessage: errorMessage,
        toolsUsed: [...new Set(toolsUsed)],
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * Execute a simple task without streaming
   */
  async executeTask(
    request: string,
    projectPath: string,
    options?: AgentOptions
  ): Promise<TaskResult> {
    // Update working directory if provided
    if (projectPath !== this.config.workingDirectory) {
      this.setWorkingDirectory(projectPath);
    }

    return await this.executeTaskWithStreaming(request, options);
  }

  /**
   * Generate LLM response with tool support
   */
  private async generateWithTools(
    history: ConversationMessage[],
    options: {
      maxTokens?: number;
      temperature?: number;
      maxSteps?: number;
      abortController?: AbortController;
      onMessage?: (message: SDKMessage) => void;
      sessionId: string;
    }
  ): Promise<{ content: string; toolCalls?: any[]; toolResults?: any[]; steps?: any[] }> {
    try {
      // Use the LLM service with our conversation history and session-specific tools
      const response = await this.llmService.generateResponse(history, {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        maxSteps: options.maxSteps || 25, // Default to 25 steps for multi-step tool calling
        tools: this.createToolSchemas(options.sessionId)
      });

      return {
        content: response.content,
        toolCalls: response.toolCalls || [],
        toolResults: response.toolResults || [],
        steps: response.steps || []
      };
      
    } catch (error) {
      this.config.outputChannel.appendLine(`[SuperDesignAgent] Error generating response: ${error}`);
      throw error;
    }
  }



  /**
   * Create tool schemas for LLM function calling using the registry
   */
  private createToolSchemas(sessionId: string = 'default'): { [name: string]: any } {
    // Create execution context for tools
    const context: ExecutionContext = {
      workingDirectory: this.config.workingDirectory,
      outputChannel: this.config.outputChannel,
      sessionId: sessionId
    };
    
    // Use the registry's built-in conversion to Vercel AI SDK format
    return this.config.toolRegistry.getVercelAITools(context);
  }

  /**
   * Get SuperDesign-specific system prompt
   */
  private getSystemPrompt(): string {
    return this.config.systemPrompts.design || `
# SuperDesign Coding Agent

You are a senior front-end designer and developer working with SuperDesign.
You pay close attention to every pixel, spacing, font, color.

## Available Tools:
${this.getAvailableTools().map(tool => `- ${tool}`).join('\n')}

## Core Principles:
1. Always understand before acting - analyze existing code patterns
2. Follow project conventions and coding standards  
3. Use tools systematically: analyze → plan → implement → verify
4. Provide clear explanations of your actions
5. Focus on elegant, modern UI design with perfect balance between minimalism and functionality

## SuperDesign Workflow:
1. Create design files in .superdesign/design_iterations/ directory
2. Use naming convention: {design_name}_{variation}.html
3. Generate 3 variations when creating designs
4. Use soft, refreshing gradient colors
5. Implement responsive, accessible designs

## Tool Usage:
- Use 'read' to examine existing files and patterns
- Use 'write' to create new design files
- Use 'edit' to modify existing designs
- Use 'multiedit' for creating multiple design variations
- Use 'ls', 'grep', 'glob' to explore project structure
- Use 'bash' for running commands and tests

Always start by understanding the project context, then plan your approach, implement changes, and verify results.
    `.trim();
  }
}

/**
 * Claude Code Agent wrapper to maintain compatibility
 */
export class ClaudeCodeAgentWrapper implements SuperDesignAgent {
  private claudeCodeService: any;
  private outputChannel: vscode.OutputChannel;
  private workingDirectory: string;
  private isInitializedFlag = false;

  constructor(claudeCodeService: any, outputChannel: vscode.OutputChannel, workingDirectory: string = '') {
    this.claudeCodeService = claudeCodeService;
    this.outputChannel = outputChannel;
    this.workingDirectory = workingDirectory;
    this.isInitializedFlag = true;
    
    this.outputChannel.appendLine('[ClaudeCodeWrapper] Initialized wrapper for Claude Code service');
  }

  async query(
    prompt: string,
    options?: Partial<AgentOptions>,
    abortController?: AbortController,
    onMessage?: (message: SDKMessage) => void
  ): Promise<SDKMessage[]> {
    try {
      this.outputChannel.appendLine(`[ClaudeCodeWrapper] Delegating query to Claude Code: ${prompt.substring(0, 100)}...`);
      
      // Delegate to the existing Claude Code service
      return await this.claudeCodeService.query(prompt, options, abortController, onMessage);
      
    } catch (error) {
      this.outputChannel.appendLine(`[ClaudeCodeWrapper] Error in Claude Code query: ${error}`);
      throw error;
    }
  }

  async executeTaskWithStreaming(request: string, options?: AgentOptions): Promise<TaskResult> {
    // Convert to Claude Code format
    const messages = await this.query(request, options, options?.abortController, options?.onMessage);
    
    return {
      success: true,
      messages,
      finalMessage: messages[messages.length - 1]?.content,
      toolsUsed: [],
      duration: 0
    };
  }

  async executeTask(request: string, projectPath: string, options?: AgentOptions): Promise<TaskResult> {
    if (projectPath !== this.workingDirectory) {
      this.setWorkingDirectory(projectPath);
    }
    
    return await this.executeTaskWithStreaming(request, options);
  }

  async analyzeCodbase(projectPath: string): Promise<ProjectAnalysis> {
    // Basic analysis - Claude Code doesn't expose this directly
    return {
      projectType: 'unknown',
      techStack: [],
      structure: { directories: [], files: [], entryPoints: [] },
      dependencies: {},
      scripts: {},
      supportsTypeScript: false,
      hasTests: false,
      buildSystem: 'unknown'
    };
  }

  async continueConversation(message: string, conversationId: string, options?: AgentOptions): Promise<AgentResponse> {
    const result = await this.executeTaskWithStreaming(message, { ...options, sessionId: conversationId });
    
    return {
      messages: result.messages,
      isComplete: result.success,
      suggestedActions: result.success ? [] : ['retry', 'clarify'],
      context: {}
    };
  }

  getSession(sessionId: string, projectPath: string): AgentSession {
    return {
      id: sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      projectPath,
      turns: [],
      context: new Map()
    };
  }

  cleanupSessions(maxAge?: number): void {
    // No-op for Claude Code wrapper
  }

  getAvailableTools(): string[] {
    return ['Claude Code Built-in Tools'];
  }

  isReady(): boolean {
    return this.isInitializedFlag;
  }

  async waitForInitialization(): Promise<boolean> {
    return this.isInitializedFlag;
  }

  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  setWorkingDirectory(path: string): void {
    this.workingDirectory = path;
  }

  get isInitialized(): boolean {
    return this.isInitializedFlag;
  }
}

 