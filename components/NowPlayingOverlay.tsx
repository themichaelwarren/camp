import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import ArtworkImage from './ArtworkImage';

interface Track {
  src: string;
  title: string;
  artist: string;
  camperId?: string;
  submissionId?: string;
  assignmentTitle?: string;
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
  onClearQueue?: () => void;
  onNavigateToSong?: (submissionId: string) => void;
  onNavigateToCamper?: (camperId: string) => void;
  onNavigateToAssignment?: (assignmentId: string) => void;
  isJukeboxMode?: boolean;
  onStopJukebox?: () => void;
  bocaCount?: number;
  isFavorited?: boolean;
  onToggleFavorite?: (submissionId: string) => void;
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
  onClearQueue,
  onNavigateToSong,
  onNavigateToCamper,
  onNavigateToAssignment,
  isJukeboxMode,
  onStopJukebox,
  bocaCount,
  isFavorited,
  onToggleFavorite
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Prevent background page scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

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

  // Pull-down-to-dismiss gesture
  const dragStartY = useRef<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const isDragging = dragStartY.current !== null;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setDragOffsetY(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging downward
    setDragOffsetY(Math.max(0, delta));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragOffsetY > 120) {
      onClose();
    }
    dragStartY.current = null;
    setDragOffsetY(0);
  }, [dragOffsetY, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-slate-100 flex flex-col animate-in slide-in-from-bottom duration-300"
      style={{
        transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        opacity: dragOffsetY > 0 ? Math.max(0.3, 1 - dragOffsetY / 400) : 1,
        borderRadius: dragOffsetY > 0 ? `${Math.min(24, dragOffsetY / 5)}px ${Math.min(24, dragOffsetY / 5)}px 0 0` : undefined,
      }}
      onClick={onClose}
    >
      {/* Full-bleed container */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar — swipe-down handle on mobile */}
        <div
          className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile pull-down indicator */}
          <div className="md:hidden flex-1 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
          <div className="hidden md:block flex-1" />
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-300 hover:bg-slate-400 flex items-center justify-center text-slate-600 hover:text-slate-800 active:scale-95 transition-all flex-shrink-0"
          >
            <i className="fa-solid fa-chevron-down text-base"></i>
          </button>
        </div>

        {/* Content area — stacked on mobile, side-by-side & vertically centered on desktop */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden md:flex md:items-center md:justify-center">
          <div className="flex flex-col items-center px-6 pb-6 md:flex-row md:items-start md:gap-12 xl:gap-16 md:px-10 xl:px-16 md:pb-0">
            {/* Left: Player controls */}
            <div className="flex flex-col items-center w-full max-w-sm md:max-w-none md:w-96 lg:w-[26rem] xl:w-[32rem] 2xl:w-[40rem] md:flex-shrink-0">
              {/* Artwork */}
              <div className="w-full mt-2 md:mt-0">
                <div className="aspect-square w-full rounded-2xl xl:rounded-3xl overflow-hidden bg-slate-200 shadow-xl relative">
                  <ArtworkImage
                    fileId={player.artworkFileId}
                    fallbackUrl={player.artworkUrl}
                    alt={player.title}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <i className="fa-solid fa-compact-disc text-6xl xl:text-7xl text-slate-400 animate-spin" style={{ animationDuration: '3s' }}></i>
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
              <div className="w-full mt-5 xl:mt-6 text-center">
                {player.submissionId ? (
                  <button
                    onClick={() => onNavigateToSong?.(player.submissionId!)}
                    className="text-slate-800 font-bold text-xl xl:text-2xl truncate block mx-auto hover:underline max-w-full"
                  >
                    {player.title}
                  </button>
                ) : (
                  <h3 className="text-slate-800 font-bold text-xl xl:text-2xl truncate">{player.title}</h3>
                )}
                {player.camperId ? (
                  <button
                    onClick={() => onNavigateToCamper?.(player.camperId!)}
                    className="text-slate-500 text-sm xl:text-base font-medium truncate block mx-auto hover:text-indigo-600 hover:underline max-w-full mt-0.5"
                  >
                    {player.artist}
                  </button>
                ) : (
                  <p className="text-slate-500 text-sm xl:text-base font-medium truncate mt-0.5">{player.artist}</p>
                )}
                {player.assignmentTitle && (
                  player.assignmentId ? (
                    <button
                      onClick={() => onNavigateToAssignment?.(player.assignmentId!)}
                      className="text-slate-400 text-xs xl:text-sm truncate block mx-auto hover:text-indigo-600 hover:underline max-w-full mt-0.5"
                    >
                      {player.assignmentTitle}
                    </button>
                  ) : (
                    <p className="text-slate-400 text-xs xl:text-sm truncate mt-0.5">{player.assignmentTitle}</p>
                  )
                )}
                {/* Action row — BOCA, heart, queue toggle, jukebox — all inline */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  {!!bocaCount && bocaCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: bocaCount }, (_, i) => (
                        <i key={i} className="fa-solid fa-star text-sm"></i>
                      ))}
                    </span>
                  )}
                  {onToggleFavorite && player.submissionId && (
                    <button
                      onClick={() => onToggleFavorite(player.submissionId!)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isFavorited
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-slate-300 hover:text-red-400 hover:bg-red-50'
                      }`}
                      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-base`}></i>
                    </button>
                  )}
                  <button
                    onClick={() => setShowQueue(prev => !prev)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      showQueue
                        ? 'text-indigo-600 hover:bg-indigo-50'
                        : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                    }`}
                    title={showQueue ? 'Hide queue' : 'Show queue'}
                  >
                    <i className="fa-solid fa-list text-sm"></i>
                  </button>
                  {isJukeboxMode && (
                    <button
                      onClick={onStopJukebox}
                      className="flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] font-bold hover:bg-amber-100 transition-colors"
                    >
                      <i className="fa-solid fa-shuffle text-[10px]"></i>
                      Jukebox
                      <i className="fa-solid fa-xmark text-[9px]"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Seek Bar */}
              <div className="w-full mt-4 xl:mt-5">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 appearance-none bg-slate-200 rounded-full cursor-pointer accent-indigo-600"
                  style={{
                    background: `linear-gradient(to right, var(--np-accent) ${seekPercent}%, var(--np-track) ${seekPercent}%)`
                  }}
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Transport Controls */}
              <div className="flex items-center justify-center gap-6 xl:gap-8 py-3 w-full">
                <button
                  className="w-11 h-11 xl:w-12 xl:h-12 rounded-full flex items-center justify-center text-slate-300 cursor-not-allowed"
                  disabled
                >
                  <i className="fa-solid fa-backward-step text-xl"></i>
                </button>
                <button
                  onClick={togglePlayPause}
                  disabled={isLoading}
                  className={`w-16 h-16 xl:w-20 xl:h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg ${isLoading ? 'opacity-50' : 'hover:bg-indigo-700 hover:scale-105 active:scale-95'} transition-all`}
                >
                  <i className={`fa-solid ${isLoading ? 'fa-spinner fa-spin' : isPlaying ? 'fa-pause' : 'fa-play ml-1'} text-2xl xl:text-3xl`}></i>
                </button>
                <button
                  onClick={onPlayNext}
                  className={`w-11 h-11 xl:w-12 xl:h-12 rounded-full flex items-center justify-center transition-all ${queue.length > 0 ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200 active:scale-95' : 'text-slate-300 cursor-not-allowed'}`}
                  disabled={queue.length === 0}
                >
                  <i className="fa-solid fa-forward-step text-xl"></i>
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3 w-full pb-2">
                <i className="fa-solid fa-volume-low text-slate-400 text-xs"></i>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="flex-1 h-1 appearance-none bg-slate-200 rounded-full cursor-pointer accent-indigo-600"
                  style={{
                    background: `linear-gradient(to right, var(--np-accent) ${volume * 100}%, var(--np-track) ${volume * 100}%)`
                  }}
                />
                <i className="fa-solid fa-volume-high text-slate-400 text-xs"></i>
              </div>
            </div>

            {/* Right: Queue — toggleable, keep column mounted in jukebox mode to avoid layout shift */}
            {showQueue && (queue.length > 0 || isJukeboxMode) && (
              <div className="w-full max-w-sm border-t border-slate-200 pt-4 mt-2 md:border-t-0 md:border-l md:pt-0 md:mt-0 md:pl-8 xl:pl-10 md:w-80 xl:w-96 md:max-w-none md:flex-shrink-0 md:max-h-[70vh] md:overflow-y-auto md:py-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Up Next</p>
                  {queue.length > 0 && onClearQueue && (
                    <button
                      onClick={onClearQueue}
                      className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {queue.length > 0 ? (
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
                        <i className="fa-solid fa-grip-vertical text-slate-300 text-xs cursor-grab active:cursor-grabbing flex-shrink-0"></i>
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                          <ArtworkImage
                            fileId={track.artworkFileId}
                            fallbackUrl={track.artworkUrl}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            containerClassName="w-full h-full"
                            fallback={
                              <div className="w-full h-full flex items-center justify-center">
                                <i className="fa-solid fa-music text-slate-300 text-xs"></i>
                              </div>
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          {track.submissionId ? (
                            <button
                              onClick={() => onNavigateToSong?.(track.submissionId!)}
                              className="text-slate-800 text-sm font-medium truncate block text-left hover:underline max-w-full"
                            >
                              {track.title}
                            </button>
                          ) : (
                            <p className="text-slate-800 text-sm font-medium truncate">{track.title}</p>
                          )}
                          <p className="text-slate-500 text-xs truncate">{track.artist}{track.assignmentTitle ? ` · ${track.assignmentTitle}` : ''}</p>
                        </div>
                        <button
                          onClick={() => onRemoveFromQueue(i)}
                          className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm py-4">Loading next song...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NowPlayingOverlay;
