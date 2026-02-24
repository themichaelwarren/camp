import React, { useMemo } from 'react';
import { CamperProfile, Prompt, Assignment, Submission, PlayableTrack, ViewState, Boca } from '../types';
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
  songsView: 'cards' | 'list';
  onSongsViewChange: (value: 'cards' | 'list') => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  selectedTags: string[];
  onSelectedTagsChange: (value: string[] | ((prev: string[]) => string[])) => void;
  bocas?: Boca[];
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

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

const CamperDetail: React.FC<CamperDetailProps> = ({ camper, prompts, allPrompts, assignments, submissions, onNavigate, onPlayTrack, onAddToQueue, songsView, onSongsViewChange, searchTerm, onSearchTermChange, selectedTags, onSelectedTagsChange, bocas = [] }) => {

  const allSubmissionTags = useMemo(() => {
    const tags = new Set<string>();
    submissions.forEach(sub => {
      getTagsForSubmission(sub, assignments, allPrompts).forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [submissions, assignments, allPrompts]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      if (searchTerm.trim()) {
        if (!sub.title.toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
      }
      if (selectedTags.length > 0) {
        const subTags = getTagsForSubmission(sub, assignments, allPrompts);
        if (!selectedTags.every(t => subTags.includes(t))) return false;
      }
      return true;
    });
  }, [submissions, assignments, allPrompts, searchTerm, selectedTags]);

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
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Location</p>
            <p className="text-slate-700 font-semibold mt-2">{camper.location || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
            <p className="text-slate-700 font-semibold mt-2">{camper.status || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Signed In</p>
            <p className="text-slate-700 font-semibold mt-2">
              {camper.lastSignedInAt ? new Date(camper.lastSignedInAt).toLocaleString() : '—'}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-800">Songs Uploaded</h3>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
              {filteredSubmissions.length !== submissions.length ? `${filteredSubmissions.length} / ${submissions.length}` : submissions.length}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full p-1">
            <button
              onClick={() => onSongsViewChange('cards')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                songsView === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => onSongsViewChange('list')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                songsView === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500'
              }`}
            >
              List
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={e => onSearchTermChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {allSubmissionTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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
          )}
        </div>

        {songsView === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSubmissions.map((submission) => {
              const track = trackFromSubmission(submission);
              const bocaCount = bocas.filter(b => b.submissionId === submission.id).length;
              return (
                <div
                  key={submission.id}
                  onClick={() => onNavigate('song-detail', submission.id)}
                  className="text-left bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:bg-white hover:border-indigo-200 transition-all cursor-pointer"
                >
                  <div className={`w-full aspect-square rounded-2xl overflow-hidden flex items-center justify-center text-2xl mb-4 relative ${
                    bocaCount > 0 ? 'bg-amber-100 text-amber-500 ring-2 ring-amber-400' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    <ArtworkImage
                      fileId={submission.artworkFileId}
                      fallbackUrl={submission.artworkUrl}
                      alt={`${submission.title} artwork`}
                      className="w-full h-full object-cover"
                      fallback={<i className={`fa-solid fa-compact-disc ${bocaCount > 0 ? 'text-amber-500' : ''}`}></i>}
                    />
                    {bocaCount > 0 && (
                      <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 shadow-md z-10">
                        <i className="fa-solid fa-star text-[8px]"></i>
                        {bocaCount} BOCA{bocaCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{submission.title}</p>
                      <p className="text-xs text-slate-500">{new Date(submission.versions?.length ? submission.versions[0].timestamp : submission.updatedAt).toLocaleDateString()}</p>
                    </div>
                    {track && (
                      <div className="flex gap-1.5 flex-shrink-0">
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
          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Song</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Artwork</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSubmissions.map((submission) => {
                  const track = trackFromSubmission(submission);
                  const bocaCount = bocas.filter(b => b.submissionId === submission.id).length;
                  return (
                    <tr
                      key={submission.id}
                      onClick={() => onNavigate('song-detail', submission.id)}
                      className="cursor-pointer hover:bg-white transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">{submission.title}</span>
                          {bocaCount > 0 && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                              <i className="fa-solid fa-star text-[8px]"></i>
                              {bocaCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(submission.versions?.length ? submission.versions[0].timestamp : submission.updatedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center ${
                          bocaCount > 0 ? 'bg-amber-100 text-amber-500 ring-2 ring-amber-400' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          <ArtworkImage
                            fileId={submission.artworkFileId}
                            fallbackUrl={submission.artworkUrl}
                            alt={`${submission.title} artwork`}
                            className="w-full h-full object-cover"
                            fallback={<i className={`fa-solid fa-compact-disc text-sm ${bocaCount > 0 ? 'text-amber-500' : ''}`}></i>}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {track && (
                          <div className="flex gap-1.5">
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
                {filteredSubmissions.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
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
