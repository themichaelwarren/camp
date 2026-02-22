import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ArtworkImage from './ArtworkImage';

interface Track {
  src: string;
  title: string;
  artist: string;
  camperId?: string;
  submissionId?: string;
  artworkFileId?: string;
  artworkUrl?: string;
}

interface NowPlayingOverlayProps {
  player: Track;
  queue: Track[];
  audioRef: React.RefObject<HTMLAudioElement>;
  isLoading?: boolean;
  onClose: () => void;
  onPlayNext: () => void;
  onRemoveFromQueue: (index: number) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
  onNavigateToSong?: (submissionId: string) => void;
  onNavigateToCamper?: (camperId: string) => void;
  isJukeboxMode?: boolean;
  onStopJukebox?: () => void;
}

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const NowPlayingOverlay: React.FC<NowPlayingOverlayProps> = ({
  player,
  queue,
  audioRef,
  isLoading,
  onClose,
  onPlayNext,
  onRemoveFromQueue,
  onReorderQueue,
  onNavigateToSong,
  onNavigateToCamper,
  isJukeboxMode,
  onStopJukebox
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(!audio.paused);
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);
    setVolume(audio.volume);

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audioRef, player.src]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [audioRef]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, [audioRef]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const vol = parseFloat(e.target.value);
    audio.volume = vol;
    setVolume(vol);
  }, [audioRef]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); togglePlayPause(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, togglePlayPause]);

  const seekPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-md mx-4 mb-0 md:mb-0 bg-gradient-to-b from-slate-900 to-slate-950 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-chevron-down text-sm"></i>
        </button>

        {/* Artwork */}
        <div className="p-6 pb-0">
          <div className="aspect-square w-full rounded-2xl overflow-hidden bg-slate-800 shadow-xl relative">
            <ArtworkImage
              fileId={player.artworkFileId}
              fallbackUrl={player.artworkUrl}
              alt={player.title}
              className="w-full h-full object-cover"
              containerClassName="w-full h-full"
              fallback={
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
                  <i className="fa-solid fa-compact-disc text-6xl text-white/20 animate-spin" style={{ animationDuration: '3s' }}></i>
                </div>
              }
              lazy={false}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <i className="fa-solid fa-spinner fa-spin text-white text-3xl"></i>
                  <p className="text-white/70 text-sm font-medium">Loading audio...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Track Info */}
        <div className="px-6 pt-5 pb-2">
          {player.submissionId ? (
            <button
              onClick={() => onNavigateToSong?.(player.submissionId!)}
              className="text-white font-bold text-xl truncate block text-left hover:underline max-w-full"
            >
              {player.title}
            </button>
          ) : (
            <h3 className="text-white font-bold text-xl truncate">{player.title}</h3>
          )}
          {player.camperId ? (
            <button
              onClick={() => onNavigateToCamper?.(player.camperId!)}
              className="text-white/50 text-sm font-medium truncate block text-left hover:text-white/70 hover:underline max-w-full"
            >
              {player.artist}
            </button>
          ) : (
            <p className="text-white/50 text-sm font-medium truncate">{player.artist}</p>
          )}
        </div>

        {isJukeboxMode && (
          <button
            onClick={onStopJukebox}
            className="mx-6 mb-1 flex items-center gap-2 bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-amber-500/30 transition-colors w-fit"
          >
            <i className="fa-solid fa-shuffle"></i>
            Jukebox Mode
            <i className="fa-solid fa-xmark ml-1"></i>
          </button>
        )}

        {/* Seek Bar */}
        <div className="px-6 pb-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 appearance-none bg-white/10 rounded-full cursor-pointer accent-white"
            style={{
              background: `linear-gradient(to right, white ${seekPercent}%, rgba(255,255,255,0.1) ${seekPercent}%)`
            }}
          />
          <div className="flex justify-between text-[11px] text-white/40 font-mono mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-center gap-8 py-3 px-6">
          <button
            className="text-white/30 cursor-not-allowed"
            disabled
          >
            <i className="fa-solid fa-backward-step text-xl"></i>
          </button>
          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            className={`w-16 h-16 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg ${isLoading ? 'opacity-50' : 'hover:scale-105 active:scale-95'} transition-transform`}
          >
            <i className={`fa-solid ${isLoading ? 'fa-spinner fa-spin' : isPlaying ? 'fa-pause' : 'fa-play ml-1'} text-2xl`}></i>
          </button>
          <button
            onClick={onPlayNext}
            className={`${queue.length > 0 ? 'text-white/70 hover:text-white' : 'text-white/30 cursor-not-allowed'} transition-colors`}
            disabled={queue.length === 0}
          >
            <i className="fa-solid fa-forward-step text-xl"></i>
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 px-6 pb-4">
          <i className="fa-solid fa-volume-low text-white/30 text-xs"></i>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 appearance-none bg-white/10 rounded-full cursor-pointer accent-white"
            style={{
              background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`
            }}
          />
          <i className="fa-solid fa-volume-high text-white/30 text-xs"></i>
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="border-t border-white/10 px-6 py-4 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Up Next</p>
            <div className="space-y-1">
              {queue.map((track, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                  onDragEnd={() => {
                    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                      onReorderQueue?.(dragIndex, dragOverIndex);
                    }
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`flex items-center gap-3 group rounded-lg px-2 py-1.5 transition-all ${
                    dragIndex === i ? 'opacity-40' : ''
                  } ${dragOverIndex === i && dragIndex !== i ? 'border-t-2 border-indigo-400' : 'border-t-2 border-transparent'}`}
                >
                  <i className="fa-solid fa-grip-vertical text-white/15 text-xs cursor-grab active:cursor-grabbing flex-shrink-0"></i>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                    <ArtworkImage
                      fileId={track.artworkFileId}
                      fallbackUrl={track.artworkUrl}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full"
                      fallback={
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="fa-solid fa-music text-white/20 text-xs"></i>
                        </div>
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {track.submissionId ? (
                      <button
                        onClick={() => onNavigateToSong?.(track.submissionId!)}
                        className="text-white text-sm font-medium truncate block text-left hover:underline max-w-full"
                      >
                        {track.title}
                      </button>
                    ) : (
                      <p className="text-white text-sm font-medium truncate">{track.title}</p>
                    )}
                    <p className="text-white/40 text-xs truncate">{track.artist}</p>
                  </div>
                  <button
                    onClick={() => onRemoveFromQueue(i)}
                    className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <i className="fa-solid fa-xmark text-sm"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default NowPlayingOverlay;
