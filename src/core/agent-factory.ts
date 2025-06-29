import * as vscode from 'vscode';
import { LLMService, LLMServiceConfig, ConversationMessage } from './llm-service';
import { ConfigManager, AgentProvider } from './config-manager';
import { 
  SuperDesignCodingAgent, 
  ClaudeCodeAgentWrapper, 
  SuperDesignAgent, 
  AgentConfig 
} from './agent';
import { SuperDesignToolRegistry } from '../tools/registry';



/**
 * Factory for creating SuperDesign coding agents based on configuration
 */
export class AgentFactory {
  private configManager: ConfigManager;
  private outputChannel: vscode.OutputChannel;
  private currentAgent: SuperDesignAgent | null = null;

  constructor(configManager: ConfigManager, outputChannel: vscode.OutputChannel) {
    this.configManager = configManager;
    this.outputChannel = outputChannel;
  }

  /**
   * Create the appropriate coding agent based on current configuration
   */
  async createAgent(claudeCodeService?: any): Promise<SuperDesignAgent> {
    const agentProvider = this.configManager.getActiveAgentProvider();
    
    this.outputChannel.appendLine(`[AgentFactory] Creating ${agentProvider} agent`);

    // Dispose current agent if exists
    if (this.currentAgent) {
      // No dispose method on SuperDesignAgent interface, just set to null
      this.currentAgent = null;
    }

    switch (agentProvider) {
      case 'claude-code':
        if (!claudeCodeService) {
          throw new Error('Claude Code service is required but not provided');
        }
        this.currentAgent = new ClaudeCodeAgentWrapper(
          claudeCodeService, 
          this.outputChannel,
          this.getWorkingDirectory()
        );
        break;

      case 'custom':
        const llmConfig = this.configManager.getLLMServiceConfig();
        if (!llmConfig) {
          throw new Error('LLM service configuration is not available');
        }
        
        // Create agent configuration
        const workingDir = this.getWorkingDirectory();
        const agentConfig: AgentConfig = {
          workingDirectory: workingDir,
          outputChannel: this.outputChannel,
          toolRegistry: new SuperDesignToolRegistry(), // Tools auto-registered in constructor
          llmConfig: {
            provider: llmConfig.provider.name,
            model: llmConfig.provider.model,
            apiKey: llmConfig.provider.apiKey,
            maxTokens: llmConfig.maxTokens,
            temperature: llmConfig.temperature
          },
          systemPrompts: {
            default: 'You are a helpful coding assistant.',
            design: this.getDesignSystemPrompt(),
            coding: 'You are an expert software developer.'
          },
          security: {
            allowedPaths: [workingDir],
            restrictToWorkspace: true
          }
        };
        
        this.currentAgent = new SuperDesignCodingAgent(agentConfig);
        break;

      default:
        throw new Error(`Unsupported agent provider: ${agentProvider}`);
    }

    this.outputChannel.appendLine(`[AgentFactory] ${agentProvider} agent created successfully`);
    return this.currentAgent;
  }

  /**
   * Get the current agent
   */
  getCurrentAgent(): SuperDesignAgent | null {
    return this.currentAgent;
  }

  /**
   * Switch to a different agent provider
   */
  async switchAgent(provider: AgentProvider, claudeCodeService?: any): Promise<SuperDesignAgent> {
    this.outputChannel.appendLine(`[AgentFactory] Switching to ${provider} agent`);
    
    await this.configManager.switchAgentProvider(provider);
    return await this.createAgent(claudeCodeService);
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    if (this.currentAgent) {
      this.currentAgent = null;
    }
    this.outputChannel.appendLine('[AgentFactory] Disposed');
  }

  /**
   * Get the current working directory for the workspace
   */
  private getWorkingDirectory(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    
    // Fallback to current working directory or empty string
    return process.cwd() || '';
  }

  /**
   * Get SuperDesign-specific system prompt
   */
  private getDesignSystemPrompt(): string {
    return `
# SuperDesign Agent

You are a senior front-end designer and developer working with SuperDesign.
You pay close attention to every pixel, spacing, font, color.

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

Always start by understanding the project context, then plan your approach, implement changes, and verify results.
    `.trim();
  }
} 