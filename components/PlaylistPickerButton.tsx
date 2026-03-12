import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PlaylistPickerButtonProps {
  submissionId: string;
  playlists: { id: string; title: string }[];
  onAddToPlaylist: (submissionId: string, playlistId: string) => void;
  onCreatePlaylist?: (title: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const PlaylistPickerButton: React.FC<PlaylistPickerButtonProps> = ({ submissionId, playlists, onAddToPlaylist, onCreatePlaylist, size = 'sm', className = '' }) => {
  const [open, setOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (showCreate) inputRef.current?.focus();
  }, [showCreate]);

  // Reset when submissionId changes
  useEffect(() => { setAddedId(null); }, [submissionId]);

  const sizeClasses = size === 'md' ? 'w-9 h-9' : 'w-8 h-8';
  const iconSize = size === 'md' ? 'text-sm' : 'text-[10px]';

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`${sizeClasses} rounded-full flex items-center justify-center transition-all ${addedId ? 'text-green-500' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'} ${className}`}
        title="Add to playlist"
      >
        <i className={`fa-solid ${addedId ? 'fa-check' : 'fa-rectangle-list'} ${iconSize}`}></i>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" onClick={() => { setOpen(false); setShowCreate(false); setNewTitle(''); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div ref={ref} className="relative bg-white rounded-2xl shadow-2xl w-72 max-h-80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Add to playlist</p>
              {onCreatePlaylist && !showCreate && (
                <button onClick={() => setShowCreate(true)} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-700">
                  <i className="fa-solid fa-plus mr-1"></i>New
                </button>
              )}
            </div>
            {showCreate && onCreatePlaylist && (
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTitle.trim()) {
                      onCreatePlaylist(newTitle.trim());
                      setNewTitle('');
                      setShowCreate(false);
                      // Close after a moment to let the playlist be created
                      setTimeout(() => setOpen(false), 300);
                    }
                    if (e.key === 'Escape') { setShowCreate(false); setNewTitle(''); }
                  }}
                  placeholder="Playlist name..."
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={() => {
                    if (newTitle.trim()) {
                      onCreatePlaylist(newTitle.trim());
                      setNewTitle('');
                      setShowCreate(false);
                      setTimeout(() => setOpen(false), 300);
                    }
                  }}
                  disabled={!newTitle.trim()}
                  className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 transition-colors flex-shrink-0"
                >
                  <i className="fa-solid fa-check text-xs"></i>
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
              {playlists.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No playlists yet</p>
              ) : playlists.map(pl => {
                const justAdded = pl.id === addedId;
                return (
                  <button
                    key={pl.id}
                    onClick={() => {
                      onAddToPlaylist(submissionId, pl.id);
                      setAddedId(pl.id);
                      setTimeout(() => setOpen(false), 400);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${justAdded ? 'bg-green-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-rectangle-list text-white text-[10px]"></i>
                    </div>
                    <span className={`text-sm truncate flex-1 ${justAdded ? 'text-green-700 font-semibold' : 'text-slate-700'}`}>{pl.title}</span>
                    {justAdded && <i className="fa-solid fa-check text-green-500 text-xs flex-shrink-0"></i>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default PlaylistPickerButton;
