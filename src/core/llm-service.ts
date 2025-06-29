import { generateText, streamText, tool, CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import * as vscode from 'vscode';
import { getAvailableModels } from './models';

export interface LLMProvider {
  name: 'openai' | 'anthropic' | 'google' | 'openrouter';
  model: string;
  apiKey: string;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason?: string;
  toolCalls?: any[];
  toolResults?: any[];
  steps?: any[];
}

export interface StreamingLLMResponse {
  stream: AsyncIterable<string>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMToolCall {
  name: string;
  parameters: any;
}

export interface LLMServiceConfig {
  provider: LLMProvider;
  maxTokens?: number;
  temperature?: number;
  tools?: any[] | { [name: string]: any };
  systemPrompt?: string;
}

/**
 * LLM Service that provides a unified interface for different AI providers
 * using the Vercel AI SDK. Supports OpenAI, Anthropic, Google, and OpenRouter.
 */
export class LLMService {
  private config: LLMServiceConfig;
  private outputChannel: vscode.OutputChannel;

  constructor(config: LLMServiceConfig, outputChannel: vscode.OutputChannel) {
    this.config = config;
    this.outputChannel = outputChannel;
    this.validateConfig();
  }

  /**
   * Validate the LLM service configuration
   */
  private validateConfig(): void {
    if (!this.config.provider.apiKey) {
      throw new Error(`API key is required for ${this.config.provider.name} provider`);
    }
    
    if (!this.config.provider.model) {
      throw new Error(`Model is required for ${this.config.provider.name} provider`);
    }

    this.outputChannel.appendLine(`LLMService initialized with ${this.config.provider.name}/${this.config.provider.model}`);
  }

  /**
   * Get the appropriate AI model instance based on the provider
   */
  private getModel() {
    const { provider } = this.config;
    
    // Set API key in environment for the provider
    switch (provider.name) {
      case 'openai':
        // Temporarily set the API key in process.env
        const originalOpenAIKey = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = provider.apiKey;
        const openaiModel = openai(provider.model);
        // Restore original key
        if (originalOpenAIKey) {
          process.env.OPENAI_API_KEY = originalOpenAIKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }
        return openaiModel;
        
      case 'anthropic':
        const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
        process.env.ANTHROPIC_API_KEY = provider.apiKey;
        const anthropicModel = anthropic(provider.model);
        if (originalAnthropicKey) {
          process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }
        return anthropicModel;
        
      case 'google':
        const originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = provider.apiKey;
        const googleModel = google(provider.model);
        if (originalGoogleKey) {
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey;
        } else {
          delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        }
        return googleModel;
        
      case 'openrouter':
        const openrouterProvider = createOpenRouter({
          apiKey: provider.apiKey,
        });
        return openrouterProvider.chat(provider.model);
        
      default:
        throw new Error(`Unsupported provider: ${provider.name}`);
    }
  }

  /**
   * Convert conversation messages to the format expected by the AI SDK
   */
  private formatMessages(messages: ConversationMessage[]): CoreMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Generate a single response from the LLM
   */
  async generateResponse(
    messages: ConversationMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      tools?: any[] | { [name: string]: any };
      maxSteps?: number;
    }
  ): Promise<LLMResponse> {
    try {
      this.outputChannel.appendLine(`Generating response with ${this.config.provider.name}/${this.config.provider.model}`);
      
      const model = this.getModel();
      const formattedMessages = this.formatMessages(messages);
      
      // Add system prompt if provided
      if (this.config.systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: this.config.systemPrompt,
        });
      }

      const generateParams: any = {
        model,
        messages: formattedMessages,
        maxTokens: options?.maxTokens || this.config.maxTokens || 4000,
        temperature: options?.temperature || this.config.temperature || 0.7,
        maxSteps: options?.maxSteps || 25, // Enable multi-step tool calling with default of 25 steps
      };

      // Only add tools if they exist and are valid
      const tools = options?.tools || this.config.tools;
      this.outputChannel.appendLine(`[DEBUG] Tools type: ${typeof tools}, isArray: ${Array.isArray(tools)}, keys: ${tools ? Object.keys(tools).join(', ') : 'none'}`);
      this.outputChannel.appendLine(`[DEBUG] MaxSteps: ${generateParams.maxSteps}`);
      
      if (tools && (Array.isArray(tools) ? tools.length > 0 : Object.keys(tools).length > 0)) {
        generateParams.tools = tools;
      }

      const result = await generateText(generateParams);

      this.outputChannel.appendLine(`Response generated: ${result.text.length} characters`);
      
      // Extract tool calls and results from steps if tools were used
      const toolCalls: any[] = [];
      const toolResults: any[] = [];
      
      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolCalls) {
            toolCalls.push(...step.toolCalls);
          }
          if (step.toolResults) {
            toolResults.push(...step.toolResults);
          }
        }
      }
      
      this.outputChannel.appendLine(`Tools executed: ${toolCalls.length} calls, ${toolResults.length} results`);
      
      return {
        content: result.text,
        usage: result.usage ? {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        } : undefined,
        finishReason: result.finishReason,
        toolCalls,
        toolResults,
        steps: result.steps || []
      };
      
    } catch (error) {
      this.outputChannel.appendLine(`Error generating response: ${error}`);
      throw new Error(`Failed to generate response: ${error}`);
    }
  }

  /**
   * Generate a streaming response from the LLM
   */
  async generateStreamingResponse(
    messages: ConversationMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      tools?: any[] | { [name: string]: any };
      maxSteps?: number;
    }
  ): Promise<StreamingLLMResponse> {
    try {
      this.outputChannel.appendLine(`Starting streaming response with ${this.config.provider.name}/${this.config.provider.model}`);
      
      const model = this.getModel();
      const formattedMessages = this.formatMessages(messages);
      
      // Add system prompt if provided
      if (this.config.systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: this.config.systemPrompt,
        });
      }

      const streamParams: any = {
        model,
        messages: formattedMessages,
        maxTokens: options?.maxTokens || this.config.maxTokens || 4000,
        temperature: options?.temperature || this.config.temperature || 0.7,
        maxSteps: options?.maxSteps || 25, // Enable multi-step tool calling with default of 25 steps
      };

      // Only add tools if they exist and are valid
      const tools = options?.tools || this.config.tools;
      if (tools && (Array.isArray(tools) ? tools.length > 0 : Object.keys(tools).length > 0)) {
        streamParams.tools = tools;
      }

      const result = streamText(streamParams);

      return {
        stream: result.textStream,
        usage: undefined, // Usage will be available after streaming completes
      };
      
    } catch (error) {
      this.outputChannel.appendLine(`Error starting streaming response: ${error}`);
      throw new Error(`Failed to start streaming response: ${error}`);
    }
  }

  /**
   * Update the LLM service configuration
   */
  updateConfig(newConfig: Partial<LLMServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMServiceConfig {
    return { ...this.config };
  }
} 