
import React, { useState, useEffect } from 'react';
import { Comment as CommentType, CamperProfile } from '../types';
import * as googleService from '../services/googleService';
import Comment from './Comment';
import CommentForm from './CommentForm';

interface CommentsSectionProps {
  entityType: 'song' | 'prompt' | 'assignment';
  entityId: string;
  spreadsheetId: string;
  currentUser: { name: string; email: string };
  campers?: CamperProfile[];
  entityOwnerEmail?: string;
  entityTitle?: string;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
  entityType,
  entityId,
  spreadsheetId,
  currentUser,
  campers = [],
  entityOwnerEmail,
  entityTitle,
}) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComments();
  }, [entityType, entityId]);

  // Polling effect: refresh comments every 10 seconds
  useEffect(() => {
    const POLL_INTERVAL = 10000; // 10 seconds
    let intervalId: NodeJS.Timeout | null = null;
    let isPageVisible = !document.hidden;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (isPageVisible) {
          loadComments();
        }
      }, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) {
        loadComments();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [entityType, entityId, spreadsheetId]);

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

  const handleCreateComment = async (text: string, mentionedEmails?: string[]) => {
    const newComment = await googleService.createComment(spreadsheetId, {
      entityType,
      entityId,
      parentId: null,
      author: currentUser.name,
      authorEmail: currentUser.email,
      text
    });
    setComments(prev => [...prev, newComment]);

    if (entityType === 'song' && entityOwnerEmail && entityOwnerEmail !== currentUser.email) {
      googleService.createNotification(spreadsheetId, {
        recipientEmail: entityOwnerEmail,
        type: 'comment_on_song',
        triggerUserEmail: currentUser.email,
        triggerUserName: currentUser.name,
        entityType: 'song',
        entityId,
        referenceId: newComment.id,
        message: `commented on "${entityTitle || 'your song'}"`
      }).catch(err => console.error('Failed to create comment notification', err));
    }

    // Mention notifications
    if (mentionedEmails && mentionedEmails.length > 0) {
      const label = entityTitle ? `"${entityTitle}"` : (entityType === 'song' ? 'a song' : entityType === 'assignment' ? 'an assignment' : 'a prompt');
      const recipients = mentionedEmails.filter(e => e !== currentUser.email && e !== entityOwnerEmail);
      if (recipients.length > 0) {
        googleService.createNotifications(spreadsheetId, recipients.map(email => ({
          recipientEmail: email,
          type: 'mention_in_comment' as const,
          triggerUserEmail: currentUser.email,
          triggerUserName: currentUser.name,
          entityType,
          entityId,
          referenceId: newComment.id,
          message: `mentioned you in a comment on ${label}`
        }))).catch(err => console.error('Failed to create mention notifications', err));
      }
    }
  };

  const handleReply = async (parentId: string, text: string, mentionedEmails?: string[]) => {
    const newComment = await googleService.createComment(spreadsheetId, {
      entityType,
      entityId,
      parentId,
      author: currentUser.name,
      authorEmail: currentUser.email,
      text
    });
    setComments(prev => [...prev, newComment]);

    const parentComment = comments.find(c => c.id === parentId);
    if (parentComment && parentComment.authorEmail !== currentUser.email) {
      const label = entityTitle ? `"${entityTitle}"` : (entityType === 'song' ? 'a song' : entityType === 'assignment' ? 'an assignment' : 'a prompt');
      googleService.createNotification(spreadsheetId, {
        recipientEmail: parentComment.authorEmail,
        type: 'reply_to_comment',
        triggerUserEmail: currentUser.email,
        triggerUserName: currentUser.name,
        entityType,
        entityId,
        referenceId: newComment.id,
        message: `replied to your comment on ${label}`
      }).catch(err => console.error('Failed to create reply notification', err));
    }

    // Mention notifications for replies
    if (mentionedEmails && mentionedEmails.length > 0) {
      const label = entityTitle ? `"${entityTitle}"` : (entityType === 'song' ? 'a song' : entityType === 'assignment' ? 'an assignment' : 'a prompt');
      const alreadyNotified = new Set([currentUser.email]);
      if (parentComment) alreadyNotified.add(parentComment.authorEmail);
      const recipients = mentionedEmails.filter(e => !alreadyNotified.has(e));
      if (recipients.length > 0) {
        googleService.createNotifications(spreadsheetId, recipients.map(email => ({
          recipientEmail: email,
          type: 'mention_in_comment' as const,
          triggerUserEmail: currentUser.email,
          triggerUserName: currentUser.name,
          entityType,
          entityId,
          referenceId: newComment.id,
          message: `mentioned you in a reply on ${label}`
        }))).catch(err => console.error('Failed to create mention notifications', err));
      }
    }
  };

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    const comment = comments.find(c => c.id === commentId);
    const wasAlreadyReacted = comment?.reactions[emoji]?.includes(currentUser.email);

    try {
      const updatedComment = await googleService.toggleReaction(
        spreadsheetId,
        commentId,
        emoji,
        currentUser.email
      );
      setComments(prev => prev.map((c) => (c.id === commentId ? updatedComment : c)));

      if (!wasAlreadyReacted && comment && comment.authorEmail !== currentUser.email) {
        const label = entityTitle ? `"${entityTitle}"` : (entityType === 'song' ? 'a song' : entityType === 'assignment' ? 'an assignment' : 'a prompt');
        googleService.createNotification(spreadsheetId, {
          recipientEmail: comment.authorEmail,
          type: 'reaction_on_comment',
          triggerUserEmail: currentUser.email,
          triggerUserName: currentUser.name,
          entityType,
          entityId,
          referenceId: comment.id,
          message: `reacted ${emoji} to your comment on ${label}`
        }).catch(err => console.error('Failed to create reaction notification', err));
      }
    } catch (error) {
      console.error('Failed to toggle reaction', error);
      alert('Failed to update reaction. Please try again.');
    }
  };

  const handleEditComment = async (commentId: string, newText: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    const previousComments = comments;
    const updated = { ...comment, text: newText, editedAt: new Date().toISOString() };
    setComments(prev => prev.map(c => c.id === commentId ? updated : c));
    try {
      await googleService.updateCommentRow(spreadsheetId, updated);
    } catch (error) {
      console.error('Failed to edit comment', error);
      setComments(previousComments);
      alert('Failed to save edit. Please try again.');
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
        <CommentForm onSubmit={handleCreateComment} campers={campers} />

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
                onEditComment={handleEditComment}
                campers={campers}
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
