
import React, { useState, useMemo } from 'react';
import { Submission, Assignment, Prompt, PlayableTrack } from '../types';
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
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc' | 'assignment-asc' | 'assignment-desc' | 'prompt-asc' | 'prompt-desc';

const SubmissionsPage: React.FC<SubmissionsPageProps> = ({ submissions, assignments, prompts, onAdd, onViewDetail, onPlayTrack, onAddToQueue, onStartJukebox, userProfile, viewMode, onViewModeChange, searchTerm, onSearchTermChange, assignmentFilter, onAssignmentFilterChange, promptFilter, onPromptFilterChange, sortBy, onSortByChange }) => {
  const [showUpload, setShowUpload] = useState(false);

  const getSubmissionDate = (sub: Submission): string => {
    return sub.versions?.length ? sub.versions[0].timestamp : sub.updatedAt;
  };

  // Resolve prompt for a submission via its assignment
  const getPromptForSubmission = (sub: Submission): Prompt | undefined => {
    const assignment = assignments.find(a => a.id === sub.assignmentId);
    if (!assignment) return undefined;
    return prompts.find(p => assignment.promptIds?.includes(p.id) || assignment.promptId === p.id);
  };

  // Filter and sort
  const filteredSubmissions = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return submissions
      .filter(sub => {
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
          default:
            return 0;
        }
      });
  }, [submissions, assignments, prompts, searchTerm, assignmentFilter, promptFilter, sortBy]);

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

  const hasActiveFilters = searchTerm || assignmentFilter !== 'all' || promptFilter !== 'all';

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Song Vault</h2>
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
            className="bg-amber-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-amber-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-100"
          >
            <i className="fa-solid fa-shuffle"></i>
            Jukebox
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            Submit New Song
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            placeholder="Search by title or camper..."
            value={searchTerm}
            onChange={e => onSearchTermChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Assignment filter */}
        <select
          value={assignmentFilter}
          onChange={e => onAssignmentFilterChange(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Assignments</option>
          {assignments.map(a => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>

        {/* Prompt filter */}
        <select
          value={promptFilter}
          onChange={e => onPromptFilterChange(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Prompts</option>
          {usedPrompts.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => onSortByChange(e.target.value as SortOption)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="title-asc">Title A → Z</option>
          <option value="title-desc">Title Z → A</option>
          <option value="assignment-asc">Assignment A → Z</option>
          <option value="assignment-desc">Assignment Z → A</option>
          <option value="prompt-asc">Prompt A → Z</option>
          <option value="prompt-desc">Prompt Z → A</option>
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full p-1">
          <button
            onClick={() => onViewModeChange('cards')}
            className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
              viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
              viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-xs text-slate-400 font-medium">
          {filteredSubmissions.length} song{filteredSubmissions.length !== 1 ? 's' : ''} found
        </p>
      )}

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
            onClick={() => { onSearchTermChange(''); onAssignmentFilterChange('all'); onPromptFilterChange('all'); }}
            className="text-indigo-600 font-bold hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSubmissions.map(sub => {
            const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
            const track = trackFromSubmission(sub);
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
                  {track && (
                    <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                      <button
                        onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                        className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all"
                        title="Play"
                      >
                        <i className="fa-solid fa-play text-lg ml-0.5"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                        className="w-10 h-10 rounded-full bg-white/90 text-slate-600 border border-slate-200 flex items-center justify-center shadow-lg hover:bg-white hover:scale-105 transition-all"
                        title="Add to queue"
                      >
                        <i className="fa-solid fa-list text-sm"></i>
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
                      {new Date(getSubmissionDate(sub)).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 font-bold uppercase tracking-tighter">Synced</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Song</th>
                <th className="px-4 py-3 hidden md:table-cell">Assignment</th>
                <th className="px-4 py-3 hidden lg:table-cell">Prompt</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.map(sub => {
                const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
                const promptTitle = getPromptForSubmission(sub)?.title || '—';
                const track = trackFromSubmission(sub);
                return (
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
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{sub.title}</p>
                          <p className="text-xs text-slate-500 truncate">{sub.camperName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 truncate hidden md:table-cell">{assignmentTitle}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 truncate hidden lg:table-cell">{promptTitle}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(getSubmissionDate(sub)).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {track && (
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                            title="Play"
                          >
                            <i className="fa-solid fa-play text-xs"></i>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                            title="Add to queue"
                          >
                            <i className="fa-solid fa-list text-xs"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
