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
        <div className={`markdown-content ${className ?? ''}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // Custom rendering for code blocks
                    code: ({ className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className ?? '');
                        const inline = !className?.includes('language-');
                        return !inline && match ? (
                            <pre className={`language-${match[1]} hljs`}>
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            </pre>
                        ) : (
                            <code className={`inline-code ${className ?? ''}`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Custom rendering for links to open externally
                    a: ({ children, href, ...props }) => (
                        <a href={href} target='_blank' rel='noopener noreferrer' {...props}>
                            {children}
                        </a>
                    ),
                    // Custom rendering for tables
                    table: ({ children, ...props }) => (
                        <div className='table-wrapper'>
                            <table {...props}>{children}</table>
                        </div>
                    ),
                    // Custom rendering for blockquotes
                    blockquote: ({ children, ...props }) => (
                        <blockquote className='markdown-blockquote' {...props}>
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
