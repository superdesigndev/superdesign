import React from 'react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

interface MessageListProps {
    messages: ChatMessage[];
}

const MessageList = ({ messages }: MessageListProps) => {
    return (
        <div className="message-list">
            {messages.map((message) => (
                <div key={message.id} className={`message ${message.role}`}>
                    <div className="message-header">
                        <span className="message-role">{message.role}</span>
                        {message.isStreaming && <span className="streaming-indicator">●</span>}
                        <span className="message-time">
                            {message.timestamp.toLocaleTimeString()}
                        </span>
                    </div>
                    <div className="message-content">
                        {message.content}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MessageList;