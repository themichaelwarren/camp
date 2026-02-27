
import React, { useState, useMemo } from 'react';
import { Assignment, Submission, Prompt, PlayableTrack, Boca, ViewState, Collaboration, CamperProfile } from '../types';
import { getPromptStatus, getPromptStatusStyle, getTerm, getSeasonStyle, DateFormat, formatDate, getDisplayArtist, trackFromSubmission, getGridStyle } from '../utils';
import ArtworkImage from '../components/ArtworkImage';

interface SemesterDetailProps {
  semester: string;
  assignments: Assignment[];
  submissions: Submission[];
  prompts: Prompt[];
  bocas: Boca[];
  campers: CamperProfile[];
  onNavigate: (view: ViewState, id?: string | null) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  onStartJukebox: (tracks: PlayableTrack[]) => void;
  favoritedSubmissionIds: string[];
  onToggleFavorite: (submissionId: string) => void;
  dateFormat: DateFormat;
  gridSize: 3 | 4 | 5;
  onGridSizeChange: (value: 3 | 4 | 5) => void;
  collaborations: Collaboration[];
}


const SemesterDetail: React.FC<SemesterDetailProps> = ({ semester, assignments, submissions, prompts, bocas, campers, onNavigate, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, onStartJukebox, favoritedSubmissionIds, onToggleFavorite, dateFormat, gridSize, onGridSizeChange, collaborations }) => {
  const [songsView, setSongsView] = useState<'cards' | 'list'>('cards');

  // Unique prompts used this semester (from assignments' promptIds)
  const semesterPrompts = useMemo(() => {
    const ids = new Set<string>();
    assignments.forEach(a => {
      if (a.promptIds) a.promptIds.forEach(id => ids.add(id));
      if (a.promptId) ids.add(a.promptId);
    });
    return prompts.filter(p => ids.has(p.id) && !p.deletedAt);
  }, [assignments, prompts]);

  const sortedAssignments = useMemo(() =>
    [...assignments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [assignments]
  );

  // Campers who participated this semester (submitted at least one song)
  const semesterCampers = useMemo((): CamperProfile[] => {
    const matched: CamperProfile[] = [];
    const seen = new Set<string>();
    // Build a map from every possible camper identifier to their profile
    const profileByKey = new Map<string, CamperProfile>();
    campers.forEach(c => {
      [c.email, c.id, c.name].forEach(k => { if (k) profileByKey.set(String(k).trim(), c); });
    });

    const allCamperIds = new Set(submissions.map(s => s.camperId || s.camperName));
    allCamperIds.forEach(cid => {
      const key = cid.trim();
      if (seen.has(key)) return;
      const profile = profileByKey.get(key);
      if (profile) {
        if (!seen.has(profile.email)) {
          matched.push(profile);
          [profile.email, profile.id, profile.name].forEach(k => { if (k) seen.add(String(k).trim()); });
        }
      } else {
        // Camper submitted but has no profile (hasn't signed in)
        const sub = submissions.find(s => (s.camperId || s.camperName) === cid);
        const name = sub?.camperName || cid;
        // Check if we already matched this person by their display name
        if (seen.has(name.trim())) return;
        matched.push({ id: cid, name, email: cid, lastSignedInAt: '' });
        seen.add(key);
        seen.add(name.trim());
      }
    });
    return matched;
  }, [submissions, campers]);

  const getSubmissionDate = (sub: Submission): string => {
    return sub.versions?.length ? sub.versions[0].timestamp : sub.updatedAt;
  };

  const sortedSubmissions = useMemo(() =>
    [...submissions].sort((a, b) => new Date(getSubmissionDate(b)).getTime() - new Date(getSubmissionDate(a)).getTime()),
    [submissions]
  );

  const allTracks = useMemo(() => {
    return sortedSubmissions
      .map(s => trackFromSubmission(s, collaborations))
      .filter((t): t is PlayableTrack => t !== null);
  }, [sortedSubmissions]);

  const getBocaCount = (submissionId: string) => bocas.filter(b => b.submissionId === submissionId).length;

  const getPromptTitles = (assignment: Assignment): string[] => {
    const ids = assignment.promptIds?.length ? assignment.promptIds : assignment.promptId ? [assignment.promptId] : [];
    return ids.map(id => prompts.find(p => p.id === id)?.title).filter(Boolean) as string[];
  };

  const renderCard = (sub: Submission) => {
    const track = trackFromSubmission(sub, collaborations);
    const bocaCount = getBocaCount(sub.id);
    const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
    const isFavorited = favoritedSubmissionIds.includes(sub.id);

    return (
      <div
        key={sub.id}
        onClick={() => onNavigate('song-detail', sub.id)}
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
          <p className="text-xs text-slate-500 mt-1">By {getDisplayArtist(sub, collaborations)}</p>
          <div className="mt-4 text-xs text-slate-500 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Assignment</p>
            <p className="font-semibold text-slate-700 truncate">{assignmentTitle}</p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1">
              <i className="fa-solid fa-calendar"></i>
              {formatDate(getSubmissionDate(sub), dateFormat)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderRow = (sub: Submission) => {
    const track = trackFromSubmission(sub, collaborations);
    const bocaCount = getBocaCount(sub.id);
    const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
    const isFavorited = favoritedSubmissionIds.includes(sub.id);

    return (
      <tr
        key={sub.id}
        onClick={() => onNavigate('song-detail', sub.id)}
        className="cursor-pointer hover:bg-slate-50 transition-colors group"
      >
        <td className="px-3 sm:px-4 py-3 max-w-0 sm:max-w-none">
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{sub.title}</p>
                {bocaCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                    <i className="fa-solid fa-star text-[8px]"></i>
                    {bocaCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">{getDisplayArtist(sub, collaborations)}</p>
            </div>
            {track && (
              <button
                onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                disabled={playingTrackId === track.versionId}
                className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors flex-shrink-0 sm:hidden"
                title="Play"
              >
                <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600 truncate hidden md:table-cell">{assignmentTitle}</td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap hidden sm:table-cell">
          {formatDate(getSubmissionDate(sub), dateFormat)}
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <div className="flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(sub.id); }}
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
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => onNavigate('semesters')}
          className="text-sm text-slate-500 hover:text-indigo-600 mb-3 flex items-center gap-1.5 transition-colors"
        >
          <i className="fa-solid fa-arrow-left text-xs"></i>
          Semesters
        </button>
        <div className="flex items-center gap-4">
          {(() => { const style = getSeasonStyle(semester); return (
            <div className={`w-12 h-12 rounded-2xl ${style.bg} ${style.text} flex items-center justify-center`}>
              <i className={`fa-solid ${style.icon} text-lg`}></i>
            </div>
          ); })()}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{semester}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {semesterCampers.length} camper{semesterCampers.length !== 1 ? 's' : ''} · {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} · {submissions.length} song{submissions.length !== 1 ? 's' : ''} · {semesterPrompts.length} prompt{semesterPrompts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Campers Section */}
      {semesterCampers.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-users text-indigo-500 text-sm"></i>
            Campers
            <span className="text-sm font-normal text-slate-400">({semesterCampers.length})</span>
          </h2>
          <div className="flex flex-wrap gap-4">
            {semesterCampers.map(c => {
              const songCount = submissions.filter(s => s.camperId === c.email || s.camperId === c.id || s.camperId === c.name || s.camperName === c.name).length;
              return (
                <button
                  key={c.id || c.email}
                  onClick={() => onNavigate('camper-detail', c.id || c.email)}
                  className="flex flex-col items-center gap-2 w-24 group"
                >
                  {c.pictureOverrideUrl || c.picture ? (
                    <ArtworkImage
                      fileId={undefined}
                      fallbackUrl={c.pictureOverrideUrl || c.picture}
                      alt={c.name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-100 group-hover:ring-indigo-300 transition-all group-hover:scale-105"
                      fallback={
                        <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold ring-2 ring-slate-100">
                          {c.name?.[0] || 'C'}
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold ring-2 ring-slate-100 group-hover:ring-indigo-300 transition-all group-hover:scale-105">
                      {c.name?.[0] || 'C'}
                    </div>
                  )}
                  <div className="text-center min-w-0 w-full">
                    <p className="text-xs font-semibold text-slate-800 truncate">{c.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400">{songCount} song{songCount !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Assignments Section */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-tasks text-indigo-500 text-sm"></i>
          Assignments
          <span className="text-sm font-normal text-slate-400">({assignments.length})</span>
        </h2>
        {sortedAssignments.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {sortedAssignments.map(a => {
              const promptTitles = getPromptTitles(a);
              return (
                <button
                  key={a.id}
                  onClick={() => onNavigate('assignment-detail', a.id)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{a.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-slate-500">
                        Due {formatDate(a.dueDate, dateFormat)}
                      </span>
                      {promptTitles.map((title, i) => (
                        <span key={i} className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-semibold truncate max-w-[160px]">{title}</span>
                      ))}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide flex-shrink-0 ${
                    a.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {a.status}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No assignments this semester.</p>
        )}
      </section>

      {/* Songs Section */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-music text-indigo-500 text-sm"></i>
            Songs
            <span className="text-sm font-normal text-slate-400">({submissions.length})</span>
          </h2>
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
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors"
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
                className="inline-flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 transition-colors"
              >
                <i className="fa-solid fa-shuffle"></i>
                Shuffle
              </button>
            </div>
          )}
        </div>

        {sortedSubmissions.length > 0 ? (
          <>
            {/* View toggle + grid size */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
                <button
                  onClick={() => setSongsView('cards')}
                  className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                    songsView === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Cards
                </button>
                <button
                  onClick={() => setSongsView('list')}
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
                {sortedSubmissions.map(sub => renderCard(sub))}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="px-3 sm:px-4 py-3">Song</th>
                      <th className="px-4 py-3 hidden md:table-cell">Assignment</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                      <th className="px-4 py-3 hidden sm:table-cell"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedSubmissions.map(sub => renderRow(sub))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400 italic">No songs this semester.</p>
        )}
      </section>

      {/* Prompts Section */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-lightbulb text-indigo-500 text-sm"></i>
          Prompts Used
          <span className="text-sm font-normal text-slate-400">({semesterPrompts.length})</span>
        </h2>
        {semesterPrompts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {semesterPrompts.map(p => {
              const status = getPromptStatus(p.id, assignments);
              return (
                <button
                  key={p.id}
                  onClick={() => onNavigate('prompt-detail', p.id)}
                  className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
                >
                  <span className="font-semibold text-sm text-slate-900">{p.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${getPromptStatusStyle(status)}`}>
                    {status}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No prompts used this semester.</p>
        )}
      </section>
    </div>
  );
};

export default SemesterDetail;
