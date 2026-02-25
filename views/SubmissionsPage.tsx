
import React, { useState, useMemo } from 'react';
import { Submission, Assignment, Prompt, PlayableTrack, Boca } from '../types';
import { getTerm, getTermSortKey, DateFormat, formatDate } from '../utils';
import ArtworkImage from '../components/ArtworkImage';
import SubmitSongModal from '../components/SubmitSongModal';

interface SubmissionsPageProps {
  submissions: Submission[];
  assignments: Assignment[];
  prompts: Prompt[];
  onAdd: (submission: Submission) => void;
  onViewDetail: (id: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  onStartJukebox: (tracks: PlayableTrack[]) => void;
  userProfile?: { name?: string; email?: string } | null;
  viewMode: 'cards' | 'list';
  onViewModeChange: (value: 'cards' | 'list') => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  assignmentFilter: string;
  onAssignmentFilterChange: (value: string) => void;
  promptFilter: string;
  onPromptFilterChange: (value: string) => void;
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
  semesterFilter: string;
  onSemesterFilterChange: (value: string) => void;
  bocas: Boca[];
  dateFormat: DateFormat;
  gridSize: 3 | 4 | 5;
  onGridSizeChange: (value: 3 | 4 | 5) => void;
  favoritedSubmissionIds: string[];
  onToggleFavorite: (submissionId: string) => void;
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc' | 'assignment-asc' | 'assignment-desc' | 'prompt-asc' | 'prompt-desc' | 'semester-desc' | 'semester-asc';

const gridClasses: Record<3 | 4 | 5, string> = {
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

const SubmissionsPage: React.FC<SubmissionsPageProps> = ({ submissions, assignments, prompts, onAdd, onViewDetail, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, onStartJukebox, userProfile, viewMode, onViewModeChange, searchTerm, onSearchTermChange, assignmentFilter, onAssignmentFilterChange, promptFilter, onPromptFilterChange, sortBy, onSortByChange, semesterFilter, onSemesterFilterChange, bocas, dateFormat, gridSize, onGridSizeChange, favoritedSubmissionIds, onToggleFavorite }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const getSubmissionDate = (sub: Submission): string => {
    return sub.versions?.length ? sub.versions[0].timestamp : sub.updatedAt;
  };

  // Resolve prompt for a submission via its assignment
  const getPromptForSubmission = (sub: Submission): Prompt | undefined => {
    const assignment = assignments.find(a => a.id === sub.assignmentId);
    if (!assignment) return undefined;
    return prompts.find(p => assignment.promptIds?.includes(p.id) || assignment.promptId === p.id);
  };

  const availableSemesters = useMemo(() => {
    const terms = new Set<string>(submissions.map(s => getTerm(getSubmissionDate(s))));
    return Array.from(terms).sort((a, b) => getTermSortKey(b) - getTermSortKey(a));
  }, [submissions]);

  // Filter and sort
  const filteredSubmissions = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return submissions
      .filter(sub => {
        // Term filter
        if (semesterFilter !== 'all' && getTerm(getSubmissionDate(sub)) !== semesterFilter) return false;

        // Assignment filter
        if (assignmentFilter !== 'all' && sub.assignmentId !== assignmentFilter) return false;

        // Prompt filter
        if (promptFilter !== 'all') {
          const assignment = assignments.find(a => a.id === sub.assignmentId);
          if (!assignment) return false;
          const hasPrompt = assignment.promptIds?.includes(promptFilter) || assignment.promptId === promptFilter;
          if (!hasPrompt) return false;
        }

        // Search
        if (normalized) {
          const inTitle = sub.title.toLowerCase().includes(normalized);
          const inCamper = sub.camperName.toLowerCase().includes(normalized);
          if (!inTitle && !inCamper) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date-desc':
            return new Date(getSubmissionDate(b)).getTime() - new Date(getSubmissionDate(a)).getTime();
          case 'date-asc':
            return new Date(getSubmissionDate(a)).getTime() - new Date(getSubmissionDate(b)).getTime();
          case 'title-asc':
            return a.title.localeCompare(b.title);
          case 'title-desc':
            return b.title.localeCompare(a.title);
          case 'assignment-asc':
          case 'assignment-desc': {
            const aTitle = assignments.find(x => x.id === a.assignmentId)?.title || '';
            const bTitle = assignments.find(x => x.id === b.assignmentId)?.title || '';
            return sortBy === 'assignment-asc' ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
          }
          case 'prompt-asc':
          case 'prompt-desc': {
            const aPrompt = getPromptForSubmission(a)?.title || '';
            const bPrompt = getPromptForSubmission(b)?.title || '';
            return sortBy === 'prompt-asc' ? aPrompt.localeCompare(bPrompt) : bPrompt.localeCompare(aPrompt);
          }
          case 'semester-desc':
          case 'semester-asc': {
            const aKey = getTermSortKey(getTerm(getSubmissionDate(a)));
            const bKey = getTermSortKey(getTerm(getSubmissionDate(b)));
            const termCmp = sortBy === 'semester-desc' ? bKey - aKey : aKey - bKey;
            if (termCmp !== 0) return termCmp;
            return new Date(getSubmissionDate(b)).getTime() - new Date(getSubmissionDate(a)).getTime();
          }
          default:
            return 0;
        }
      });
  }, [submissions, assignments, prompts, searchTerm, assignmentFilter, promptFilter, semesterFilter, sortBy]);

  // Unique prompts that are used by at least one assignment with submissions
  const usedPrompts = useMemo(() => {
    const promptIds = new Set<string>();
    submissions.forEach(sub => {
      const assignment = assignments.find(a => a.id === sub.assignmentId);
      if (assignment) {
        if (assignment.promptIds?.length) {
          assignment.promptIds.forEach(id => promptIds.add(id));
        } else if (assignment.promptId) {
          promptIds.add(assignment.promptId);
        }
      }
    });
    return prompts.filter(p => promptIds.has(p.id));
  }, [submissions, assignments, prompts]);

  const hasActiveFilters = searchTerm || assignmentFilter !== 'all' || promptFilter !== 'all' || semesterFilter !== 'all';

  const isSemesterSort = sortBy === 'semester-desc' || sortBy === 'semester-asc';
  const groupedBySemester: [string, Submission[]][] = useMemo(() => {
    if (!isSemesterSort) return [];
    const groups: Record<string, Submission[]> = {};
    filteredSubmissions.forEach(sub => {
      const term = getTerm(getSubmissionDate(sub));
      if (!groups[term]) groups[term] = [];
      groups[term].push(sub);
    });
    return Object.entries(groups);
  }, [filteredSubmissions, isSemesterSort]);

  const renderCard = (sub: Submission, assignmentTitle: string, track: PlayableTrack | null, bocaCount: number) => {
    const isFavorited = favoritedSubmissionIds.includes(sub.id);
    return (
    <div
      key={sub.id}
      onClick={() => onViewDetail(sub.id)}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
    >
      <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
        <ArtworkImage
          fileId={sub.artworkFileId}
          fallbackUrl={sub.artworkUrl}
          alt={`${sub.title} artwork`}
          className="w-full h-full object-contain bg-slate-100"
          fallback={<i className="fa-solid fa-compact-disc text-4xl text-indigo-400"></i>}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(sub.id); }}
          className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 ${
            isFavorited
              ? 'bg-red-500 text-white shadow-md'
              : 'bg-black/30 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/50'
          }`}
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-sm`}></i>
        </button>
        {bocaCount > 0 && (
          <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 shadow-md z-10">
            <i className="fa-solid fa-star text-[8px]"></i>
            {bocaCount} BOCA{bocaCount !== 1 ? 's' : ''}
          </div>
        )}
        {track && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <button
              onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
              disabled={playingTrackId === track.versionId}
              className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all disabled:opacity-70"
              title="Play"
            >
              <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-lg ml-0.5`}></i>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
              disabled={queueingTrackId === track.versionId}
              className="w-10 h-10 rounded-full bg-white/90 text-slate-600 border border-slate-200 flex items-center justify-center shadow-lg hover:bg-white hover:scale-105 transition-all disabled:opacity-70"
              title="Add to queue"
            >
              <i className={`fa-solid ${queueingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-list'} text-sm`}></i>
            </button>
          </div>
        )}
      </div>
      <div className="p-4">
        <h4 className="font-bold text-slate-800 text-lg leading-tight truncate">{sub.title}</h4>
        <p className="text-xs text-slate-500 mt-1">By {sub.camperName}</p>
        <div className="mt-4 text-xs text-slate-500 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Assignment</p>
          <p className="font-semibold text-slate-700 truncate">{assignmentTitle}</p>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-calendar"></i>
            {formatDate(getSubmissionDate(sub), dateFormat)}
          </span>
          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-semibold">{getTerm(getSubmissionDate(sub))}</span>
        </div>
      </div>
    </div>
  );
  };

  const renderRow = (sub: Submission, assignmentTitle: string, track: PlayableTrack | null, bocaCount: number) => (
    <tr
      key={sub.id}
      onClick={() => onViewDetail(sub.id)}
      className="cursor-pointer hover:bg-slate-50 transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
            <ArtworkImage
              fileId={sub.artworkFileId}
              fallbackUrl={sub.artworkUrl}
              alt={`${sub.title} artwork`}
              className="w-full h-full object-cover"
              containerClassName="w-full h-full flex items-center justify-center"
              fallback={<i className="fa-solid fa-compact-disc text-indigo-400 text-sm"></i>}
            />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{sub.title}</p>
              <p className="text-xs text-slate-500 truncate">{sub.camperName}</p>
            </div>
            {bocaCount > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                <i className="fa-solid fa-star text-[8px]"></i>
                {bocaCount}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 truncate hidden md:table-cell">{assignmentTitle}</td>
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
        <div>{formatDate(getSubmissionDate(sub), dateFormat)}</div>
        <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-semibold">{getTerm(getSubmissionDate(sub))}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(sub.id); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              favoritedSubmissionIds.includes(sub.id)
                ? 'bg-red-50 text-red-500'
                : 'bg-slate-50 text-slate-300 border border-slate-200 hover:text-red-400 hover:bg-red-50'
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
                className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                title="Play"
              >
                <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                disabled={queueingTrackId === track.versionId}
                className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                title="Add to queue"
              >
                <i className={`fa-solid ${queueingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-list'} text-xs`}></i>
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">Song Vault</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{submissions.length}</span>
          </div>
          <p className="text-slate-500 text-sm">Review, track versions, and refine your camp songs.</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => {
              const tracks = filteredSubmissions
                .map(s => trackFromSubmission(s))
                .filter((t): t is PlayableTrack => t !== null);
              if (tracks.length > 0) onStartJukebox(tracks);
            }}
            className="bg-amber-500 text-white px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-sm md:text-base font-bold hover:bg-amber-600 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-shuffle"></i>
            Jukebox
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-indigo-600 text-white px-4 py-1.5 md:px-6 md:py-2.5 rounded-xl text-sm md:text-base font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            Submit New Song
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search by title or camper..."
              value={searchTerm}
              onChange={e => onSearchTermChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors flex-shrink-0 ${
              showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="fa-solid fa-sliders"></i>
            Filters
            <i className={`fa-solid fa-chevron-${showFilters ? 'up' : 'down'} text-[10px]`}></i>
          </button>
        </div>
        <div className={`${showFilters ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Semester</label>
              <select
                value={semesterFilter}
                onChange={e => onSemesterFilterChange(e.target.value)}
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Semesters</option>
                {availableSemesters.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Assignment</label>
              <select
                value={assignmentFilter}
                onChange={e => onAssignmentFilterChange(e.target.value)}
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Assignments</option>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prompt</label>
              <select
                value={promptFilter}
                onChange={e => onPromptFilterChange(e.target.value)}
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Prompts</option>
                {usedPrompts.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort By</label>
              <select
                value={sortBy}
                onChange={e => onSortByChange(e.target.value as SortOption)}
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="title-asc">Title A → Z</option>
                <option value="title-desc">Title Z → A</option>
                <option value="assignment-asc">Assignment A → Z</option>
                <option value="assignment-desc">Assignment Z → A</option>
                <option value="prompt-asc">Prompt A → Z</option>
                <option value="prompt-desc">Prompt Z → A</option>
                <option value="term-desc">Semester: Newest</option>
                <option value="term-asc">Semester: Oldest</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* View toggle + grid size + results count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
            <button
              onClick={() => onViewModeChange('cards')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              List
            </button>
          </div>
          {viewMode === 'cards' && (
            <div className="hidden md:flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
              {([3, 4, 5] as const).map(n => (
                <button
                  key={n}
                  onClick={() => onGridSizeChange(n)}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                    gridSize === n ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title={`${n} per row`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
        {hasActiveFilters && (
          <p className="text-xs text-slate-400 font-medium">
            {filteredSubmissions.length} song{filteredSubmissions.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Content */}
      {submissions.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 text-3xl">
            <i className="fa-solid fa-music"></i>
          </div>
          <h3 className="font-bold text-slate-800 text-xl">No songs found</h3>
          <p className="text-slate-500 mt-2 mb-6">You haven't uploaded any masterpieces yet. Start writing!</p>
          <button
            onClick={() => setShowUpload(true)}
            className="text-indigo-600 font-bold hover:underline"
          >
            Upload your first draft
          </button>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 text-3xl">
            <i className="fa-solid fa-filter"></i>
          </div>
          <h3 className="font-bold text-slate-800 text-xl">No songs match your filters</h3>
          <p className="text-slate-500 mt-2 mb-6">Try adjusting your search or filter criteria.</p>
          <button
            onClick={() => { onSearchTermChange(''); onAssignmentFilterChange('all'); onPromptFilterChange('all'); onSemesterFilterChange('all'); }}
            className="text-indigo-600 font-bold hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2">
          {isSemesterSort ? (
            groupedBySemester.map(([term, items]) => (
              <React.Fragment key={term}>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest pt-4 first:pt-0">{term}</div>
                <div className={`grid ${gridClasses[gridSize]} gap-4`}>
                  {items.map(sub => {
                    const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
                    const track = trackFromSubmission(sub);
                    const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
                    return renderCard(sub, assignmentTitle, track, bocaCount);
                  })}
                </div>
              </React.Fragment>
            ))
          ) : (
            <div className={`grid ${gridClasses[gridSize]} gap-4`}>
              {filteredSubmissions.map(sub => {
                const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
                const track = trackFromSubmission(sub);
                const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
                return renderCard(sub, assignmentTitle, track, bocaCount);
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {isSemesterSort ? (
            groupedBySemester.map(([term, items]) => (
              <React.Fragment key={term}>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest pt-4 first:pt-0">{term}</div>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-100">
                      {items.map(sub => {
                        const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
                        const track = trackFromSubmission(sub);
                        const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
                        return renderRow(sub, assignmentTitle, track, bocaCount);
                      })}
                    </tbody>
                  </table>
                </div>
              </React.Fragment>
            ))
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Song</th>
                    <th className="px-4 py-3 hidden md:table-cell">Assignment</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.map(sub => {
                    const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
                    const track = trackFromSubmission(sub);
                    const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
                    return renderRow(sub, assignmentTitle, track, bocaCount);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showUpload && (
        <SubmitSongModal
          assignments={assignments}
          userProfile={userProfile}
          onAdd={onAdd}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
};

export default SubmissionsPage;
