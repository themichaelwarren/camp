import React, { useState, useRef, useEffect } from 'react';
import { Prompt, Assignment } from '../types';
import { getPromptStatus, getPromptStatusStyle } from '../utils';

interface PromptSelectorProps {
  prompts: Prompt[];
  assignments: Assignment[];
  selectedPromptId: string;
  onChange: (promptId: string) => void;
  placeholder?: string;
  required?: boolean;
}

const PromptSelector: React.FC<PromptSelectorProps> = ({
  prompts,
  assignments,
  selectedPromptId,
  onChange,
  placeholder = 'Search and select a prompt...',
  required = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  const filteredPrompts = prompts.filter(prompt =>
    prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (promptId: string) => {
    onChange(promptId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredPrompts.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPrompts[highlightedIndex]) {
          handleSelect(filteredPrompts[highlightedIndex].id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`w-full px-4 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500 ${
          !selectedPrompt ? 'text-slate-400' : 'text-slate-800'
        }`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {!isOpen && selectedPrompt ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{selectedPrompt.title}</div>
              <div className="text-xs text-slate-500 line-clamp-1">{selectedPrompt.description}</div>
            </div>
            <i className="fa-solid fa-chevron-down text-slate-400 text-xs"></i>
          </div>
        ) : !isOpen ? (
          <div className="flex items-center justify-between">
            <span>{placeholder}</span>
            <i className="fa-solid fa-chevron-down text-slate-400 text-xs"></i>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            className="w-full outline-none text-sm"
            placeholder="Type to search..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filteredPrompts.length > 0 ? (
            filteredPrompts.map((prompt, index) => (
              <div
                key={prompt.id}
                onClick={() => handleSelect(prompt.id)}
                className={`p-3 cursor-pointer transition-colors border-b border-slate-50 last:border-b-0 ${
                  index === highlightedIndex
                    ? 'bg-indigo-50'
                    : selectedPromptId === prompt.id
                    ? 'bg-slate-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800 mb-1">{prompt.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-2 mb-2">{prompt.description}</div>
                    <div className="flex flex-wrap gap-1">
                      {prompt.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
                          {tag}
                        </span>
                      ))}
                      {prompt.tags.length > 3 && (
                        <span className="text-[9px] text-slate-400">+{prompt.tags.length - 3}</span>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const cs = getPromptStatus(prompt.id, assignments);
                    return <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${getPromptStatusStyle(cs)}`}>{cs}</span>;
                  })()}
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-slate-400 text-sm">
              <i className="fa-solid fa-search mb-2 text-lg opacity-30"></i>
              <p>No prompts found matching "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}

      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={selectedPromptId}
          onChange={() => {}}
          className="absolute opacity-0 pointer-events-none"
          tabIndex={-1}
        />
      )}
    </div>
  );
};

export default PromptSelector;
