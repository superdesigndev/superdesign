import React, { useState } from 'react';

interface DesignPanelProps {
    vscode: any;
}

const DesignPanel: React.FC<DesignPanelProps> = ({ vscode }) => {
    const [activeTab, setActiveTab] = useState('colors');
    const [colors, _setColors] = useState([
        { name: 'Primary', value: '#007ACC' },
        { name: 'Secondary', value: '#1E1E1E' },
        { name: 'Success', value: '#4CAF50' },
        { name: 'Warning', value: '#FF9800' },
    ]);

    const handleExportDesign = () => {
        vscode.postMessage({
            command: 'exportDesign',
            data: { colors, activeTab },
        });
    };

    return (
        <div className='design-panel'>
            <nav className='tab-nav'>
                <button
                    className={`tab ${activeTab === 'colors' ? 'active' : ''}`}
                    onClick={() => setActiveTab('colors')}
                >
                    🎨 Colors
                </button>
                <button
                    className={`tab ${activeTab === 'typography' ? 'active' : ''}`}
                    onClick={() => setActiveTab('typography')}
                >
                    ✏️ Typography
                </button>
                <button
                    className={`tab ${activeTab === 'components' ? 'active' : ''}`}
                    onClick={() => setActiveTab('components')}
                >
                    🧩 Components
                </button>
            </nav>

            <div className='tab-content'>
                {activeTab === 'colors' && (
                    <div className='colors-panel'>
                        <h3>Color Palette</h3>
                        <div className='color-grid'>
                            {colors.map((color, index) => (
                                <div key={index} className='color-item'>
                                    <div
                                        className='color-swatch'
                                        style={{ backgroundColor: color.value }}
                                    />
                                    <div className='color-info'>
                                        <span className='color-name'>{color.name}</span>
                                        <span className='color-value'>{color.value}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'typography' && (
                    <div className='typography-panel'>
                        <h3>Typography Scale</h3>
                        <div className='font-samples'>
                            <div className='font-sample h1'>Heading 1</div>
                            <div className='font-sample h2'>Heading 2</div>
                            <div className='font-sample body'>Body Text</div>
                            <div className='font-sample caption'>Caption</div>
                        </div>
                    </div>
                )}

                {activeTab === 'components' && (
                    <div className='components-panel'>
                        <h3>Design Components</h3>
                        <p>Component library coming soon...</p>
                    </div>
                )}
            </div>

            <div className='actions'>
                <button className='export-btn' onClick={handleExportDesign}>
                    📤 Export Design System
                </button>
            </div>
        </div>
    );
};

export default DesignPanel;
