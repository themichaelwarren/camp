import React, { useState } from 'react';
import { Comment as CommentType } from '../types';
import CommentForm from './CommentForm';
import ReactionPicker from './ReactionPicker';

interface CommentProps {
  comment: CommentType;
  replies: CommentType[];
  currentUserEmail: string;
  onReply: (parentId: string, text: string) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: string) => void;
}

const Comment: React.FC<CommentProps> = ({
  comment,
  replies,
  currentUserEmail,
  onReply,
  onToggleReaction
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleReplySubmit = async (text: string) => {
    await onReply(comment.id, text);
    setShowReplyForm(false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
          {comment.author.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-slate-50 rounded-2xl px-4 py-3">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-bold text-sm text-slate-800">
                {comment.author}
              </span>
              <span className="text-xs text-slate-400">
                {formatTimestamp(comment.timestamp)}
              </span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
              {comment.text}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2 px-2">
            <ReactionPicker
              reactions={comment.reactions}
              currentUserEmail={currentUserEmail}
              onToggleReaction={(emoji) => onToggleReaction(comment.id, emoji)}
            />
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Reply
            </button>
          </div>

          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                onSubmit={handleReplySubmit}
                onCancel={() => setShowReplyForm(false)}
                placeholder="Write a reply..."
                submitLabel="Reply"
                autoFocus
              />
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-slate-200">
              {replies.map((reply) => (
                <Comment
                  key={reply.id}
                  comment={reply}
                  replies={[]}
                  currentUserEmail={currentUserEmail}
                  onReply={onReply}
                  onToggleReaction={onToggleReaction}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Comment;
