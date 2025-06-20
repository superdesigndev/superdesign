import React from 'react';

interface MessageListProps {
    messages: string[];
}

const MessageList = ({ messages }: MessageListProps) => {
    return (
        <div className="message-list">
            {messages.map((message, index) => (
                <div key={index} className="message">
                    {message}
                </div>
            ))}
        </div>
    )
}

export default MessageList;