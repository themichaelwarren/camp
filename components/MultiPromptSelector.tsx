import React, { useState, useRef, useEffect } from 'react';
import { Prompt, PromptStatus } from '../types';
import TagInput from './TagInput';

interface MultiPromptSelectorProps {
  prompts: Prompt[];
  selectedPromptIds: string[];
  onChange: (promptIds: string[]) => void;
  onCreatePrompt: (prompt: Prompt) => Promise<void>;
  placeholder?: string;
  required?: boolean;
  availableTags: string[];
  spreadsheetId: string;
  userEmail?: string;
}

const MultiPromptSelector: React.FC<MultiPromptSelectorProps> = ({
  prompts,
  selectedPromptIds,
  onChange,
  onCreatePrompt,
  placeholder = 'Search and select prompts...',
  required = false,
  availableTags,
  spreadsheetId,
  userEmail
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ title: '', description: '', tags: [] as string[] });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPrompts = prompts.filter(p => selectedPromptIds.includes(p.id));

  const filteredPrompts = prompts.filter(prompt =>
    !selectedPromptIds.includes(prompt.id) && (
      prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (promptId: string) => {
    onChange([...selectedPromptIds, promptId]);
    setSearchTerm('');
    setHighlightedIndex(0);
  };

  const handleRemove = (promptId: string) => {
    onChange(selectedPromptIds.filter(id => id !== promptId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (showCreateForm) return;

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
        setShowCreateForm(false);
        break;
      case 'Backspace':
        if (!searchTerm && selectedPromptIds.length > 0) {
          handleRemove(selectedPromptIds[selectedPromptIds.length - 1]);
        }
        break;
    }
  };

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.title.trim()) return;

    setIsCreating(true);
    try {
      const prompt: Prompt = {
        id: Math.random().toString(36).substr(2, 9),
        title: newPrompt.title.trim(),
        description: newPrompt.description.trim(),
        tags: newPrompt.tags,
        upvotes: 0,
        status: PromptStatus.DRAFT,
        createdAt: new Date().toISOString().split('T')[0],
        createdBy: userEmail || 'Admin'
      };

      await onCreatePrompt(prompt);
      onChange([...selectedPromptIds, prompt.id]);
      setNewPrompt({ title: '', description: '', tags: [] });
      setShowCreateForm(false);
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to create prompt', error);
      alert('Failed to create prompt. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500 min-h-[42px] flex flex-wrap gap-2 items-center cursor-text"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {selectedPrompts.map(prompt => (
          <span
            key={prompt.id}
            className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-semibold max-w-[200px]"
          >
            <span className="truncate">{prompt.title}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(prompt.id);
              }}
              className="hover:text-indigo-900 ml-0.5 shrink-0"
            >
              <i className="fa-solid fa-xmark text-[10px]"></i>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[140px] outline-none text-sm bg-transparent"
          placeholder={selectedPrompts.length === 0 ? placeholder : 'Add more...'}
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          {!showCreateForm ? (
            <>
              {filteredPrompts.length > 0 ? (
                filteredPrompts.slice(0, 6).map((prompt, index) => (
                  <div
                    key={prompt.id}
                    onClick={() => handleSelect(prompt.id)}
                    className={`p-3 cursor-pointer transition-colors border-b border-slate-50 last:border-b-0 ${
                      index === highlightedIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-800 mb-0.5">{prompt.title}</div>
                        <div className="text-xs text-slate-500 line-clamp-1 mb-1.5">{prompt.description}</div>
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
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                        prompt.status === 'Active' ? 'bg-green-100 text-green-700' :
                        prompt.status === 'Draft' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {prompt.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : searchTerm ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  <p>No prompts found matching "{searchTerm}"</p>
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400 text-sm">
                  <p>All prompts selected or none available</p>
                </div>
              )}

              <div className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(true);
                    if (searchTerm) {
                      setNewPrompt(prev => ({ ...prev, title: searchTerm }));
                    }
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 text-indigo-600 font-semibold flex items-center gap-2 transition-colors"
                >
                  <i className="fa-solid fa-plus"></i>
                  Create New Prompt{searchTerm && `: "${searchTerm}"`}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreatePrompt} className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">New Prompt</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewPrompt({ title: '', description: '', tags: [] });
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Prompt title *"
                  value={newPrompt.title}
                  onChange={e => setNewPrompt(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div>
                <textarea
                  placeholder="Description (optional)"
                  value={newPrompt.description}
                  onChange={e => setNewPrompt(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div>
                <TagInput
                  value={newPrompt.tags}
                  onChange={tags => setNewPrompt(prev => ({ ...prev, tags }))}
                  availableTags={availableTags}
                  onCreateTag={async () => {}}
                  placeholder="Add tags..."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewPrompt({ title: '', description: '', tags: [] });
                  }}
                  className="flex-1 px-3 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPrompt.title.trim() || isCreating}
                  className="flex-1 px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus"></i>
                      Create & Add
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {required && (
        <input
          type="text"
          required
          value={selectedPromptIds.length > 0 ? 'valid' : ''}
          onChange={() => {}}
          className="absolute opacity-0 pointer-events-none"
          tabIndex={-1}
        />
      )}
    </div>
  );
};

export default MultiPromptSelector;
