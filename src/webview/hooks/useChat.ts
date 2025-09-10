import React, { useState, useEffect, useCallback } from 'react';
import { CoreMessage } from 'ai';

// Additional metadata for UI state
interface MessageMetadata {
    timestamp?: number;
    is_loading?: boolean;
    estimated_duration?: number;
    start_time?: number;
    elapsed_time?: number;
    progress_percentage?: number;
    session_id?: string;
    result_type?: string;
    is_error?: boolean;
    duration_ms?: number;
    total_cost_usd?: number;
    // Tool-related metadata
    tool_name?: string;
    tool_id?: string;
    tool_input?: any;
    tool_result?: any;
    result_is_error?: boolean;
    result_received?: boolean;
    actions?: Array<{
        text: string;
        command: string;
        args?: string;
    }>;
}

// Message with metadata for UI
export type ChatMessage = CoreMessage & {
    metadata?: MessageMetadata;
};

export interface ChatHookResult {
    chatHistory: ChatMessage[];
    isLoading: boolean;
    sendMessage: (message: string) => void;
    clearHistory: () => void;
    setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

// Tool time estimation map (in seconds)
const TOOL_TIME_ESTIMATES: { [key: string]: number } = {
    'mcp_taskmaster-ai_initialize_project': 45,
    'mcp_taskmaster-ai_parse_prd': 180,
    'mcp_taskmaster-ai_analyze_project_complexity': 120,
    'mcp_taskmaster-ai_expand_task': 90,
    'mcp_taskmaster-ai_expand_all': 200,
    'mcp_taskmaster-ai_update_task': 60,
    'mcp_taskmaster-ai_update_subtask': 45,
    'mcp_taskmaster-ai_add_task': 75,
    'mcp_taskmaster-ai_research': 150,
    'codebase_search': 30,
    'read_file': 15,
    'edit_file': 45,
    'run_terminal_cmd': 60,
    'default': 90
};

function getToolTimeEstimate(toolName: string): number {
    if (TOOL_TIME_ESTIMATES[toolName]) {
        return TOOL_TIME_ESTIMATES[toolName];
    }
    
    for (const [key, value] of Object.entries(TOOL_TIME_ESTIMATES)) {
        if (toolName.includes(key) || key.includes(toolName)) {
            return value;
        }
    }
    
    if (toolName.includes('taskmaster') || toolName.includes('task')) {
        return 120;
    }
    if (toolName.includes('search') || toolName.includes('grep')) {
        return 30;
    }
    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write')) {
        return 25;
    }
    
    return TOOL_TIME_ESTIMATES.default;
}

function cleanIncompleteToolCalls(history: ChatMessage[]): ChatMessage[] {
    const cleanedHistory: ChatMessage[] = [];
    
    for (let i = 0; i < history.length; i++) {
        const message = history[i];
        
        if (message.role === 'assistant' && Array.isArray(message.content)) {
            // Check if this assistant message contains tool calls
            const toolCalls = message.content.filter(part => part.type === 'tool-call');
            
            if (toolCalls.length > 0) {
                // Check if all tool calls have corresponding tool results
                const hasIncompleteTools = toolCalls.some(toolCall => {
                    const toolCallId = (toolCall as any).toolCallId;
                    
                    // Look for tool result in subsequent messages
                    for (let j = i + 1; j < history.length; j++) {
                        const laterMsg = history[j];
                        if (laterMsg.role === 'tool' && Array.isArray(laterMsg.content)) {
                            const hasMatchingResult = laterMsg.content.some(
                                part => part.type === 'tool-result' && (part as any).toolCallId === toolCallId
                            );
                            if (hasMatchingResult) {
                                return false; // Tool call has result
                            }
                        }
                        // Stop looking if we hit another assistant message
                        if (laterMsg.role === 'assistant') {
                            break;
                        }
                    }
                    return true; // No matching tool result found
                });
                
                if (hasIncompleteTools) {
                    // Remove incomplete tool calls from content
                    const filteredContent = message.content.filter(part => part.type !== 'tool-call');
                    
                    if (filteredContent.length > 0) {
                        // Keep the message but without tool calls
                        cleanedHistory.push({
                            ...message,
                            content: filteredContent.length === 1 && filteredContent[0].type === 'text' 
                                ? (filteredContent[0] as any).text 
                                : filteredContent,
                            metadata: {
                                ...message.metadata,
                                is_loading: false
                            }
                        });
                    }
                    // Skip the rest of this iteration to avoid adding incomplete tools
                    continue;
                }
            }
        }
        
        // Add message normally if no incomplete tool calls
        cleanedHistory.push(message);
    }
    
    return cleanedHistory;
}

export function useChat(vscode: any): ChatHookResult {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
        // Initialize with persisted chat history from localStorage
        try {
            const saved = localStorage.getItem('superdesign-chat-history');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('Failed to load chat history from localStorage:', error);
            return [];
        }
    });
    const [isLoading, setIsLoading] = useState(false);

    // Persist chat history to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('superdesign-chat-history', JSON.stringify(chatHistory));
        } catch (error) {
            console.warn('Failed to save chat history to localStorage:', error);
        }
    }, [chatHistory]);

    const clearHistory = useCallback(() => {
        setChatHistory([]);
        // Also clear from localStorage
        try {
            localStorage.removeItem('superdesign-chat-history');
        } catch (error) {
            console.warn('Failed to clear chat history from localStorage:', error);
        }
    }, []);

    const sendMessage = useCallback((message: string) => {
        setIsLoading(true);
        
        // Clean incomplete tool calls from existing history
        const cleanedHistory = cleanIncompleteToolCalls(chatHistory);
        
        // Add user message to history
        const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            metadata: {
                timestamp: Date.now()
            }
        };
        
        const newHistory = [...cleanedHistory, userMessage];
        setChatHistory(newHistory);
        
        // Send to extension with cleaned history
        vscode.postMessage({
            command: 'chatMessage',
            message: message,
            chatHistory: newHistory
        });
    }, [chatHistory, vscode]);

    useEffect(() => {
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            
            switch (message.command) {
                case 'chatResponseChunk':
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        
                        if (message.messageType === 'assistant') {
                            // Handle assistant text messages
                            const lastMessage = newHistory[newHistory.length - 1];
                            
                            if (lastMessage && lastMessage.role === 'assistant' && typeof lastMessage.content === 'string') {
                                // Append to existing assistant message
                                newHistory[newHistory.length - 1] = {
                                    ...lastMessage,
                                    content: lastMessage.content + message.content
                                };
                            } else {
                                // Create new assistant message
                                newHistory.push({
                                    role: 'assistant',
                                    content: message.content,
                                    metadata: {
                                        timestamp: Date.now(),
                                        session_id: message.metadata?.session_id
                                    }
                                });
                            }
                        } else if (message.messageType === 'tool-call') {
                            // Handle tool calls - append to existing assistant message
                            const toolCallPart = {
                                type: 'tool-call' as const,
                                toolCallId: message.metadata?.tool_id || 'unknown',
                                toolName: message.metadata?.tool_name || 'unknown',
                                args: message.metadata?.tool_input || {}
                            };
                            
                            // Find the last assistant message and append tool call to it
                            const lastMessage = newHistory[newHistory.length - 1];
                            const lastIndex = newHistory.length - 1;
                            
                            if (lastMessage && lastMessage.role === 'assistant') {
                                // Convert content to array format and append tool call
                                let newContent;
                                if (typeof lastMessage.content === 'string') {
                                    // Convert string to array with text part + tool call part
                                    newContent = [
                                        { type: 'text', text: lastMessage.content },
                                        toolCallPart
                                    ];
                                } else if (Array.isArray(lastMessage.content)) {
                                    // Append to existing array
                                    newContent = [...lastMessage.content, toolCallPart];
                                } else {
                                    // Fallback: create new array
                                    newContent = [toolCallPart];
                                }
                                
                                newHistory[lastIndex] = {
                                    ...lastMessage,
                                    content: newContent as any,
                                    metadata: {
                                        ...lastMessage.metadata,
                                        is_loading: true,
                                        estimated_duration: 90,
                                        start_time: Date.now(),
                                        progress_percentage: 0
                                    }
                                };
                            } else {
                                // No assistant message to append to, create new one
                                newHistory.push({
                                    role: 'assistant',
                                    content: [toolCallPart],
                                    metadata: {
                                        timestamp: Date.now(),
                                        session_id: message.metadata?.session_id,
                                        is_loading: true,
                                        estimated_duration: 90,
                                        start_time: Date.now(),
                                        progress_percentage: 0
                                    }
                                });
                            }
                        } else if (message.messageType === 'tool-result') {
                            // Create tool result message matching the tool call ID
                            newHistory.push({
                                role: 'tool',
                                content: [{
                                    type: 'tool-result',
                                    toolCallId: message.metadata?.tool_id || 'unknown',
                                    toolName: message.metadata?.tool_name || 'unknown',
                                    result: message.content || '',
                                    isError: false
                                }]
                            });
                        }
                        
                        return newHistory;
                    });
                    break;

                case 'chatToolUpdate':
                    // Update tool parameters during streaming
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        
                        // Find the most recent tool call message with matching ID
                        for (let i = newHistory.length - 1; i >= 0; i--) {
                            const msg = newHistory[i];
                            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                                const toolCallIndex = msg.content.findIndex(
                                    part => part.type === 'tool-call' && (part as any).toolCallId === message.tool_use_id
                                );
                                
                                if (toolCallIndex !== -1) {
                                    // Update the tool call args
                                    const updatedContent = [...msg.content];
                                    updatedContent[toolCallIndex] = {
                                        ...updatedContent[toolCallIndex],
                                        args: message.tool_input
                                    } as any;
                                    
                                    newHistory[i] = {
                                        ...msg,
                                        content: updatedContent
                                    };
                                    break;
                                }
                            }
                        }
                        
                        return newHistory;
                    });
                    break;

                case 'chatToolResult':
                    // Complete tool loading state
                    console.log('Received tool result for:', message.tool_use_id);
                    setChatHistory(prev => {
                        const newHistory = [...prev];
                        
                        // Find and complete tool loading
                        for (let i = newHistory.length - 1; i >= 0; i--) {
                            const msg = newHistory[i];
                            if (msg.role === 'assistant' && Array.isArray(msg.content) && msg.metadata?.is_loading) {
                                const hasMatchingToolCall = msg.content.some(
                                    part => part.type === 'tool-call' && (part as any).toolCallId === message.tool_use_id
                                );
                                
                                if (hasMatchingToolCall) {
                                    newHistory[i] = {
                                        ...msg,
                                        metadata: {
                                            ...msg.metadata,
                                            is_loading: false,
                                            progress_percentage: 100,
                                            elapsed_time: msg.metadata.estimated_duration || 90
                                        }
                                    };
                                    break;
                                }
                            }
                        }
                        
                        return newHistory;
                    });
                    break;
                    
                case 'chatStreamEnd':
                    console.log('Chat stream ended');
                    setIsLoading(false);
                    break;
                    
                case 'chatErrorWithActions':
                    // Handle API key and authentication errors with action buttons
                    console.log('Chat error with actions:', message.error);
                    setIsLoading(false);
                    
                    const errorMessage: ChatMessage = {
                        role: 'assistant',
                        content: `❌ **${message.error}**\n\nPlease configure your API key to use this AI model.`,
                        metadata: {
                            timestamp: Date.now(),
                            is_error: true,
                            actions: message.actions || []
                        }
                    };
                    
                    setChatHistory(prev => [...prev, errorMessage]);
                    break;
                    
                case 'chatError':
                    // Handle general errors
                    console.log('Chat error:', message.error);
                    setIsLoading(false);
                    
                    const generalErrorMessage: ChatMessage = {
                        role: 'assistant',
                        content: `❌ **Error**: ${message.error}`,
                        metadata: {
                            timestamp: Date.now(),
                            is_error: true
                        }
                    };
                    
                    setChatHistory(prev => [...prev, generalErrorMessage]);
                    break;
                    
                case 'chatStopped':
                    console.log('Chat was stopped');
                    setIsLoading(false);
                    break;
                    
                default:
                    break;
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, []);

    return {
        chatHistory,
        isLoading,
        sendMessage,
        clearHistory,
        setChatHistory
    };
} 