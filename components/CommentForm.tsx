import React, { useState, useRef, useMemo } from 'react';
import { CamperProfile } from '../types';
import ArtworkImage from './ArtworkImage';

interface CommentFormProps {
  onSubmit: (text: string, mentionedEmails?: string[]) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  campers?: CamperProfile[];
}

const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  submitLabel = 'Comment',
  autoFocus = false,
  campers
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedEmails, setMentionedEmails] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || !campers?.length) return [];
    const q = mentionQuery.toLowerCase();
    return campers.filter(c => c.name && c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, campers]);

  const detectMention = (value: string, cursorPos: number) => {
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setSelectedMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    detectMention(value, e.target.selectionStart);
  };

  const insertMention = (camper: CamperProfile) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (!atMatch) return;

    const matchStart = textBeforeCursor.length - atMatch[0].length;
    const atStart = matchStart + (atMatch[0][0] === '@' ? 0 : 1); // skip leading whitespace
    const before = text.slice(0, atStart);
    const after = text.slice(cursorPos);
    const insertion = `@${camper.name} `;

    const newText = before + insertion + after;
    setText(newText);
    setMentionQuery(null);
    setMentionedEmails(prev => new Set(prev).add(camper.email));

    const newCursorPos = before.length + insertion.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionSuggestions[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    // Verify mentions still exist in final text
    const finalMentions = campers
      ? Array.from(mentionedEmails).filter(email => {
          const camper = campers.find(c => c.email === email);
          return camper && text.includes(`@${camper.name}`);
        })
      : [];

    setIsSubmitting(true);
    try {
      await onSubmit(text.trim(), finalMentions.length > 0 ? finalMentions : undefined);
      setText('');
      setMentionedEmails(new Set());
    } catch (error) {
      console.error('Failed to submit comment', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={() => {
            const ta = textareaRef.current;
            if (ta) detectMention(text, ta.selectionStart);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-base disabled:bg-slate-50 disabled:text-slate-400"
          rows={3}
        />
        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="absolute z-[9999] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {mentionSuggestions.map((camper, index) => (
              <button
                key={camper.email}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(camper); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors flex items-center gap-3 ${
                  index === selectedMentionIndex ? 'bg-indigo-50' : ''
                }`}
              >
                {camper.pictureOverrideUrl || camper.picture ? (
                  <ArtworkImage
                    fileId={undefined}
                    fallbackUrl={camper.pictureOverrideUrl || camper.picture}
                    alt={camper.name}
                    className="w-6 h-6 rounded-full object-cover"
                    containerClassName="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"
                    fallback={
                      <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                        {camper.name?.[0]?.toUpperCase()}
                      </div>
                    }
                  />
                ) : (
                  <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                    {camper.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className="font-medium">{camper.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!text.trim() || isSubmitting}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              Posting...
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
};

export default CommentForm;
