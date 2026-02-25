import React, { useState } from 'react';
import MarkdownPreview from './MarkdownPreview';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minHeight?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your instructions using markdown...',
  required = false,
  minHeight = 'h-32'
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden min-w-0">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => setActiveTab('write')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'write'
              ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fa-solid fa-pen mr-2"></i>
          Write
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'preview'
              ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fa-solid fa-eye mr-2"></i>
          Preview
        </button>
      </div>

      {/* Content */}
      <div className="bg-white">
        {activeTab === 'write' ? (
          <textarea
            required={required}
            className={`w-full px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${minHeight}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <div className={`px-4 py-3 ${minHeight} overflow-y-auto`}>
            {value ? (
              <MarkdownPreview content={value} />
            ) : (
              <p className="text-slate-400 italic">Nothing to preview yet. Write some markdown in the Write tab!</p>
            )}
          </div>
        )}
      </div>

      {/* Markdown help */}
      {activeTab === 'write' && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex flex-wrap gap-3">
          <span className="font-semibold">Quick Reference:</span>
          <span><code className="bg-slate-200 px-1 rounded">**bold**</code></span>
          <span><code className="bg-slate-200 px-1 rounded">*italic*</code></span>
          <span><code className="bg-slate-200 px-1 rounded">- list</code></span>
          <span><code className="bg-slate-200 px-1 rounded"># heading</code></span>
          <span><code className="bg-slate-200 px-1 rounded">[link](url)</code></span>
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;
