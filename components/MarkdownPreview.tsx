import React, { useEffect, useState } from 'react';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

// Import marked dynamically
let marked: any = null;

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className = '' }) => {
  const [html, setHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMarked = async () => {
      if (!marked) {
        const markedModule = await import('https://esm.sh/marked@11.1.1');
        marked = markedModule.marked;
      }
      setIsLoading(false);
    };
    loadMarked();
  }, []);

  useEffect(() => {
    if (!isLoading && marked) {
      const rendered = marked.parse(content || '', { breaks: true, gfm: true });
      setHtml(rendered);
    }
  }, [content, isLoading]);

  if (isLoading) {
    return <div className={className}>Loading preview...</div>;
  }

  return (
    <div
      className={`markdown-preview ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownPreview;
