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
    
    // Set API key in environment for the provider (persistent)
    switch (provider.name) {
      case 'openai':
        process.env.OPENAI_API_KEY = provider.apiKey;
        return openai(provider.model);
        
      case 'anthropic':
        process.env.ANTHROPIC_API_KEY = provider.apiKey;
        this.outputChannel.appendLine(`[DEBUG] Set ANTHROPIC_API_KEY in environment (length: ${provider.apiKey.length})`);
        return anthropic(provider.model);
        
      case 'google':
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = provider.apiKey;
        return google(provider.model);
        
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
   * Generate a streaming response with real-time tool calls and results
   */
  async generateStreamingResponseWithTools(
    messages: ConversationMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      tools?: any[] | { [name: string]: any };
      maxSteps?: number;
      onToolCall?: (toolCall: any) => void;
      onToolResult?: (toolResult: any) => void;
      onTextDelta?: (text: string) => void;
    }
  ): Promise<{
    content: string;
    toolCalls: any[];
    toolResults: any[];
    steps: any[];
    usage?: { promptTokens: number; completionTokens: number; };
  }> {
    try {
      this.outputChannel.appendLine(`Starting streaming response with tools for ${this.config.provider.name}/${this.config.provider.model}`);
      
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
        maxSteps: options?.maxSteps || 25,
      };

      // Only add tools if they exist and are valid
      const tools = options?.tools || this.config.tools;
      this.outputChannel.appendLine(`[DEBUG] Tools type: ${typeof tools}, isArray: ${Array.isArray(tools)}, keys: ${tools ? Object.keys(tools).join(', ') : 'none'}`);
      this.outputChannel.appendLine(`[DEBUG] MaxSteps: ${streamParams.maxSteps}`);
      
      if (tools && (Array.isArray(tools) ? tools.length > 0 : Object.keys(tools).length > 0)) {
        streamParams.tools = tools;
      }

      const result = streamText(streamParams);
      
      // Collect data as we stream
      let fullContent = '';
      const toolCalls: any[] = [];
      const toolResults: any[] = [];
      const steps: any[] = [];

      // Process the full stream which includes tool calls and results
      for await (const delta of result.fullStream) {
        // Debug: Log all stream events to understand the structure
        this.outputChannel.appendLine(`[STREAM DEBUG] Event type: ${delta.type}`);
        
        switch (delta.type) {
          case 'text-delta':
            if (delta.textDelta) {
              fullContent += delta.textDelta;
              if (options?.onTextDelta) {
                options.onTextDelta(delta.textDelta);
              }
            }
            break;
            
          case 'tool-call':
            this.outputChannel.appendLine(`[STREAM] Tool call: ${(delta as any).toolName || 'unknown'}`);
            toolCalls.push(delta);
            if (options?.onToolCall) {
              options.onToolCall(delta);
            }
            break;
            
          case 'step-finish':
            // Keep step tracking for completeness
            this.outputChannel.appendLine(`[STREAM] Step finished`);
            steps.push(delta);
            break;
            
          default:
            // Handle tool-result events (not in official types but exists in practice)
            if ((delta as any).type === 'tool-result') {
              this.outputChannel.appendLine(`[STREAM] Tool result for: ${(delta as any).toolCallId || 'unknown'}`);
              toolResults.push(delta);
              if (options?.onToolResult) {
                options.onToolResult(delta);
              }
            } else {
              // Log any other unhandled event types
              this.outputChannel.appendLine(`[STREAM DEBUG] Unhandled event type: ${delta.type}`);
            }
            break;
        }
      }

      // Wait for the final result to get usage data
      const finalResult = await result;
      const finalText = await finalResult.text;
      const finalUsage = await finalResult.usage;
      
      this.outputChannel.appendLine(`Response generated: ${finalText.length} characters`);
      this.outputChannel.appendLine(`Tools executed: ${toolCalls.length} calls, ${toolResults.length} results`);

      return {
        content: fullContent || finalText,
        toolCalls,
        toolResults,
        steps,
        usage: finalUsage ? {
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
        } : undefined,
      };
      
    } catch (error) {
      this.outputChannel.appendLine(`Error in streaming response with tools: ${error}`);
      throw new Error(`Failed to generate streaming response with tools: ${error}`);
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