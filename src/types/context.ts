export type WebviewLayout = 'sidebar' | 'panel';

export interface WebviewContext {
    layout: WebviewLayout;
    extensionUri: string;
    viewType?: 'chat' | 'registry' | 'canvas';
    logoUris?: {
        cursor: string;
        windsurf: string;
        claudeCode: string;
        lovable: string;
        bolt: string;
    };
}

export interface WebviewMessage {
    command: string;
    [key: string]: any;
}

export interface ChatCommand extends WebviewMessage {
    command: 'chatWithClaude';
    message: string;
}

export interface ChatResponse extends WebviewMessage {
    command: 'chatResponse';
    response: string;
}

export interface ChatError extends WebviewMessage {
    command: 'chatError';
    error: string;
}

export interface StopChatCommand extends WebviewMessage {
    command: 'stopChat';
}

export interface ChatStopped extends WebviewMessage {
    command: 'chatStopped';
}

export interface InitContext extends WebviewMessage {
    command: 'initContext';
    context: WebviewContext;
} 