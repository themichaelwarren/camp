import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Playlist, Submission, Assignment, Collaboration, Boca, PlayableTrack, ViewState } from '../types';
import { getDisplayArtist, getPrimaryVersion } from '../utils';
import ArtworkImage from '../components/ArtworkImage';
import SongPickerModal from '../components/SongPickerModal';
import * as googleService from '../services/googleService';

interface PlaylistDetailProps {
  playlist: Playlist;
  submissions: Submission[];
  assignments: Assignment[];
  collaborations: Collaboration[];
  onNavigate: (view: ViewState, id?: string | null) => void;
  onUpdate?: (playlist: Playlist) => void;
  onDelete?: (playlistId: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: { versionId: string; title: string; artist: string; camperId?: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string }) => Promise<void>;
  onShufflePlay: (tracks: PlayableTrack[]) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  userProfile?: { name?: string; email?: string } | null;
  bocas: Boca[];
  spreadsheetId?: string;
}

const PlaylistDetail: React.FC<PlaylistDetailProps> = ({ playlist, submissions, assignments, collaborations, onNavigate, onUpdate, onDelete, onPlayTrack, onAddToQueue, onShufflePlay, playingTrackId, queueingTrackId, userProfile, bocas, spreadsheetId }) => {
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleValue, setTitleValue] = useState(playlist.title);
  const [descValue, setDescValue] = useState(playlist.description);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploadingArtwork, setIsUploadingArtwork] = useState(false);

  // Drag state (desktop)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Drag state (mobile touch)
  const touchDragIndex = useRef<number | null>(null);
  const touchDragClone = useRef<HTMLDivElement | null>(null);
  const trackItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [touchDragOver, setTouchDragOver] = useState<number | null>(null);
  const [touchDragging, setTouchDragging] = useState<number | null>(null);

  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window;

  const tracks = useMemo(() => {
    return playlist.submissionIds
      .map(id => {
        const s = submissions.find(sub => sub.id === id);
        if (!s || s.deletedAt) return null;
        const primary = getPrimaryVersion(s);
        if (!primary?.id) return null;
        return { submission: s, track: { versionId: primary.id, title: s.title, artist: getDisplayArtist(s, collaborations), camperId: s.camperId, submissionId: s.id, artworkFileId: s.artworkFileId, artworkUrl: s.artworkUrl } as PlayableTrack };
      })
      .filter((t): t is { submission: Submission; track: PlayableTrack } => t !== null);
  }, [playlist.submissionIds, submissions, collaborations]);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newIds = [...playlist.submissionIds];
    const [moved] = newIds.splice(fromIndex, 1);
    newIds.splice(toIndex, 0, moved);
    onUpdate?.({ ...playlist, submissionIds: newIds, updatedAt: new Date().toISOString() });
  };

  const handleRemoveSong = (submissionId: string) => {
    onUpdate?.({ ...playlist, submissionIds: playlist.submissionIds.filter(id => id !== submissionId), updatedAt: new Date().toISOString() });
  };

  const handleAddSongs = (ids: string[]) => {
    onUpdate?.({ ...playlist, submissionIds: [...playlist.submissionIds, ...ids], updatedAt: new Date().toISOString() });
  };

  const handleSaveTitle = () => {
    if (titleValue.trim() && titleValue.trim() !== playlist.title) {
      onUpdate?.({ ...playlist, title: titleValue.trim(), updatedAt: new Date().toISOString() });
    }
    setEditingTitle(false);
  };

  const handleSaveDesc = () => {
    if (descValue !== playlist.description) {
      onUpdate?.({ ...playlist, description: descValue, updatedAt: new Date().toISOString() });
    }
    setEditingDesc(false);
  };

  const handleArtworkUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('Image must be 5MB or smaller.'); return; }
    setIsUploadingArtwork(true);
    try {
      const uploaded = await googleService.uploadArtworkToDriveInFolder(file);
      onUpdate?.({ ...playlist, artworkFileId: uploaded.id, artworkUrl: uploaded.webViewLink, updatedAt: new Date().toISOString() });
    } catch { alert('Failed to upload artwork.'); }
    finally { setIsUploadingArtwork(false); }
  };

  // Touch drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    touchDragIndex.current = index;
    setTouchDragging(index);
    setTouchDragOver(index);
    const el = trackItemRefs.current[index];
    if (el) {
      const rect = el.getBoundingClientRect();
      const clone = el.cloneNode(true) as HTMLDivElement;
      clone.style.position = 'fixed';
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      clone.style.zIndex = '99999';
      clone.style.opacity = '0.9';
      clone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
      clone.style.borderRadius = '12px';
      clone.style.pointerEvents = 'none';
      clone.style.transition = 'none';
      clone.style.transform = 'scale(1.03)';
      document.body.appendChild(clone);
      touchDragClone.current = clone;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchDragIndex.current === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touchDragClone.current) {
      touchDragClone.current.style.top = `${touch.clientY - (touchDragClone.current.offsetHeight / 2)}px`;
    }
    for (let i = 0; i < trackItemRefs.current.length; i++) {
      const ref = trackItemRefs.current[i];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          setTouchDragOver(i);
          break;
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchDragIndex.current !== null && touchDragOver !== null && touchDragIndex.current !== touchDragOver) {
      handleReorder(touchDragIndex.current, touchDragOver);
    }
    if (touchDragClone.current) {
      document.body.removeChild(touchDragClone.current);
      touchDragClone.current = null;
    }
    touchDragIndex.current = null;
    setTouchDragging(null);
    setTouchDragOver(null);
  }, [touchDragOver]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => onNavigate('playlists')} className="mt-1 w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <i className="fa-solid fa-arrow-left text-slate-400 text-sm"></i>
        </button>

        <div className="flex flex-col md:flex-row gap-5 flex-1 min-w-0">
          {/* Cover art */}
          <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden flex-shrink-0 group">
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
                <p className="text-white font-bold text-center text-xl leading-tight drop-shadow-lg">{playlist.title}</p>
              </div>
            )}
            {onUpdate && (
              <label className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                <div className="text-white text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                  {isUploadingArtwork ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-camera"></i> Cover</>}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleArtworkUpload(e.target.files[0]); }} disabled={isUploadingArtwork} />
              </label>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-end">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Playlist</p>
            {editingTitle && onUpdate ? (
              <input
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setTitleValue(playlist.title); setEditingTitle(false); } }}
                className="text-3xl font-bold text-slate-800 bg-transparent border-b-2 border-indigo-400 outline-none mb-2"
                autoFocus
              />
            ) : (
              <h2
                className={`text-3xl font-bold text-slate-800 mb-2 ${onUpdate ? 'cursor-pointer hover:text-indigo-600 transition-colors' : ''}`}
                onClick={() => { if (onUpdate) { setTitleValue(playlist.title); setEditingTitle(true); } }}
              >
                {playlist.title}
              </h2>
            )}
            {editingDesc && onUpdate ? (
              <textarea
                value={descValue}
                onChange={e => setDescValue(e.target.value)}
                onBlur={handleSaveDesc}
                className="text-sm text-slate-500 bg-transparent border border-slate-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-500 mb-3 resize-none"
                rows={2}
                autoFocus
              />
            ) : (
              <p
                className={`text-sm text-slate-500 mb-3 ${onUpdate ? 'cursor-pointer hover:text-slate-700' : ''} ${!playlist.description && !onUpdate ? 'hidden' : ''}`}
                onClick={() => { if (onUpdate) { setDescValue(playlist.description); setEditingDesc(true); } }}
              >
                {playlist.description || (onUpdate ? 'Click to add a description...' : '')}
              </p>
            )}
            <p className="text-xs text-slate-400">
              By {userProfile?.email === playlist.creatorEmail ? 'you' : playlist.creatorName} · {tracks.length} song{tracks.length === 1 ? '' : 's'}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4">
              {tracks.length > 0 && (
                <>
                  <button
                    onClick={() => { if (tracks[0]) onPlayTrack(tracks[0].track); }}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                  >
                    <i className="fa-solid fa-play text-[9px]"></i>
                    Play All
                  </button>
                  <button
                    onClick={() => onShufflePlay(tracks.map(t => t.track))}
                    className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                  >
                    <i className="fa-solid fa-shuffle text-[9px]"></i>
                    Shuffle
                  </button>
                </>
              )}
              {onUpdate && (
                <button
                  onClick={() => setShowSongPicker(true)}
                  className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  <i className="fa-solid fa-plus text-[9px]"></i>
                  Add Songs
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-red-500 px-2 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ml-auto"
                >
                  <i className="fa-solid fa-trash text-[9px]"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      {tracks.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
          <i className="fa-solid fa-music text-3xl text-slate-200 mb-3 block"></i>
          <p className="text-slate-400 text-sm mb-3">This playlist is empty</p>
          {onUpdate && (
            <button
              onClick={() => setShowSongPicker(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              <i className="fa-solid fa-plus"></i>
              Add Songs
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {tracks.map(({ submission: s, track }, i) => {
              const isPlaying = playingTrackId === track.versionId;
              const bocaCount = bocas.filter(b => b.submissionId === s.id).length;

              return (
                <div
                  key={`${s.id}-${i}`}
                  ref={el => { trackItemRefs.current[i] = el; }}
                  draggable={onUpdate && !isMobile ? true : false}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={e => { e.preventDefault(); setDragOverIndex(i); }}
                  onDragEnd={() => {
                    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                      handleReorder(dragIndex, dragOverIndex);
                    }
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 group hover:bg-slate-50 transition-colors ${
                    dragIndex === i || touchDragging === i ? 'opacity-40' : ''
                  } ${(dragOverIndex === i && dragIndex !== i) || (touchDragOver === i && touchDragging !== null && touchDragging !== i) ? 'border-t-2 border-indigo-400' : ''}`}
                >
                  {/* Drag handle */}
                  {onUpdate && (
                    <div
                      className="flex-shrink-0 flex items-center justify-center w-6 h-8 touch-none cursor-grab active:cursor-grabbing"
                      onTouchStart={e => handleTouchStart(e, i)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <i className="fa-solid fa-grip-vertical text-slate-300 text-xs"></i>
                    </div>
                  )}

                  {/* Track number */}
                  <span className="w-6 text-center text-xs text-slate-400 font-mono flex-shrink-0">
                    {isPlaying ? <i className="fa-solid fa-volume-high text-indigo-500 text-[10px]"></i> : i + 1}
                  </span>

                  {/* Artwork */}
                  <ArtworkImage
                    fileId={s.artworkFileId}
                    fallbackUrl={s.artworkUrl}
                    alt={s.title}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    fallback={
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                        <i className="fa-solid fa-music text-slate-400 text-xs"></i>
                      </div>
                    }
                  />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isPlaying ? 'text-indigo-600' : 'text-slate-800'}`}>{s.title}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {getDisplayArtist(s, collaborations)}
                      {bocaCount > 0 && <span className="ml-1.5 text-amber-500"><i className="fa-solid fa-star text-[8px]"></i> {bocaCount}</span>}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onPlayTrack(track)}
                      className="w-8 h-8 rounded-full hover:bg-indigo-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <i className="fa-solid fa-play text-[10px]"></i>
                    </button>
                    <button
                      onClick={() => onAddToQueue(track)}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <i className="fa-solid fa-list-ul text-[10px]"></i>
                    </button>
                    <button
                      onClick={() => onNavigate('song-detail', s.id)}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </button>
                    {onUpdate && (
                      <button
                        onClick={() => handleRemoveSong(s.id)}
                        className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Playlist</h3>
            <p className="text-sm text-slate-500 mb-5">Are you sure you want to delete "{playlist.title}"? This won't delete any songs.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={() => { onDelete?.(playlist.id); onNavigate('playlists'); }} className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Song picker */}
      {showSongPicker && (
        <SongPickerModal
          submissions={submissions}
          assignments={assignments}
          collaborations={collaborations}
          excludeIds={playlist.submissionIds}
          onSelect={handleAddSongs}
          onClose={() => setShowSongPicker(false)}
        />
      )}
    </div>
  );
};

export default PlaylistDetail;
