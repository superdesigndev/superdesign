import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/vs2015.css'; // Dark theme that matches VS Code

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    return (
        <div className={`markdown-content ${className || ''}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // Custom paragraph with forced spacing
                    p: ({ node, children, ...props }) => {
                        return (
                            <p 
                                style={{ 
                                    margin: '0 !important', 
                                    padding: '0 !important', 
                                    lineHeight: '1.3 !important',
                                    marginBottom: '0 !important',
                                    marginTop: '0 !important',
                                    display: 'block'
                                }} 
                                {...props}
                            >
                                {children}
                            </p>
                        );
                    },
                    // Custom list with forced spacing
                    ul: ({ node, children, ...props }) => {
                        return (
                            <ul 
                                style={{ 
                                    margin: '0 !important', 
                                    padding: '0 !important',
                                    paddingLeft: '20px !important',
                                    lineHeight: '1.3 !important',
                                    marginTop: '0 !important',
                                    marginBottom: '0 !important',
                                    display: 'block'
                                }} 
                                {...props}
                            >
                                {children}
                            </ul>
                        );
                    },
                    // Custom list item with forced spacing
                    li: ({ node, children, ...props }) => {
                        return (
                            <li 
                                style={{ 
                                    margin: '0 !important', 
                                    padding: '0 !important',
                                    lineHeight: '1.3 !important',
                                    marginTop: '0 !important',
                                    marginBottom: '0 !important',
                                    display: 'list-item'
                                }} 
                                {...props}
                            >
                                {children}
                            </li>
                        );
                    },
                    // Custom ordered list with forced spacing
                    ol: ({ node, children, ...props }) => {
                        return (
                            <ol 
                                style={{ 
                                    margin: '0 !important', 
                                    padding: '0 !important',
                                    paddingLeft: '20px !important',
                                    lineHeight: '1.3 !important',
                                    marginTop: '0 !important',
                                    marginBottom: '0 !important',
                                    display: 'block'
                                }} 
                                {...props}
                            >
                                {children}
                            </ol>
                        );
                    },
                    // Override div to prevent any spacing
                    div: ({ node, children, ...props }) => {
                        return (
                            <div 
                                style={{ 
                                    margin: '0 !important', 
                                    padding: '0 !important',
                                    lineHeight: '1.3 !important'
                                }} 
                                {...props}
                            >
                                {children}
                            </div>
                        );
                    },
                    // Custom rendering for code blocks
                    code: ({ node, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const inline = !className?.includes('language-');
                        return !inline && match ? (
                            <pre className={`language-${match[1]} hljs`}>
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            </pre>
                        ) : (
                            <code className={`inline-code ${className || ''}`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Custom rendering for links to open externally
                    a: ({ node, children, href, ...props }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                        >
                            {children}
                        </a>
                    ),
                    // Custom rendering for tables
                    table: ({ node, children, ...props }) => (
                        <div className="table-wrapper">
                            <table {...props}>{children}</table>
                        </div>
                    ),
                    // Custom rendering for blockquotes
                    blockquote: ({ node, children, ...props }) => (
                        <blockquote className="markdown-blockquote" {...props}>
                            {children}
                        </blockquote>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer; 