import * as vscode from 'vscode';
import { ClaudeCodeService } from '../services/claudeCodeService';
import { SuperDesignCodingAgent, AgentConfig } from './agent';
import { SuperDesignToolRegistry } from '../tools/registry';

// Common interface that both agents implement
export interface CodingAgentService {
  query(
    prompt: string, 
    options?: any, 
    abortController?: AbortController,
    onMessage?: (message: any) => void
  ): Promise<any[]>;
  
  readonly isReady: boolean;
  waitForInitialization(): Promise<boolean>;
  getWorkingDirectory(): string;
}

// Wrapper to make SuperDesignCodingAgent compatible with the service interface
class SuperDesignAgentWrapper implements CodingAgentService {
  private agent: SuperDesignCodingAgent;
  private outputChannel: vscode.OutputChannel;
  
  constructor(agent: SuperDesignCodingAgent, outputChannel: vscode.OutputChannel) {
    this.agent = agent;
    this.outputChannel = outputChannel;
  }

  async query(
    prompt: string, 
    options?: any, 
    abortController?: AbortController,
    onMessage?: (message: any) => void
  ): Promise<any[]> {
    this.outputChannel.appendLine(`🤖 SuperDesignAgentWrapper: Executing query with SuperDesign custom agent`);
    this.outputChannel.appendLine(`🤖 SuperDesignAgentWrapper: Prompt preview: "${prompt.substring(0, 100)}..."`);
    
    // Delegate directly to the SuperDesign agent's query method
    const result = await this.agent.query(prompt, options, abortController, onMessage);
    
    this.outputChannel.appendLine(`✅ SuperDesignAgentWrapper: Query completed with ${result.length} messages`);
    return result;
  }

  get isReady(): boolean {
    return this.agent.isInitialized;
  }

  async waitForInitialization(): Promise<boolean> {
    return await this.agent.waitForInitialization();
  }

  getWorkingDirectory(): string {
    return this.agent.getWorkingDirectory();
  }
}

// Wrapper to make ClaudeCodeService compatible with the service interface
class ClaudeCodeAgentWrapper implements CodingAgentService {
  private service: ClaudeCodeService;
  private outputChannel: vscode.OutputChannel;
  
  constructor(service: ClaudeCodeService, outputChannel: vscode.OutputChannel) {
    this.service = service;
    this.outputChannel = outputChannel;
  }

  async query(
    prompt: string, 
    options?: any, 
    abortController?: AbortController,
    onMessage?: (message: any) => void
  ): Promise<any[]> {
    this.outputChannel.appendLine(`🏛️ ClaudeCodeAgentWrapper: Executing query with Claude Code agent`);
    this.outputChannel.appendLine(`🏛️ ClaudeCodeAgentWrapper: Prompt preview: "${prompt.substring(0, 100)}..."`);
    
    const result = await this.service.query(prompt, options, abortController, onMessage);
    
    this.outputChannel.appendLine(`✅ ClaudeCodeAgentWrapper: Query completed with ${result.length} messages`);
    return result;
  }

  get isReady(): boolean {
    return this.service.isReady;
  }

  async waitForInitialization(): Promise<boolean> {
    return await this.service.waitForInitialization();
  }

  getWorkingDirectory(): string {
    return this.service.getWorkingDirectory();
  }
}

export class AgentFactory {
  private static instance: AgentFactory;
  private outputChannel: vscode.OutputChannel;
  private currentAgent: CodingAgentService | null = null;

  private constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  static getInstance(outputChannel: vscode.OutputChannel): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory(outputChannel);
    }
    return AgentFactory.instance;
  }

  /**
   * Create an agent based on VS Code configuration
   */
  async createAgent(): Promise<CodingAgentService> {
    const config = vscode.workspace.getConfiguration('superdesign');
    const agentProvider = config.get<string>('agentProvider', 'claude-code');

    this.outputChannel.appendLine(`🔧 AgentFactory: Creating agent with provider: ${agentProvider}`);
    this.outputChannel.appendLine(`🔧 AgentFactory: Raw config value: ${JSON.stringify(config.get('agentProvider'))}`);

    try {
      if (agentProvider === 'custom') {
        this.outputChannel.appendLine(`🔧 AgentFactory: Routing to SuperDesign custom agent`);
        const agent = await this.createSuperDesignAgent();
        this.outputChannel.appendLine(`✅ AgentFactory: SuperDesign agent created successfully`);
        return agent;
      } else {
        this.outputChannel.appendLine(`🔧 AgentFactory: Routing to Claude Code agent`);
        const agent = await this.createClaudeCodeAgent();
        this.outputChannel.appendLine(`✅ AgentFactory: Claude Code agent created successfully`);
        return agent;
      }
    } catch (error) {
      this.outputChannel.appendLine(`Failed to create ${agentProvider} agent: ${error}`);
      
      // Fallback to Claude Code if SuperDesign agent fails
      if (agentProvider === 'custom') {
        this.outputChannel.appendLine('Falling back to Claude Code agent...');
        vscode.window.showWarningMessage(
          'Failed to initialize custom coding agent, falling back to Claude Code.',
          'Open Settings'
        ).then(action => {
          if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'superdesign.agentProvider');
          }
        });
        return await this.createClaudeCodeAgent();
      }
      
      throw error;
    }
  }

  /**
   * Get the current agent or create one if none exists
   */
  async getOrCreateAgent(): Promise<CodingAgentService> {
    if (!this.currentAgent) {
      this.currentAgent = await this.createAgent();
    }
    return this.currentAgent;
  }

  /**
   * Switch agent provider based on current configuration
   */
  async switchAgent(): Promise<CodingAgentService> {
    const config = vscode.workspace.getConfiguration('superdesign');
    const agentProvider = config.get<string>('agentProvider', 'claude-code');
    
    this.outputChannel.appendLine(`🔄 AgentFactory: Switching to agent provider: ${agentProvider}`);
    this.outputChannel.appendLine(`🔄 AgentFactory: Previous agent was: ${this.currentAgent ? 'active' : 'null'}`);
    
    this.currentAgent = null; // Reset current agent
    this.currentAgent = await this.createAgent();
    
    this.outputChannel.appendLine(`✅ AgentFactory: Agent switch completed successfully`);
    return this.currentAgent;
  }

  private async createSuperDesignAgent(): Promise<CodingAgentService> {
    this.outputChannel.appendLine('Creating SuperDesign custom coding agent...');

    // Get API keys from configuration
    const config = vscode.workspace.getConfiguration('superdesign');
    const openaiApiKey = config.get<string>('openaiApiKey');
    const anthropicApiKey = config.get<string>('anthropicApiKey');

    // Debug: Log available keys (masked for security)
    this.outputChannel.appendLine(`🔍 Available API keys: OpenAI=${openaiApiKey ? 'configured' : 'missing'}, Anthropic=${anthropicApiKey ? 'configured' : 'missing'}`);

    if (!openaiApiKey && !anthropicApiKey) {
      throw new Error('At least one API key (OpenAI or Anthropic) is required for custom coding agent');
    }

    // Setup working directory
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace folder found. Please open a workspace first.');
    }

    const workingDirectory = workspaceRoot;

    // Choose provider based on available keys - prefer Anthropic if both are available
    let provider: string;
    let apiKey: string;
    let model: string;

    if (anthropicApiKey) {
      provider = 'anthropic';
      apiKey = anthropicApiKey;
      model = 'claude-3-5-sonnet-20241022';
      this.outputChannel.appendLine(`🎯 Selected provider: Anthropic (Claude)`);
    } else if (openaiApiKey) {
      provider = 'openai';
      apiKey = openaiApiKey;
      model = 'gpt-4o';
      this.outputChannel.appendLine(`🎯 Selected provider: OpenAI (GPT)`);
    } else {
      throw new Error('No valid API key found for any supported provider');
    }

    // Debug: Confirm the final API key is set
    this.outputChannel.appendLine(`🔐 API key for ${provider}: ${apiKey ? 'configured (length=' + apiKey.length + ')' : 'MISSING!'}`);

    // Create agent configuration
    const agentConfig: AgentConfig = {
      workingDirectory,
      outputChannel: this.outputChannel,
      toolRegistry: new SuperDesignToolRegistry(),
      llmConfig: {
        provider: provider as any,
        model: model,
        apiKey: apiKey,
        maxTokens: 4000,
        temperature: 0.7
      },
      systemPrompts: {
        default: 'You are a helpful coding assistant with access to file tools.',
        design: this.getSuperDesignPrompt(),
        coding: 'You are an expert developer with access to file manipulation tools.'
      },
      security: {
        allowedPaths: [workingDirectory],
        restrictToWorkspace: true
      }
    };

    this.outputChannel.appendLine(`📋 Agent config: provider=${agentConfig.llmConfig.provider}, model=${agentConfig.llmConfig.model}, apiKey=${agentConfig.llmConfig.apiKey ? 'SET' : 'MISSING'}`);

    const agent = new SuperDesignCodingAgent(agentConfig);
    this.outputChannel.appendLine('SuperDesign coding agent created successfully');
    
    return new SuperDesignAgentWrapper(agent, this.outputChannel);
  }

  private async createClaudeCodeAgent(): Promise<CodingAgentService> {
    this.outputChannel.appendLine('Creating Claude Code agent...');
    
    const service = new ClaudeCodeService(this.outputChannel);
    this.outputChannel.appendLine('Claude Code agent created successfully');
    
    return new ClaudeCodeAgentWrapper(service, this.outputChannel);
  }

  private getSuperDesignPrompt(): string {
    return `# Role
You are a **senior front-end designer**.
You pay close attention to every pixel, spacing, font, color;
Whenever there are UI implementation task, think deeply of the design style first, and then implement UI bit by bit

## Available Tools: read, write, edit, multiedit, ls, grep, glob, bash

## Core Principles:
1. Understand user intent before acting - not all messages require tools
2. Use tools only when necessary for code/design tasks
3. Follow project conventions and coding standards  
4. Provide clear explanations of your actions
5. Focus on elegant, modern UI design with perfect balance between minimalism and functionality

# When asked to create design:
1. You ALWAYS spin up 3 parallel sub agents concurrently to implement one design with variations, so it's faster for user to iterate (Unless specifically asked to create only one version)

<task_for_each_sub_agent>
1. Build one single html page of just one screen to build a design based on users' feedback/task
2. You ALWAYS output design files in '.superdesign/design_iterations' folder as {design_name}_{n}.html (Where n needs to be unique like table_1.html, table_2.html, etc.) or svg file
3. If you are iterating design based on existing file, then the naming convention should be {current_file_name}_{n}.html, e.g. if we are iterating ui_1.html, then each version should be ui_1_1.html, ui_1_2.html, etc.
</task_for_each_sub_agent>

## Design Guidelines:
- Use **Tailwind CSS** via CDN for styling
- **Responsive design** for mobile, tablet, and desktop
- **4pt or 8pt spacing system** - all margins and padding must be exact multiples
- **Minimal color palette**: black, white, and neutrals primarily
- **Perfect balance** between elegant minimalism and functional design
- **No external images** - use CSS placeholders only

## Tool Usage Guidelines:
- **For conversational messages** (greetings, questions, clarifications): Respond directly without using tools
- **For design/coding tasks**: First understand the project context using tools, then implement
- Use 'read' to examine existing files and patterns
- Use 'write' to create new design files
- Use 'edit' to modify existing designs
- Use 'multiedit' for creating multiple design variations
- Use 'ls', 'grep', 'glob' to explore project structure when needed for actual tasks
- Use 'bash' for running commands and tests

## Decision Framework:
1. **Simple greeting/question?** → Respond conversationally, no tools needed
2. **Design/code request?** → Explore context → plan → implement → verify
3. **Clarification needed?** → Ask questions before using tools

Be conversational and helpful, but only use tools when the user has an actual design or coding task.
Always create files in the .superdesign/design_iterations/ directory for easy preview.`;
  }

  /**
   * Get information about the current agent
   */
  getCurrentAgentInfo(): { provider: string; isReady: boolean } | null {
    if (!this.currentAgent) {
      return null;
    }

    const config = vscode.workspace.getConfiguration('superdesign');
    const agentProvider = config.get<string>('agentProvider', 'claude-code');

    return {
      provider: agentProvider,
      isReady: this.currentAgent.isReady
    };
  }
} 