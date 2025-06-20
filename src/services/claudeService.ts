import { query, type SDKMessage } from "@anthropic-ai/claude-code";

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

export interface ClaudeResponse {
    message: ChatMessage;
    sessionId: string;
    cost?: number;
    duration?: number;
}

export class ClaudeService {
    private currentSessionId: string | null = null;
    private conversationHistory: ChatMessage[] = [];

    /**
     * Send a message to Claude and get streaming response
     */
    async sendMessage(
        userMessage: string,
        onMessageUpdate?: (message: ChatMessage) => void
    ): Promise<ClaudeResponse> {
        console.log('ClaudeService.sendMessage called with message:', userMessage);
        console.log('Update callback provided:', !!onMessageUpdate);
        console.log('Environment check - ANTHROPIC_API_KEY available:', !!process.env.ANTHROPIC_API_KEY);
        console.log('Process env keys:', Object.keys(process.env).filter(k => k.includes('ANTHROP')));
        
        // Create user message
        const userChatMessage: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        };

        console.log('Created user message:', userChatMessage);

        // Add to history
        this.conversationHistory.push(userChatMessage);

        // Create assistant message for streaming updates
        const assistantMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true
        };

        console.log('Created assistant message:', assistantMessage);

        // Initialize response
        let finalResponse: ClaudeResponse = {
            message: assistantMessage,
            sessionId: this.currentSessionId || ''
        };

        try {
            console.log('Starting Claude SDK query...');
            // Call Claude Code SDK
            const messages: SDKMessage[] = [];
            
            for await (const message of query({
                prompt: userMessage,
                abortController: new AbortController(),
                options: {
                    maxTurns: 3,
                },
            })) {
                console.log('Received message from Claude SDK:', message);
                messages.push(message);

                // Handle different message types
                switch (message.type) {
                    case 'system':
                        console.log('System message:', message);
                        if (message.subtype === 'init') {
                            this.currentSessionId = message.session_id;
                            finalResponse.sessionId = message.session_id;
                        }
                        break;

                    case 'assistant':
                        console.log('Assistant message:', message);
                        // Extract text content from assistant message
                        const textContent = this.extractTextFromMessage(message.message);
                        console.log('Extracted text content:', textContent);
                        if (textContent) {
                            assistantMessage.content += textContent;
                            console.log('Updated assistant content:', assistantMessage.content);
                            // Call update callback for streaming effect
                            console.log('Calling onMessageUpdate...');
                            onMessageUpdate?.(assistantMessage);
                        }
                        break;

                    case 'result':
                        console.log('Result message:', message);
                        if (message.subtype === 'success') {
                            // Final result - update message
                            assistantMessage.content = message.result;
                            assistantMessage.isStreaming = false;
                            finalResponse.cost = message.total_cost_usd;
                            finalResponse.duration = message.duration_ms;
                            finalResponse.sessionId = message.session_id;
                            console.log('Updated final response:', finalResponse);
                        }
                        break;
                        
                    default:
                        console.log('Unknown message type:', message.type);
                }
            }

            console.log('Query complete, adding to history');
            // Add final assistant message to history
            this.conversationHistory.push(assistantMessage);
            
            console.log('Returning final response:', finalResponse);
            return finalResponse;

        } catch (error) {
            console.error('Error in ClaudeService.sendMessage:', error);
            // Handle errors
            const errorMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
                timestamp: new Date(),
                isStreaming: false
            };

            return {
                message: errorMessage,
                sessionId: this.currentSessionId || ''
            };
        }
    }

    /**
     * Get conversation history
     */
    getHistory(): ChatMessage[] {
        return [...this.conversationHistory];
    }

    /**
     * Clear conversation history
     */
    clearHistory(): void {
        this.conversationHistory = [];
        this.currentSessionId = null;
    }

    /**
     * Get current session ID
     */
    getSessionId(): string | null {
        return this.currentSessionId;
    }

    /**
     * Extract text content from Claude assistant message
     */
    private extractTextFromMessage(message: any): string {
        if (!message?.content) {
            return '';
        }
        
        // Handle array of content blocks
        if (Array.isArray(message.content)) {
            return message.content
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text)
                .join('');
        }
        
        // Handle direct text content
        if (typeof message.content === 'string') {
            return message.content;
        }
        
        return '';
    }

    /**
     * Generate unique ID for messages
     */
    private generateId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
} 