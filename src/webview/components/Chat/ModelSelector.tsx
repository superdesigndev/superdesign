import React, { useState, useRef, useEffect } from 'react';
import { BrainIcon } from '../Icons';
import type { ModelConfigWithProvider, ProviderId } from '../../../providers/types';

interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (providerId: ProviderId, model: string) => void;
    disabled?: boolean;
    models: ModelConfigWithProvider[];
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    selectedModel,
    onModelChange,
    disabled,
    models,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const filteredModels = models.filter(
        model =>
            model.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            model.providerId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedModelName =
        models.find(m => m.id === selectedModel)?.displayName ?? selectedModel;

    const calculateDropdownPosition = () => {
        if (!triggerRef.current) {
            return;
        }

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
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
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

    const handleModelSelect = (providerId: ProviderId, modelId: string) => {
        onModelChange(providerId, modelId);
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

            <div className='model-selector-wrapper'>
                <button
                    ref={triggerRef}
                    className='model-selector-trigger'
                    onClick={handleToggleOpen}
                    disabled={disabled}
                >
                    <div className='selector-icon model-icon'>
                        <BrainIcon />
                    </div>
                    <span>{selectedModelName}</span>
                    <svg
                        className={`model-selector-arrow ${isOpen ? 'open' : ''}`}
                        width='12'
                        height='12'
                        viewBox='0 0 20 20'
                        fill='currentColor'
                    >
                        <path
                            stroke='currentColor'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='1.5'
                            d='m6 12 4-4 4 4'
                        />
                    </svg>
                </button>

                {isOpen && (
                    <div className='model-selector-modal'>
                        <div
                            className='model-selector-content'
                            ref={modalRef}
                            style={{
                                top: dropdownPosition.top,
                                left: dropdownPosition.left,
                            }}
                        >
                            <div className='model-selector-header'>
                                <input
                                    type='text'
                                    className='model-selector-search'
                                    placeholder='Search models...'
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className='model-selector-list'>
                                {filteredModels.map(model => (
                                    <button
                                        key={model.id}
                                        className={`model-option ${model.id === selectedModel ? 'selected' : ''}`}
                                        onClick={() =>
                                            handleModelSelect(model.providerId, model.id)
                                        }
                                    >
                                        <div className='model-icon'>
                                            <BrainIcon />
                                        </div>
                                        <div className='model-info'>
                                            <div className='model-name'>{model.displayName}</div>
                                            <div className='model-provider'>{model.providerId}</div>
                                        </div>
                                        {model.id === selectedModel && (
                                            <div className='model-check'>✓</div>
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
