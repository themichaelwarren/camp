import React, { useState } from 'react';

interface ReactionPickerProps {
  reactions: Record<string, string[]>;
  currentUserEmail: string;
  onToggleReaction: (emoji: string) => void;
}

const EMOJI_CATEGORIES = {
  'Music & Camp': ['🤘', '🎸', '🎵', '🎶', '🎤', '🎹', '🥁', '🎺', '🎻', '🎧', '🎼', '🔊'],
  'Reactions': ['👍', '👎', '👏', '🙌', '🤝', '✊', '👊', '🤙', '✌️', '🤟', '💪', '🫶'],
  'Love & Energy': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🔥', '⚡', '✨', '💫'],
  'Faces': ['😂', '😭', '😍', '🥰', '😎', '🤩', '🥳', '😊', '😢', '😅', '🤔', '😮', '😱', '🤯', '🥺', '😤', '😈'],
  'Symbols': ['⭐', '🌟', '💯', '✅', '❌', '❓', '❗', '💡', '🎉', '🎊', '🏆', '🥇'],
  'Nature': ['🌈', '🌙', '☀️', '⛈️', '🌸', '🌹', '🌺', '🍀', '🌲', '🌊'],
  'Animals': ['🐱', '🐶', '🦄', '🦋', '🐝', '🦅', '🦉', '🐢', '🐍', '🦖'],
  'Food & Drink': ['🍕', '🌮', '🍔', '🍰', '🍪', '☕', '🥤', '🍺', '🍷', '🥂']
};

const AVAILABLE_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

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
              <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-slate-200 z-20 w-80 max-h-96 overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pick a reaction</p>
                </div>
                <div className="p-3 space-y-4">
                  {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <div key={category}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{category}</p>
                      <div className="grid grid-cols-8 gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiClick(emoji)}
                            className="w-9 h-9 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center text-xl"
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReactionPicker;
