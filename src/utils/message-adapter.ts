import { SDKMessage } from '../core/agent';

/**
 * Vercel AI SDK message format
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Array<{
    type: 'text' | 'tool-call' | 'tool-result';
    text?: string;
    toolCallId?: string;
    toolName?: string;
    args?: any;
    result?: any;
    isError?: boolean;
  }>;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
    state: 'partial-call' | 'call' | 'result';
  }>;
}

/**
 * Tool execution result format
 */
export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  args: any;
  result: any;
  isError: boolean;
  duration?: number;
}

/**
 * Streaming chunk format from Vercel AI SDK
 */
export interface StreamingChunk {
  type: 'text-delta' | 'tool-call-delta' | 'tool-call' | 'tool-result' | 'finish';
  textDelta?: string;
  toolCallId?: string;
  toolName?: string;
  argsTextDelta?: string;
  args?: any;
  result?: any;
  finishReason?: string;
}

/**
 * Adapter for converting between Vercel AI SDK and SuperDesign message formats
 */
export class MessageAdapter {
  /**
   * Convert AI SDK message to SuperDesign SDKMessage format
   */
  static convertToSDKMessage(
    aiMessage: AIMessage,
    sessionId: string,
    metadata?: {
      duration?: number;
      cost?: number;
      parentToolUseId?: string;
    }
  ): SDKMessage[] {
    const messages: SDKMessage[] = [];
    
    if (aiMessage.role === 'assistant' && Array.isArray(aiMessage.content)) {
      // Handle multi-part assistant messages with tool calls
      for (const part of aiMessage.content) {
        if (part.type === 'text' && part.text) {
          messages.push({
            type: 'assistant',
            content: part.text,
            session_id: sessionId,
            duration_ms: metadata?.duration,
            total_cost_usd: metadata?.cost
          });
        } else if (part.type === 'tool-call') {
          messages.push({
            type: 'assistant',
            subtype: 'tool_use',
            message: {
              content: [{
                type: 'tool_use',
                id: part.toolCallId,
                name: part.toolName,
                input: part.args
              }]
            },
            session_id: sessionId,
            parent_tool_use_id: metadata?.parentToolUseId
          });
        } else if (part.type === 'tool-result') {
          messages.push({
            type: 'result',
            subtype: part.isError ? 'error' : 'success',
            content: typeof part.result === 'string' ? part.result : JSON.stringify(part.result),
            session_id: sessionId,
            parent_tool_use_id: part.toolCallId
          });
        }
      }
    } else if (aiMessage.toolInvocations) {
      // Handle tool invocations from Vercel AI SDK
      for (const invocation of aiMessage.toolInvocations) {
        if (invocation.state === 'call') {
          messages.push({
            type: 'assistant',
            subtype: 'tool_use',
            message: {
              content: [{
                type: 'tool_use',
                id: invocation.toolCallId,
                name: invocation.toolName,
                input: invocation.args
              }]
            },
            session_id: sessionId
          });
        } else if (invocation.state === 'result') {
          messages.push({
            type: 'result',
            subtype: 'success',
            content: typeof invocation.result === 'string' ? invocation.result : JSON.stringify(invocation.result),
            session_id: sessionId,
            parent_tool_use_id: invocation.toolCallId
          });
        }
      }
    } else if (typeof aiMessage.content === 'string') {
      // Handle simple text messages
      messages.push({
        type: aiMessage.role === 'user' ? 'user' : 'assistant',
        content: aiMessage.content,
        session_id: sessionId,
        duration_ms: metadata?.duration,
        total_cost_usd: metadata?.cost
      });
    }

    return messages;
  }

  /**
   * Convert SuperDesign SDKMessage to AI SDK message format
   */
  static convertFromSDKMessage(sdkMessage: SDKMessage): AIMessage {
    if (sdkMessage.type === 'user') {
      return {
        role: 'user',
        content: sdkMessage.content || ''
      };
    }

    if (sdkMessage.type === 'assistant') {
      if (sdkMessage.subtype === 'tool_use' && sdkMessage.message?.content) {
        // Handle tool use messages
        const toolUse = sdkMessage.message.content[0];
        return {
          role: 'assistant',
          content: [{
            type: 'tool-call',
            toolCallId: toolUse.id,
            toolName: toolUse.name,
            args: toolUse.input
          }]
        };
      } else {
        // Handle regular assistant messages
        return {
          role: 'assistant',
          content: sdkMessage.content || sdkMessage.message?.content || ''
        };
      }
    }

    if (sdkMessage.type === 'result') {
      return {
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: sdkMessage.parent_tool_use_id || '',
          result: sdkMessage.content,
          isError: sdkMessage.subtype === 'error'
        }]
      };
    }

    // Default fallback
    return {
      role: 'system',
      content: sdkMessage.content || ''
    };
  }

  /**
   * Convert tool execution result to SDKMessage
   */
  static convertToolResultToSDKMessage(
    toolResult: ToolExecutionResult,
    sessionId: string
  ): SDKMessage {
    return {
      type: 'result',
      subtype: toolResult.isError ? 'error' : 'success',
      content: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result),
      session_id: sessionId,
      parent_tool_use_id: toolResult.toolCallId,
      duration_ms: toolResult.duration
    };
  }

  /**
   * Convert streaming chunk to SDKMessage
   */
  static convertStreamingChunkToSDKMessage(
    chunk: StreamingChunk,
    sessionId: string,
    accumulatedContent?: string
  ): SDKMessage | null {
    switch (chunk.type) {
      case 'text-delta':
        if (chunk.textDelta) {
          return {
            type: 'assistant',
            content: accumulatedContent || chunk.textDelta,
            session_id: sessionId
          };
        }
        break;

      case 'tool-call':
        if (chunk.toolCallId && chunk.toolName && chunk.args) {
          return {
            type: 'assistant',
            subtype: 'tool_use',
            message: {
              content: [{
                type: 'tool_use',
                id: chunk.toolCallId,
                name: chunk.toolName,
                input: chunk.args
              }]
            },
            session_id: sessionId
          };
        }
        break;

      case 'tool-result':
        if (chunk.toolCallId && chunk.result !== undefined) {
          return {
            type: 'result',
            subtype: 'success',
            content: typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result),
            session_id: sessionId,
            parent_tool_use_id: chunk.toolCallId
          };
        }
        break;

      case 'finish':
        return {
          type: 'system',
          content: `Finished: ${chunk.finishReason || 'complete'}`,
          session_id: sessionId
        };
    }

    return null;
  }

  /**
   * Create error message in SDKMessage format
   */
  static createErrorMessage(
    error: Error | string,
    sessionId: string,
    toolCallId?: string
  ): SDKMessage {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    return {
      type: 'result',
      subtype: 'error',
      content: errorMessage,
      session_id: sessionId,
      parent_tool_use_id: toolCallId
    };
  }

  /**
   * Create system message in SDKMessage format
   */
  static createSystemMessage(
    content: string,
    sessionId: string
  ): SDKMessage {
    return {
      type: 'system',
      content,
      session_id: sessionId
    };
  }

  /**
   * Create user message in SDKMessage format
   */
  static createUserMessage(
    content: string,
    sessionId: string
  ): SDKMessage {
    return {
      type: 'user',
      content,
      session_id: sessionId
    };
  }

  /**
   * Create assistant message in SDKMessage format
   */
  static createAssistantMessage(
    content: string,
    sessionId: string,
    metadata?: {
      duration?: number;
      cost?: number;
    }
  ): SDKMessage {
    return {
      type: 'assistant',
      content,
      session_id: sessionId,
      duration_ms: metadata?.duration,
      total_cost_usd: metadata?.cost
    };
  }

  /**
   * Create tool call message in SDKMessage format
   */
  static createToolCallMessage(
    toolCall: { toolCallId: string; toolName: string; args: any },
    sessionId: string
  ): SDKMessage {
    return {
      type: 'assistant',
      subtype: 'tool_use',
      message: {
        content: [{
          type: 'tool_use',
          id: toolCall.toolCallId,
          name: toolCall.toolName,
          input: toolCall.args
        }]
      },
      session_id: sessionId
    };
  }

  /**
   * Create tool result message in SDKMessage format
   */
  static createToolResultMessage(
    toolResult: { toolCallId: string; result: any; isError?: boolean },
    sessionId: string
  ): SDKMessage {
    return {
      type: 'result',
      subtype: toolResult.isError ? 'error' : 'success',
      content: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result),
      session_id: sessionId,
      parent_tool_use_id: toolResult.toolCallId
    };
  }

  /**
   * Batch convert multiple AI messages to SDKMessages
   */
  static convertBatchToSDKMessages(
    aiMessages: AIMessage[],
    sessionId: string
  ): SDKMessage[] {
    const sdkMessages: SDKMessage[] = [];

    for (const aiMessage of aiMessages) {
      const converted = this.convertToSDKMessage(aiMessage, sessionId);
      sdkMessages.push(...converted);
    }

    return sdkMessages;
  }

  /**
   * Extract conversation history as AI messages for context
   */
  static extractConversationHistory(
    sdkMessages: SDKMessage[]
  ): AIMessage[] {
    const aiMessages: AIMessage[] = [];
    
    // Group messages by type and create conversation flow
    for (const sdkMessage of sdkMessages) {
      if (sdkMessage.type === 'user' || 
          (sdkMessage.type === 'assistant' && !sdkMessage.subtype)) {
        // Simple user or assistant text messages
        aiMessages.push(this.convertFromSDKMessage(sdkMessage));
      }
      // Skip tool use and result messages for conversation history
      // These will be handled by the agent's tool execution flow
    }

    return aiMessages;
  }

  /**
   * Calculate total cost from SDKMessages
   */
  static calculateTotalCost(messages: SDKMessage[]): number {
    return messages.reduce((total, message) => {
      return total + (message.total_cost_usd || 0);
    }, 0);
  }

  /**
   * Calculate total duration from SDKMessages
   */
  static calculateTotalDuration(messages: SDKMessage[]): number {
    return messages.reduce((total, message) => {
      return total + (message.duration_ms || 0);
    }, 0);
  }
} 