import { useState, useEffect, useCallback } from 'react';

export interface ChatMessage {
    type: 'user' | 'assistant' | 'result' | 'user-input' | 'tool' | 'tool-result' | 'tool-group';
    message: string;
    timestamp?: number;
    subtype?: string;
    metadata?: {
        duration_ms?: number;
        total_cost_usd?: number;
        is_error?: boolean;
        num_turns?: number;
        tool_name?: string;
        tool_id?: string;
        tool_input?: any;
        session_id?: string;
        parent_tool_use_id?: string;
        result_type?: string;
        tool_result?: string;
        result_is_error?: boolean;
        result_received?: boolean;
        group_id?: string;
        is_loading?: boolean;
        child_tools?: ChatMessage[];
        // Enhanced loading states
        estimated_duration?: number;
        start_time?: number;
        elapsed_time?: number;
        progress_percentage?: number;
        streaming_args?: string;
        streaming_subtype?: string;
    };
}

export interface ChatHookResult {
    chatHistory: ChatMessage[];
    isLoading: boolean;
    sendMessage: (message: string) => void;
    stopResponse: () => void;
    clearHistory: () => void;
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
    'default': 90 // Default for unknown tools
};

function getToolTimeEstimate(toolName: string): number {
    // Check for exact match first
    if (TOOL_TIME_ESTIMATES[toolName]) {
        return TOOL_TIME_ESTIMATES[toolName];
    }
    
    // Check for partial matches for similar tools
    for (const [key, value] of Object.entries(TOOL_TIME_ESTIMATES)) {
        if (toolName.includes(key) || key.includes(toolName)) {
            return value;
        }
    }
    
    // Special cases based on tool name patterns
    if (toolName.includes('taskmaster') || toolName.includes('task')) {
        return 120; // Task-related tools tend to be slower
    }
    if (toolName.includes('search') || toolName.includes('grep')) {
        return 30; // Search tools are usually faster
    }
    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write')) {
        return 25; // File operations are usually quick
    }
    
    return TOOL_TIME_ESTIMATES.default;
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

    // Timer for updating tool progress
    useEffect(() => {
        const interval = setInterval(() => {
            setChatHistory(prev => {
                const newHistory = [...prev];
                let hasUpdates = false;

                // Helper function to update tool progress recursively
                const updateToolProgress = (messages: ChatMessage[]) => {
                    messages.forEach(msg => {
                        if ((msg.type === 'tool' || msg.type === 'tool-group') && msg.metadata?.is_loading) {
                            const startTime = msg.metadata.start_time || Date.now();
                            const estimatedDuration = msg.metadata.estimated_duration || 90;
                            const elapsed = (Date.now() - startTime) / 1000; // in seconds
                            const progress = Math.min((elapsed / estimatedDuration) * 100, 95); // Cap at 95% until complete

                            msg.metadata.elapsed_time = elapsed;
                            msg.metadata.progress_percentage = progress;
                            hasUpdates = true;
                        }

                        // Update child tools in groups
                        if (msg.type === 'tool-group' && msg.metadata?.child_tools) {
                            updateToolProgress(msg.metadata.child_tools);
                        }
                    });
                };

                updateToolProgress(newHistory);
                return hasUpdates ? newHistory : prev;
            });
        }, 1000); // Update every second

        return () => clearInterval(interval);
    }, []);

    // Function to auto-collapse previous tool messages
    const autoCollapseTools = () => {
        // Signal to ChatInterface to collapse all but the last tool/tool-result
        window.dispatchEvent(new CustomEvent('autoCollapseTools'));
    };

    useEffect(() => {
        const messageHandler = (event: MessageEvent) => {
            const message = event.data;
            console.log('Frontend received message:', message);
            
            try {
                switch (message.command) {
                    case 'chatStreamStart':
                        console.log('Starting new chat stream');
                        // Auto-collapse previous tools when starting new stream
                        autoCollapseTools();
                        // Initialize a new assistant message for streaming
                        setChatHistory(prev => [...prev, {
                            type: 'assistant',
                            message: '',
                            timestamp: Date.now()
                        }]);
                        break;
                        
                    case 'chatTextDelta':
                        // Handle real-time character-by-character streaming
                        console.log('Received text delta:', message.content?.substring(0, 50) + '...');
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const lastIndex = newHistory.length - 1;
                            const lastMessage = newHistory[lastIndex];
                            
                            if (lastMessage && lastMessage.type === 'assistant') {
                                // Simple delta accumulation without modification
                                // The AI is already sending correct markdown formatting
                                newHistory[lastIndex] = {
                                    ...lastMessage,
                                    message: (lastMessage.message || '') + (message.content || ''),
                                    metadata: { ...lastMessage.metadata, ...message.metadata }
                                };
                            } else {
                                // Create new assistant message if none exists
                                newHistory.push({
                                    type: 'assistant',
                                    message: message.content || '',
                                    timestamp: Date.now(),
                                    metadata: message.metadata || {}
                                });
                            }
                            
                            return newHistory;
                        });
                        break;
                        
                    case 'chatResponseChunk':
                        console.log('Received chunk:', message.messageType, message.content?.substring(0, 100));
                        setChatHistory(prev => {
                            if (prev.length === 0) {
                                console.warn('Received chunk but no messages in history');
                                return prev;
                            }
                            
                            const newHistory = [...prev];
                            
                            if (message.messageType === 'tool') {
                                // Add new tool message with loading state
                                console.log('Adding tool message:', message.metadata?.tool_name);
                                
                                const parentToolId = message.metadata?.parent_tool_use_id;
                                const toolName = message.metadata?.tool_name || 'Unknown Tool';
                                const estimatedDuration = getToolTimeEstimate(toolName);
                                const startTime = Date.now();
                                
                                const newTool: ChatMessage = {
                                    type: 'tool',
                                    message: message.content || '',
                                    timestamp: Date.now(),
                                    subtype: message.subtype,
                                    metadata: {
                                        ...message.metadata,
                                        is_loading: true, // Start in loading state
                                        estimated_duration: estimatedDuration,
                                        start_time: startTime,
                                        elapsed_time: 0,
                                        progress_percentage: 0
                                    }
                                };
                                
                                if (parentToolId) {
                                    // This tool has a parent - try to group it
                                    const parentGroupIndex = newHistory.findIndex(msg => 
                                        (msg.type === 'tool-group' && msg.metadata?.group_id === parentToolId) ||
                                        (msg.type === 'tool' && msg.metadata?.tool_id === parentToolId)
                                    );
                                    
                                    if (parentGroupIndex !== -1) {
                                        // Add to existing group
                                        const parentMsg = newHistory[parentGroupIndex];
                                        if (parentMsg.type === 'tool-group') {
                                            parentMsg.metadata!.child_tools = parentMsg.metadata!.child_tools || [];
                                            parentMsg.metadata!.child_tools.push(newTool);
                                        } else {
                                            // Convert parent tool to group and add this tool as child
                                            newHistory[parentGroupIndex] = {
                                                type: 'tool-group',
                                                message: parentMsg.message,
                                                timestamp: parentMsg.timestamp,
                                                subtype: parentMsg.subtype,
                                                metadata: {
                                                    ...parentMsg.metadata,
                                                    group_id: parentToolId,
                                                    child_tools: [parentMsg, newTool]
                                                }
                                            };
                                        }
                                    } else {
                                        // Parent not found, add as standalone tool
                                        newHistory.push(newTool);
                                    }
                                } else {
                                    // No parent, add as standalone tool
                                    newHistory.push(newTool);
                                }
                            } else if (message.messageType === 'tool-result') {
                                // Add new tool result message
                                console.log('Adding tool result:', message.metadata?.result_type);
                                newHistory.push({
                                    type: 'tool-result',
                                    message: message.content || '',
                                    timestamp: Date.now(),
                                    subtype: message.subtype,
                                    metadata: message.metadata || {}
                                });
                            } else {
                                // Find the last message of the same type or create new one
                                const lastIndex = newHistory.length - 1;
                                const lastMessage = newHistory[lastIndex];
                                
                                if (lastMessage && lastMessage.type === message.messageType) {
                                    // Append to existing message
                                    newHistory[lastIndex] = {
                                        ...lastMessage,
                                        message: lastMessage.message + message.content,
                                        subtype: message.subtype,
                                        metadata: { ...lastMessage.metadata, ...message.metadata }
                                    };
                                } else {
                                    // Create new message
                                    newHistory.push({
                                        type: message.messageType,
                                        message: message.content || '',
                                        timestamp: Date.now(),
                                        subtype: message.subtype,
                                        metadata: message.metadata || {}
                                    });
                                }
                            }
                            
                            return newHistory;
                        });
                        break;
                        
                    case 'chatToolResult':
                        // Update existing tool message with its result
                        console.log('Received tool result for:', message.tool_use_id);
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            
                            // Helper function to find and update tool in nested structure
                            const findAndUpdateTool = (messages: ChatMessage[], toolId: string): boolean => {
                                for (let i = 0; i < messages.length; i++) {
                                    const msg = messages[i];
                                    
                                    if (msg.type === 'tool' && msg.metadata?.tool_id === toolId) {
                                        // Found the tool - update it with result and complete loading state
                                        messages[i] = {
                                            ...msg,
                                            metadata: {
                                                ...msg.metadata,
                                                tool_result: message.content,
                                                result_is_error: message.is_error,
                                                result_received: true,
                                                is_loading: false, // Remove loading state
                                                progress_percentage: 100, // Set to 100% on completion
                                                elapsed_time: msg.metadata?.estimated_duration || 90 // Set elapsed to estimated duration
                                            }
                                        };
                                        return true;
                                    } else if (msg.type === 'tool-group' && msg.metadata?.child_tools) {
                                        // Search in child tools
                                        if (findAndUpdateTool(msg.metadata.child_tools, toolId)) {
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            };
                            
                            const found = findAndUpdateTool(newHistory, message.tool_use_id);
                            
                            if (found) {
                                console.log('Updated tool with result and completed loading');
                            } else {
                                console.warn('Could not find tool with ID:', message.tool_use_id);
                            }
                            
                            return newHistory;
                        });
                        break;
                        
                    case 'chatToolCallUpdate':
                        // Handle streaming tool call argument updates
                        console.log('🔧 Received tool call update for:', message.tool_use_id, 'subtype:', message.subtype);
                        console.log('🔧 Message content length:', message.content?.length || 0);
                        console.log('🔧 Parsed tool input:', message.metadata?.tool_input);
                        console.log('🔧 Raw streaming args:', message.metadata?.streaming_args?.substring(0, 100) + '...');
                        
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            
                            // Helper function to find and update streaming tool in nested structure
                            const findAndUpdateStreamingTool = (messages: ChatMessage[], toolId: string): boolean => {
                                for (let i = 0; i < messages.length; i++) {
                                    const msg = messages[i];
                                    
                                    if (msg.type === 'tool' && msg.metadata?.tool_id === toolId) {
                                        // Found the tool - update it with streaming arguments
                                        const currentArgs = message.metadata?.tool_input || {};
                                        const streamingArgs = message.metadata?.streaming_args || message.content || '';
                                        
                                        console.log(`🔧 Updating tool ${toolId} with args:`, currentArgs);
                                        
                                        messages[i] = {
                                            ...msg,
                                            metadata: {
                                                ...msg.metadata,
                                                tool_input: currentArgs,
                                                is_loading: message.subtype !== 'streaming_complete',
                                                streaming_args: streamingArgs, // Raw accumulated args string
                                                streaming_subtype: message.subtype
                                            }
                                        };
                                        return true;
                                    } else if (msg.type === 'tool-group' && msg.metadata?.child_tools) {
                                        // Search in child tools
                                        if (findAndUpdateStreamingTool(msg.metadata.child_tools, toolId)) {
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            };
                            
                            const found = findAndUpdateStreamingTool(newHistory, message.tool_use_id);
                            
                            if (!found && message.subtype === 'streaming_start') {
                                // First streaming update - create new tool message
                                const toolName = message.metadata?.tool_name || 'Unknown Tool';
                                const estimatedDuration = getToolTimeEstimate(toolName);
                                const startTime = Date.now();
                                
                                console.log(`🔧 Creating new streaming tool message: ${toolName} (ID: ${message.tool_use_id})`);
                                
                                const newTool: ChatMessage = {
                                    type: 'tool',
                                    message: message.content || '',
                                    timestamp: Date.now(),
                                    subtype: 'tool_use',
                                    metadata: {
                                        tool_name: toolName,
                                        tool_id: message.tool_use_id,
                                        tool_input: message.metadata?.tool_input || {},
                                        is_loading: true,
                                        estimated_duration: estimatedDuration,
                                        start_time: startTime,
                                        elapsed_time: 0,
                                        progress_percentage: 0,
                                        streaming_args: message.metadata?.streaming_args || message.content || '',
                                        streaming_subtype: message.subtype
                                    }
                                };
                                
                                newHistory.push(newTool);
                                console.log('🔧 Created new streaming tool message:', toolName);
                            } else if (found) {
                                console.log('🔧 Updated streaming tool with new arguments');
                            } else {
                                console.warn('🔧 Could not find tool with ID for streaming update:', message.tool_use_id);
                                console.log('🔧 Current chat history tool IDs:', newHistory
                                    .filter(msg => msg.type === 'tool')
                                    .map(msg => ({ id: msg.metadata?.tool_id, name: msg.metadata?.tool_name }))
                                );
                            }
                            
                            return newHistory;
                        });
                        break;
                        
                    case 'chatStreamEnd':
                        console.log('Chat stream ended');
                        setIsLoading(false);
                        break;
                        
                    case 'chatResponse':
                        console.log('Received complete chat response (legacy)');
                        // Handle legacy non-streaming responses
                        setIsLoading(false);
                        if (message.response) {
                            setChatHistory(prev => [...prev, {
                                type: 'assistant',
                                message: message.response,
                                timestamp: Date.now()
                            }]);
                        }
                        break;
                        
                    case 'chatError':
                        console.error('Chat error received:', message.error);
                        setIsLoading(false);
                        setChatHistory(prev => [...prev, {
                            type: 'result',
                            message: `Error: ${message.error}`,
                            timestamp: Date.now(),
                            subtype: 'error',
                            metadata: { is_error: true }
                        }]);
                        break;
                        
                    case 'chatStopped':
                        setChatHistory(prev => {
                            const newHistory = [...prev];
                            const lastMessage = newHistory[newHistory.length - 1];
                            if (lastMessage && (lastMessage.type === 'assistant' || lastMessage.type === 'result') && !lastMessage.message.trim()) {
                                // Remove empty message if stopped immediately
                                newHistory.pop();
                            }
                            return [...newHistory, {
                                type: 'result',
                                message: 'Response stopped by user.',
                                timestamp: Date.now(),
                                subtype: 'stopped'
                            }];
                        });
                        setIsLoading(false);
                        break;
                    
                    default:
                        console.log('Unknown message command:', message.command);
                        break;
                }
            } catch (error) {
                console.error('Error handling message:', error, 'Message:', message);
                // Don't crash the UI, just log the error
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, []);

    const sendMessage = useCallback((message: string) => {
        if (!message.trim() || isLoading) {
            return;
        }
        
        // Add user message to history
        setChatHistory(prev => [...prev, {
            type: 'user-input',
            message: message.trim(),
            timestamp: Date.now()
        }]);
        
        // Send to extension
        setIsLoading(true);
        vscode.postMessage({
            command: 'chatWithClaude',
            message: message.trim()
        });
    }, [vscode, isLoading]);

    const stopResponse = useCallback(() => {
        if (isLoading) {
            vscode.postMessage({
                command: 'stopChat'
            });
            setIsLoading(false);
        }
    }, [vscode, isLoading]);

    const clearHistory = useCallback(() => {
        setChatHistory([]);
    }, []);

    return {
        chatHistory,
        isLoading,
        sendMessage,
        stopResponse,
        clearHistory
    };
} 