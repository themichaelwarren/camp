import React, { useState, useRef, useEffect } from 'react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  availableTags: string[];
  onCreateTag: (tagName: string) => Promise<void>;
  placeholder?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  availableTags,
  onCreateTag,
  placeholder = 'Type to add tags...'
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = availableTags.filter(
        tag =>
          tag.toLowerCase().includes(inputValue.toLowerCase()) &&
          !value.includes(tag)
      );
      setSuggestions(filtered);
      // Always show suggestions dropdown when typing (even if no matches, so user can create new tag)
      setShowSuggestions(true);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, availableTags, value]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed)) return;

    // Just add the tag to the local list - don't create in database yet
    // The parent component will handle creation on form submit
    onChange([...value, trimmed]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        addTag(suggestions[selectedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    }
  };

  return (
    <div className="relative">
      <div className="w-full px-4 py-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 min-h-[42px] flex flex-wrap gap-2 items-center">
        {value.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-xs font-semibold"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-indigo-800 ml-1"
            >
              <i className="fa-solid fa-xmark text-[10px]"></i>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setSuggestions(availableTags.filter(t => t.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(t)))}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm"
        />
      </div>
      {showSuggestions && inputValue.trim() && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((tag, index) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors ${
                index === selectedIndex ? 'bg-indigo-50' : ''
              }`}
            >
              {tag}
            </button>
          ))}
          {suggestions.length === 0 && (
            <div className="px-4 py-2 text-xs text-slate-400 italic">
              No existing tags match
            </div>
          )}
          {inputValue && !availableTags.includes(inputValue.trim()) && !value.includes(inputValue.trim()) && (
            <button
              type="button"
              onClick={() => addTag(inputValue)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-green-50 text-green-600 font-semibold ${
                suggestions.length > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <i className="fa-solid fa-plus mr-2"></i>
              Create "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TagInput;
