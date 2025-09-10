import * as vscode from 'vscode';
import { ClaudeCodeService, LLMMessage } from './claudeCodeService';
import { AgentService } from '../types/agent';
import { CoreMessage } from 'ai';
import { Logger } from './logger';

export class ChatMessageService {
    private currentRequestController?: AbortController;

    constructor(
        private agentService: AgentService,
        private outputChannel: vscode.OutputChannel
    ) {}

    async handleChatMessage(message: any, webview: vscode.Webview): Promise<void> {
        try {
            const chatHistory: CoreMessage[] = message.chatHistory || [];
            const latestMessage = message.message || '';
            const messageContent = message.messageContent || latestMessage;
            
            console.log('========chatHistory', chatHistory);

            Logger.info(`Chat message received with ${chatHistory.length} history messages`);
            Logger.info(`Latest message: ${latestMessage}`);
            
            // Debug structured content
            if (typeof messageContent !== 'string' && Array.isArray(messageContent)) {
                Logger.info(`Structured content: ${messageContent.length} parts`);
                messageContent.forEach((part, index) => {
                    if (part.type === 'text') {
                        Logger.info(`  [${index}] text: "${part.text?.substring(0, 100)}..."`);
                    } else if (part.type === 'image') {
                        Logger.info(`  [${index}] image: ${part.mimeType || 'unknown type'} (${part.image?.length || 0} chars)`);
                    }
                });
            } else {
                Logger.info(`Simple text content: ${String(messageContent).substring(0, 100)}...`);
            }
            
            // Create new AbortController for this request
            this.currentRequestController = new AbortController();
            
            // Send initial streaming start message
            webview.postMessage({
                command: 'chatStreamStart'
            });
            
            // Debug log chat history with VS Code output channel
            this.outputChannel.appendLine('=== CHAT HISTORY DEBUG ===');
            this.outputChannel.appendLine(`📥 Input: ${chatHistory.length} CoreMessage messages`);
            
            // Log each message
            this.outputChannel.appendLine('📋 Chat history:');
            chatHistory.forEach((msg, index) => {
                const content = typeof msg.content === 'string' ? msg.content : 
                    Array.isArray(msg.content) ? 
                        msg.content.map(part => 
                            part.type === 'text' ? part.text?.substring(0, 50) + '...' :
                            part.type === 'tool-call' ? `[tool-call: ${part.toolName}]` :
                            part.type === 'tool-result' ? `[tool-result: ${part.toolName}]` :
                            `[${part.type}]`
                        ).join(', ') :
                        '[complex content]';
                        
                this.outputChannel.appendLine(`  [${index}] ${msg.role}: "${content.substring(0, 100)}..."`);
            });
            
            this.outputChannel.appendLine('=== END CHAT HISTORY DEBUG ===');
            
            // Use conversation history or single prompt
            let response: any[];
            if (chatHistory.length > 0) {
                // Use conversation history - CoreMessage format is already compatible
                this.outputChannel.appendLine(`Using conversation history with ${chatHistory.length} messages`);
                response = await this.agentService.query(
                    undefined, // no prompt 
                    chatHistory, // use CoreMessage array directly
                    undefined, 
                    this.currentRequestController,
                    (streamMessage: any) => {
                        // Process and send each message as it arrives
                        this.handleStreamMessage(streamMessage, webview);
                    }
                );
            } else {
                // Fallback to single prompt for first message
                this.outputChannel.appendLine('No conversation history, using single prompt');
                response = await this.agentService.query(
                    latestMessage, // use latest message as prompt
                    undefined, // no messages array
                    undefined, 
                    this.currentRequestController,
                    (streamMessage: any) => {
                        // Process and send each message as it arrives
                        this.handleStreamMessage(streamMessage, webview);
                    }
                );
            }

            // Check if request was aborted
            if (this.currentRequestController.signal.aborted) {
                Logger.warn('Request was aborted');
                return;
            }

            Logger.info(`Agent response completed with ${response.length} total messages`);

            // Send stream end message
            webview.postMessage({
                command: 'chatStreamEnd'
            });

        } catch (error) {
            // Check if the error is due to abort
            if (this.currentRequestController?.signal.aborted) {
                Logger.info('Request was stopped by user');
                webview.postMessage({
                    command: 'chatStopped'
                });
                return;
            }

            Logger.error(`Chat message failed: ${error}`);
            Logger.error(`Error type: ${typeof error}, constructor: ${error?.constructor?.name}`);
            
            // Check if this is an API key authentication error or process failure
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error(`Processing error message: "${errorMessage}"`);
            if (this.agentService.isApiKeyAuthError(errorMessage) || !this.agentService.hasApiKey()) {
                // Determine which provider is currently selected to show specific error
                const config = vscode.workspace.getConfiguration('superdesign');
                const specificModel = config.get<string>('aiModel');
                const provider = config.get<string>('aiModelProvider', 'anthropic');
                const openaiUrl = config.get<string>('openaiUrl');
                
                // Determine provider from model name if specific model is set, ignore if custom openai url is used
                let effectiveProvider = provider;
                let providerName = 'AI';
                let configureCommand = 'superdesign.configureApiKey';
                
                if (specificModel && !(!openaiUrl && provider === 'openai')) {
                    if (specificModel.includes('/')) {
                        effectiveProvider = 'openrouter';
                    } else if (specificModel.startsWith('claude-')) {
                        effectiveProvider = 'anthropic';
                    } else {
                        effectiveProvider = 'openai';
                    }
                }
                
                switch (effectiveProvider) {
                    case 'openrouter':
                        providerName = 'OpenRouter';
                        configureCommand = 'superdesign.configureOpenRouterApiKey';
                        break;
                    case 'anthropic':
                        providerName = 'Anthropic';
                        configureCommand = 'superdesign.configureApiKey';
                        break;
                    case 'claude-code':
                        providerName = 'Claude Code';
                        configureCommand = 'workbench.action.openSettings';
                        break;
                    case 'openai':
                        providerName = 'OpenAI';
                        configureCommand = 'superdesign.configureOpenAIApiKey';
                        break;
                }
                
                const hasApiKey = this.agentService.hasApiKey();
                const displayMessage = hasApiKey ? 
                    `Invalid ${providerName} API key. Please check your configuration.` : 
                    `${providerName} API key not configured. Please set up your API key to use this AI model.`;
                    
                webview.postMessage({
                    command: 'chatErrorWithActions',
                    error: displayMessage,
                    actions: [
                        { text: `Configure ${providerName} API Key`, command: configureCommand },
                        { text: 'Open Settings', command: 'workbench.action.openSettings', args: '@ext:iganbold.superdesign' }
                    ]
                });
            } else {
                // Regular error - show standard error message
                vscode.window.showErrorMessage(`Chat failed: ${error}`);
                webview.postMessage({
                    command: 'chatError',
                    error: errorMessage
                });
            }
        } finally {
            // Clear the controller when done
            this.currentRequestController = undefined;
        }
    }

    private handleStreamMessage(message: CoreMessage, webview: vscode.Webview): void {
        Logger.debug(`Handling CoreMessage: ${JSON.stringify(message, null, 2)}`);
        
        // Check if this is an update to existing message
        const isUpdate = (message as any)._isUpdate;
        const updateToolId = (message as any)._updateToolId;
        
        // Handle assistant messages
        if (message.role === 'assistant') {
            if (typeof message.content === 'string') {
                // Simple text content
                if (message.content.trim()) {
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'assistant',
                        content: message.content,
                        metadata: {}
                    });
                }
            } else if (Array.isArray(message.content)) {
                // Handle assistant content array (text parts, tool calls, etc.)
                for (const part of message.content) {
                    if (part.type === 'text' && (part as any).text) {
                        // Send text content
                        webview.postMessage({
                            command: 'chatResponseChunk',
                            messageType: 'assistant',
                            content: (part as any).text,
                            metadata: {}
                        });
                    } else if (part.type === 'tool-call') {
                        // Send tool call or update
                        const toolPart = part as any;
                        const command = isUpdate ? 'chatToolUpdate' : 'chatResponseChunk';
                        const messageType = isUpdate ? undefined : 'tool-call';
                        
                        if (isUpdate) {
                            // Send tool parameter update
                            webview.postMessage({
                                command: 'chatToolUpdate',
                                tool_use_id: toolPart.toolCallId,
                                tool_input: toolPart.args
                            });
                        } else {
                            // Send new tool call message
                            webview.postMessage({
                                command: 'chatResponseChunk',
                                messageType: 'tool-call',
                                content: '',
                                metadata: {
                                    tool_name: toolPart.toolName,
                                    tool_id: toolPart.toolCallId,
                                    tool_input: toolPart.args
                                }
                            });
                        }
                    }
                }
            }
        }
        
        // Handle tool messages (CoreToolMessage)
        if (message.role === 'tool' && Array.isArray(message.content)) {
            for (const toolResultPart of message.content) {
                if (toolResultPart.type === 'tool-result') {
                    const part = toolResultPart as any;
                    const content = typeof part.result === 'string' ? 
                        part.result : 
                        JSON.stringify(part.result, null, 2);
                    
                    Logger.debug(`Tool result for ${part.toolCallId}: "${content.substring(0, 200)}..."`);
                    
                    // Send tool result to frontend
                    webview.postMessage({
                        command: 'chatResponseChunk',
                        messageType: 'tool-result',
                        content: content,
                        metadata: {
                            tool_id: part.toolCallId,
                            tool_name: part.toolName,
                            is_error: part.isError || false
                        }
                    });
                    
                    // Also send completion signal
                    webview.postMessage({
                        command: 'chatToolResult',
                        tool_use_id: part.toolCallId,
                        content: content,
                        is_error: part.isError || false
                    });
                }
            }
        }
        
        // Handle user messages
        if (message.role === 'user') {
            if (typeof message.content === 'string' && message.content.trim()) {
                webview.postMessage({
                    command: 'chatResponseChunk',
                    messageType: 'user',
                    content: message.content,
                    metadata: {}
                });
            }
        }
        
        // Skip other message types (system, etc.)
    }

    // Legacy handler for backward compatibility
    private handleLegacyResultMessage(message: any, webview: vscode.Webview): void {
        if (message.type === 'result') {
            Logger.debug(`Result message structure: ${JSON.stringify(message, null, 2)}`);
            
            // Skip error result messages that contain raw API key errors - these are handled by our custom error handler
            if (message.is_error) {
                // Check if this is an API key related error in any field
                const messageStr = JSON.stringify(message).toLowerCase();
                if (messageStr.includes('api key') || messageStr.includes('authentication') || 
                    messageStr.includes('unauthorized') || messageStr.includes('anthropic') ||
                    messageStr.includes('process exited') || messageStr.includes('exit code')) {
                    Logger.debug('Skipping raw API key error result message - handled by custom error handler');
                    return;
                }
            }
            
            // Skip final success result messages that are just summaries
            if (message.subtype === 'success' && message.result && typeof message.result === 'string') {
                const resultText = message.result.toLowerCase();
                // Skip if it looks like a final summary (contains phrases like "successfully created", "perfect", etc.)
                if (resultText.includes('successfully') || resultText.includes('perfect') || 
                    resultText.includes('created') || resultText.includes('variations')) {
                    Logger.debug('Skipping final summary result message');
                    return;
                }
            }
            
            let content = '';
            let resultType = 'result';
            let isError = false;
            
            if (typeof message.message === 'string') {
                content = message.message;
            } else if (message.content) {
                content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            } else if (message.text) {
                content = message.text;
            } else if (message.result && typeof message.result === 'string') {
                content = message.result;
            } else {
                // Skip messages that would result in raw JSON dump
                Logger.debug('Skipping result message with no readable content');
                return;
            }
            
            // Determine result type and error status
            if (message.subtype) {
                if (message.subtype.includes('error')) {
                    isError = true;
                    resultType = 'error';
                } else if (message.subtype === 'success') {
                    resultType = 'success';
                }
            }
            
            Logger.debug(`Extracted result content: "${content.substring(0, 200)}..."`);
            
            if (content.trim()) {
                webview.postMessage({
                    command: 'chatResponseChunk',
                    messageType: 'tool-result',
                    content: content,
                    metadata: {
                        session_id: message.session_id,
                        parent_tool_use_id: message.parent_tool_use_id,
                        result_type: resultType,
                        is_error: isError,
                        duration_ms: message.duration_ms,
                        total_cost_usd: message.total_cost_usd
                    }
                });
            }
        }
        
        // Log tool activity
        if ((message.type === 'assistant' || message.type === 'user') && ('subtype' in message) && (message.subtype === 'tool_use' || message.subtype === 'tool_result')) {
            Logger.debug(`Tool activity detected: ${message.subtype}`);
        }
    }

    async stopCurrentChat(webview: vscode.Webview): Promise<void> {
        if (this.currentRequestController) {
            Logger.info('Stopping current chat request');
            this.currentRequestController.abort();
            
            // Send stopped message back to webview
            webview.postMessage({
                command: 'chatStopped'
            });
        } else {
            Logger.info('No active chat request to stop');
        }
    }

    private processClaudeResponse(response: LLMMessage[]): string {
        let fullResponse = '';
        let assistantMessages: string[] = [];
        let toolResults: string[] = [];
        
        for (const msg of response) {
            const subtype = 'subtype' in msg ? msg.subtype : undefined;
            Logger.debug(`Processing message type: ${msg.type}${subtype ? `, subtype: ${subtype}` : ''}`);
            
            // Collect assistant messages
            if (msg.type === 'assistant' && msg.message) {
                let content = '';
                
                if (typeof msg.message === 'string') {
                    content = msg.message;
                } else if (msg.message.content && Array.isArray(msg.message.content)) {
                    content = msg.message.content
                        .filter((item: any) => item.type === 'text')
                        .map((item: any) => item.text)
                        .join('\n');
                } else if (msg.message.content && typeof msg.message.content === 'string') {
                    content = msg.message.content;
                }
                
                if (content.trim()) {
                    assistantMessages.push(content);
                }
            }
            
            // Collect tool results
            if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
                const result = typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result, null, 2);
                toolResults.push(result);
            }
            
            // Handle tool usage messages
            if ((msg.type === 'assistant' || msg.type === 'user') && ('subtype' in msg) && (msg.subtype === 'tool_use' || msg.subtype === 'tool_result')) {
                Logger.debug(`Tool activity detected: ${msg.subtype}`);
            }
        }

        // Combine all responses
        if (assistantMessages.length > 0) {
            fullResponse = assistantMessages.join('\n\n');
        }
        
        if (toolResults.length > 0 && !fullResponse.includes(toolResults[0])) {
            if (fullResponse) {
                fullResponse += '\n\n--- Tool Results ---\n' + toolResults.join('\n\n');
            } else {
                fullResponse = toolResults.join('\n\n');
            }
        }

        if (!fullResponse) {
            fullResponse = 'I processed your request but didn\'t generate a visible response. Check the console for details.';
        }

        return fullResponse;
    }
}