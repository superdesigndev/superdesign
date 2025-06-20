import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

// Acquire VS Code API
const vscode = acquireVsCodeApi();

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

const ChatApp = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Listen for messages from the extension host
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            
            switch (message.command) {
                case 'messageUpdate':
                    // Handle streaming updates
                    const streamingMsg = message.data.message;
                    setMessages(prev => {
                        const existing = prev.find(m => m.id === streamingMsg.id);
                        if (existing) {
                            // Update existing message
                            return prev.map(m => 
                                m.id === streamingMsg.id 
                                    ? { ...streamingMsg, timestamp: new Date(streamingMsg.timestamp) }
                                    : m
                            );
                        } else {
                            // Add new streaming message
                            return [...prev, { ...streamingMsg, timestamp: new Date(streamingMsg.timestamp) }];
                        }
                    });
                    break;
                    
                case 'messageComplete':
                    // Handle final response
                    const finalMsg = message.data.response.message;
                    setMessages(prev => 
                        prev.map(m => 
                            m.id === finalMsg.id 
                                ? { ...finalMsg, timestamp: new Date(finalMsg.timestamp), isStreaming: false }
                                : m
                        )
                    );
                    setIsLoading(false);
                    break;
                    
                case 'error':
                    // Handle errors
                    const errorMsg: ChatMessage = {
                        id: `error_${Date.now()}`,
                        role: 'assistant',
                        content: `Error: ${message.data.error}`,
                        timestamp: new Date(),
                        isStreaming: false
                    };
                    setMessages(prev => [...prev, errorMsg]);
                    setIsLoading(false);
                    break;
                    
                case 'historyCleared':
                    setMessages([]);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleSendMessage = (message: string) => {
        // Add user message to chat
        const userMessage: ChatMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        // Send to extension host
        vscode.postMessage({
            command: 'sendMessage',
            data: { message }
        });
    };

    return (
        <div className="chat-container">
            <MessageList messages={messages} />
            {isLoading && (
                <div className="loading-indicator">
                    Claude is thinking...
                </div>
            )}
            <ChatInput onSendMessage={handleSendMessage} />
        </div>
    );
}

export default ChatApp;