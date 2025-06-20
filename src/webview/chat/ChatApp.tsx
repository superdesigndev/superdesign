import React, {useState} from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

declare const vscode: {
    postMessage: (message: any) => void;
}

const ChatApp = () => {
    const [messages, setMessages] = useState<string[]>([]);

    const handleSendMessage = (message: string) => {
        setMessages([...messages, message]);

        vscode.postMessage({
            command: 'sendMessage',
            text: message
        })
    }

    return (
        <div className='chat-container'>
            <MessageList messages={messages} />
            <ChatInput onSendMessage={handleSendMessage} />
        </div>
    )
}

export default ChatApp;