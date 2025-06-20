// Import and re-export from service for convenience
import type { ChatMessage, ClaudeResponse } from '../services/claudeService';
export type { ChatMessage, ClaudeResponse };

// Message types for webview communication
export interface WebviewMessage {
    command: string;
    data?: any;
}

export interface SendMessageCommand extends WebviewMessage {
    command: 'sendMessage';
    data: {
        message: string;
    };
}

export interface MessageUpdateCommand extends WebviewMessage {
    command: 'messageUpdate';
    data: {
        message: ChatMessage;
    };
}

export interface MessageCompleteCommand extends WebviewMessage {
    command: 'messageComplete';
    data: {
        response: ClaudeResponse;
    };
}

export interface ErrorCommand extends WebviewMessage {
    command: 'error';
    data: {
        error: string;
    };
}

// Union type for all possible commands
export type ChatCommand = 
    | SendMessageCommand 
    | MessageUpdateCommand 
    | MessageCompleteCommand 
    | ErrorCommand; 