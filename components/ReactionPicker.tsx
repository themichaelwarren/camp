import React, { useState } from 'react';

interface ReactionPickerProps {
  reactions: Record<string, string[]>;
  currentUserEmail: string;
  onToggleReaction: (emoji: string) => void;
}

const AVAILABLE_EMOJIS = ['👍', '❤️', '😂', '🎵', '🔥', '👏'];

const ReactionPicker: React.FC<ReactionPickerProps> = ({ reactions, currentUserEmail, onToggleReaction }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onToggleReaction(emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(reactions).map(([emoji, users]) => {
          const hasReacted = users.includes(currentUserEmail);
          return (
            <button
              key={emoji}
              onClick={() => onToggleReaction(emoji)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                hasReacted
                  ? 'bg-indigo-100 border border-indigo-300 text-indigo-700'
                  : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{emoji}</span>
              <span className="font-bold">{users.length}</span>
            </button>
          );
        })}

        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors flex items-center justify-center text-sm"
          >
            <i className="fa-solid fa-face-smile"></i>
          </button>

          {showPicker && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPicker(false)}
              />
              <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-lg border border-slate-200 p-2 flex gap-1 z-20">
                {AVAILABLE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-8 h-8 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReactionPicker;
