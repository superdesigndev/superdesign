import * as vscode from 'vscode';
import { LLMProvider, LLMServiceConfig } from './llm-service';
import { getAvailableModels, getDefaultModel } from './models';

export type AgentProvider = 'claude-code' | 'custom';

export interface SuperDesignConfig {
  agentProvider: AgentProvider;
  preferredModel: string;
  fallbackModel: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  openrouterApiKey?: string;
  maxTokens: number;
  temperature: number;
  enableStreamingResponses: boolean;
  enableDebugLogging: boolean;
  maxDesignVariations: number;
  autoSaveDesigns: boolean;
}

export interface ApiKeyValidation {
  provider: string;
  isValid: boolean;
  hasKey: boolean;
  errorMessage?: string;
}

/**
 * Configuration Manager for SuperDesign extension
 * Handles VS Code settings, API keys, and model configuration
 */
export class ConfigManager {
  private outputChannel: vscode.OutputChannel;
  private readonly configSection = 'superdesign';

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Get the current configuration from VS Code settings
   */
  getConfig(): SuperDesignConfig {
    const config = vscode.workspace.getConfiguration(this.configSection);
    
    return {
      agentProvider: config.get<AgentProvider>('agentProvider', 'claude-code'),
      preferredModel: config.get<string>('preferredModel', 'claude-3-5-sonnet-20241022'),
      fallbackModel: config.get<string>('fallbackModel', 'gpt-4o-mini'),
      anthropicApiKey: config.get<string>('anthropicApiKey'),
      openaiApiKey: config.get<string>('openaiApiKey'),
      googleApiKey: config.get<string>('googleApiKey'),
      openrouterApiKey: config.get<string>('openrouterApiKey'),
      maxTokens: config.get<number>('maxTokens', 4000),
      temperature: config.get<number>('temperature', 0.7),
      enableStreamingResponses: config.get<boolean>('enableStreamingResponses', true),
      enableDebugLogging: config.get<boolean>('enableDebugLogging', false),
      maxDesignVariations: config.get<number>('maxDesignVariations', 3),
      autoSaveDesigns: config.get<boolean>('autoSaveDesigns', true)
    };
  }

  /**
   * Update a configuration value
   */
  async updateConfig<K extends keyof SuperDesignConfig>(
    key: K,
    value: SuperDesignConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configSection);
    await config.update(key, value, target);
    this.outputChannel.appendLine(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
  }

  /**
   * Get the currently active agent provider
   */
  getActiveAgentProvider(): AgentProvider {
    return this.getConfig().agentProvider;
  }

  /**
   * Switch between Claude Code and Custom agent
   */
  async switchAgentProvider(provider: AgentProvider): Promise<void> {
    await this.updateConfig('agentProvider', provider);
    this.outputChannel.appendLine(`Switched to ${provider} agent`);

    if (provider === 'custom') {
      const validation = this.validateCurrentModelApiKey();
      if (!validation.isValid) {
        vscode.window.showWarningMessage(
          `Custom agent selected but ${validation.errorMessage}`,
          'Configure API Keys'
        ).then(selection => {
          if (selection === 'Configure API Keys') {
            vscode.commands.executeCommand('superdesign.configureMultipleApiKeys');
          }
        });
      }
    }
  }

  /**
   * Get LLM service configuration for the custom agent
   */
  getLLMServiceConfig(): LLMServiceConfig | null {
    const config = this.getConfig();
    
    if (config.agentProvider !== 'custom') {
      return null;
    }

    // Determine provider based on preferred model
    const { provider: providerName, apiKey } = this.getProviderForModel(config.preferredModel, config);
    
    if (providerName === 'unknown') {
      throw new Error(`Unknown model provider for model: ${config.preferredModel}`);
    }
    
    if (!apiKey) {
      throw new Error(`API key not configured for ${providerName} provider`);
    }

    const provider: LLMProvider = {
      name: providerName,
      model: config.preferredModel,
      apiKey: apiKey,
    };

    return {
      provider,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      systemPrompt: this.getSystemPrompt(),
    };
  }

  /**
   * Get provider and API key for a specific model
   */
  getProviderForModel(model: string, config: SuperDesignConfig): { provider: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'unknown'; apiKey: string | undefined } {
    if (model.includes('claude') || model.includes('anthropic')) {
      return { provider: 'anthropic', apiKey: config.anthropicApiKey };
    } else if (model.includes('gpt') || model.includes('openai')) {
      return { provider: 'openai', apiKey: config.openaiApiKey };
    } else if (model.includes('gemini') || model.includes('google')) {
      return { provider: 'google', apiKey: config.googleApiKey };
    } else if (model.includes('openrouter')) {
      return { provider: 'openrouter', apiKey: config.openrouterApiKey };
    } else {
      return { provider: 'unknown', apiKey: undefined };
    }
  }

  /**
   * Validate API key for current model
   */
  validateCurrentModelApiKey(): { isValid: boolean; provider: string; errorMessage?: string } {
    const config = this.getConfig();
    const { provider, apiKey } = this.getProviderForModel(config.preferredModel, config);
    
    if (provider === 'unknown') {
      return {
        isValid: false,
        provider: 'Unknown',
        errorMessage: `Unknown model provider for: ${config.preferredModel}`
      };
    }
    
    const hasValidKey = !!apiKey && apiKey.length > 10;
    
    return {
      isValid: hasValidKey,
      provider,
      errorMessage: hasValidKey ? undefined : `${provider} API key required for model: ${config.preferredModel}`
    };
  }

  /**
   * Validate that required API keys are configured
   */
  validateConfiguration(): { isValid: boolean; missingKeys: string[] } {
    const config = this.getConfig();
    const missingKeys: string[] = [];

    if (config.agentProvider === 'claude-code') {
      if (!config.anthropicApiKey) {
        missingKeys.push('anthropicApiKey');
      }
    } else if (config.agentProvider === 'custom') {
      const { provider, apiKey } = this.getProviderForModel(config.preferredModel, config);
      
      if (!apiKey) {
        missingKeys.push(`${provider}ApiKey`);
      }
    }

    return {
      isValid: missingKeys.length === 0,
      missingKeys,
    };
  }

  /**
   * Get the system prompt for the custom coding agent
   */
  private getSystemPrompt(): string {
    const config = this.getConfig();
    
    const basePrompt = `# SuperDesign AI Agent

You are a senior front-end designer and developer specializing in creating beautiful, functional UI designs.

## Configuration
- Agent Provider: ${config.agentProvider}
- Preferred Model: ${config.preferredModel}
- Max Design Variations: ${config.maxDesignVariations}
- Auto-save Designs: ${config.autoSaveDesigns}

## Core Principles
1. Always think deeply about design style before implementation
2. Pay attention to every pixel, spacing, font, and color
3. Create 3 parallel design variations by default for user choice
4. Save designs to .superdesign/design_iterations/ folder
5. Follow modern design principles and accessibility standards

## Design Guidelines
- Balance elegant minimalism with functional design
- Use soft, refreshing gradient colors
- Maintain well-proportioned white space
- Ensure responsive design patterns
- Focus on component reusability
- Maintain design system consistency

## Available Tools
You have access to comprehensive file operations, code analysis, and shell command execution tools to implement designs effectively.`;

    return basePrompt;
  }

  /**
   * Set up default configuration for first-time users
   */
  async initializeDefaultConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configSection);
    
    const hasExistingConfig = 
      config.get('agentProvider') !== undefined ||
      config.get('preferredModel') !== undefined;

    if (!hasExistingConfig) {
      this.outputChannel.appendLine('Initializing default SuperDesign configuration...');
      
      // Set default values
      await config.update('agentProvider', 'claude-code', vscode.ConfigurationTarget.Global);
      await config.update('preferredModel', 'claude-3-5-sonnet-20241022', vscode.ConfigurationTarget.Global);
      await config.update('fallbackModel', 'gpt-4o-mini', vscode.ConfigurationTarget.Global);
      await config.update('maxTokens', 4000, vscode.ConfigurationTarget.Global);
      await config.update('temperature', 0.7, vscode.ConfigurationTarget.Global);
      await config.update('enableStreamingResponses', true, vscode.ConfigurationTarget.Global);
      await config.update('enableDebugLogging', false, vscode.ConfigurationTarget.Global);
      await config.update('maxDesignVariations', 3, vscode.ConfigurationTarget.Global);
      await config.update('autoSaveDesigns', true, vscode.ConfigurationTarget.Global);
      
      this.outputChannel.appendLine('Default configuration initialized');
    }
  }

  /**
   * Show configuration status in VS Code
   */
  async showConfigStatus(): Promise<void> {
    const config = this.getConfig();
    const validation = this.validateConfiguration();
    
    let status = `**SuperDesign Configuration Status**\n\n`;
    status += `**Active Agent:** ${config.agentProvider}\n`;
    
    if (config.agentProvider === 'custom') {
      status += `**Preferred Model:** ${config.preferredModel}\n`;
      status += `**Fallback Model:** ${config.fallbackModel}\n`;
    }
    
    status += `\n**Configuration Status:** ${validation.isValid ? '✅ Valid' : '❌ Invalid'}\n`;
    
    if (!validation.isValid) {
      status += `**Missing API Keys:** ${validation.missingKeys.join(', ')}\n`;
      status += `\n**To fix:** Go to VS Code Settings → Extensions → SuperDesign and configure the missing API keys.`;
    }

    await vscode.window.showInformationMessage(status, { modal: true });
  }
} 