import React, { useState, useMemo } from 'react';
import { Playlist, Submission, Collaboration, Boca, PlayableTrack } from '../types';
import { getDisplayArtist, getPrimaryVersion } from '../utils';
import ArtworkImage from '../components/ArtworkImage';

interface PlaylistsPageProps {
  playlists: Playlist[];
  submissions: Submission[];
  collaborations: Collaboration[];
  onViewDetail: (id: string) => void;
  onCreatePlaylist?: (title: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onShufflePlay: (tracks: PlayableTrack[]) => Promise<void>;
  playingTrackId?: string | null;
  bocas: Boca[];
  userProfile?: { name?: string; email?: string } | null;
}

const PlaylistsPage: React.FC<PlaylistsPageProps> = ({ playlists, submissions, collaborations, onViewDetail, onCreatePlaylist, onPlayTrack, onShufflePlay, playingTrackId, bocas, userProfile }) => {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return playlists;
    const q = search.toLowerCase();
    return playlists.filter(p => p.title.toLowerCase().includes(q) || p.creatorName.toLowerCase().includes(q));
  }, [playlists, search]);

  const getPlaylistTracks = (playlist: Playlist): PlayableTrack[] => {
    return playlist.submissionIds
      .map(id => submissions.find(s => s.id === id))
      .filter((s): s is Submission => !!s && !s.deletedAt && !!getPrimaryVersion(s)?.id)
      .map(s => {
        const primary = getPrimaryVersion(s)!;
        return { versionId: primary.id, title: s.title, artist: getDisplayArtist(s, collaborations), camperId: s.camperId, submissionId: s.id, artworkFileId: s.artworkFileId, artworkUrl: s.artworkUrl } as PlayableTrack;
      });
  };

  const getCoverSubmission = (playlist: Playlist): Submission | undefined => {
    return playlist.submissionIds
      .map(id => submissions.find(s => s.id === id))
      .find((s): s is Submission => !!s && !s.deletedAt);
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onCreatePlaylist?.(newTitle.trim());
    setNewTitle('');
    setShowCreate(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">Playlists</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{playlists.length}</span>
          </div>
          <p className="text-slate-500 text-sm">Curate tracklists and group songs together.</p>
        </div>
        {onCreatePlaylist && (
          <button
            onClick={() => setShowCreate(true)}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors"
          >
            <i className="fa-solid fa-plus"></i>
            New Playlist
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button type="submit" disabled={!newTitle.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50">
              Create
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setNewTitle(''); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </form>
        </div>
      )}

      {playlists.length > 3 && (
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            placeholder="Search playlists..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <i className="fa-solid fa-list-music text-4xl text-slate-200 mb-4 block" style={{ fontFamily: 'Font Awesome 6 Pro' }}></i>
          <i className="fa-solid fa-rectangle-list text-4xl text-slate-200 mb-4 block"></i>
          <p className="text-slate-400 text-sm">{playlists.length === 0 ? 'No playlists yet. Create one to get started!' : 'No playlists match your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(playlist => {
            const cover = playlist.artworkFileId ? undefined : getCoverSubmission(playlist);
            const trackCount = playlist.submissionIds.length;
            const tracks = getPlaylistTracks(playlist);
            const isOwn = userProfile?.email === playlist.creatorEmail;

            return (
              <div
                key={playlist.id}
                onClick={() => onViewDetail(playlist.id)}
                className="group cursor-pointer"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden mb-2.5 bg-slate-100">
                  {playlist.artworkFileId ? (
                    <ArtworkImage
                      fileId={playlist.artworkFileId}
                      fallbackUrl={playlist.artworkUrl}
                      alt={playlist.title}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
                          <p className="text-white font-bold text-center text-lg leading-tight">{playlist.title}</p>
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
                      <p className="text-white font-bold text-center text-lg leading-tight drop-shadow-lg">{playlist.title}</p>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-2">
                      {tracks.length > 0 && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); if (tracks[0]) onPlayTrack(tracks[0]); }}
                            className="w-10 h-10 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                          >
                            <i className="fa-solid fa-play text-sm ml-0.5"></i>
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); onShufflePlay(tracks); }}
                            className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                          >
                            <i className="fa-solid fa-shuffle text-sm"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-0.5">
                  <p className="text-sm font-bold text-slate-800 truncate">{playlist.title}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {isOwn ? 'by you' : `by ${playlist.creatorName}`} · {trackCount} song{trackCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlaylistsPage;
