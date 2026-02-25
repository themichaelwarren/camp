
import React, { useState, useMemo } from 'react';
import { Submission, Assignment, PlayableTrack, Boca, Collaboration } from '../types';
import { getTerm, DateFormat, formatDate, getDisplayArtist, trackFromSubmission } from '../utils';
import ArtworkImage from '../components/ArtworkImage';

interface FavoritesPageProps {
  submissions: Submission[];
  assignments: Assignment[];
  onViewDetail: (id: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  onStartJukebox: (tracks: PlayableTrack[]) => void;
  favoritedSubmissionIds: string[];
  onToggleFavorite: (submissionId: string) => void;
  bocas: Boca[];
  dateFormat: DateFormat;
  gridSize: 3 | 4 | 5;
  onGridSizeChange: (value: 3 | 4 | 5) => void;
  collaborations: Collaboration[];
}

const gridClasses: Record<3 | 4 | 5, string> = {
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

const FavoritesPage: React.FC<FavoritesPageProps> = ({ submissions, assignments, onViewDetail, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, onStartJukebox, favoritedSubmissionIds, onToggleFavorite, bocas, dateFormat, gridSize, onGridSizeChange, collaborations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const getSubmissionDate = (sub: Submission): string => {
    return sub.versions?.length ? sub.versions[0].timestamp : sub.updatedAt;
  };

  const filteredSubmissions = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return submissions
      .filter(sub => {
        if (!normalized) return true;
        return sub.title.toLowerCase().includes(normalized) || sub.camperName.toLowerCase().includes(normalized);
      })
      .sort((a, b) => new Date(getSubmissionDate(b)).getTime() - new Date(getSubmissionDate(a)).getTime());
  }, [submissions, searchTerm]);

  const allTracks = useMemo(() => {
    return filteredSubmissions
      .map(s => trackFromSubmission(s, collaborations))
      .filter((t): t is PlayableTrack => t !== null);
  }, [filteredSubmissions]);

  const renderCard = (sub: Submission) => {
    const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
    const track = trackFromSubmission(sub, collaborations);
    const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
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
              <p className="text-xs text-slate-500 truncate">{getDisplayArtist(sub, collaborations)}</p>
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
            <h2 className="text-2xl font-bold text-slate-800">
              <i className="fa-solid fa-heart text-red-500 mr-2"></i>
              Favorites
            </h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{submissions.length} song{submissions.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-slate-500 text-sm">Your personally curated collection of camp songs.</p>
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
              className="bg-indigo-600 text-white px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-sm md:text-base font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
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
              className="bg-amber-500 text-white px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-sm md:text-base font-bold hover:bg-amber-600 transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-shuffle"></i>
              Shuffle
            </button>
          </div>
        )}
      </div>

      {submissions.length > 0 ? (
        <>
          {/* Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search favorites..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                      viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
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
                        className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${gridSize === n ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                        title={`${n} per row`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-400 font-semibold">{filteredSubmissions.length} song{filteredSubmissions.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Songs */}
          {filteredSubmissions.length > 0 ? (
            viewMode === 'cards' ? (
              <div className={`grid ${gridClasses[gridSize]} gap-4`}>
                {filteredSubmissions.map(sub => renderCard(sub))}
              </div>
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
                      const track = trackFromSubmission(sub, collaborations);
                      const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
                      return renderRow(sub, assignmentTitle, track, bocaCount);
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="text-center py-16 text-slate-400">
              <i className="fa-solid fa-magnifying-glass text-3xl mb-3 block"></i>
              <p className="font-semibold">No favorites match "{searchTerm}"</p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-regular fa-heart text-3xl text-red-300"></i>
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No favorites yet</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Tap the heart on any song in the Song Vault to add it to your favorites collection.
          </p>
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
