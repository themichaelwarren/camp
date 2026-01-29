import React, { useState, useEffect } from 'react';
import { Comment as CommentType } from '../types';
import * as googleService from '../services/googleService';
import Comment from './Comment';
import CommentForm from './CommentForm';

interface CommentsSectionProps {
  entityType: 'song' | 'prompt' | 'assignment';
  entityId: string;
  spreadsheetId: string;
  currentUser: { name: string; email: string };
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
  entityType,
  entityId,
  spreadsheetId,
  currentUser
}) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, [entityType, entityId]);

  const loadComments = async () => {
    try {
      const fetchedComments = await googleService.fetchComments(spreadsheetId, entityType, entityId);
      setComments(fetchedComments);
    } catch (error) {
      console.error('Failed to load comments', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateComment = async (text: string) => {
    const newComment = await googleService.createComment(spreadsheetId, {
      entityType,
      entityId,
      parentId: null,
      author: currentUser.name,
      authorEmail: currentUser.email,
      text
    });
    setComments([...comments, newComment]);
  };

  const handleReply = async (parentId: string, text: string) => {
    const newComment = await googleService.createComment(spreadsheetId, {
      entityType,
      entityId,
      parentId,
      author: currentUser.name,
      authorEmail: currentUser.email,
      text
    });
    setComments([...comments, newComment]);
  };

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    try {
      const updatedComment = await googleService.toggleReaction(
        spreadsheetId,
        commentId,
        emoji,
        currentUser.email
      );
      setComments(comments.map((c) => (c.id === commentId ? updatedComment : c)));
    } catch (error) {
      console.error('Failed to toggle reaction', error);
      alert('Failed to update reaction. Please try again.');
    }
  };

  // Organize comments into a tree structure
  const topLevelComments = comments.filter((c) => !c.parentId);
  const getReplies = (parentId: string) => {
    return comments.filter((c) => c.parentId === parentId);
  };

  // Sort top-level comments by timestamp (newest first)
  const sortedComments = [...topLevelComments].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (isLoading) {
    return (
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Comments</h3>
        <div className="flex items-center justify-center py-8">
          <i className="fa-solid fa-spinner fa-spin text-slate-400 text-2xl"></i>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      <div className="space-y-6">
        <CommentForm onSubmit={handleCreateComment} />

        {sortedComments.length > 0 ? (
          <div className="space-y-6 pt-6 border-t border-slate-100">
            {sortedComments.map((comment) => (
              <Comment
                key={comment.id}
                comment={comment}
                replies={getReplies(comment.id)}
                currentUserEmail={currentUser.email}
                onReply={handleReply}
                onToggleReaction={handleToggleReaction}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            No comments yet. Be the first to comment!
          </div>
        )}
      </div>
    </section>
  );
};

export default CommentsSection;
