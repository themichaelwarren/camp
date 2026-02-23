
import React, { useState, useEffect, useMemo } from 'react';
import { Prompt, Assignment, Submission, Comment as CommentType, PlayableTrack, ViewState } from '../types';
import * as googleService from '../services/googleService';
import ArtworkImage from '../components/ArtworkImage';

interface InboxPageProps {
  prompts: Prompt[];
  assignments: Assignment[];
  submissions: Submission[];
  spreadsheetId: string | null;
  onNavigate: (view: ViewState, id?: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
}

type ActivityItem =
  | { type: 'song-version'; date: string; submission: Submission; versionIndex: number }
  | { type: 'comment'; date: string; comment: CommentType }
  | { type: 'reaction'; date: string; comment: CommentType; emoji: string; users: string[] }
  | { type: 'prompt'; date: string; prompt: Prompt }
  | { type: 'assignment'; date: string; assignment: Assignment };

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'all-time';

const getTimeRangeStart = (range: TimeRange): Date | null => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case 'today': return startOfDay;
    case 'yesterday': return new Date(startOfDay.getTime() - 86400000);
    case 'week': return new Date(startOfDay.getTime() - 7 * 86400000);
    case 'month': return new Date(startOfDay.getTime() - 30 * 86400000);
    case 'all-time': return null;
  }
};

const getTimeRangeEnd = (range: TimeRange): Date | null => {
  if (range === 'yesterday') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return null;
};

const InboxPage: React.FC<InboxPageProps> = ({ prompts, assignments, submissions, spreadsheetId, onNavigate, onPlayTrack }) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'songs' | 'comments' | 'prompts' | 'assignments'>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all-time');

  useEffect(() => {
    if (!spreadsheetId) { setIsLoading(false); return; }
    googleService.fetchAllComments(spreadsheetId)
      .then(setComments)
      .catch(err => console.error('Failed to load comments for inbox', err))
      .finally(() => setIsLoading(false));
  }, [spreadsheetId]);

  // Polling for comments
  useEffect(() => {
    if (!spreadsheetId) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        googleService.fetchAllComments(spreadsheetId).then(setComments).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [spreadsheetId]);

  const resolveEntityName = (comment: CommentType): { label: string; view: ViewState; id: string } => {
    if (comment.entityType === 'song') {
      const sub = submissions.find(s => s.id === comment.entityId);
      return { label: sub ? `"${sub.title}"` : 'a song', view: 'song-detail', id: comment.entityId };
    }
    if (comment.entityType === 'prompt') {
      const p = prompts.find(p => p.id === comment.entityId);
      return { label: p ? `"${p.title}"` : 'a prompt', view: 'prompt-detail', id: comment.entityId };
    }
    const a = assignments.find(a => a.id === comment.entityId);
    return { label: a ? `"${a.title}"` : 'an assignment', view: 'assignment-detail', id: comment.entityId };
  };

  const items = useMemo(() => {
    const all: ActivityItem[] = [];

    // Song versions as individual items
    if (filter === 'all' || filter === 'songs') {
      submissions.forEach(sub => {
        sub.versions.forEach((v, idx) => {
          if (v.timestamp) {
            all.push({ type: 'song-version', date: v.timestamp, submission: sub, versionIndex: idx });
          }
        });
      });
    }

    // Comments (top-level only to avoid noise from replies)
    if (filter === 'all' || filter === 'comments') {
      comments.forEach(c => {
        all.push({ type: 'comment', date: c.timestamp, comment: c });
      });
    }

    // Prompts
    if (filter === 'all' || filter === 'prompts') {
      prompts.forEach(p => {
        all.push({ type: 'prompt', date: p.createdAt, prompt: p });
      });
    }

    // Assignments
    if (filter === 'all' || filter === 'assignments') {
      assignments.forEach(a => {
        all.push({ type: 'assignment', date: a.createdAt || a.startDate || a.dueDate, assignment: a });
      });
    }

    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply time range filter
    const rangeStart = getTimeRangeStart(timeRange);
    const rangeEnd = getTimeRangeEnd(timeRange);
    if (rangeStart || rangeEnd) {
      return all.filter(item => {
        const t = new Date(item.date).getTime();
        if (rangeStart && t < rangeStart.getTime()) return false;
        if (rangeEnd && t >= rangeEnd.getTime()) return false;
        return true;
      });
    }

    return all;
  }, [submissions, comments, prompts, assignments, filter, timeRange]);

  const filters = [
    { key: 'all', label: 'All', icon: 'fa-stream' },
    { key: 'songs', label: 'Songs', icon: 'fa-music' },
    { key: 'comments', label: 'Comments', icon: 'fa-comment' },
    { key: 'prompts', label: 'Prompts', icon: 'fa-lightbulb' },
    { key: 'assignments', label: 'Assignments', icon: 'fa-tasks' },
  ] as const;

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-solid fa-spinner fa-spin text-slate-400 text-2xl"></i>
          <p className="text-sm text-slate-500">Loading inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800">Inbox</h2>
          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{items.length}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full p-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
                filter === f.key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className={`fa-solid ${f.icon}`}></i>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full p-1">
          {([
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Last 7 Days' },
            { key: 'month', label: 'Last 30 Days' },
            { key: 'all-time', label: 'All Time' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTimeRange(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                timeRange === t.key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {items.map((item, idx) => {
          if (item.type === 'song-version') {
            const sub = item.submission;
            const version = sub.versions[item.versionIndex];
            const track = trackFromSubmission(sub);
            const isFirstVersion = item.versionIndex === sub.versions.length - 1;
            return (
              <div
                key={`sv-${sub.id}-${item.versionIndex}`}
                onClick={() => onNavigate('song-detail', sub.id)}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                  <ArtworkImage
                    fileId={sub.artworkFileId}
                    fallbackUrl={sub.artworkUrl}
                    alt={sub.title}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full flex items-center justify-center"
                    fallback={<i className="fa-solid fa-music text-green-500 text-sm"></i>}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{sub.camperName}</span>
                    {isFirstVersion
                      ? <> uploaded <span className="font-semibold text-indigo-600">"{sub.title}"</span></>
                      : <> updated <span className="font-semibold text-indigo-600">"{sub.title}"</span> <span className="text-slate-400">(v{sub.versions.length - item.versionIndex})</span></>
                    }
                  </p>
                  {version.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{version.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {track && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                      className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors opacity-0 group-hover:opacity-100"
                      title="Play"
                    >
                      <i className="fa-solid fa-play text-xs"></i>
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(item.date)}</span>
                </div>
              </div>
            );
          }

          if (item.type === 'comment') {
            const c = item.comment;
            const entity = resolveEntityName(c);
            const reactionEntries = Object.entries(c.reactions || {});
            return (
              <div
                key={`c-${c.id}`}
                onClick={() => onNavigate(entity.view, entity.id)}
                className="flex items-start gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-comment text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{c.author}</span>
                    {c.parentId ? ' replied' : ' commented'} on <span className="font-semibold text-indigo-600">{entity.label}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.text}</p>
                  {reactionEntries.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {reactionEntries.map(([emoji, users]) => (
                        <span key={emoji} className="text-xs bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                          {emoji} {(users as string[]).length}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0">{formatRelativeTime(item.date)}</span>
              </div>
            );
          }

          if (item.type === 'prompt') {
            const p = item.prompt;
            return (
              <div
                key={`p-${p.id}`}
                onClick={() => onNavigate('prompt-detail', p.id)}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-lightbulb text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    New prompt: <span className="font-semibold text-indigo-600">"{p.title}"</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                    <i className="fa-solid fa-heart"></i> {p.upvotes}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(item.date)}</span>
                </div>
              </div>
            );
          }

          if (item.type === 'assignment') {
            const a = item.assignment;
            return (
              <div
                key={`a-${a.id}`}
                onClick={() => onNavigate('assignment-detail', a.id)}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-tasks text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    New assignment: <span className="font-semibold text-indigo-600">"{a.title}"</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Due {a.dueDate} &middot; {a.status}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0">{formatRelativeTime(item.date)}</span>
              </div>
            );
          }

          return null;
        })}

        {items.length === 0 && (
          <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <i className="fa-solid fa-inbox text-3xl mb-4 opacity-30"></i>
            <p className="font-medium">No activity yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
