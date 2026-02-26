import React, { useState, useMemo } from 'react';
import { CamperProfile, Prompt, Assignment, Submission, PlayableTrack, ViewState, Boca, Collaboration } from '../types';
import { getTerm, getTermSortKey, isCurrentOrFutureTerm, getSeasonStyle, DateFormat, formatDate, getDisplayArtist, trackFromSubmission, getGridStyle } from '../utils';
import ArtworkImage from '../components/ArtworkImage';

interface CamperDetailProps {
  camper: CamperProfile;
  prompts: Prompt[];
  allPrompts: Prompt[];
  assignments: Assignment[];
  submissions: Submission[];
  onNavigate: (view: ViewState, id?: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  onStartJukebox: (tracks: PlayableTrack[]) => void;
  songsView: 'cards' | 'list';
  onSongsViewChange: (value: 'cards' | 'list') => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  selectedTags: string[];
  onSelectedTagsChange: (value: string[] | ((prev: string[]) => string[])) => void;
  favoritedSubmissionIds: string[];
  onToggleFavorite: (submissionId: string) => void;
  bocas?: Boca[];
  dateFormat: DateFormat;
  gridSize: 3 | 4 | 5;
  onGridSizeChange: (value: 3 | 4 | 5) => void;
  collaborations: Collaboration[];
}

const getTagsForSubmission = (sub: Submission, assignments: Assignment[], allPrompts: Prompt[]): string[] => {
  const assignment = assignments.find(a => a.id === sub.assignmentId);
  if (!assignment) return [];
  const promptIds = assignment.promptIds?.length ? assignment.promptIds : [assignment.promptId].filter(Boolean);
  const tags = new Set<string>();
  for (const pid of promptIds) {
    const prompt = allPrompts.find(p => p.id === pid);
    if (prompt) prompt.tags.forEach(t => tags.add(t));
  }
  return Array.from(tags);
};

type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';

const getFirstVersionDate = (sub: Submission): number => {
  if (sub.versions?.length) {
    const t = new Date(sub.versions[sub.versions.length - 1].timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  return new Date(sub.updatedAt).getTime() || 0;
};


const CamperDetail: React.FC<CamperDetailProps> = ({ camper, prompts, allPrompts, assignments, submissions, onNavigate, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, onStartJukebox, songsView, onSongsViewChange, searchTerm, onSearchTermChange, selectedTags, onSelectedTagsChange, favoritedSubmissionIds, onToggleFavorite, bocas = [], dateFormat, gridSize, onGridSizeChange, collaborations }) => {
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [showFilters, setShowFilters] = useState(false);

  const earnedSemesters = useMemo(() => {
    const terms = new Set<string>();
    submissions.forEach(sub => {
      const a = assignments.find(a => a.id === sub.assignmentId);
      if (a) terms.add(getTerm(a.dueDate));
    });
    return Array.from(terms).sort((a, b) => getTermSortKey(a) - getTermSortKey(b));
  }, [submissions, assignments]);

  const allSubmissionTags = useMemo(() => {
    const tags = new Set<string>();
    submissions.forEach(sub => {
      getTagsForSubmission(sub, assignments, allPrompts).forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [submissions, assignments, allPrompts]);

  const filteredSubmissions = useMemo(() => {
    const filtered = submissions.filter(sub => {
      if (searchTerm.trim()) {
        if (!sub.title.toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
      }
      if (selectedTags.length > 0) {
        const subTags = getTagsForSubmission(sub, assignments, allPrompts);
        if (!selectedTags.every(t => subTags.includes(t))) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return getFirstVersionDate(b) - getFirstVersionDate(a);
        case 'date-asc': return getFirstVersionDate(a) - getFirstVersionDate(b);
        case 'title-asc': return a.title.localeCompare(b.title);
        case 'title-desc': return b.title.localeCompare(a.title);
        default: return 0;
      }
    });
  }, [submissions, assignments, allPrompts, searchTerm, selectedTags, sortBy]);

  const allTracks = useMemo(() => {
    return filteredSubmissions
      .map(s => trackFromSubmission(s, collaborations))
      .filter((t): t is PlayableTrack => t !== null);
  }, [filteredSubmissions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('campers')}
          className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="flex items-center gap-4">
          {camper.pictureOverrideUrl || camper.picture ? (
            <ArtworkImage
              fileId={undefined}
              fallbackUrl={camper.pictureOverrideUrl || camper.picture}
              alt={camper.name}
              className="w-16 h-16 rounded-2xl object-cover"
              fallback={
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl font-bold">
                  {camper.name?.[0] || 'C'}
                </div>
              }
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl font-bold">
              {camper.name?.[0] || 'C'}
            </div>
          )}
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{camper.name || 'Unknown Camper'}</h2>
            <p className="text-slate-500 text-sm">{camper.email}</p>
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-3xl p-6">
        <h3 className="text-lg font-bold text-slate-800">Profile</h3>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Location</p>
            <p className="text-slate-700 font-semibold mt-2">{camper.location || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
            <p className="text-slate-700 font-semibold mt-2">{camper.status || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Intake Semester</p>
            <p className="text-slate-700 font-semibold mt-2 flex items-center gap-1.5">
              <i className="fa-solid fa-graduation-cap text-indigo-400 text-xs"></i>
              {camper.intakeSemester || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Signed In</p>
            <p className="text-slate-700 font-semibold mt-2">
              {camper.lastSignedInAt ? new Date(camper.lastSignedInAt).toLocaleString() : '—'}
            </p>
          </div>
        </div>
        {earnedSemesters.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Semesters</p>
            <div className="flex flex-wrap gap-2">
              {earnedSemesters.map(term => {
                const isIntake = term === camper.intakeSemester;
                const style = getSeasonStyle(term);
                return (
                  <button
                    key={term}
                    onClick={() => onNavigate('semester-detail', term)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all hover:shadow-md hover:scale-105 ${style.bg} ${style.text} ${
                      isIntake ? 'ring-2 ring-offset-1 ring-current' : ''
                    }`}
                  >
                    <i className={`fa-solid ${isIntake ? 'fa-seedling' : style.icon} text-xs`}></i>
                    {term}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-800">Songs Uploaded</h3>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {filteredSubmissions.length !== submissions.length ? `${filteredSubmissions.length} / ${submissions.length}` : submissions.length}
            </span>
          </div>
          {submissions.length > 0 && (
            <div className="flex items-center gap-3 self-start md:self-auto">
              <button
                onClick={async () => {
                  if (allTracks.length === 0) return;
                  await onPlayTrack(allTracks[0]);
                  for (let i = 1; i < allTracks.length; i++) {
                    onAddToQueue(allTracks[i]);
                  }
                }}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-play"></i>
                Play All
              </button>
              <button
                onClick={async () => {
                  if (allTracks.length === 0) return;
                  const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
                  await onPlayTrack(shuffled[0]);
                  for (let i = 1; i < shuffled.length; i++) {
                    onAddToQueue(shuffled[i]);
                  }
                }}
                className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-sm font-bold hover:bg-amber-600 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-shuffle"></i>
                Shuffle
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search songs..."
                value={searchTerm}
                onChange={e => onSearchTermChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <div className={`${showFilters ? 'block' : 'hidden'} space-y-3`}>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort By</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="title-asc">Title A–Z</option>
                <option value="title-desc">Title Z–A</option>
              </select>
            </div>
            {allSubmissionTags.length > 0 && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tags</label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {allSubmissionTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => onSelectedTagsChange(prev =>
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      )}
                      className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
            <button
              onClick={() => onSongsViewChange('cards')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                songsView === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => onSongsViewChange('list')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                songsView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              List
            </button>
          </div>
          {songsView === 'cards' && (
            <div className="hidden xl:flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
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

        {songsView === 'cards' ? (
          <div className="grid gap-4" style={getGridStyle(gridSize)}>
            {filteredSubmissions.map((submission) => {
              const track = trackFromSubmission(submission, collaborations);
              const bocaCount = bocas.filter(b => b.submissionId === submission.id).length;
              const isFavorited = favoritedSubmissionIds.includes(submission.id);
              return (
                <div
                  key={submission.id}
                  onClick={() => onNavigate('song-detail', submission.id)}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                >
                  <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                    <ArtworkImage
                      fileId={submission.artworkFileId}
                      fallbackUrl={submission.artworkUrl}
                      alt={`${submission.title} artwork`}
                      className="w-full h-full object-contain bg-slate-100"
                      fallback={<i className="fa-solid fa-compact-disc text-4xl text-indigo-400"></i>}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(submission.id); }}
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
                    <h4 className="font-bold text-slate-800 text-lg leading-tight truncate">{submission.title}</h4>
                    <div className="mt-3 text-xs text-slate-500 space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Assignment</p>
                      <p className="font-semibold text-slate-700 truncate">{assignments.find(a => a.id === submission.assignmentId)?.title || 'Independent Work'}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-calendar"></i>
                        {formatDate(submission.versions?.length ? submission.versions[submission.versions.length - 1].timestamp : submission.updatedAt, dateFormat)}
                      </span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-semibold">{getTerm(submission.versions?.length ? submission.versions[submission.versions.length - 1].timestamp : submission.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredSubmissions.length === 0 && (
              <div className="col-span-full text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl p-10">
                {submissions.length > 0 ? (
                  <>
                    <p>No songs match your filters.</p>
                    <button onClick={() => { onSearchTermChange(''); onSelectedTagsChange([]); }} className="text-indigo-600 font-bold hover:underline mt-2">Clear filters</button>
                  </>
                ) : 'No songs uploaded yet.'}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Song</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((submission) => {
                  const track = trackFromSubmission(submission, collaborations);
                  const bocaCount = bocas.filter(b => b.submissionId === submission.id).length;
                  const isFavorited = favoritedSubmissionIds.includes(submission.id);
                  return (
                    <tr
                      key={submission.id}
                      onClick={() => onNavigate('song-detail', submission.id)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                            <ArtworkImage
                              fileId={submission.artworkFileId}
                              fallbackUrl={submission.artworkUrl}
                              alt={`${submission.title} artwork`}
                              className="w-full h-full object-cover"
                              containerClassName="w-full h-full flex items-center justify-center"
                              fallback={<i className="fa-solid fa-compact-disc text-indigo-400 text-sm"></i>}
                            />
                          </div>
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{submission.title}</p>
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
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(submission.versions?.length ? submission.versions[submission.versions.length - 1].timestamp : submission.updatedAt, dateFormat)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(submission.id); }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              isFavorited
                                ? 'bg-red-50 text-red-500'
                                : 'bg-slate-50 text-slate-300 border border-slate-200 hover:text-red-400 hover:bg-red-50'
                            }`}
                            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
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
                })}
                {filteredSubmissions.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                      {submissions.length > 0 ? (
                        <>
                          <p>No songs match your filters.</p>
                          <button onClick={() => { onSearchTermChange(''); onSelectedTagsChange([]); }} className="text-indigo-600 font-bold hover:underline mt-2">Clear filters</button>
                        </>
                      ) : 'No songs uploaded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-800">Prompts Recommended</h3>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{prompts.length}</span>
          </div>
        </div>
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => onNavigate('prompt-detail', prompt.id)}
              className="w-full text-left bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-indigo-200 hover:bg-white transition-all"
            >
              <p className="text-sm font-semibold text-slate-800">{prompt.title}</p>
              <p className="text-xs text-slate-500 line-clamp-1">{prompt.description}</p>
            </button>
          ))}
          {prompts.length === 0 && (
            <p className="text-slate-400 text-sm italic">No prompts yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default CamperDetail;
