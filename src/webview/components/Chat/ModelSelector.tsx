import React, { useState, useRef, useEffect } from 'react';
import { BrainIcon } from '../Icons';

interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (model: string) => void;
    disabled?: boolean;
}

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    category: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const models: ModelOption[] = [
        // Anthropic
        { id: 'claude-4-opus-20250514', name: 'Claude 4 Opus', provider: 'Anthropic', category: 'Premium' },
        { id: 'claude-4-sonnet-20250514', name: 'Claude 4 Sonnet', provider: 'Anthropic', category: 'Balanced' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', category: 'Balanced' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', category: 'Balanced' },
        // Google (OpenRouter)
        { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'OpenRouter (Google)', category: 'Balanced' },
        // Meta (OpenRouter)
        { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', provider: 'OpenRouter (Meta)', category: 'Balanced' },
        // DeepSeek (OpenRouter)
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'OpenRouter (DeepSeek)', category: 'Balanced' },
        // Mistral (OpenRouter)
        { id: 'mistralai/mistral-small-3.2-24b-instruct-2506', name: 'Mistral Small 3.2 24B', provider: 'OpenRouter (Mistral)', category: 'Balanced' },
        // xAI (OpenRouter)
        { id: 'x-ai/grok-3', name: 'Grok 3', provider: 'OpenRouter (xAI)', category: 'Balanced' },
        // Qwen (OpenRouter)
        { id: 'qwen/qwen3-235b-a22b-04-28', name: 'Qwen3 235B', provider: 'OpenRouter (Qwen)', category: 'Balanced' },
        // Perplexity (OpenRouter)
        { id: 'perplexity/sonar-reasoning-pro', name: 'Sonar Reasoning Pro', provider: 'OpenRouter (Perplexity)', category: 'Balanced' },
        // Microsoft (OpenRouter)
        { id: 'microsoft/phi-4-reasoning-plus-04-30', name: 'Phi-4 Reasoning Plus', provider: 'OpenRouter (Microsoft)', category: 'Balanced' },
        // NVIDIA (OpenRouter)
        { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Llama 3.3 Nemotron Super 49B', provider: 'OpenRouter (NVIDIA)', category: 'Balanced' },
        // Cohere (OpenRouter)
        { id: 'cohere/command-a-03-2025', name: 'Command A', provider: 'OpenRouter (Cohere)', category: 'Balanced' },
        // Amazon (OpenRouter)
        { id: 'amazon/nova-pro-v1', name: 'Nova Pro', provider: 'OpenRouter (Amazon)', category: 'Balanced' },
        // Inflection (OpenRouter)
        { id: 'inflection/inflection-3-productivity', name: 'Inflection 3 Productivity', provider: 'OpenRouter (Inflection)', category: 'Balanced' },
        // Reka (OpenRouter)
        { id: 'rekaai/reka-flash-3', name: 'Reka Flash 3', provider: 'OpenRouter (Reka)', category: 'Balanced' },
        // Additional OpenRouter models
        { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast 1', provider: 'OpenRouter (xAI)', category: 'Fast' },
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'OpenRouter (Anthropic)', category: 'Balanced' },
        { id: 'deepseek/deepseek-chat-v3.1:free', name: 'DeepSeek Chat V3.1 Free', provider: 'OpenRouter (DeepSeek)', category: 'Balanced' },
        // Existing OpenAI (direct)
        { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', category: 'Balanced' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', category: 'Fast' }
    ];

    const filteredModels = models.filter(model =>
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedModelName = models.find(m => m.id === selectedModel)?.name || selectedModel;

    const calculateDropdownPosition = () => {
        if (!triggerRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const modalHeight = 190; // Reduced from 220 since we removed add models section
        const modalWidth = 240;
        const padding = 8;

        // Calculate vertical position (above the trigger)
        let top = triggerRect.top - modalHeight - padding;
        
        // If there's not enough space above, show below
        if (top < padding) {
            top = triggerRect.bottom + padding;
        }

        // Calculate horizontal position (align with trigger)
        let left = triggerRect.left;
        
        // Ensure modal doesn't go off-screen horizontally
        const rightEdge = left + modalWidth;
        if (rightEdge > window.innerWidth - padding) {
            left = window.innerWidth - modalWidth - padding;
        }
        if (left < padding) {
            left = padding;
        }

        setDropdownPosition({ top, left });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen) {
                calculateDropdownPosition();
            }
        };

        const handleResize = () => {
            if (isOpen) {
                calculateDropdownPosition();
            }
        };

        if (isOpen) {
            calculateDropdownPosition();
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    const handleModelSelect = (modelId: string) => {
        onModelChange(modelId);
        setIsOpen(false);
    };

    const handleToggleOpen = () => {
        if (!isOpen) {
            calculateDropdownPosition();
        }
        setIsOpen(!isOpen);
    };

    return (
        <>
            <style>
                {`
                    .model-selector-wrapper {
                        position: relative;
                        display: inline-block;
                    }

                    .model-selector-trigger {
                        background: transparent;
                        color: var(--vscode-foreground);
                        border: none;
                        outline: none;
                        font-size: 11px;
                        font-family: inherit;
                        cursor: pointer;
                        padding: 2px 20px 2px 6px;
                        border-radius: 4px;
                        transition: background-color 0.2s ease;
                        min-width: 120px;
                        white-space: nowrap;
                        position: relative;
                        display: flex;
                        align-items: center;
                        gap: 3px;
                    }

                    .model-selector-trigger:hover:not(:disabled) {
                        background: var(--vscode-list-hoverBackground);
                    }

                    .model-selector-trigger:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    .model-selector-arrow {
                        position: absolute;
                        right: 6px;
                        top: 50%;
                        transform: translateY(-50%);
                        transition: transform 0.2s ease;
                        color: var(--vscode-descriptionForeground);
                    }

                    .model-selector-arrow.open {
                        transform: translateY(-50%) rotate(180deg);
                    }

                    .model-selector-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: transparent;
                        z-index: 1000;
                        pointer-events: none;
                    }

                    .model-selector-content {
                        position: absolute;
                        background: var(--vscode-dropdown-background);
                        border: 1px solid var(--vscode-dropdown-border);
                        border-radius: 4px;
                        width: 240px;
                        max-height: 190px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                        overflow: hidden;
                        pointer-events: auto;
                    }

                    .model-selector-header {
                        padding: 6px 8px;
                        border-bottom: 1px solid var(--vscode-dropdown-border);
                    }

                    .model-selector-search {
                        width: 100%;
                        background: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 3px;
                        padding: 6px 8px;
                        color: var(--vscode-input-foreground);
                        font-size: 11px;
                        outline: none;
                        box-sizing: border-box;
                    }

                    .model-selector-search:focus {
                        border-color: var(--vscode-focusBorder);
                    }

                    .model-selector-search::placeholder {
                        color: var(--vscode-input-placeholderForeground);
                    }

                    .model-selector-list {
                        max-height: 150px;
                        overflow-y: auto;
                        overflow-x: hidden;
                    }

                    .model-selector-list::-webkit-scrollbar {
                        width: 6px;
                    }

                    .model-selector-list::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    .model-selector-list::-webkit-scrollbar-thumb {
                        background: var(--vscode-scrollbarSlider-background);
                        border-radius: 3px;
                    }

                    .model-selector-list::-webkit-scrollbar-thumb:hover {
                        background: var(--vscode-scrollbarSlider-hoverBackground);
                    }

                    .model-option {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 4px 8px 4px 8px;
                        cursor: pointer;
                        transition: background-color 0.2s ease;
                        border: none;
                        background: none;
                        width: 100%;
                        text-align: left;
                        box-sizing: border-box;
                        min-height: 28px;
                        position: relative;
                    }

                    .model-option:hover {
                        background: var(--vscode-list-hoverBackground);
                    }

                    .model-option.selected {
                        background: var(--vscode-list-activeSelectionBackground) !important;
                        color: var(--vscode-list-activeSelectionForeground);
                    }

                    .model-option.selected:hover {
                        background: var(--vscode-list-activeSelectionBackground) !important;
                    }

                    .model-icon {
                        flex-shrink: 0;
                        color: var(--vscode-descriptionForeground);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 12px;
                        height: 12px;
                    }

                    .model-option.selected .model-icon {
                        color: var(--vscode-list-activeSelectionForeground);
                    }

                    .model-info {
                        flex: 1;
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                    }

                    .model-name {
                        font-size: 11px;
                        font-weight: 500;
                        color: var(--vscode-foreground);
                        margin: 0;
                        line-height: 1.2;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .model-option.selected .model-name {
                        color: var(--vscode-list-activeSelectionForeground);
                    }

                    .model-provider {
                        font-size: 9px;
                        color: var(--vscode-descriptionForeground);
                        margin: 0;
                        line-height: 1.1;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .model-option.selected .model-provider {
                        color: var(--vscode-list-activeSelectionForeground);
                        opacity: 0.8;
                    }

                    .model-check {
                        flex-shrink: 0;
                        color: var(--vscode-list-activeSelectionForeground);
                        font-size: 11px;
                        width: 12px;
                        height: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                `}
            </style>

            <div className="model-selector-wrapper">
                <button 
                    ref={triggerRef}
                    className="model-selector-trigger"
                    onClick={handleToggleOpen}
                    disabled={disabled}
                >
                    <div className="selector-icon model-icon">
                        <BrainIcon />
                    </div>
                    <span>{selectedModelName}</span>
                    <svg 
                        className={`model-selector-arrow ${isOpen ? 'open' : ''}`}
                        width="12" 
                        height="12" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                    >
                        <path 
                            stroke="currentColor" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth="1.5" 
                            d="m6 12 4-4 4 4"
                        />
                    </svg>
                </button>

                {isOpen && (
                    <div className="model-selector-modal">
                        <div 
                            className="model-selector-content" 
                            ref={modalRef}
                            style={{
                                top: dropdownPosition.top,
                                left: dropdownPosition.left
                            }}
                        >
                            <div className="model-selector-header">
                                <input
                                    type="text"
                                    className="model-selector-search"
                                    placeholder="Search models..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="model-selector-list">
                                {filteredModels.map((model) => (
                                    <button
                                        key={model.id}
                                        className={`model-option ${model.id === selectedModel ? 'selected' : ''}`}
                                        onClick={() => handleModelSelect(model.id)}
                                    >
                                        <div className="model-icon">
                                            <BrainIcon />
                                        </div>
                                        <div className="model-info">
                                            <div className="model-name">{model.name}</div>
                                            <div className="model-provider">{model.provider}</div>
                                        </div>
                                        {model.id === selectedModel && (
                                            <div className="model-check">✓</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default ModelSelector; 