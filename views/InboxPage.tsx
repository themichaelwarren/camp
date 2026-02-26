
import React, { useState, useMemo } from 'react';
import { Prompt, Assignment, Submission, Comment as CommentType, PlayableTrack, ViewState, Boca, CamperProfile, StatusUpdate, Collaboration } from '../types';
import { DateFormat, formatDate, getDisplayArtist, trackFromSubmission } from '../utils';
import ArtworkImage from '../components/ArtworkImage';

interface InboxPageProps {
  prompts: Prompt[];
  assignments: Assignment[];
  submissions: Submission[];
  campers: CamperProfile[];
  comments?: CommentType[];
  onNavigate: (view: ViewState, id?: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  favoritedSubmissionIds: string[];
  onToggleFavorite: (submissionId: string) => void;
  bocas?: Boca[];
  statusUpdates?: StatusUpdate[];
  dateFormat: DateFormat;
  collaborations: Collaboration[];
}

type ActivityItem =
  | { type: 'song-version'; date: string; submission: Submission; versionIndex: number }
  | { type: 'comment'; date: string; comment: CommentType }
  | { type: 'reaction'; date: string; comment: CommentType; emoji: string; users: string[] }
  | { type: 'prompt'; date: string; prompt: Prompt }
  | { type: 'assignment'; date: string; assignment: Assignment }
  | { type: 'boca'; date: string; boca: Boca }
  | { type: 'boca-received'; date: string; boca: Boca }
  | { type: 'status-update'; date: string; statusUpdate: StatusUpdate };

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

const findCamper = (campers: CamperProfile[], emailOrName: string): CamperProfile | undefined => {
  return campers.find(c => c.email === emailOrName || c.name === emailOrName);
};

const CamperAvatar: React.FC<{ emailOrName: string; campers: CamperProfile[]; size?: string }> = ({ emailOrName, campers, size = 'w-10 h-10' }) => {
  const camper = findCamper(campers, emailOrName);
  const photoUrl = camper?.pictureOverrideUrl || camper?.picture;
  const initial = (camper?.name || emailOrName)?.[0]?.toUpperCase() || '?';
  if (photoUrl) {
    return (
      <ArtworkImage
        fileId={undefined}
        fallbackUrl={photoUrl}
        alt={camper?.name || emailOrName}
        className={`${size} rounded-xl object-cover`}
        containerClassName={`${size} rounded-xl flex-shrink-0 overflow-hidden`}
        fallback={
          <div className={`${size} rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold`}>
            {initial}
          </div>
        }
      />
    );
  }
  return (
    <div className={`${size} rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 text-sm font-bold`}>
      {initial}
    </div>
  );
};

const InboxPage: React.FC<InboxPageProps> = ({ prompts, assignments, submissions, campers, comments = [], onNavigate, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, favoritedSubmissionIds, onToggleFavorite, bocas = [], statusUpdates = [], dateFormat, collaborations }) => {
  const [filter, setFilter] = useState<'all' | 'songs' | 'comments' | 'prompts' | 'assignments' | 'bocas' | 'status'>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all-time');
  const [selectedCamper, setSelectedCamper] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

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

    // BOCAs
    if (filter === 'all' || filter === 'bocas') {
      bocas.forEach(b => {
        all.push({ type: 'boca', date: b.awardedAt, boca: b });
        all.push({ type: 'boca-received', date: b.awardedAt, boca: b });
      });
    }

    // Status updates
    if (filter === 'all' || filter === 'status') {
      statusUpdates.forEach(su => {
        all.push({ type: 'status-update', date: su.timestamp, statusUpdate: su });
      });
    }

    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply time range filter
    const rangeStart = getTimeRangeStart(timeRange);
    const rangeEnd = getTimeRangeEnd(timeRange);
    let filtered = all;
    if (rangeStart || rangeEnd) {
      filtered = filtered.filter(item => {
        const t = new Date(item.date).getTime();
        if (rangeStart && t < rangeStart.getTime()) return false;
        if (rangeEnd && t >= rangeEnd.getTime()) return false;
        return true;
      });
    }

    // Apply camper filter
    if (selectedCamper) {
      filtered = filtered.filter(item => {
        switch (item.type) {
          case 'song-version': return item.submission.camperId === selectedCamper || collaborations.some(c => c.submissionId === item.submission.id && c.camperId === selectedCamper);
          case 'comment': return item.comment.authorEmail === selectedCamper;
          case 'reaction': return item.comment.authorEmail === selectedCamper;
          case 'prompt': return item.prompt.createdBy === selectedCamper || item.prompt.createdBy === campers.find(c => c.email === selectedCamper)?.name;
          case 'boca': return item.boca.fromEmail === selectedCamper;
          case 'boca-received': {
            const sub = submissions.find(s => s.id === item.boca.submissionId);
            return sub?.camperId === selectedCamper;
          }
          case 'status-update': return item.statusUpdate.camperEmail === selectedCamper;
          case 'assignment': return true; // assignments aren't camper-specific
          default: return true;
        }
      });
    }

    return filtered;
  }, [submissions, comments, prompts, assignments, bocas, statusUpdates, filter, timeRange, selectedCamper, collaborations, campers]);

  const filters = [
    { key: 'all', label: 'All', icon: 'fa-stream' },
    { key: 'songs', label: 'Songs', icon: 'fa-music' },
    { key: 'comments', label: 'Comments', icon: 'fa-comment' },
    { key: 'prompts', label: 'Prompts', icon: 'fa-lightbulb' },
    { key: 'assignments', label: 'Assignments', icon: 'fa-tasks' },
    { key: 'bocas', label: 'BOCAs', icon: 'fa-star' },
    { key: 'status', label: 'Status', icon: 'fa-circle-info' },
  ] as const;

  const getDateGroup = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);
    const startOfMonth = new Date(startOfToday.getTime() - 30 * 86400000);
    const t = date.getTime();
    if (t >= startOfToday.getTime()) return 'Today';
    if (t >= startOfYesterday.getTime()) return 'Yesterday';
    if (t >= startOfWeek.getTime()) return 'This Week';
    if (t >= startOfMonth.getTime()) return 'This Month';
    return 'Older';
  };

  const groupedItems = useMemo(() => {
    const groups: { label: string; items: typeof items }[] = [];
    const groupMap = new Map<string, typeof items>();
    for (const item of items) {
      const label = getDateGroup(item.date);
      if (!groupMap.has(label)) {
        const arr: typeof items = [];
        groupMap.set(label, arr);
        groups.push({ label, items: arr });
      }
      groupMap.get(label)!.push(item);
    }
    return groups;
  }, [items]);

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
    return formatDate(date, dateFormat);
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800">Inbox</h2>
          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{items.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
            showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fa-solid fa-sliders"></i>
          Filters
          {(filter !== 'all' || timeRange !== 'all-time' || selectedCamper) && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
          <i className={`fa-solid fa-chevron-${showFilters ? 'up' : 'down'} text-[10px]`}></i>
        </button>

        <div className={`${showFilters ? 'flex' : 'hidden'} flex-wrap items-center gap-3`}>
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  filter === f.key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className={`fa-solid ${f.icon}`}></i>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  timeRange === t.key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            value={selectedCamper}
            onChange={(e) => setSelectedCamper(e.target.value)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors appearance-none bg-no-repeat bg-right pr-7 ${
              selectedCamper ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundPosition: 'right 8px center' }}
          >
            <option value="">All Campers</option>
            {campers
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(c => (
                <option key={c.email} value={c.email}>{c.name}</option>
              ))
            }
          </select>
          {(filter !== 'all' || timeRange !== 'all-time' || selectedCamper) && (
            <button
              onClick={() => { setFilter('all'); setTimeRange('all-time'); setSelectedCamper(''); }}
              className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {groupedItems.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 py-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">{group.label}</span>
            </div>
            {group.items.map((item, idx) => {
          if (item.type === 'song-version') {
            const sub = item.submission;
            const version = sub.versions[item.versionIndex];
            const track = trackFromSubmission(sub, collaborations);
            const isFirstVersion = item.versionIndex === sub.versions.length - 1;
            const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
            return (
              <div
                key={`sv-${sub.id}-${item.versionIndex}`}
                onClick={() => onNavigate('song-detail', sub.id)}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 cursor-pointer transition-all group"
              >
                <CamperAvatar campers={campers} emailOrName={sub.camperId || sub.camperName} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{getDisplayArtist(sub, collaborations)}</span>
                    {isFirstVersion
                      ? <> uploaded <span className="font-semibold text-indigo-600">"{sub.title}"</span></>
                      : <> updated <span className="font-semibold text-indigo-600">"{sub.title}"</span> <span className="text-slate-400">(v{sub.versions.length - item.versionIndex})</span></>
                    }
                    {bocaCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold align-middle">
                        <i className="fa-solid fa-star text-[8px]"></i>
                        {bocaCount}
                      </span>
                    )}
                  </p>
                  {version.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{version.notes}</p>}
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(sub.id); }}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        favoritedSubmissionIds.includes(sub.id)
                          ? 'text-red-500'
                          : 'text-slate-300'
                      }`}
                    >
                      <i className={`${favoritedSubmissionIds.includes(sub.id) ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
                    </button>
                    {track && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                          disabled={playingTrackId === track.versionId}
                          className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center"
                        >
                          <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-[10px]`}></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                          disabled={queueingTrackId === track.versionId}
                          className="w-7 h-7 rounded-md text-slate-400 flex items-center justify-center"
                        >
                          <i className={`fa-solid ${queueingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-list'} text-[10px]`}></i>
                        </button>
                      </>
                    )}
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-music text-[8px]"></i>
                      Song
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.date)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(sub.id); }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        favoritedSubmissionIds.includes(sub.id)
                          ? 'bg-red-50 text-red-500'
                          : 'text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                      }`}
                      title={favoritedSubmissionIds.includes(sub.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <i className={`${favoritedSubmissionIds.includes(sub.id) ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
                    </button>
                    {track && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                          disabled={playingTrackId === track.versionId}
                          className={`w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors ${playingTrackId === track.versionId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          title="Play"
                        >
                          <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                          disabled={queueingTrackId === track.versionId}
                          className={`w-8 h-8 rounded-lg text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors ${queueingTrackId === track.versionId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          title="Add to queue"
                        >
                          <i className={`fa-solid ${queueingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-list'} text-xs`}></i>
                        </button>
                      </>
                    )}
                  </div>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-music text-[8px]"></i>
                    Song
                  </span>
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
                <CamperAvatar campers={campers} emailOrName={c.authorEmail || c.author} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{c.author}</span>
                    {c.parentId ? ' replied' : ' commented'} on <span className="font-semibold text-indigo-600">{entity.label}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {c.text}
                    {c.editedAt && <span className="text-slate-400 italic ml-1">(edited)</span>}
                  </p>
                  {reactionEntries.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {reactionEntries.map(([emoji, users]) => (
                        <span key={emoji} className="text-xs bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                          {emoji} {(users as string[]).length}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-comment text-[8px]"></i>
                      Comment
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.date)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-comment text-[8px]"></i>
                    Comment
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(item.date)}</span>
                </div>
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
                <CamperAvatar campers={campers} emailOrName={p.createdBy} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    New prompt: <span className="font-semibold text-indigo-600">"{p.title}"</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-lightbulb text-[8px]"></i>
                      Prompt
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.date)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                    <i className="fa-solid fa-heart"></i> {p.upvotes}
                  </span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-lightbulb text-[8px]"></i>
                    Prompt
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
                  <p className="text-xs text-slate-400 mt-0.5">Due {formatDate(a.dueDate, dateFormat)} &middot; {a.status}</p>
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-tasks text-[8px]"></i>
                      Assignment
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.date)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-tasks text-[8px]"></i>
                    Assignment
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(item.date)}</span>
                </div>
              </div>
            );
          }

          if (item.type === 'boca') {
            const b = item.boca;
            const sub = submissions.find(s => s.id === b.submissionId);
            const giverCamper = findCamper(campers, b.fromEmail);
            const giverName = giverCamper?.name || b.fromEmail;
            return (
              <div
                key={`boca-${b.id}`}
                onClick={() => sub ? onNavigate('song-detail', sub.id) : undefined}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-amber-200 cursor-pointer transition-all"
              >
                <CamperAvatar campers={campers} emailOrName={b.fromEmail} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{giverName}</span> gave a BOCA to{' '}
                    <span className="font-semibold text-indigo-600">"{sub?.title || 'a song'}"</span>
                  </p>
                  {sub && <p className="text-xs text-slate-400 mt-0.5">by {getDisplayArtist(sub, collaborations)}</p>}
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-star text-[8px]"></i>
                      BOCA
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.date)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-star text-[8px]"></i>
                    BOCA
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(item.date)}</span>
                </div>
              </div>
            );
          }

          if (item.type === 'boca-received') {
            const b = item.boca;
            const sub = submissions.find(s => s.id === b.submissionId);
            const recipientCamper = sub ? findCamper(campers, sub.camperId) : undefined;
            const recipientName = recipientCamper?.name || sub?.camperName || 'a camper';
            const giverCamper = findCamper(campers, b.fromEmail);
            const giverName = giverCamper?.name || b.fromEmail;
            return (
              <div
                key={`boca-recv-${b.id}`}
                onClick={() => sub ? onNavigate('song-detail', sub.id) : undefined}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-amber-200 cursor-pointer transition-all"
              >
                <CamperAvatar campers={campers} emailOrName={sub?.camperId || ''} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{recipientName}</span> received a BOCA for{' '}
                    <span className="font-semibold text-indigo-600">"{sub?.title || 'a song'}"</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">from {giverName}</p>
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-trophy text-[8px]"></i>
                      BOCA
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.date)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-trophy text-[8px]"></i>
                    BOCA
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(item.date)}</span>
                </div>
              </div>
            );
          }

          if (item.type === 'status-update') {
            const su = item.statusUpdate;
            return (
              <div
                key={`status-${su.id}`}
                onClick={() => onNavigate('camper-detail', su.camperEmail)}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 cursor-pointer transition-all"
              >
                <CamperAvatar campers={campers} emailOrName={su.camperEmail} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-bold text-slate-800">{su.camperName}</span> updated their status
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 italic">"{su.status}"</p>
                  <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                    <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-circle-info text-[8px]"></i>
                      Status
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{formatRelativeTime(item.date)}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <i className="fa-solid fa-circle-info text-[8px]"></i>
                    Status
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatRelativeTime(item.date)}</span>
                </div>
              </div>
            );
          }

          return null;
        })}
          </div>
        ))}

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
