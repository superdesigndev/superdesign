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
        // Create user message
        const userChatMessage: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        };

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

        // Initialize response
        let finalResponse: ClaudeResponse = {
            message: assistantMessage,
            sessionId: this.currentSessionId || ''
        };

        try {
            // Call Claude Code SDK
            const messages: SDKMessage[] = [];
            
            for await (const message of query({
                prompt: userMessage,
                abortController: new AbortController(),
                options: {
                    maxTurns: 3,
                },
            })) {
                messages.push(message);

                // Handle different message types
                switch (message.type) {
                    case 'system':
                        if (message.subtype === 'init') {
                            this.currentSessionId = message.session_id;
                            finalResponse.sessionId = message.session_id;
                        }
                        break;

                    case 'assistant':
                        // Extract text content from assistant message
                        const textContent = this.extractTextFromMessage(message.message);
                        if (textContent) {
                            assistantMessage.content += textContent;
                            // Call update callback for streaming effect
                            onMessageUpdate?.(assistantMessage);
                        }
                        break;

                    case 'result':
                        if (message.subtype === 'success') {
                            // Final result - update message
                            assistantMessage.content = message.result;
                            assistantMessage.isStreaming = false;
                            finalResponse.cost = message.total_cost_usd;
                            finalResponse.duration = message.duration_ms;
                            finalResponse.sessionId = message.session_id;
                        }
                        break;
                }
            }

            // Add final assistant message to history
            this.conversationHistory.push(assistantMessage);
            
            return finalResponse;

        } catch (error) {
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