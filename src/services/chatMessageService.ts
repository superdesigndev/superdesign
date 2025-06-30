import * as vscode from 'vscode';
import { CodingAgentService } from '../core/agent-factory';

interface MessageMetadata {
    session_id?: string;
    parent_tool_use_id?: string;
    agent_type?: string;
    timestamp?: number;
    tool_name?: string;
    tool_id?: string;
    tool_input?: any;
    result_type?: string;
    is_error?: boolean;
    duration_ms?: number;
    total_cost_usd?: number;
    streaming_args?: string; // Raw accumulated tool call arguments during streaming
}

interface StreamMessage {
    command: string;
    messageType?: string;
    content?: string;
    subtype?: string;
    metadata?: MessageMetadata;
    tool_use_id?: string;
    error?: string;
}

export class ChatMessageService {
    private currentRequestController?: AbortController;
    private currentAgentType: string = 'unknown';
    private messageBuffer: string[] = [];
    private lastActivityTime: number = Date.now();

    constructor(
        private agentService: CodingAgentService,
        private outputChannel: vscode.OutputChannel
    ) {
        this.detectAgentType();
    }

    /**
     * Detect the current agent type for optimized message handling
     */
    private detectAgentType(): void {
        try {
            const config = vscode.workspace.getConfiguration('superdesign');
            this.currentAgentType = config.get('agentProvider', 'claude-code');
            this.outputChannel.appendLine(`ChatMessageService initialized with agent type: ${this.currentAgentType}`);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to detect agent type: ${error}`);
            this.currentAgentType = 'claude-code'; // Fallback
        }
    }

    /**
     * Enhanced chat message handler with agent-specific optimizations
     */
    async handleChatMessage(message: any, webview: vscode.Webview): Promise<void> {
        const startTime = Date.now();
        this.lastActivityTime = startTime;
        
        // Re-detect agent type to ensure we have the latest configuration
        this.detectAgentType();
        
        try {
            this.outputChannel.appendLine(`💬 ChatMessageService: Handling message with agent type: ${this.currentAgentType}`);
            this.outputChannel.appendLine(`💬 ChatMessageService: Message preview: "${message.message?.substring(0, 100)}..."`);
            this.outputChannel.appendLine(`💬 ChatMessageService: Agent service type: ${this.agentService.constructor.name}`);
            
            // Create new AbortController for this request
            this.currentRequestController = new AbortController();
            
            // Send initial streaming start message with agent info
            webview.postMessage({
                command: 'chatStreamStart',
                metadata: {
                    agent_type: this.currentAgentType,
                    timestamp: startTime
                }
            });
            
            // Clear message buffer for new conversation
            this.messageBuffer = [];
            
            // Enhanced query with agent-specific handling
            const response = await this.queryWithAgentOptimization(
                message.message,
                webview,
                this.currentRequestController
            );

            // Check if request was aborted
            if (this.currentRequestController.signal.aborted) {
                this.outputChannel.appendLine('Request was aborted');
                return;
            }

            const duration = Date.now() - startTime;
            this.outputChannel.appendLine(`[${this.currentAgentType}] Response completed in ${duration}ms with ${response.length} messages`);

            // Send stream end message with summary
            webview.postMessage({
                command: 'chatStreamEnd',
                metadata: {
                    agent_type: this.currentAgentType,
                    duration_ms: duration,
                    message_count: response.length,
                    timestamp: Date.now()
                }
            });

        } catch (error) {
            await this.handleChatError(error, webview, startTime);
        } finally {
            // Clear the controller when done
            this.currentRequestController = undefined;
        }
    }

    /**
     * Agent-optimized query method
     */
    private async queryWithAgentOptimization(
        message: string,
        webview: vscode.Webview,
        controller: AbortController
    ): Promise<any[]> {
        
        // Add SuperDesign-specific context for custom agents
        if (this.currentAgentType === 'custom') {
            message = this.enhanceMessageForSuperDesign(message);
        }

        return this.agentService.query(
            message,
            undefined,
            controller,
            (streamMessage: any) => {
                this.handleStreamMessageOptimized(streamMessage, webview);
            }
        );
    }

    /**
     * Enhance messages with SuperDesign-specific context
     */
    private enhanceMessageForSuperDesign(message: string): string {
        const designKeywords = ['design', 'ui', 'interface', 'component', 'layout', 'style', 'visual'];
        const hasDesignContext = designKeywords.some(keyword => 
            message.toLowerCase().includes(keyword)
        );

        if (hasDesignContext) {
            const enhancedMessage = `[SuperDesign Context] ${message}

Please consider:
- Modern design principles and best practices
- Accessibility and usability standards  
- Responsive design patterns
- Component reusability
- Design system consistency`;

            this.outputChannel.appendLine('Enhanced message with SuperDesign context');
            return enhancedMessage;
        }

        return message;
    }

    /**
     * Enhanced stream message handler with better performance
     */
    private handleStreamMessageOptimized(message: any, webview: vscode.Webview): void {
        this.lastActivityTime = Date.now();
        
        const subtype = 'subtype' in message ? message.subtype : undefined;
        this.outputChannel.appendLine(`[${this.currentAgentType}] Stream: ${message.type}${subtype ? `:${subtype}` : ''}`);
        
        // Skip system messages early
        if (message.type === 'system') {
            return;
        }

        // Create base metadata
        const baseMetadata: MessageMetadata = {
            session_id: message.session_id,
            parent_tool_use_id: message.parent_tool_use_id,
            agent_type: this.currentAgentType,
            timestamp: this.lastActivityTime
        };

        // Route to appropriate handler based on message type
        switch (message.type) {
            case 'user':
                this.handleUserMessage(message, webview, baseMetadata);
                break;
            case 'assistant':
                this.handleAssistantMessage(message, webview, baseMetadata);
                break;
            case 'result':
                this.handleResultMessage(message, webview, baseMetadata);
                break;
            // Handle streaming tool call updates
            case 'tool-call-update':
                this.handleToolCallUpdate(message, webview, baseMetadata);
                break;
            default:
                this.outputChannel.appendLine(`Unknown message type: ${message.type}`);
        }
    }

    /**
     * Enhanced user message handler
     */
    private handleUserMessage(message: any, webview: vscode.Webview, metadata: MessageMetadata): void {
        // Handle direct content from SuperDesign agent
        if (message.content && typeof message.content === 'string') {
            this.sendMessageToWebview(webview, {
                command: 'chatResponseChunk',
                messageType: 'user',
                content: message.content,
                metadata
            });
            return;
        }

        // Handle legacy message.message format (for Claude Code compatibility)
        if (!message.message) {return;}

        if (typeof message.message === 'string') {
            this.sendMessageToWebview(webview, {
                command: 'chatResponseChunk',
                messageType: 'user',
                content: message.message,
                metadata
            });
        } else if (message.message.content && Array.isArray(message.message.content)) {
            // Handle tool results and text content
            message.message.content.forEach((item: any) => {
                if (item.type === 'tool_result' && item.tool_use_id) {
                    this.handleToolResult(item, webview, metadata);
                } else if (item.type === 'text' && item.text) {
                    this.sendMessageToWebview(webview, {
                        command: 'chatResponseChunk',
                        messageType: 'user',
                        content: item.text,
                        metadata
                    });
                }
            });
        } else if (message.message.content || message.message.text) {
            const content = message.message.content || message.message.text;
            this.sendMessageToWebview(webview, {
                command: 'chatResponseChunk',
                messageType: 'user',
                content,
                metadata
            });
        }
    }

    /**
     * Enhanced assistant message handler
     */
    private handleAssistantMessage(message: any, webview: vscode.Webview, metadata: MessageMetadata): void {
        // Handle streaming text deltas for real-time typing effect
        if (message.subtype === 'text_delta' && message.content) {
            this.sendMessageToWebview(webview, {
                command: 'chatTextDelta',
                content: message.content,
                metadata
            });
            return;
        }

        // Handle direct content from SuperDesign agent
        if (message.content && typeof message.content === 'string') {
            this.messageBuffer.push(message.content);
            this.sendMessageToWebview(webview, {
                command: 'chatResponseChunk',
                messageType: 'assistant',
                content: message.content,
                metadata
            });
            return;
        }

        // Handle legacy message.message format (for Claude Code compatibility)
        if (!message.message) {return;}

        if (typeof message.message === 'string') {
            this.messageBuffer.push(message.message);
            this.sendMessageToWebview(webview, {
                command: 'chatResponseChunk',
                messageType: 'assistant',
                content: message.message,
                metadata
            });
        } else if (message.message.content && Array.isArray(message.message.content)) {
            message.message.content.forEach((item: any) => {
                if (item.type === 'text' && item.text) {
                    this.messageBuffer.push(item.text);
                    this.sendMessageToWebview(webview, {
                        command: 'chatResponseChunk',
                        messageType: 'assistant',
                        content: item.text,
                        metadata
                    });
                } else if (item.type === 'tool_use') {
                    this.handleToolUse(item, webview, metadata);
                }
            });
        } else if (message.message.type === 'text') {
            const content = message.message.text || '';
            this.messageBuffer.push(content);
            this.sendMessageToWebview(webview, {
                command: 'chatResponseChunk',
                messageType: 'assistant',
                content,
                metadata
            });
        } else if (message.message.content || message.message.text) {
            const content = message.message.content || message.message.text;
            this.messageBuffer.push(content);
            this.sendMessageToWebview(webview, {
                command: 'chatResponseChunk',
                messageType: 'assistant',
                content,
                metadata
            });
        }
    }

    /**
     * Handle tool usage messages
     */
    private handleToolUse(item: any, webview: vscode.Webview, metadata: MessageMetadata): void {
        this.outputChannel.appendLine(`[TOOL DEBUG] handleToolUse called with: ${JSON.stringify(item, null, 2)}`);
        
        const toolMetadata = {
            ...metadata,
            tool_name: item.name || 'Unknown Tool',
            tool_id: item.id,
            tool_input: item.input || {}
        };

        this.outputChannel.appendLine(`[TOOL DEBUG] Sending tool call with ID: ${item.id}`);

        this.sendMessageToWebview(webview, {
            command: 'chatResponseChunk',
            messageType: 'tool',
            content: '',
            subtype: 'tool_use',
            metadata: toolMetadata
        });

        // Log tool usage for SuperDesign analytics
        if (this.currentAgentType === 'custom') {
            this.logSuperDesignToolUsage(item.name, item.input);
        }
    }

    /**
     * Handle tool result messages
     */
    private handleToolResult(item: any, webview: vscode.Webview, metadata: MessageMetadata): void {
        this.outputChannel.appendLine(`[TOOL DEBUG] handleToolResult called with: ${JSON.stringify(item, null, 2)}`);
        
        const resultContent = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
        
        this.outputChannel.appendLine(`[TOOL DEBUG] Sending tool result for ID: ${item.tool_use_id}`);
        
        this.sendMessageToWebview(webview, {
            command: 'chatToolResult',
            tool_use_id: item.tool_use_id,
            content: resultContent,
            metadata: {
                ...metadata,
                is_error: item.is_error || false
            }
        });
    }

    /**
     * Handle streaming tool call argument updates
     */
    private handleToolCallUpdate(message: any, webview: vscode.Webview, metadata: MessageMetadata): void {
        this.outputChannel.appendLine(`[TOOL STREAM DEBUG] handleToolCallUpdate called with: ${JSON.stringify(message, null, 2)}`);
        
        // Try to parse the accumulated arguments JSON
        let parsedArgs = {};
        try {
            if (message.accumulatedArgs && message.accumulatedArgs.trim()) {
                // Only try to parse if the string looks like complete JSON (ends with })
                const trimmedArgs = message.accumulatedArgs.trim();
                if (trimmedArgs.endsWith('}') || trimmedArgs.endsWith('}"}')) {
                    parsedArgs = JSON.parse(trimmedArgs);
                }
            }
        } catch (error) {
            // If parsing fails, keep empty object (partial JSON still streaming)
            this.outputChannel.appendLine(`[TOOL STREAM DEBUG] Could not parse args JSON (normal during streaming): ${error}`);
        }
        
        this.sendMessageToWebview(webview, {
            command: 'chatToolCallUpdate',
            tool_use_id: message.toolCallId,
            content: message.accumulatedArgs || '',
            subtype: message.subtype, // 'streaming_start', 'streaming_delta', 'streaming_complete'
            metadata: {
                ...metadata,
                tool_name: message.toolName,
                tool_id: message.toolCallId,
                tool_input: parsedArgs, // Send parsed JSON object instead of raw string
                streaming_args: message.accumulatedArgs // Keep raw string for display
            }
        });
    }

    /**
     * Enhanced result message handler
     */
    private handleResultMessage(message: any, webview: vscode.Webview, metadata: MessageMetadata): void {
        // Check if this is a tool result (has parent_tool_use_id)
        if (message.parent_tool_use_id) {
            // This is a tool result - route to handleToolResult
            const toolResultItem = {
                tool_use_id: message.parent_tool_use_id,
                content: this.extractResultContent(message),
                is_error: this.isErrorResult(message)
            };
            this.handleToolResult(toolResultItem, webview, metadata);
            return;
        }

        // Skip summary messages to reduce noise
        if (this.shouldSkipResultMessage(message)) {
            return;
        }

        const content = this.extractResultContent(message);
        if (!content.trim()) {return;}

        const resultMetadata = {
            ...metadata,
            result_type: this.determineResultType(message),
            is_error: this.isErrorResult(message),
            duration_ms: message.duration_ms,
            total_cost_usd: message.total_cost_usd
        };

        this.sendMessageToWebview(webview, {
            command: 'chatResponseChunk',
            messageType: 'tool-result',
            content,
            metadata: resultMetadata
        });
    }

    /**
     * Determine if result message should be skipped
     */
    private shouldSkipResultMessage(message: any): boolean {
        if (message.subtype === 'success' && message.result && typeof message.result === 'string') {
            const resultText = message.result.toLowerCase();
            const skipPhrases = ['successfully', 'perfect', 'created', 'variations', 'completed'];
            return skipPhrases.some(phrase => resultText.includes(phrase));
        }
        return false;
    }

    /**
     * Extract content from result message
     */
    private extractResultContent(message: any): string {
        if (typeof message.message === 'string') {
            return message.message;
        } else if (message.content) {
            return typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        } else if (message.text) {
            return message.text;
        }
        return JSON.stringify(message);
    }

    /**
     * Determine result type
     */
    private determineResultType(message: any): string {
        if (message.subtype) {
            if (message.subtype.includes('error')) {return 'error';}
            if (message.subtype === 'success') {return 'success';}
        }
        return 'result';
    }

    /**
     * Check if result is an error
     */
    private isErrorResult(message: any): boolean {
        return message.subtype && message.subtype.includes('error');
    }

    /**
     * Send message to webview with error handling
     */
    private sendMessageToWebview(webview: vscode.Webview, message: StreamMessage): void {
        try {
            webview.postMessage(message);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to send message to webview: ${error}`);
        }
    }

    /**
     * Log tool usage for SuperDesign analytics
     */
    private logSuperDesignToolUsage(toolName: string, input: any): void {
        const designTools = ['write', 'edit', 'read', 'multiedit'];
        if (designTools.includes(toolName?.toLowerCase())) {
            this.outputChannel.appendLine(`[SuperDesign Analytics] Design tool used: ${toolName}`);
            
            // Could be extended to send analytics to external service
            if (toolName === 'write' && (input?.path?.includes('.css') || input?.path?.includes('.scss'))) {
                this.outputChannel.appendLine('[SuperDesign Analytics] CSS file created/modified');
            }
        }
    }

    /**
     * Enhanced error handling with agent-specific strategies
     */
    private async handleChatError(error: any, webview: vscode.Webview, startTime: number): Promise<void> {
        // Check if the error is due to abort
        if (this.currentRequestController?.signal.aborted) {
            this.outputChannel.appendLine('Request was stopped by user');
            webview.postMessage({
                command: 'chatStopped',
                metadata: {
                    agent_type: this.currentAgentType,
                    duration_ms: Date.now() - startTime
                }
            });
            return;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const duration = Date.now() - startTime;
        
        this.outputChannel.appendLine(`[${this.currentAgentType}] Chat failed after ${duration}ms: ${errorMessage}`);

        // Agent-specific error handling
        if (this.currentAgentType === 'custom' && errorMessage.includes('API key')) {
            vscode.window.showErrorMessage(
                'SuperDesign Custom Agent: Please check your API key configuration in settings.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'superdesign');
                }
            });
        } else if (this.currentAgentType === 'claude-code' && errorMessage.includes('Claude Code')) {
            vscode.window.showErrorMessage(
                'Claude Code service error. Try switching to SuperDesign Custom Agent.',
                'Switch Agent'
            ).then(selection => {
                if (selection === 'Switch Agent') {
                    vscode.commands.executeCommand('superdesign.switchAgent');
                }
            });
        } else {
            vscode.window.showErrorMessage(`Chat failed: ${errorMessage}`);
        }
        
        // Send error response back to webview
        webview.postMessage({
            command: 'chatError',
            error: errorMessage,
            metadata: {
                agent_type: this.currentAgentType,
                duration_ms: duration,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Enhanced stop functionality
     */
    async stopCurrentChat(webview: vscode.Webview): Promise<void> {
        if (this.currentRequestController) {
            this.outputChannel.appendLine(`[${this.currentAgentType}] Stopping current chat request`);
            this.currentRequestController.abort();
            
            // Send stopped message back to webview
            webview.postMessage({
                command: 'chatStopped',
                metadata: {
                    agent_type: this.currentAgentType,
                    timestamp: Date.now()
                }
            });
        } else {
            this.outputChannel.appendLine('No active chat request to stop');
        }
    }

    /**
     * Get current chat statistics
     */
    getChatStatistics(): any {
        return {
            agent_type: this.currentAgentType,
            message_buffer_length: this.messageBuffer.length,
            last_activity: this.lastActivityTime,
            is_active: !!this.currentRequestController
        };
    }

    /**
     * Clear message buffer and reset state
     */
    clearChatHistory(): void {
        this.messageBuffer = [];
        this.lastActivityTime = Date.now();
        this.outputChannel.appendLine(`[${this.currentAgentType}] Chat history cleared`);
    }

    /**
     * Legacy method for backward compatibility
     */
    private processClaudeResponse(response: any[]): string {
        let fullResponse = '';
        let assistantMessages: string[] = [];
        let toolResults: string[] = [];
        
        for (const msg of response) {
            const subtype = 'subtype' in msg ? msg.subtype : undefined;
            this.outputChannel.appendLine(`Processing message type: ${msg.type}${subtype ? `, subtype: ${subtype}` : ''}`);
            
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
                this.outputChannel.appendLine(`Tool activity detected: ${msg.subtype}`);
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