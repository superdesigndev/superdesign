import React, { useState, useEffect } from 'react';
import { RegistryConfig, RegistryComponent, RegistryPage } from '../../types/canvas.types';

interface ComponentRegistryProps {
    registry: RegistryConfig;
    isLoading: boolean;
    error: string | null;
    onComponentSelect: (component: RegistryComponent) => void;
    onPageSelect: (page: RegistryPage) => void;
    onRefresh: () => void;
}

const ComponentRegistry: React.FC<ComponentRegistryProps> = ({
    registry,
    isLoading,
    error,
    onComponentSelect,
    onPageSelect,
    onRefresh
}) => {
    const [activeTab, setActiveTab] = useState<'components' | 'pages'>('components');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Group items by group
    const groupedComponents = registry.components.reduce((acc, component) => {
        if (!acc[component.group]) {
            acc[component.group] = [];
        }
        acc[component.group].push(component);
        return acc;
    }, {} as Record<string, RegistryComponent[]>);

    const groupedPages = registry.pages.reduce((acc, page) => {
        if (!acc[page.group]) {
            acc[page.group] = [];
        }
        acc[page.group].push(page);
        return acc;
    }, {} as Record<string, RegistryPage[]>);

    // Filter items based on search term
    const filterItems = <T extends RegistryComponent | RegistryPage>(items: T[]): T[] => {
        if (!searchTerm) return items;
        return items.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    // Get unique groups
    const componentGroups = Object.keys(groupedComponents);
    const pageGroups = Object.keys(groupedPages);
    const allGroups = [...new Set([...componentGroups, ...pageGroups])];

    // Toggle group expansion
    const toggleGroup = (group: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(group)) {
            newExpanded.delete(group);
        } else {
            newExpanded.add(group);
        }
        setExpandedGroups(newExpanded);
    };

    // Expand all groups by default
    useEffect(() => {
        setExpandedGroups(new Set(allGroups));
    }, [registry]);

    if (isLoading) {
        return (
            <div className="component-registry">
                <div className="registry-loading">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <span className="loading-text">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="component-registry">
                <div className="registry-error">
                    <div className="error-icon">⚠</div>
                    <h4>Failed to load registry</h4>
                    <p>{error}</p>
                    <button onClick={onRefresh} className="retry-btn">
                        ↻ Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="component-registry">

            {/* Search */}
            <div className="registry-search">
                <div className="search-container">
                    <span className="search-icon">⌕</span>
                    <input
                        type="text"
                        placeholder="Search components and pages..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="clear-search"
                            title="Clear search"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="registry-tabs">
                <button
                    className={`tab ${activeTab === 'components' ? 'active' : ''}`}
                    onClick={() => setActiveTab('components')}
                >
                    <span className="tab-label">Components</span>
                    <span className="tab-count">{registry.components.length}</span>
                </button>
                <button
                    className={`tab ${activeTab === 'pages' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pages')}
                >
                    <span className="tab-label">Pages</span>
                    <span className="tab-count">{registry.pages.length}</span>
                </button>
            </div>

            {/* Content */}
            <div className="registry-content">
                {activeTab === 'components' && (
                    <div className="components-list">
                        {Object.entries(groupedComponents).map(([group, components]) => {
                            const filteredComponents = filterItems(components);
                            if (filteredComponents.length === 0) return null;

                            const isExpanded = expandedGroups.has(group);

                            return (
                                <div key={group} className="component-group">
                                    <button
                                        className={`group-header ${isExpanded ? 'expanded' : ''}`}
                                        onClick={() => toggleGroup(group)}
                                    >
                                        <span className="group-toggle">
                                            ❯
                                        </span>
                                        <span className="group-name">{group}</span>
                                        <span className="group-count">{filteredComponents.length}</span>
                                    </button>

                                    {isExpanded && (
                                        <div className="group-items">
                                            {filteredComponents.map((component) => (
                                                <div
                                                    key={component.name}
                                                    className="component-item"
                                                    onClick={() => onComponentSelect(component)}
                                                >
                                                    <div className="item-header">
                                                        <div className="item-title">
                                                            <span className="item-name">{component.name}</span>
                                                            <div className="item-meta">
                                                                <span className="item-type">{component.type}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="item-description">
                                                        {component.description}
                                                    </div>
                                                    {component.props.length > 0 && (
                                                        <div className="item-props">
                                                            <span className="props-label">Props:</span>
                                                            <span className="props-count">
                                                                {component.props.length}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'pages' && (
                    <div className="pages-list">
                        {Object.entries(groupedPages).map(([group, pages]) => {
                            const filteredPages = filterItems(pages);
                            if (filteredPages.length === 0) return null;

                            const isExpanded = expandedGroups.has(group);

                            return (
                                <div key={group} className="page-group">
                                    <button
                                        className={`group-header ${isExpanded ? 'expanded' : ''}`}
                                        onClick={() => toggleGroup(group)}
                                    >
                                        <span className="group-toggle">
                                            ❯
                                        </span>
                                        <span className="group-name">{group}</span>
                                        <span className="group-count">{filteredPages.length}</span>
                                    </button>

                                    {isExpanded && (
                                        <div className="group-items">
                                            {filteredPages.map((page) => (
                                                <div
                                                    key={page.name}
                                                    className="page-item"
                                                    onClick={() => onPageSelect(page)}
                                                >
                                                    <div className="item-header">
                                                        <div className="item-title">
                                                            <span className="item-name">{page.name}</span>
                                                            <div className="item-meta">
                                                                <span className="item-route">{page.page}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="item-description">
                                                        {page.description}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Empty state */}
            {((activeTab === 'components' && registry.components.length === 0) ||
              (activeTab === 'pages' && registry.pages.length === 0)) && (
                <div className="registry-empty">
                    <div className="empty-icon">◻</div>
                    <h4>No {activeTab} found</h4>
                    <p>Create a <code>.superdesign/registry.json</code> file to get started with your component library.</p>
                    <button onClick={onRefresh} className="empty-action">
                        ↻ Refresh
                    </button>
                </div>
            )}



            <style>
                {`
                /* Component Registry - Compact Design Following VS Code Design System */
                .component-registry {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--vscode-sideBar-background);
                    color: var(--vscode-sideBar-foreground);
                    font-family: var(--vscode-font-family);
                    font-size: 12px;
                    overflow: hidden;
                }

                /* Centered Loading State */
                .registry-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    padding: 32px 14px;
                }

                /* Compact Search */
                .registry-search {
                    padding: 8px 0;
                    margin: 4px 0;
                }

                .search-container {
                    position: relative;
                    padding: 0;
                }

                .search-icon {
                    position: absolute;
                    left: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--vscode-input-placeholderForeground);
                    font-size: 20px;
                }

                .search-input {
                    width: 100%;
                    padding: 6px 10px 6px 32px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    color: var(--vscode-input-foreground);
                    font-size: 11px;
                    font-family: var(--vscode-font-family);
                    box-sizing: border-box;
                }

                .search-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }

                .search-input::placeholder {
                    color: var(--vscode-input-placeholderForeground);
                }

                .clear-search {
                    position: absolute;
                    right: 6px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: var(--vscode-input-placeholderForeground);
                    cursor: pointer;
                    padding: 1px;
                    font-size: 12px;
                }

                .clear-search:hover {
                    color: var(--vscode-foreground);
                }

                /* VS Code Style Tabs */
                .registry-tabs {
                    display: flex;
                    background: var(--vscode-sideBar-background);
                    position: relative;
                }

                .tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    padding: 8px 10px;
                    background: transparent;
                    border: none;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    font-family: var(--vscode-font-family);
                    opacity: 0.7;
                    border-bottom: 2px solid transparent;
                }

                .tab-count {
                    font-size: 9px;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 1px 4px;
                    border-radius: 6px;
                    min-width: 12px;
                    text-align: center;
                }

                .tab:hover {
                    opacity: 1;
                    background: var(--vscode-list-hoverBackground);
                }

                .tab.active {
                    opacity: 1;
                    background: transparent;
                    color: var(--vscode-foreground);
                    border-bottom-color: var(--vscode-focusBorder);
                }

                /* Compact Content */
                .registry-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 4px 0;
                    border-top: 1px solid var(--vscode-panel-border);
                }

                .registry-content::-webkit-scrollbar {
                    width: 6px;
                }

                .registry-content::-webkit-scrollbar-track {
                    background: transparent;
                }

                .registry-content::-webkit-scrollbar-thumb {
                    background: var(--vscode-scrollbarSlider-background);
                    border-radius: 3px;
                }

                .registry-content::-webkit-scrollbar-thumb:hover {
                    background: var(--vscode-scrollbarSlider-hoverBackground);
                }

                /* Compact Groups */
                .component-group,
                .page-group {
                    margin-bottom: 0;
                }

                .group-header {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 10px;
                    background: transparent;
                    border: none;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 600;
                    text-align: left;
                    transition: background-color 0.2s ease;
                    font-family: var(--vscode-font-family);
                }

                .group-header:hover {
                    background: var(--vscode-list-hoverBackground);
                }

                .group-toggle {
                    font-size: 8px;
                    color: var(--vscode-descriptionForeground);
                    transition: transform 0.2s ease;
                    width: 10px;
                    text-align: center;
                }

                .group-header.expanded .group-toggle {
                    transform: rotate(90deg);
                }

                .group-name {
                    flex: 1;
                    text-transform: capitalize;
                    font-weight: 600;
                    margin-right: 8px;
                    text-align: left;
                }

                .group-count {
                    font-size: 9px;
                    color: var(--vscode-descriptionForeground);
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 1px 4px;
                    border-radius: 6px;
                    min-width: 12px;
                    text-align: center;
                }

                /* Compact Group Items */
                .group-items {
                    padding-left: 0;
                    border-left: 1px solid transparent;
                }

                /* Card-style Items */
                .component-item,
                .page-item {
                    padding: 8px 10px;
                    margin: 4px 0;
                    cursor: pointer;
                    border-radius: 4px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    transition: all 0.2s ease;
                }

                .component-item:hover,
                .page-item:hover {
                    background: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                /* Compact Item Content */
                .item-header {
                    margin-bottom: 4px;
                }

                .item-title {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                .item-name {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    line-height: 1.2;
                    flex: 1;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .item-meta {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                }

                .item-type {
                    font-size: 8px;
                    color: var(--vscode-textLink-foreground);
                    font-weight: 600;
                    background: var(--vscode-button-secondaryBackground);
                    padding: 1px 4px;
                    border-radius: 3px;
                    text-transform: uppercase;
                }



                .item-route {
                    font-size: 8px;
                    color: var(--vscode-descriptionForeground);
                    font-family: var(--vscode-editor-font-family);
                    background: var(--vscode-textCodeBlock-background);
                    padding: 1px 4px;
                    border-radius: 2px;
                }

                .item-description {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    line-height: 1.3;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    margin-bottom: 2px;
                }

                .item-props {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 4px;
                }

                .props-label {
                    font-size: 9px;
                    color: var(--vscode-descriptionForeground);
                    font-weight: 500;
                }

                .props-count {
                    font-size: 9px;
                    color: var(--vscode-charts-blue);
                    font-weight: 600;
                    background: var(--vscode-input-background);
                    padding: 1px 4px;
                    border-radius: 3px;
                    border: 1px solid var(--vscode-input-border);
                }

                /* Compact Empty State */
                .registry-empty {
                    padding: 24px 14px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }

                .empty-icon {
                    font-size: 32px;
                    opacity: 0.3;
                }

                .registry-empty h4 {
                    margin: 0;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .registry-empty p {
                    margin: 0;
                    font-size: 10px;
                    line-height: 1.4;
                    max-width: 220px;
                }

                .registry-empty code {
                    background: var(--vscode-textCodeBlock-background);
                    color: var(--vscode-textPreformat-foreground);
                    padding: 1px 3px;
                    border-radius: 2px;
                    font-size: 9px;
                    font-family: var(--vscode-editor-font-family);
                }

                .empty-action {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 500;
                    transition: background-color 0.2s ease;
                    font-family: var(--vscode-font-family);
                }

                .empty-action:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                /* Remove Footer - Not Essential */
                .registry-footer {
                    display: none;
                }

                /* Compact Error State */
                .registry-error {
                    padding: 24px 14px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }

                .error-icon {
                    font-size: 32px;
                    color: var(--vscode-errorForeground);
                }

                .registry-error h4 {
                    margin: 0;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-errorForeground);
                }

                .registry-error p {
                    margin: 0;
                    color: var(--vscode-descriptionForeground);
                    font-size: 10px;
                    line-height: 1.4;
                    max-width: 220px;
                }

                .retry-btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 500;
                    transition: background-color 0.2s ease;
                    font-family: var(--vscode-font-family);
                }

                .retry-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                /* Compact Loading State */
                .loading-container {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .spinner {
                    width: 12px;
                    height: 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-top: 1px solid var(--vscode-button-background);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                .loading-text {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                `}
            </style>
        </div>
    );
};

export default ComponentRegistry; 