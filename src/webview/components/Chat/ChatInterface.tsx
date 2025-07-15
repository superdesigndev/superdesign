import React, { useState, useEffect } from 'react';
import { useChat, ChatMessage } from '../../hooks/useChat';
import { useFirstTimeUser } from '../../hooks/useFirstTimeUser';
import { WebviewLayout } from '../../../types/context';
import MarkdownRenderer from '../MarkdownRenderer';
import { TaskIcon, ClockIcon, CheckIcon, LightBulbIcon, GroupIcon, BrainIcon } from '../Icons';
import Welcome from '../Welcome';
import ThemePreviewCard from './ThemePreviewCard';
import ModelSelector from './ModelSelector';

import { WebviewMessage } from '../../types/canvas.types';
import chatStyles from './ChatInterface.css';
import welcomeStyles from '../Welcome/Welcome.css';

interface ChatInterfaceProps {
    layout: WebviewLayout;
    vscode: any;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ layout, vscode }) => {
    const { chatHistory, isLoading, sendMessage, stopResponse, clearHistory } = useChat(vscode);
    const { isFirstTime, isLoading: isCheckingFirstTime, markAsReturningUser, resetFirstTimeUser } = useFirstTimeUser();
    const [inputMessage, setInputMessage] = useState('');
    const [selectedModel, setSelectedModel] = useState<string>('claude-3-5-sonnet-20241022');
    const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({});
    const [showFullContent, setShowFullContent] = useState<{[key: string]: boolean}>({});
    const [currentContext, setCurrentContext] = useState<{fileName: string; type: string} | null>(null);
    const [showWelcome, setShowWelcome] = useState<boolean>(false);

    // Drag and drop state
    const [uploadingImages, setUploadingImages] = useState<string[]>([]);
    const [pendingImages, setPendingImages] = useState<{fileName: string; originalName: string; fullPath: string}[]>([]);



    // Request current provider on mount
    useEffect(() => {
        vscode.postMessage({
            command: 'getCurrentProvider'
        });
        

        
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'currentProviderResponse') {
                let fallbackModel: string;
                switch (message.provider) {
                    case 'openai':
                        fallbackModel = 'gpt-4o';
                        break;
                    case 'openrouter':
                        fallbackModel = 'anthropic/claude-3-7-sonnet-20250219';
                        break;
                    case 'anthropic':
                    default:
                        fallbackModel = 'claude-3-5-sonnet-20241022';
                        break;
                }
                setSelectedModel(message.model || fallbackModel);
            } else if (message.command === 'providerChanged') {
                setSelectedModel(message.model);

            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleModelChange = (model: string) => {
        // Send model change request to extension
        vscode.postMessage({
            command: 'changeProvider',
            model: model
        });
    };



    useEffect(() => {
        // Inject ChatInterface CSS styles
        const styleId = 'chat-interface-styles';
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            styleElement.textContent = chatStyles;
            document.head.appendChild(styleElement);
        }

        // Inject Welcome CSS styles
        const welcomeStyleId = 'welcome-styles';
        let welcomeStyleElement = document.getElementById(welcomeStyleId) as HTMLStyleElement;
        
        if (!welcomeStyleElement) {
            welcomeStyleElement = document.createElement('style');
            welcomeStyleElement.id = welcomeStyleId;
            welcomeStyleElement.textContent = welcomeStyles;
            document.head.appendChild(welcomeStyleElement);
        }

        // Auto-open canvas if not already open
        const autoOpenCanvas = () => {
            // Check if canvas panel is already open by looking for the canvas webview
            vscode.postMessage({
                command: 'checkCanvasStatus'
            });
            
            // Listen for canvas status response and context messages
            const handleMessage = (event: MessageEvent) => {
                const message = event.data;
                if (message.command === 'canvasStatusResponse') {
                    if (!message.isOpen) {
                        // Canvas is not open, auto-open it
                        console.log('🎨 Auto-opening canvas view...');
                        vscode.postMessage({
                            command: 'autoOpenCanvas'
                        });
                    }
                } else if (message.command === 'contextFromCanvas') {
                    // Handle context from canvas
                    console.log('📄 Received context from canvas:', message.data);
                    console.log('📄 Current context before setting:', currentContext);
                    if (message.data.type === 'clear' || !message.data.fileName) {
                        setCurrentContext(null);
                        console.log('📄 Context cleared');
                    } else {
                        setCurrentContext(message.data);
                        console.log('📄 Context set to:', message.data);
                    }
                } else if (message.command === 'imageSavedToMoodboard') {
                    // Handle successful image save with full path
                    console.log('📎 Image saved with full path:', message.data);
                    setPendingImages(prev => [...prev, {
                        fileName: message.data.fileName,
                        originalName: message.data.originalName,
                        fullPath: message.data.fullPath
                    }]);
                    // Remove from uploading state
                    setUploadingImages(prev => prev.filter(name => name !== message.data.originalName));
                } else if (message.command === 'imageSaveError') {
                    // Handle image save error
                    console.error('📎 Image save error:', message.data);
                    setUploadingImages(prev => prev.filter(name => name !== message.data.originalName));
                } else if (message.command === 'clearChat') {
                    // Handle clear chat command from toolbar
                    handleNewConversation();
                } else if (message.command === 'resetWelcome') {
                    // Handle reset welcome command from command palette
                    resetFirstTimeUser();
                    setShowWelcome(true);
                    console.log('👋 Welcome screen reset and shown');
                } else if (message.command === 'setChatPrompt') {
                    // Handle prompt from canvas floating buttons
                    console.log('📝 Received prompt from canvas:', message.data.prompt);
                    setInputMessage(message.data.prompt);
                }
            };
            
            window.addEventListener('message', handleMessage);
            
            // Cleanup listener
            return () => {
                window.removeEventListener('message', handleMessage);
            };
        };
        
        // Delay the check slightly to ensure chat is fully loaded
        const timeoutId = setTimeout(autoOpenCanvas, 500);

        return () => {
            clearTimeout(timeoutId);
            // Clean up on unmount
            const existingStyle = document.getElementById(styleId);
            if (existingStyle) {
                document.head.removeChild(existingStyle);
            }
            const existingWelcomeStyle = document.getElementById(welcomeStyleId);
            if (existingWelcomeStyle) {
                document.head.removeChild(existingWelcomeStyle);
            }
        };
    }, [vscode]);

    // Handle first-time user welcome display
    useEffect(() => {
        if (!isCheckingFirstTime && isFirstTime && chatHistory.length === 0) {
            setShowWelcome(true);
            console.log('👋 Showing welcome for first-time user');
        }
    }, [isCheckingFirstTime, isFirstTime, chatHistory.length]);

    // Auto-collapse tools when new messages arrive
    useEffect(() => {
        const handleAutoCollapse = () => {
            setExpandedTools(prev => {
                const newState = { ...prev };
                const toolIndices = chatHistory
                    .map((msg, index) => ({ msg, index }))
                    .filter(({ msg }) => msg.type === 'tool' || msg.type === 'tool-result')
                    .map(({ index }) => index);
                
                // Keep only the last tool/tool-result expanded
                if (toolIndices.length > 1) {
                    const lastToolIndex = toolIndices[toolIndices.length - 1];
                    toolIndices.forEach(index => {
                        if (index !== lastToolIndex) {
                            newState[index] = false;
                        }
                    });
                }
                
                return newState;
            });
        };

        window.addEventListener('autoCollapseTools', handleAutoCollapse);
        return () => window.removeEventListener('autoCollapseTools', handleAutoCollapse);
    }, [chatHistory]);

    const handleSendMessage = async () => {
        if (inputMessage.trim()) {
            let messageContent: any;
            
            console.log('📤 Sending message with context:', currentContext);
            console.log('📤 Input message:', inputMessage);
            
            // Check if we have image context to include
            if (currentContext && (currentContext.type === 'image' || currentContext.type === 'images')) {
                try {
                    // Create structured content with text and images
                    const contentParts: any[] = [
                        {
                            type: 'text',
                            text: inputMessage
                        }
                    ];
                    
                    // Process image context
                    const imagePaths = currentContext.type === 'images' 
                        ? currentContext.fileName.split(', ')
                        : [currentContext.fileName];
                    
                    // Convert each image to base64
                    for (const imagePath of imagePaths) {
                        try {
                            // Request base64 data from the extension
                            const base64Data = await new Promise<string>((resolve, reject) => {
                                const timeoutId = setTimeout(() => {
                                    reject(new Error('Timeout waiting for base64 data'));
                                }, 10000);
                                
                                const handler = (event: MessageEvent) => {
                                    const message = event.data;
                                    if (message.command === 'base64ImageResponse' && message.filePath === imagePath) {
                                        clearTimeout(timeoutId);
                                        window.removeEventListener('message', handler);
                                        if (message.error) {
                                            reject(new Error(message.error));
                                        } else {
                                            resolve(message.base64Data);
                                        }
                                    }
                                };
                                
                                window.addEventListener('message', handler);
                                
                                // Request base64 data from extension
                                vscode.postMessage({
                                    command: 'getBase64Image',
                                    filePath: imagePath
                                });
                            });
                            
                            // Extract MIME type from base64 data URL
                            const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
                            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                            const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '');
                            
                            contentParts.push({
                                type: 'image',
                                image: base64Content,
                                mimeType: mimeType
                            });
                            
                            console.log('📎 Added image to message:', imagePath, 'MIME:', mimeType);
                        } catch (error) {
                            console.error('Failed to load image:', imagePath, error);
                            // Add error note to text content instead
                            contentParts[0].text += `\n\n[Note: Could not load image ${imagePath}: ${error}]`;
                        }
                    }
                    
                    messageContent = contentParts;
                    console.log('📤 Final structured message content:', contentParts.length, 'parts');
                } catch (error) {
                    console.error('Error processing images:', error);
                    // Fallback to text-only message with context info
                    messageContent = currentContext.type === 'images' 
                        ? `Context: Multiple images in moodboard\n\nMessage: ${inputMessage}`
                        : `Context: ${currentContext.fileName}\n\nMessage: ${inputMessage}`;
                }
            } else if (currentContext) {
                // Non-image context - use simple text format
                messageContent = `Context: ${currentContext.fileName}\n\nMessage: ${inputMessage}`;
                console.log('📤 Final message with non-image context:', messageContent);
            } else {
                // No context - just the message text
                messageContent = inputMessage;
                console.log('📤 No context available, sending message as-is');
            }
            
            sendMessage(messageContent);
            setInputMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputMessage(e.target.value);
        resizeTextarea(e.target);
    };

    const resizeTextarea = (textarea: HTMLTextAreaElement) => {
        // Auto-resize textarea
        textarea.style.height = 'auto'; // Reset height to calculate new height
        
        // Set height based on scroll height, with max height of 120px (about 6 lines)
        const maxHeight = 120;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
    };

    // Reset textarea height when input is cleared (e.g., after sending message)
    useEffect(() => {
        if (!inputMessage.trim()) {
            const textarea = document.querySelector('.message-input') as HTMLTextAreaElement;
            if (textarea) {
                textarea.style.height = 'auto';
            }
        }
    }, [inputMessage]);

    const handleAddContext = () => {
        // TODO: Implement context addition functionality
        console.log('Add Context clicked');
    };

    const handleCopyMessage = (message: string) => {
        navigator.clipboard.writeText(message).then(() => {
            // Could add a toast notification here
            console.log('Message copied to clipboard');
        });
    };

    const handleLikeMessage = (index: number) => {
        // TODO: Implement like functionality
        console.log('Liked message:', index);
    };

    const handleDislikeMessage = (index: number) => {
        // TODO: Implement dislike functionality
        console.log('Disliked message:', index);
    };

    const handleNewConversation = () => {
        clearHistory();
        setCurrentContext(null);
    };

    const handleWelcomeGetStarted = () => {
        setShowWelcome(false);
        markAsReturningUser();
        console.log('👋 User clicked Get Started, welcome dismissed');
        
        // Auto-trigger initialize Superdesign command
        vscode.postMessage({
            command: 'initializeSuperdesign'
        });
        console.log('🚀 Auto-triggering Initialize Superdesign command');
    };

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if dragged items contain files
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Essential: Must prevent default and set dropEffect for drop to work
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isLoading) {
            return;
        }

        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            return;
        }

        // Process each image file
        for (const file of imageFiles) {
            try {
                await handleImageUpload(file);
            } catch (error) {
                console.error('Error processing dropped image:', error);
            }
        }
    };

    const handleImageUpload = async (file: File): Promise<void> => {
        const maxSize = 10 * 1024 * 1024; // 10MB limit
        if (file.size > maxSize) {
            const displayName = file.name || 'clipboard image';
            console.error('Image too large:', displayName);
            vscode.postMessage({
                command: 'showError',
                data: `Image "${displayName}" is too large. Maximum size is 10MB.`
            });
            return;
        }

        // Create a unique filename - handle clipboard images without names
        const timestamp = Date.now();
        const originalName = file.name || `clipboard-image-${timestamp}`;
        const extension = file.type.split('/')[1] || 'png';
        const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = safeName.includes('.') ? `${timestamp}_${safeName}` : `${timestamp}_${safeName}.${extension}`;

        // Add to uploading state
        setUploadingImages(prev => [...prev, originalName]);

        // Convert to base64 for sending to extension
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result as string;
            
            // Send to extension to save in moodboard
            vscode.postMessage({
                command: 'saveImageToMoodboard',
                data: {
                    fileName,
                    originalName,
                    base64Data,
                    mimeType: file.type,
                    size: file.size
                }
            });

            console.log('📎 Image sent to extension for saving:', fileName);
        };

        reader.onerror = () => {
            console.error('Error reading file:', file.name);
            setUploadingImages(prev => prev.filter(name => name !== file.name));
            vscode.postMessage({
                command: 'showError',
                data: `Failed to read image "${file.name}"`
            });
        };

        reader.readAsDataURL(file);
    };

    useEffect(() => {
        // Auto-set context when images finish uploading
        if (uploadingImages.length === 0 && pendingImages.length > 0) {
            if (pendingImages.length === 1) {
                // Single image - set as context with full path
                setCurrentContext({
                    fileName: pendingImages[0].fullPath,
                    type: 'image'
                });
            } else {
                // Multiple images - create a combined context with all full paths
                const fullPaths = pendingImages.map(img => img.fullPath).join(', ');
                setCurrentContext({
                    fileName: fullPaths,
                    type: 'images'
                });
            }
            // Clear pending images after setting context
            setPendingImages([]);
        }
    }, [uploadingImages.length, pendingImages.length]);

    // Global drag & drop fallback for VS Code webview
    useEffect(() => {
        const handleGlobalDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                e.dataTransfer.dropEffect = 'copy';
            }
        };

        const handleGlobalDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎯 Global drop detected!', e.dataTransfer?.files.length, 'files');

            if (!e.dataTransfer?.files) return;

            const files = Array.from(e.dataTransfer.files);
            console.log('🎯 Global files from drop:', files.map(f => `${f.name} (${f.type})`));
            
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            console.log('🎯 Global image files:', imageFiles.map(f => f.name));

            if (imageFiles.length > 0 && !isLoading) {
                console.log('📎 Processing images from global drop:', imageFiles.map(f => f.name));
                
                for (const file of imageFiles) {
                    try {
                        await handleImageUpload(file);
                    } catch (error) {
                        console.error('Error processing dropped image:', error);
                    }
                }
            }
        };

        const handleGlobalPaste = async (e: ClipboardEvent) => {
            // Only handle paste if we're focused on the chat and not loading
            if (isLoading || showWelcome) return;

            const clipboardItems = e.clipboardData?.items;
            if (!clipboardItems) return;

            console.log('📋 Paste detected, checking for images...');

            // Look for image items in clipboard
            const imageItems = Array.from(clipboardItems).filter(item => 
                item.type.startsWith('image/')
            );

            if (imageItems.length > 0) {
                e.preventDefault();
                console.log('📋 Found', imageItems.length, 'image(s) in clipboard');

                for (const item of imageItems) {
                    const file = item.getAsFile();
                    if (file) {
                        try {
                            console.log('📋 Processing pasted image:', file.name || 'clipboard-image', file.type);
                            await handleImageUpload(file);
                        } catch (error) {
                            console.error('Error processing pasted image:', error);
                            vscode.postMessage({
                                command: 'showError',
                                data: `Failed to process pasted image: ${error instanceof Error ? error.message : String(error)}`
                            });
                        }
                    }
                }
            }
        };

        // Add global listeners
        document.addEventListener('dragover', handleGlobalDragOver);
        document.addEventListener('drop', handleGlobalDrop);
        document.addEventListener('paste', handleGlobalPaste);

        return () => {
            document.removeEventListener('dragover', handleGlobalDragOver);
            document.removeEventListener('drop', handleGlobalDrop);
            document.removeEventListener('paste', handleGlobalPaste);
        };
    }, [isLoading, handleImageUpload, showWelcome]);

    const renderChatMessage = (msg: ChatMessage, index: number) => {
        const isLastUserMessage = msg.type === 'user-input' && index === chatHistory.length - 1 && isLoading;
        const isLastStreamingMessage = (msg.type === 'assistant' || msg.type === 'result') && index === chatHistory.length - 1;
        const isStreaming = isLastStreamingMessage && isLoading;
        const messageText = typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message);
        
        // Handle tool messages specially
        if (msg.type === 'tool') {
            return renderToolMessage(msg, index);
        }
        
        // Handle tool groups specially
        if (msg.type === 'tool-group') {
            return renderToolGroup(msg, index);
        }
        
        // Handle error messages with actions specially
        if (msg.type === 'error') {
            return renderErrorMessage(msg, index);
        }
        
        // Determine message label and styling
        let messageLabel = '';
        let messageClass = '';
        
        switch (msg.type) {
            case 'user-input':
                messageLabel = 'You';
                messageClass = 'user';
                break;
            case 'user':
                messageLabel = 'Claude (User Message)';
                messageClass = 'user-sdk';
                break;
            case 'assistant':
                messageLabel = 'Claude';
                messageClass = 'assistant';
                break;
            case 'result':
                if (msg.subtype === 'success') {
                    messageLabel = 'Result';
                } else if (msg.subtype === 'error_max_turns') {
                    messageLabel = 'Error (Max Turns)';
                } else if (msg.subtype === 'error_during_execution') {
                    messageLabel = 'Error (Execution)';
                } else if (msg.subtype === 'stopped') {
                    messageLabel = 'Stopped';
                } else if (msg.subtype === 'error') {
                    messageLabel = 'Error';
                } else {
                    messageLabel = 'Result';
                }
                messageClass = msg.metadata?.is_error ? 'result-error' : 'result';
                break;
        }
        
        return (
            <div key={index} className={`chat-message chat-message--${messageClass} chat-message--${layout}`}>
                {layout === 'panel' && (
                    <div className="chat-message__header">
                    <span className="chat-message__label">
                            {messageLabel}
                        </span>
                        {msg.metadata && (
                            <span className="chat-message__metadata">
                                {msg.metadata.duration_ms && (
                                    <span className="metadata-item">{msg.metadata.duration_ms}ms</span>
                                )}
                                {msg.metadata.total_cost_usd && (
                                    <span className="metadata-item">${msg.metadata.total_cost_usd.toFixed(4)}</span>
                                )}
                                {msg.metadata.num_turns && (
                                    <span className="metadata-item">{msg.metadata.num_turns} turns</span>
                                )}
                    </span>
                )}
            </div>
                )}
            <div className="chat-message__content">
                    {(msg.type === 'assistant' || msg.type === 'result') ? (
                        <MarkdownRenderer content={messageText} />
                    ) : (
                        (() => {
                            // Check if this is a user message with context
                            if (messageText.startsWith('Context: ') && messageText.includes('\n\nMessage: ')) {
                                const contextMatch = messageText.match(/^Context: (.+)\n\nMessage: (.+)$/s);
                                if (contextMatch) {
                                    const contextFile = contextMatch[1];
                                    const actualMessage = contextMatch[2];
                                    
                                    // Handle display for multiple images or single image
                                    let displayFileName;
                                    if (contextFile.includes(', ')) {
                                        // Multiple images - show count
                                        const paths = contextFile.split(', ');
                                        displayFileName = `${paths.length} images in moodboard`;
                                    } else {
                                        // Single image - show just filename
                                        displayFileName = contextFile.includes('.superdesign') 
                                            ? contextFile.split('.superdesign/')[1] || contextFile.split('/').pop() || contextFile
                                            : contextFile.split('/').pop() || contextFile;
                                    }
                                    
                                    return (
                                        <>
                                            <div className="message-context-display">
                                                <span className="context-icon">@</span>
                                                <span className="context-text">{displayFileName}</span>
                                            </div>
                                            <div className="message-text">{actualMessage}</div>
                                        </>
                                    );
                                }
                            }
                            return messageText;
                        })()
                    )}
                    {isStreaming && <span className="streaming-cursor">▋</span>}
                </div>
                {(msg.type === 'assistant' || msg.type === 'result') && !isStreaming && (
                    <div className="message-actions">
                        <button 
                            onClick={() => handleLikeMessage(index)}
                            className="action-btn like-btn"
                            title="Like response"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8.864.046C7.908-.193 7.02.53 6.956 1.466c-.072 1.051-.23 2.016-.428 2.59-.125.36-.479 1.013-1.04 1.639-.557.623-1.282 1.178-2.131 1.41C2.685 7.288 2 7.87 2 8.72v4.001c0 .845.682 1.464 1.448 1.545 1.07.114 1.564.415 2.068.723l.048.03c.272.165.578.348.97.484.397.136.861.217 1.466.217h3.5c.937 0 1.599-.477 1.934-1.064a1.86 1.86 0 0 0 .254-.912c0-.152-.023-.312-.077-.464.201-.263.38-.578.488-.901.11-.33.172-.762.004-1.149.069-.13.12-.269.159-.403.077-.27.113-.568.113-.857 0-.288-.036-.585-.113-.856a2.144 2.144 0 0 0-.138-.362 1.9 1.9 0 0 0 .234-1.734c-.206-.592-.682-1.1-1.2-1.272-.847-.282-1.803-.276-2.516-.211a9.84 9.84 0 0 0-.443.05 9.365 9.365 0 0 0-.062-4.509A1.38 1.38 0 0 0 9.125.111L8.864.046zM11.5 14.721H8c-.51 0-.863-.069-1.14-.164-.281-.097-.506-.228-.776-.393l-.04-.024c-.555-.339-1.198-.731-2.49-.868-.333-.036-.554-.29-.554-.55V8.72c0-.254.226-.543.62-.65 1.095-.3 1.977-.996 2.614-1.708.635-.71 1.064-1.475 1.238-1.978.243-.7.407-1.768.482-2.85.025-.362.36-.594.667-.518l.262.066c.16.04.258.143.288.255a8.34 8.34 0 0 1-.145 4.725.5.5 0 0 0 .595.644l.003-.001.014-.003.058-.014a8.908 8.908 0 0 1 1.036-.157c.663-.06 1.457-.054 2.11.164.175.058.45.3.57.65.107.308.087.67-.266 1.022l-.353.353.353.354c.043.043.105.141.154.315.048.167.075.37.075.581 0 .212-.027.414-.075.582-.05.174-.111.272-.154.315l-.353.353.353.354c.047.047.109.177.005.488a2.224 2.224 0 0 1-.505.805l-.353.353.353.354c.006.005.041.05.041.17a.866.866 0 0 1-.121.416c-.165.288-.503.56-1.066.56z"/>
                            </svg>
                        </button>
                        <button 
                            onClick={() => handleDislikeMessage(index)}
                            className="action-btn dislike-btn"
                            title="Dislike response"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8.864 15.674c-.956.24-1.843-.484-1.908-1.42-.072-1.05-.23-2.015-.428-2.59-.125-.36-.479-1.012-1.04-1.638-.557-.624-1.282-1.179-2.131-1.41C2.685 8.432 2 7.85 2 7V3c0-.845.682-1.464 1.448-1.546 1.07-.113 1.564-.415 2.068-.723l.048-.029c.272-.166.578-.349.97-.484C6.931.082 7.395 0 8 0h3.5c.937 0 1.599.478 1.934 1.064.164.287.254.607.254.913 0 .152-.023.312-.077.464.201.262.38.577.488.9.11.33.172.762.004 1.15.069.129.12.268.159.403.077.27.113.567.113.856 0 .289-.036.586-.113.856-.035.12-.08.244-.138.363.394.571.418 1.2.234 1.733-.206.592-.682 1.1-1.2 1.272-.847.283-1.803.276-2.516.211a9.877 9.877 0 0 1-.443-.05 9.364 9.364 0 0 1-.062 4.51c-.138.508-.55.848-1.012.964l-.261.065zM11.5 1H8c-.51 0-.863.068-1.14.163-.281.097-.506.229-.776.393l-.04.025c-.555.338-1.198.73-2.49.868-.333.035-.554.29-.554.55V7c0 .255.226.543.62.65 1.095.3 1.977.997 2.614 1.709.635.71 1.064 1.475 1.238 1.977.243.7.407 1.768.482 2.85.025.362.36.595.667.518l.262-.065c.16-.04.258-.144.288-.255a8.34 8.34 0 0 0-.145-4.726.5.5 0 0 1 .595-.643h.003l.014.004.058.013a8.912 8.912 0 0 0 1.036.157c.663.06 1.457.054 2.11-.164.175-.058.45-.3.57-.65.107-.308.087-.67-.266-1.021L12.793 6l.353-.354c.043-.042.105-.14.154-.315.048-.167.075-.37.075-.581 0-.211-.027-.414-.075-.581-.05-.174-.111-.273-.154-.315L12.793 4l.353-.354c.047-.047.109-.176.005-.488a2.224 2.224 0 0 0-.505-.804L12.293 2l.353-.354c.006-.005.041-.05.041-.17a.866.866 0 0 0-.121-.415C12.4 1.272 12.063 1 11.5 1z"/>
                            </svg>
                        </button>
                        <button 
                            onClick={() => handleCopyMessage(messageText)}
                            className="action-btn copy-btn"
                            title="Copy response"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                            </svg>
                        </button>
                    </div>
                )}
                {isLastUserMessage && (
                    <div className="generating-content">
                        <span className="generating-text">Generating</span>
                        <button 
                            onClick={stopResponse}
                            className="generating-stop-btn"
                            title="Stop response"
                        >
                            Stop
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderToolMessage = (msg: ChatMessage, index: number) => {
        try {
            const toolName = msg.metadata?.tool_name || 'Unknown Tool';
            const toolInput = msg.metadata?.tool_input || {};
            
            // Special handling for generateTheme tool calls
            if (toolName === 'generateTheme') {
                const hasResult = msg.metadata?.result_received || false;
                const isLoading = msg.metadata?.is_loading || false;
                const resultIsError = msg.metadata?.result_is_error || false;
                const toolResult = msg.metadata?.tool_result || '';
                
                // Extract theme data from tool input
                const themeName = toolInput.theme_name || 'Untitled Theme';
                const reasoning = toolInput.reasoning_reference || '';
                const cssSheet = toolInput.cssSheet || '';
                
                // Try to parse tool result to get file path
                let cssFilePath = null;
                if (hasResult && !resultIsError && toolResult) {
                    try {
                        const result = JSON.parse(toolResult);
                        if (result.success && result.filePath) {
                            cssFilePath = result.filePath;
                        }
                    } catch (e) {
                        // Fallback to cssSheet if parsing fails
                        console.warn('Failed to parse theme tool result:', e);
                    }
                }
                
                return (
                    <div key={index} className={`theme-tool-message theme-tool-message--${layout}`}>
                        <ThemePreviewCard
                            themeName={themeName}
                            reasoning={reasoning}
                            cssSheet={cssFilePath ? null : cssSheet}
                            cssFilePath={cssFilePath}
                            isLoading={isLoading && !hasResult}
                            vscode={vscode}
                        />
                        {resultIsError && (
                            <div className="theme-error-notice" style={{
                                margin: '0.5rem 0',
                                padding: '0.75rem',
                                backgroundColor: 'var(--destructive)',
                                color: 'var(--destructive-foreground)',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem'
                            }}>
                                ⚠️ Theme generation encountered an error. The preview above shows the input data.
                            </div>
                        )}
                    </div>
                );
            }
            
            // Continue with existing generic tool rendering for other tools
            const isExpanded = expandedTools[index] || false;
            const showFullResult = showFullContent[index] || false;
            const showFullInput = showFullContent[`${index}_input`] || false;
            const showFullPrompt = showFullContent[`${index}_prompt`] || false;
            
            const description = toolInput.description || '';
            const command = toolInput.command || '';
            const prompt = toolInput.prompt || '';
            
            // Tool result data
            const hasResult = msg.metadata?.result_received || false;
            const isLoading = msg.metadata?.is_loading || false;
            const toolResult = msg.metadata?.tool_result || '';
            const resultIsError = msg.metadata?.result_is_error || false;
            
            // Tool is complete when it has finished (regardless of errors)
            const toolComplete = hasResult && !isLoading;
            
            // Enhanced loading data
            const estimatedDuration = msg.metadata?.estimated_duration || 90;
            const elapsedTime = msg.metadata?.elapsed_time || 0;
            const progressPercentage = msg.metadata?.progress_percentage || 0;
            const remainingTime = Math.max(0, estimatedDuration - elapsedTime);
            
            // Format time display
            const formatTime = (seconds: number): string => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            
            // Get friendly tool name for display
            const getFriendlyToolName = (name: string): string => {
                const friendlyNames: { [key: string]: string } = {
                    'mcp_taskmaster-ai_parse_prd': 'Parsing Requirements Document',
                    'mcp_taskmaster-ai_analyze_project_complexity': 'Analyzing Project Complexity',
                    'mcp_taskmaster-ai_expand_task': 'Expanding Task',
                    'mcp_taskmaster-ai_expand_all': 'Expanding All Tasks',
                    'mcp_taskmaster-ai_research': 'Researching Information',
                    'codebase_search': 'Searching Codebase',
                    'read_file': 'Reading File',
                    'edit_file': 'Editing File',
                    'run_terminal_cmd': 'Running Command'
                };
                return friendlyNames[name] || name.replace(/mcp_|_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            };
            
            // Get helpful loading tips based on tool and progress
            const getLoadingTip = (toolName: string, progress: number): string => {
                const progressStage = progress < 25 ? 'early' : progress < 50 ? 'mid' : progress < 75 ? 'late' : 'final';
                
                const tipsByTool: { [key: string]: { [stage: string]: string[] } } = {
                    'mcp_taskmaster-ai_parse_prd': {
                        early: ['Analyzing requirements and identifying key features...', 'Breaking down complex requirements into manageable tasks...'],
                        mid: ['Structuring tasks based on dependencies and priorities...', 'Defining implementation details for each component...'],
                        late: ['Finalizing task relationships and estimates...', 'Optimizing task breakdown for efficient development...'],
                        final: ['Completing task generation and validation...', 'Almost ready with your project roadmap!']
                    },
                    'mcp_taskmaster-ai_research': {
                        early: ['Gathering the latest information from multiple sources...', 'Searching for best practices and recent developments...'],
                        mid: ['Analyzing findings and filtering relevant information...', 'Cross-referencing multiple sources for accuracy...'],
                        late: ['Synthesizing research into actionable insights...', 'Preparing comprehensive research summary...'],
                        final: ['Finalizing research report with recommendations...', 'Almost done with your research!']
                    },
                    'mcp_taskmaster-ai_expand_task': {
                        early: ['Breaking down the task into detailed subtasks...', 'Analyzing task complexity and dependencies...'],
                        mid: ['Defining implementation steps and requirements...', 'Creating detailed subtask specifications...'],
                        late: ['Optimizing subtask flow and dependencies...', 'Adding implementation details and strategies...'],
                        final: ['Finalizing subtask breakdown...', 'Your detailed implementation plan is almost ready!']
                    }
                };
                
                const generalTips = {
                    early: ['AI is working hard to process your request...', 'Analyzing your requirements in detail...', 'Loading the best approach for your needs...'],
                    mid: ['Making good progress on your request...', 'Processing complex logic and relationships...', 'Halfway there! Building your solution...'],
                    late: ['Finalizing details and optimizations...', 'Almost finished with the heavy lifting...', 'Putting the finishing touches on your request...'],
                    final: ['Just a few more seconds...', 'Completing final validations...', 'Almost ready with your results!']
                };
                
                const toolTips = tipsByTool[toolName] || generalTips;
                const stageTips = toolTips[progressStage] || generalTips[progressStage];
                const randomIndex = Math.floor((progress / 10)) % stageTips.length;
                
                return stageTips[randomIndex];
            };
            
            const toggleExpanded = () => {
                setExpandedTools(prev => ({
                    ...prev,
                    [index]: !prev[index]
                }));
            };
            
            const toggleShowFullResult = () => {
                setShowFullContent(prev => ({
                    ...prev,
                    [index]: !prev[index]
                }));
            };
            
            const toggleShowFullInput = () => {
                setShowFullContent(prev => ({
                    ...prev,
                    [`${index}_input`]: !prev[`${index}_input`]
                }));
            };
            
            const toggleShowFullPrompt = () => {
                setShowFullContent(prev => ({
                    ...prev,
                    [`${index}_prompt`]: !prev[`${index}_prompt`]
                }));
            };
            
            // Determine if content needs truncation
            const MAX_PREVIEW = 300;
            
            // Result truncation
            const resultNeedsTruncation = toolResult.length > MAX_PREVIEW;
            const displayResult = resultNeedsTruncation && !showFullResult 
                ? toolResult.substring(0, MAX_PREVIEW) + '...'
                : toolResult;
            
            // Input truncation
            const inputString = JSON.stringify(toolInput, null, 2);
            const inputNeedsTruncation = inputString.length > MAX_PREVIEW;
            const displayInput = inputNeedsTruncation && !showFullInput 
                ? inputString.substring(0, MAX_PREVIEW) + '...'
                : inputString;
            
            // Prompt truncation
            const promptNeedsTruncation = prompt.length > MAX_PREVIEW;
            const displayPrompt = promptNeedsTruncation && !showFullPrompt 
                ? prompt.substring(0, MAX_PREVIEW) + '...'
                : prompt;
            
            return (
                <div key={index} className={`tool-message tool-message--${layout} ${toolComplete ? 'tool-message--complete' : ''} ${isLoading ? 'tool-message--loading' : ''}`}>
                    <div 
                        className="tool-message__header"
                        onClick={toggleExpanded}
                    >
                        <div className="tool-message__main">
                            <span className="tool-icon">
                                {isLoading ? (
                                    <div className="loading-icon-simple">
                                        <div className="loading-ring"></div>
                                    </div>
                                ) : (
                                    <TaskIcon />
                                )}
                            </span>
                            <div className="tool-info">
                                <span className="tool-name">{getFriendlyToolName(toolName)}</span>
                                {description && (
                                    <span className="tool-description">{description}</span>
                                )}
                                {isLoading && (
                                    <span className="tool-time-remaining">
                                        <ClockIcon /> {formatTime(remainingTime)} remaining
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="tool-actions">
                            {toolComplete && (
                                <span className="tool-status tool-status--complete">
                                    <CheckIcon />
                                </span>
                            )}
                            <button className={`tool-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="tool-message__details">
                            {isLoading && (
                                <div className="tool-loading-tips">
                                    <div className="loading-tip">
                                        <span className="tip-icon"><LightBulbIcon /></span>
                                        <span className="tip-text">
                                            {getLoadingTip(toolName, Math.floor((estimatedDuration - remainingTime) / estimatedDuration * 100))}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {command && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">Command:</span>
                                    <code className="tool-detail__value">{command}</code>
                                </div>
                            )}
                            {Object.keys(toolInput).length > 0 && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">Input:</span>
                                    <div className="tool-detail__value tool-detail__value--result">
                                        <pre className="tool-result-content">
                                            {displayInput}
                                        </pre>
                                        {inputNeedsTruncation && (
                                            <button 
                                                className="tool-result__show-more"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleShowFullInput();
                                                }}
                                            >
                                                {showFullInput ? 'Show Less' : 'Show More'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {prompt && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">Prompt:</span>
                                    <div className="tool-detail__value tool-detail__value--result">
                                        <pre className="tool-result-content">
                                            {displayPrompt}
                                        </pre>
                                        {promptNeedsTruncation && (
                                            <button 
                                                className="tool-result__show-more"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleShowFullPrompt();
                                                }}
                                            >
                                                {showFullPrompt ? 'Show Less' : 'Show More'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {hasResult && (
                                <div className="tool-detail">
                                    <span className="tool-detail__label">
                                        {resultIsError ? 'Error Result:' : 'Result:'}
                                    </span>
                                    <div className={`tool-detail__value tool-detail__value--result ${resultIsError ? 'tool-detail__value--error' : ''}`}>
                                        <pre className="tool-result-content">
                                            {displayResult}
                                        </pre>
                                        {resultNeedsTruncation && (
                                            <button 
                                                className="tool-result__show-more"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleShowFullResult();
                                                }}
                                            >
                                                {showFullResult ? 'Show Less' : 'Show More'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return (
                <div key={index} className={`tool-message tool-message--${layout} tool-message--error`}>
                    <div className="tool-message__header">
                        <div className="tool-message__main">
                            <span className="tool-icon">⚠️</span>
                            <div className="tool-info">
                                <span className="tool-name">Error rendering tool: {msg.metadata?.tool_name || 'Unknown'}</span>
                                <span className="tool-description">{errorMessage}</span>
                            </div>
                        </div>
            </div>
        </div>
    );
        }
    };

    const renderToolGroup = (msg: ChatMessage, index: number) => {
        try {
            const isExpanded = expandedTools[index] || false;
            const childTools = msg.metadata?.child_tools || [];
            const groupName = msg.metadata?.tool_name || 'Tool Group';
            const hasResults = childTools.some(tool => tool.metadata?.result_received);
            const hasErrors = childTools.some(tool => tool.metadata?.result_is_error);
            const isLoading = childTools.some(tool => tool.metadata?.is_loading);
            
            // Task is complete when ALL tools have finished (regardless of errors)
            const allToolsFinished = childTools.length > 0 && childTools.every(tool => tool.metadata?.result_received);
            const taskComplete = allToolsFinished && !isLoading;
            
            // Calculate group progress based on child tools
            let totalProgress = 0;
            let totalTime = 0;
            let remainingTime = 0;
            if (childTools.length > 0) {
                childTools.forEach(tool => {
                    totalProgress += tool.metadata?.progress_percentage || 0;
                    totalTime += tool.metadata?.estimated_duration || 0;
                    remainingTime += Math.max(0, (tool.metadata?.estimated_duration || 0) - (tool.metadata?.elapsed_time || 0));
                });
                totalProgress = totalProgress / childTools.length;
                
                // If all tools are finished, set progress to 100%
                if (allToolsFinished) {
                    totalProgress = 100;
                }
            }
            
            // Format time display
            const formatTime = (seconds: number): string => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            
            const toggleExpanded = () => {
                setExpandedTools(prev => ({
                    ...prev,
                    [index]: !prev[index]
                }));
            };
            
            return (
                <div key={index} className={`tool-group tool-group--${layout} ${taskComplete ? 'tool-group--complete' : ''} ${isLoading ? 'tool-group--loading' : ''}`}>
                    <div 
                        className="tool-group__header"
                        onClick={toggleExpanded}
                    >
                        <div className="tool-group__main">
                            <span className="tool-group-icon">
                                {isLoading ? (
                                    <div className="loading-icon-simple">
                                        <div className="loading-ring"></div>
                                    </div>
                                ) : (
                                    <GroupIcon />
                                )}
                            </span>
                            <div className="tool-group-info">
                                <span className="tool-group-name">{groupName}</span>
                                {isLoading && (
                                    <span className="tool-time-remaining">
                                        <ClockIcon /> {formatTime(remainingTime)} remaining
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="tool-group-actions">
                            <span className="tool-group-count">{childTools.length} steps</span>
                            {taskComplete && (
                                <span className="tool-status tool-status--complete">
                                    <CheckIcon />
                                </span>
                            )}
                            <button className={`tool-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="tool-group__children">
                            {childTools.map((childTool, childIndex) => 
                                renderToolMessage(childTool, `${index}_${childIndex}` as any)
                            )}
                        </div>
                    )}
                </div>
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return (
                <div key={index} className={`tool-group tool-group--${layout} tool-group--error`}>
                    <div className="tool-group__header">
                        <div className="tool-group__main">
                            <span className="tool-group-icon">⚠️</span>
                            <div className="tool-group-info">
                                <span className="tool-group-name">Error rendering tool group</span>
                                <span className="tool-time-remaining">{errorMessage}</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    };

    const renderErrorMessage = (msg: ChatMessage, index: number) => {
        const handleActionClick = (action: { text: string; command: string; args?: string }) => {
            console.log('Action clicked:', action);
            vscode.postMessage({
                command: 'executeAction',
                actionCommand: action.command,
                actionArgs: action.args
            });
        };

        return (
            <div key={index} className={`chat-message chat-message--result-error chat-message--${layout}`}>
                {layout === 'panel' && (
                    <div className="chat-message__header">
                        <span className="chat-message__label">Error</span>
                    </div>
                )}
                <div className="chat-message__content">
                    <div className="error-message-content">
                        {msg.message}
                    </div>
                    {msg.actions && msg.actions.length > 0 && (
                        <div className="error-actions">
                            {msg.actions.map((action, actionIndex) => (
                                <button
                                    key={actionIndex}
                                    onClick={() => handleActionClick(action)}
                                    className="error-action-btn"
                                >
                                    {action.text}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPlaceholder = () => (
        <div className={`chat-placeholder chat-placeholder--${layout}`}>
            <div className="chat-placeholder__content">
                <div className="empty-state-message">
                    <p>
                        <strong>Cursor/Windsurf/Claude Code rules already added</strong>, prompt Cursor/Windsurf/Claude Code to design UI like <kbd>Help me design a calculator UI</kbd> and preview the UI in Superdesign canvas by <kbd>Cmd+Shift+P</kbd> <code>'Superdesign: Open canvas view'</code>
                    </p>
                    <div className="empty-state-divider">OR</div>
                    <p>
                        You can start with native superdesign agent chat below <em>(We have better UX)</em>
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div 
            className={`chat-interface chat-interface--${layout}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >

            {layout === 'panel' && (
                <header className="chat-header">
                    <h2>💬 Chat with Claude</h2>
                    <p>Ask Claude anything about code, design, or development!</p>
                    <button 
                        className="new-conversation-btn"
                        onClick={handleNewConversation}
                        title="Start a new conversation"
                        disabled={isLoading}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                        </svg>
                    </button>
                </header>
            )}



            <div className="chat-container">
                <div className="chat-history">
                    {showWelcome ? (
                        <Welcome 
                            onGetStarted={handleWelcomeGetStarted}
                            vscode={vscode}
                        />
                    ) : chatHistory.length === 0 ? renderPlaceholder() : (
                        <>
                            {chatHistory
                                .filter(msg => {
                                    // Filter out verbose result messages to keep chat clean
                                    if (msg.type === 'result' && msg.subtype === 'success') {
                                        return false;
                                    }
                                    return true;
                                })
                                .map(renderChatMessage)
                            }
                        </>
                    )}
                </div>

                {!showWelcome && (
                    <div className="chat-input-wrapper">
                        {/* Context Display */}
                        {currentContext ? (
                            <div className="context-display">
                                <span className="context-icon">
                                    {currentContext.type === 'image' ? '🖼️' : currentContext.type === 'images' ? '🖼️' : '📄'}
                                </span>
                                <span className="context-text">
                                    {currentContext.type === 'image' ? 'Image: ' : currentContext.type === 'images' ? 'Images: ' : 'Context: '}
                                    {currentContext.type === 'images' ? 
                                        `${currentContext.fileName.split(', ').length} images in moodboard` :
                                        (currentContext.fileName.includes('.superdesign') 
                                            ? currentContext.fileName.split('.superdesign/')[1] || currentContext.fileName.split('/').pop() || currentContext.fileName
                                            : currentContext.fileName.split('/').pop() || currentContext.fileName
                                        )
                                    }
                                </span>
                                <button 
                                    className="context-clear-btn"
                                    onClick={() => setCurrentContext(null)}
                                    title="Clear context"
                                >
                                    ×
                                </button>
                            </div>
                        ) : null}

                        {/* Upload Progress */}
                        {uploadingImages.length > 0 && (
                            <div className="upload-progress">
                                {uploadingImages.length > 1 && (
                                    <div className="upload-summary">
                                        Uploading {uploadingImages.length} images...
                                    </div>
                                )}
                                {uploadingImages.map((fileName, index) => (
                                    <div key={index} className="uploading-item">
                                        <span className="upload-icon">📎</span>
                                        <span className="upload-text">Uploading {fileName}...</span>
                                        <div className="upload-spinner"></div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Context Button */}
                        {!currentContext && uploadingImages.length === 0 && (
                            <button 
                                className="add-context-btn"
                                onClick={handleAddContext}
                                disabled={isLoading}
                            >
                                <span className="add-context-icon">@</span>
                                Add Context
                            </button>
                        )}

                        {/* Input Area */}
                    <div className="chat-input">
                            <textarea
                                placeholder="Design a calculator UI..."
                            value={inputMessage}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading || showWelcome}
                            className="message-input"
                                rows={1}
                                style={{
                                    minHeight: '20px',
                                    maxHeight: '120px',
                                    resize: 'none',
                                    overflow: inputMessage.split('\n').length > 6 ? 'auto' : 'hidden'
                                }}
                        />
                        </div>

                        {/* Agent and Model Selectors with Actions */}
                        <div className="input-controls">
                            <div className="selectors-group">
                                <div className="selector-wrapper">
                                    <ModelSelector
                                        selectedModel={selectedModel}
                                        onModelChange={handleModelChange}
                                        disabled={isLoading || showWelcome}
                                    />
                                </div>
                            </div>
                            
                            <div className="input-actions">
                                <button 
                                    className="attach-btn"
                                    onClick={() => {
                                        // Create file input and trigger it
                                        const fileInput = document.createElement('input');
                                        fileInput.type = 'file';
                                        fileInput.accept = 'image/*';
                                        fileInput.multiple = true;
                                        fileInput.onchange = async (e) => {
                                            const files = (e.target as HTMLInputElement).files;
                                            if (files) {
                                                for (const file of Array.from(files)) {
                                                    try {
                                                        await handleImageUpload(file);
                                                    } catch (error) {
                                                        console.error('Error uploading image:', error);
                                                    }
                                                }
                                            }
                                        };
                                        fileInput.click();
                                    }}
                                    disabled={isLoading || showWelcome}
                                    title="Attach images"
                                >
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                                        <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                                    </svg>
                                </button>
                                {isLoading ? (
                                    <button 
                                        onClick={stopResponse}
                                        className="send-btn stop-btn"
                                        title="Stop response"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 9 14H7a1.5 1.5 0 0 1-1.5-1.5v-9z"/>
                                        </svg>
                                    </button>
                                ) : (
                        <button 
                            onClick={handleSendMessage}
                                        disabled={!inputMessage.trim() || showWelcome}
                            className="send-btn"
                                        title="Send message"
                        >
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/>
                                        </svg>
                        </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatInterface; 