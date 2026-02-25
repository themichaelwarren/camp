import React, { useState } from 'react';
import { Comment as CommentType, CamperProfile } from '../types';
import CommentForm from './CommentForm';
import ReactionPicker from './ReactionPicker';
import ArtworkImage from './ArtworkImage';

interface CommentProps {
  comment: CommentType;
  replies: CommentType[];
  currentUserEmail: string;
  onReply: (parentId: string, text: string) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: string) => void;
  onEditComment: (commentId: string, newText: string) => Promise<void>;
  campers?: CamperProfile[];
}

const Comment: React.FC<CommentProps> = ({
  comment,
  replies,
  currentUserEmail,
  onReply,
  onToggleReaction,
  onEditComment,
  campers = [],
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isAuthor = comment.authorEmail?.toLowerCase() === currentUserEmail?.toLowerCase();

  const camper = campers.find(c => c.email?.toLowerCase() === comment.authorEmail?.toLowerCase() || c.name === comment.author);
  const photoUrl = camper?.pictureOverrideUrl || camper?.picture;

  const handleReplySubmit = async (text: string) => {
    await onReply(comment.id, text);
    setShowReplyForm(false);
  };

  const handleEditSave = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === comment.text) {
      setIsEditing(false);
      setEditText(comment.text);
      return;
    }
    setIsSavingEdit(true);
    try {
      await onEditComment(comment.id, trimmed);
      setIsEditing(false);
    } catch {
      // Error alert shown by parent; revert edit text
      setEditText(comment.text);
    } finally {
      setIsSavingEdit(false);
    }
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

  const resolveUserName = (email: string): string => {
    const c = campers.find(p => p.email === email);
    return c?.name || email.split('@')[0];
  };

  const initial = (camper?.name || comment.author)?.[0]?.toUpperCase() || '?';

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {photoUrl ? (
            <ArtworkImage
              fileId={undefined}
              fallbackUrl={photoUrl}
              alt={camper?.name || comment.author}
              className="w-8 h-8 rounded-full object-cover"
              containerClassName="w-8 h-8 rounded-full overflow-hidden"
              fallback={
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                  {initial}
                </div>
              }
            />
          ) : (
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
              {initial}
            </div>
          )}
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
              {comment.editedAt && (
                <span className="text-[10px] text-slate-400 italic" title={`Edited ${new Date(comment.editedAt).toLocaleString()}`}>
                  (edited)
                </span>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleEditSave}
                    disabled={isSavingEdit}
                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditText(comment.text); }}
                    className="px-3 py-1 text-slate-500 text-xs font-bold hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                {comment.text}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 px-2">
            <ReactionPicker
              reactions={comment.reactions}
              currentUserEmail={currentUserEmail}
              onToggleReaction={(emoji) => onToggleReaction(comment.id, emoji)}
              campers={campers}
            />
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Reply
            </button>
            {isAuthor && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
              >
                Edit
              </button>
            )}
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
                  onEditComment={onEditComment}
                  campers={campers}
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
