
import React, { useState, useMemo } from 'react';
import { Boca, Submission, PlayableTrack, ViewState } from '../types';
import ArtworkImage from '../components/ArtworkImage';

type BocasSortOption = 'count-desc' | 'count-asc' | 'title-asc' | 'title-desc' | 'artist-asc' | 'artist-desc' | 'recent';

interface BOCAsPageProps {
  bocas: Boca[];
  submissions: Submission[];
  currentUserEmail: string;
  onNavigate: (view: ViewState, id?: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  onGiveBoca: (submissionId: string) => Promise<void>;
  viewMode: 'cards' | 'list';
  onViewModeChange: (value: 'cards' | 'list') => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  sortBy: BocasSortOption;
  onSortByChange: (value: BocasSortOption) => void;
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

const BOCAsPage: React.FC<BOCAsPageProps> = ({ bocas, submissions, currentUserEmail, onNavigate, onPlayTrack, playingTrackId, onGiveBoca, viewMode, onViewModeChange, searchTerm, onSearchTermChange, sortBy, onSortByChange }) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [givingBocaId, setGivingBocaId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Build list of months that have at least one BOCA, plus current month
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    monthSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    bocas.forEach(b => {
      const d = new Date(b.awardedAt);
      if (!isNaN(d.getTime())) {
        monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(monthSet).sort().reverse();
  }, [bocas]);

  // Parse selected month into range
  const [monthStart, monthEnd] = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return [new Date(year, month - 1, 1), new Date(year, month, 1)];
  }, [selectedMonth]);

  // Filter BOCAs for selected month
  const monthBocas = useMemo(() => {
    return bocas.filter(b => {
      const d = new Date(b.awardedAt);
      return d >= monthStart && d < monthEnd;
    });
  }, [bocas, monthStart, monthEnd]);

  // Current user's remaining BOCAs (always based on current calendar month)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthlyUsed = bocas.filter(b => b.fromEmail === currentUserEmail && new Date(b.awardedAt) >= currentMonthStart && new Date(b.awardedAt) < currentMonthEnd).length;
  const remaining = Math.max(0, 2 - monthlyUsed);
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetLabel = nextReset.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Aggregate: submissionId -> count
  const rankedSongs = useMemo(() => {
    const counts: Record<string, { count: number; latestAt: string }> = {};
    monthBocas.forEach(b => {
      if (!counts[b.submissionId]) {
        counts[b.submissionId] = { count: 0, latestAt: b.awardedAt };
      }
      counts[b.submissionId].count++;
      if (b.awardedAt > counts[b.submissionId].latestAt) {
        counts[b.submissionId].latestAt = b.awardedAt;
      }
    });

    return Object.entries(counts)
      .map(([submissionId, { count, latestAt }]) => ({
        submissionId,
        count,
        latestAt,
        submission: submissions.find(s => s.id === submissionId)
      }))
      .filter(item => item.submission);
  }, [monthBocas, submissions]);

  // Apply search and sort
  const filteredSortedSongs = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return rankedSongs
      .filter(item => {
        if (!normalized) return true;
        const sub = item.submission!;
        return sub.title.toLowerCase().includes(normalized) || sub.camperName.toLowerCase().includes(normalized);
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'count-desc':
            return b.count - a.count || new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
          case 'count-asc':
            return a.count - b.count || new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
          case 'title-asc':
            return a.submission!.title.localeCompare(b.submission!.title);
          case 'title-desc':
            return b.submission!.title.localeCompare(a.submission!.title);
          case 'artist-asc':
            return a.submission!.camperName.localeCompare(b.submission!.camperName);
          case 'artist-desc':
            return b.submission!.camperName.localeCompare(a.submission!.camperName);
          case 'recent':
            return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
          default:
            return 0;
        }
      });
  }, [rankedSongs, searchTerm, sortBy]);

  const formatMonth = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isCurrentMonth = selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-800">BOCAs</h2>
        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
          <i className="fa-solid fa-star mr-1"></i>
          Best of Camp Awards
        </span>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search songs or campers..."
              value={searchTerm}
              onChange={e => onSearchTermChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors flex-shrink-0 ${
              showFilters ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="fa-solid fa-sliders"></i>
            Filters
            <i className={`fa-solid fa-chevron-${showFilters ? 'up' : 'down'} text-[10px]`}></i>
          </button>
        </div>
        <div className={`${showFilters ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort By</label>
              <select
                value={sortBy}
                onChange={e => onSortByChange(e.target.value as BocasSortOption)}
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="count-desc">Most BOCAs First</option>
                <option value="count-asc">Fewest BOCAs First</option>
                <option value="title-asc">Title A → Z</option>
                <option value="title-desc">Title Z → A</option>
                <option value="artist-asc">Artist A → Z</option>
                <option value="artist-desc">Artist Z → A</option>
                <option value="recent">Most Recent BOCA</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* BOCA Remaining Banner */}
      {currentUserEmail && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-star"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              You have <span className="text-amber-600">{remaining} BOCA{remaining !== 1 ? 's' : ''}</span> left this month
            </p>
            <p className="text-xs text-amber-700/70 mt-0.5">Resets {resetLabel}</p>
          </div>
        </div>
      )}

      {/* View toggle + results count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 w-fit">
          <button
            onClick={() => onViewModeChange('cards')}
            className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
              viewMode === 'cards' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
              viewMode === 'list' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            List
          </button>
        </div>
        <p className="text-xs text-slate-400 font-medium">
          {filteredSortedSongs.length} song{filteredSortedSongs.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Content */}
      {filteredSortedSongs.length > 0 ? (
        viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSortedSongs.map(({ submissionId, count, submission: sub }) => {
              if (!sub) return null;
              const track = trackFromSubmission(sub);
              const alreadyBocad = bocas.some(b => b.submissionId === submissionId && b.fromEmail === currentUserEmail);
              const isOwnSong = currentUserEmail === sub.camperId;
              const canGive = currentUserEmail && !alreadyBocad && !isOwnSong && remaining > 0 && isCurrentMonth;

              return (
                <div
                  key={submissionId}
                  onClick={() => onNavigate('song-detail', submissionId)}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group"
                >
                  <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                    <ArtworkImage
                      fileId={sub.artworkFileId}
                      fallbackUrl={sub.artworkUrl}
                      alt={`${sub.title} artwork`}
                      className="w-full h-full object-contain bg-slate-100"
                      fallback={<i className="fa-solid fa-compact-disc text-4xl text-amber-400"></i>}
                    />
                    <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full font-bold text-[10px] flex items-center gap-1 shadow-md">
                      <i className="fa-solid fa-star text-[8px]"></i>
                      BOCA'd by {count} camper{count !== 1 ? 's' : ''}
                    </div>
                    {track && (
                      <div className={`absolute inset-0 flex items-center justify-center gap-3 transition-opacity bg-black/20 ${playingTrackId === track.versionId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                          disabled={playingTrackId === track.versionId}
                          className="w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg hover:bg-amber-600 hover:scale-105 transition-all disabled:opacity-70"
                          title="Play"
                        >
                          <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-lg ml-0.5`}></i>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-slate-800 text-lg leading-tight truncate">{sub.title}</h4>
                    <p className="text-xs text-slate-500 mt-1">By {sub.camperName}</p>
                    <div className="mt-3 flex items-center justify-between">
                      {alreadyBocad ? (
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200 font-bold uppercase tracking-tighter flex items-center gap-1">
                          <i className="fa-solid fa-star text-[8px]"></i>
                          You BOCA'd this
                        </span>
                      ) : canGive ? (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setGivingBocaId(submissionId);
                            try { await onGiveBoca(submissionId); } finally { setGivingBocaId(null); }
                          }}
                          disabled={givingBocaId === submissionId}
                          className="text-[10px] bg-amber-400 hover:bg-amber-500 text-amber-900 px-3 py-1 rounded-full font-bold uppercase tracking-tighter flex items-center gap-1 transition-colors"
                        >
                          <i className={`fa-solid ${givingBocaId === submissionId ? 'fa-spinner fa-spin' : 'fa-star'} text-[8px]`}></i>
                          Give BOCA
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Song</th>
                  <th className="px-4 py-3">BOCAs</th>
                  <th className="px-4 py-3 hidden md:table-cell"></th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSortedSongs.map(({ submissionId, count, submission: sub }) => {
                  if (!sub) return null;
                  const track = trackFromSubmission(sub);
                  const alreadyBocad = bocas.some(b => b.submissionId === submissionId && b.fromEmail === currentUserEmail);
                  const isOwnSong = currentUserEmail === sub.camperId;
                  const canGive = currentUserEmail && !alreadyBocad && !isOwnSong && remaining > 0 && isCurrentMonth;

                  return (
                    <tr
                      key={submissionId}
                      onClick={() => onNavigate('song-detail', submissionId)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center relative">
                            <ArtworkImage
                              fileId={sub.artworkFileId}
                              fallbackUrl={sub.artworkUrl}
                              alt={`${sub.title} artwork`}
                              className="w-full h-full object-cover"
                              containerClassName="w-full h-full flex items-center justify-center"
                              fallback={<i className="fa-solid fa-compact-disc text-amber-400 text-sm"></i>}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{sub.title}</p>
                            <p className="text-xs text-slate-500 truncate">{sub.camperName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                          <i className="fa-solid fa-star text-[8px]"></i>
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" onClick={e => e.stopPropagation()}>
                        {alreadyBocad ? (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200 font-bold uppercase tracking-tighter flex items-center gap-1 w-fit">
                            <i className="fa-solid fa-star text-[8px]"></i>
                            You BOCA'd this
                          </span>
                        ) : canGive ? (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setGivingBocaId(submissionId);
                              try { await onGiveBoca(submissionId); } finally { setGivingBocaId(null); }
                            }}
                            disabled={givingBocaId === submissionId}
                            className="text-[10px] bg-amber-400 hover:bg-amber-500 text-amber-900 px-3 py-1 rounded-full font-bold uppercase tracking-tighter flex items-center gap-1 transition-colors"
                          >
                            <i className={`fa-solid ${givingBocaId === submissionId ? 'fa-spinner fa-spin' : 'fa-star'} text-[8px]`}></i>
                            Give BOCA
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {track && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                            disabled={playingTrackId === track.versionId}
                            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors"
                            title="Play"
                          >
                            <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : rankedSongs.length > 0 ? (
        /* Search produced no results */
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 text-3xl">
            <i className="fa-solid fa-filter"></i>
          </div>
          <h3 className="font-bold text-slate-800 text-xl">No songs match your search</h3>
          <p className="text-slate-500 mt-2 mb-6">Try adjusting your search criteria.</p>
          <button
            onClick={() => onSearchTermChange('')}
            className="text-amber-600 font-bold hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        /* No BOCAs for this month */
        <div className="text-center py-16 bg-amber-50/50 rounded-3xl border-2 border-dashed border-amber-200">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400 text-3xl">
            <i className="fa-solid fa-star"></i>
          </div>
          <h3 className="font-bold text-slate-800 text-xl">No BOCAs yet for {formatMonth(selectedMonth)}</h3>
          <p className="text-slate-500 mt-2 mb-2 max-w-md mx-auto">
            Listen to some songs and award your favorites! You get 2 BOCAs each month to give to the songs that move you.
          </p>
        </div>
      )}
    </div>
  );
};

export default BOCAsPage;
