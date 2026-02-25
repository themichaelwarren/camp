
import React, { useMemo } from 'react';
import { Assignment, Submission, Prompt, PlayableTrack, Boca, ViewState } from '../types';
import { getPromptStatus, getPromptStatusStyle, DateFormat, formatDate } from '../utils';
import ArtworkImage from '../components/ArtworkImage';

interface SemesterDetailProps {
  semester: string;
  assignments: Assignment[];
  submissions: Submission[];
  prompts: Prompt[];
  bocas: Boca[];
  onNavigate: (view: ViewState, id?: string | null) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  dateFormat: DateFormat;
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

const SemesterDetail: React.FC<SemesterDetailProps> = ({ semester, assignments, submissions, prompts, bocas, onNavigate, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, dateFormat }) => {

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

  const getSubmissionDate = (sub: Submission): string => {
    return sub.versions?.length ? sub.versions[0].timestamp : sub.updatedAt;
  };

  const sortedSubmissions = useMemo(() =>
    [...submissions].sort((a, b) => new Date(getSubmissionDate(b)).getTime() - new Date(getSubmissionDate(a)).getTime()),
    [submissions]
  );

  const getBocaCount = (submissionId: string) => bocas.filter(b => b.submissionId === submissionId).length;

  const getPromptTitles = (assignment: Assignment): string[] => {
    const ids = assignment.promptIds?.length ? assignment.promptIds : assignment.promptId ? [assignment.promptId] : [];
    return ids.map(id => prompts.find(p => p.id === id)?.title).filter(Boolean) as string[];
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
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <i className="fa-solid fa-graduation-cap text-lg"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{semester}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Set(submissions.map(s => s.camperId || s.camperName)).size} camper{new Set(submissions.map(s => s.camperId || s.camperName)).size !== 1 ? 's' : ''} · {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} · {submissions.length} song{submissions.length !== 1 ? 's' : ''} · {semesterPrompts.length} prompt{semesterPrompts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

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
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-music text-indigo-500 text-sm"></i>
          Songs
          <span className="text-sm font-normal text-slate-400">({submissions.length})</span>
        </h2>
        {sortedSubmissions.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {sortedSubmissions.map(sub => {
              const track = trackFromSubmission(sub);
              const bocaCount = getBocaCount(sub.id);
              const isPlaying = track && playingTrackId === track.versionId;
              const isQueueing = track && queueingTrackId === track.versionId;
              return (
                <div
                  key={sub.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <button
                    onClick={() => track && onPlayTrack(track)}
                    disabled={!track}
                    className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 group"
                  >
                    <ArtworkImage
                      fileId={sub.artworkFileId}
                      fallbackUrl={sub.artworkUrl}
                      alt={sub.title}
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full flex items-center justify-center bg-slate-100"
                      fallback={<i className="fa-solid fa-compact-disc text-sm text-slate-400"></i>}
                    />
                    {track && (
                      <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-xs`}></i>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => onNavigate('song-detail', sub.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="font-semibold text-slate-900 truncate">{sub.title}</p>
                    <p className="text-xs text-slate-500 truncate">{sub.camperName}</p>
                  </button>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {bocaCount > 0 && (
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                        <i className="fa-solid fa-star text-amber-500"></i>
                        {bocaCount}
                      </span>
                    )}
                    {track && (
                      <button
                        onClick={() => onAddToQueue(track)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                        title="Add to queue"
                      >
                        {isQueueing ? (
                          <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                        ) : (
                          <i className="fa-solid fa-list text-xs"></i>
                        )}
                      </button>
                    )}
                    <span className="text-xs text-slate-400 w-16 text-right">
                      {formatDate(getSubmissionDate(sub), dateFormat)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
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
