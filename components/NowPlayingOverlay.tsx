import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import ArtworkImage from './ArtworkImage';
import { buildPath } from '../router';
import { DocTextSegment } from '../types';
import { fetchDocContent, extractDocIdFromUrl } from '../services/googleService';

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
  onStartJukebox?: () => void;
  onStopJukebox?: () => void;
  lyricsDocUrl?: string;
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
  onStartJukebox,
  onStopJukebox,
  lyricsDocUrl,
  bocaCount,
  isFavorited,
  onToggleFavorite
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [sidePanel, setSidePanel] = useState<'queue' | 'lyrics'>('queue');
  const [lyrics, setLyrics] = useState<DocTextSegment[] | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [showCopied, setShowCopied] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.innerHeight < 480);
  const [isShort, setIsShort] = useState(() => window.innerHeight >= 480 && window.innerHeight < 700);

  useEffect(() => {
    const mqCompact = window.matchMedia('(max-height: 479px)');
    const mqShort = window.matchMedia('(min-height: 480px) and (max-height: 699px)');
    const handleCompact = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    const handleShort = (e: MediaQueryListEvent) => setIsShort(e.matches);
    mqCompact.addEventListener('change', handleCompact);
    mqShort.addEventListener('change', handleShort);
    return () => {
      mqCompact.removeEventListener('change', handleCompact);
      mqShort.removeEventListener('change', handleShort);
    };
  }, []);

  const handleShare = useCallback(() => {
    if (!player.submissionId) return;
    const path = buildPath('song-detail', player.submissionId, player.title);
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  }, [player.submissionId, player.title]);

  // Swipe-to-remove state for queue items (iOS-style reveal)
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeLocked = useRef(false); // locks to horizontal once direction is determined
  const [swipeOffsets, setSwipeOffsets] = useState<Record<number, number>>({});
  const [openSwipeIndex, setOpenSwipeIndex] = useState<number | null>(null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const SWIPE_SNAP = 72; // px to reveal delete button

  // Prevent background page scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!lyricsDocUrl) { setLyrics(null); return; }
    const docId = extractDocIdFromUrl(lyricsDocUrl);
    if (!docId) { setLyrics(null); return; }
    setLyricsLoading(true);
    fetchDocContent(docId)
      .then(setLyrics)
      .catch(() => setLyrics(null))
      .finally(() => setLyricsLoading(false));
  }, [lyricsDocUrl]);

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

  // Swipe-to-remove handlers (iOS-style snap-to-reveal)
  const handleSwipeStart = useCallback((e: React.TouchEvent, index: number) => {
    // Close any other open swipe first
    if (openSwipeIndex !== null && openSwipeIndex !== index) {
      setSwipeOffsets(prev => ({ ...prev, [openSwipeIndex]: 0 }));
      setOpenSwipeIndex(null);
    }
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeLocked.current = false;
    const startOffset = openSwipeIndex === index ? -SWIPE_SNAP : 0;
    setSwipeOffsets(prev => ({ ...prev, [index]: startOffset }));
  }, [openSwipeIndex, SWIPE_SNAP]);

  const handleSwipeMove = useCallback((e: React.TouchEvent, index: number) => {
    if (swipeStartX.current === null) return;
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = e.touches[0].clientY - (swipeStartY.current || 0);
    // Determine direction on first significant move
    if (!swipeLocked.current) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        // Vertical scroll — abort swipe
        swipeStartX.current = null;
        return;
      }
      if (Math.abs(dx) > 5) swipeLocked.current = true;
      else return;
    }
    e.preventDefault(); // prevent scroll while swiping horizontally
    const base = openSwipeIndex === index ? -SWIPE_SNAP : 0;
    const raw = base + dx;
    // Clamp: no right overshoot, max left = -SWIPE_SNAP * 1.3
    const clamped = Math.max(-SWIPE_SNAP * 1.3, Math.min(0, raw));
    setSwipeOffsets(prev => ({ ...prev, [index]: clamped }));
  }, [openSwipeIndex, SWIPE_SNAP]);

  const handleSwipeEnd = useCallback((index: number) => {
    const offset = swipeOffsets[index] || 0;
    if (offset < -SWIPE_SNAP * 0.4) {
      // Snap open — reveal delete button
      setSwipeOffsets(prev => ({ ...prev, [index]: -SWIPE_SNAP }));
      setOpenSwipeIndex(index);
    } else {
      // Snap closed
      setSwipeOffsets(prev => ({ ...prev, [index]: 0 }));
      setOpenSwipeIndex(prev => prev === index ? null : prev);
    }
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeLocked.current = false;
  }, [swipeOffsets, SWIPE_SNAP]);

  const handleSwipeDelete = useCallback((index: number) => {
    setRemovingIndex(index);
    setSwipeOffsets(prev => ({ ...prev, [index]: -500 }));
    setTimeout(() => {
      onRemoveFromQueue(index);
      setRemovingIndex(null);
      setOpenSwipeIndex(null);
      setSwipeOffsets(prev => { const next = { ...prev }; delete next[index]; return next; });
    }, 250);
  }, [onRemoveFromQueue]);

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
        className="flex-1 flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile-only pull-down handle */}
        {!isCompact && (
          <div
            className="md:hidden flex items-center justify-center px-6 pt-3 pb-1 flex-shrink-0 touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
        )}

        {/* Close button — absolute top-right, compact on short viewports */}
        {!isCompact && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-chevron-down text-sm"></i>
          </button>
        )}

        {/* Content area — compact horizontal when viewport is very short, normal otherwise */}
        <div className="flex-1 overflow-y-auto md:flex md:items-center md:justify-center">
          {isCompact ? (
            /* ===== COMPACT MINI PLAYER (short viewports / tiny Safari windows) ===== */
            <div className="flex flex-col h-full px-3 py-2">
              <div className="flex items-center gap-3">
                {/* Close */}
                <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 transition-all flex-shrink-0">
                  <i className="fa-solid fa-chevron-down text-xs"></i>
                </button>
                {/* Tiny artwork */}
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 shadow-sm">
                  <ArtworkImage
                    fileId={player.artworkFileId}
                    fallbackUrl={player.artworkUrl}
                    alt={player.title}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <i className="fa-solid fa-compact-disc text-lg text-slate-400 animate-spin" style={{ animationDuration: '3s' }}></i>
                      </div>
                    }
                    lazy={false}
                  />
                </div>
                {/* Track info */}
                <div className="flex-1 min-w-0">
                  {player.submissionId ? (
                    <button onClick={() => onNavigateToSong?.(player.submissionId!)} className="text-slate-800 font-bold text-sm truncate block hover:underline max-w-full">{player.title}</button>
                  ) : (
                    <p className="text-slate-800 font-bold text-sm truncate">{player.title}</p>
                  )}
                  <p className="text-slate-500 text-xs truncate">{player.artist}</p>
                </div>
                {/* Compact transport */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={togglePlayPause} disabled={isLoading} className={`w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm ${isLoading ? 'opacity-50' : 'hover:bg-indigo-700 active:scale-95'} transition-all`}>
                    <i className={`fa-solid ${isLoading ? 'fa-spinner fa-spin' : isPlaying ? 'fa-pause' : 'fa-play ml-0.5'} text-sm`}></i>
                  </button>
                  <button onClick={onPlayNext} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${queue.length > 0 ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400'}`} disabled={queue.length === 0}>
                    <i className="fa-solid fa-forward-step text-xs"></i>
                  </button>
                  {onToggleFavorite && player.submissionId && (
                    <button onClick={() => onToggleFavorite(player.submissionId!)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isFavorited ? 'text-red-500' : 'text-slate-300 hover:text-red-400'}`}>
                      <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
                    </button>
                  )}
                  <button onClick={isJukeboxMode ? onStopJukebox : onStartJukebox} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isJukeboxMode ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}`} title={isJukeboxMode ? 'Stop radio' : 'Start radio'}>
                    <i className="fa-solid fa-radio text-xs"></i>
                  </button>
                </div>
              </div>
              {/* Seek bar */}
              <div className="mt-1.5">
                <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={handleSeek} className="w-full h-1 appearance-none bg-slate-200 rounded-full cursor-pointer accent-indigo-600" style={{ background: `linear-gradient(to right, var(--np-accent) ${seekPercent}%, var(--np-track) ${seekPercent}%)` }} />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          ) : (
          /* ===== FULL PLAYER (normal viewports) ===== */
          <div className={`flex flex-col items-center px-6 pb-6 ${isShort ? 'h-full lg:flex-row lg:items-start lg:pb-0 lg:py-4 lg:gap-6 lg:px-6' : 'md:flex-row md:items-start md:pb-0 md:py-4 md:gap-12 xl:gap-16 md:px-10 xl:px-16'}`}>
            {/* Left: Player controls */}
            <div className={`flex items-center w-full ${isShort ? 'flex-row gap-5 max-w-none flex-shrink-0 lg:w-auto lg:flex-1' : 'flex-col max-w-sm md:flex-shrink-0 md:max-w-none md:w-96 lg:w-[26rem] xl:w-[32rem] 2xl:w-[40rem] min-[1800px]:w-[48rem] min-[2200px]:w-[56rem]'}`}>
              {/* Artwork — aspect-square with viewport-capped height */}
              <div className={isShort ? 'flex-shrink-0' : 'w-full mt-2 md:mt-0 flex justify-center'} style={isShort ? { width: 'min(35vh, 240px)' } : undefined}>
                <div className={`relative overflow-hidden bg-slate-200 shadow-xl aspect-square ${isShort ? 'rounded-xl w-full' : 'rounded-2xl xl:rounded-3xl max-h-[55vh] max-w-[55vh] w-full'}`}>
                  <ArtworkImage
                    fileId={player.artworkFileId}
                    fallbackUrl={player.artworkUrl}
                    alt={player.title}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <i className={`fa-solid fa-compact-disc text-slate-400 animate-spin ${isShort ? 'text-4xl' : 'text-6xl xl:text-7xl'}`} style={{ animationDuration: '3s' }}></i>
                      </div>
                    }
                    lazy={false}
                  />
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <i className={`fa-solid fa-spinner fa-spin text-white ${isShort ? 'text-xl' : 'text-3xl'}`}></i>
                        {!isShort && <p className="text-white/70 text-sm font-medium">Loading audio...</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Track Info + Controls */}
              <div className={isShort ? 'flex-1 min-w-0' : 'w-full'}>
                {/* Track Info */}
                <div className={isShort ? 'text-left' : 'w-full mt-5 xl:mt-6 text-center'}>
                  {player.submissionId ? (
                    <button
                      onClick={() => onNavigateToSong?.(player.submissionId!)}
                      className={`text-slate-800 font-bold truncate block hover:underline max-w-full ${isShort ? 'text-base' : 'text-xl xl:text-2xl mx-auto'}`}
                    >
                      {player.title}
                    </button>
                  ) : (
                    <h3 className={`text-slate-800 font-bold truncate ${isShort ? 'text-base' : 'text-xl xl:text-2xl'}`}>{player.title}</h3>
                  )}
                  {player.camperId ? (
                    <button
                      onClick={() => onNavigateToCamper?.(player.camperId!)}
                      className={`text-slate-500 font-medium truncate block hover:text-indigo-600 hover:underline max-w-full mt-0.5 ${isShort ? 'text-xs' : 'text-sm xl:text-base mx-auto'}`}
                    >
                      {player.artist}
                    </button>
                  ) : (
                    <p className={`text-slate-500 font-medium truncate mt-0.5 ${isShort ? 'text-xs' : 'text-sm xl:text-base'}`}>{player.artist}</p>
                  )}
                  {player.assignmentTitle && !isShort && (
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
                  {/* Action row — BOCA, heart, queue toggle, radio — all inline */}
                  <div className={`flex items-center gap-2 ${isShort ? 'mt-1.5' : 'justify-center gap-3 mt-3'}`}>
                    {!!bocaCount && bocaCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: bocaCount }, (_, i) => (
                          <i key={i} className={`fa-solid fa-star ${isShort ? 'text-xs' : 'text-sm'}`}></i>
                        ))}
                      </span>
                    )}
                    {onToggleFavorite && player.submissionId && (
                      <button
                        onClick={() => onToggleFavorite(player.submissionId!)}
                        className={`rounded-full flex items-center justify-center transition-all ${isShort ? 'w-7 h-7' : 'w-9 h-9'} ${
                          isFavorited
                            ? 'text-red-500 hover:bg-red-50'
                            : 'text-slate-300 hover:text-red-400 hover:bg-red-50'
                        }`}
                        title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart ${isShort ? 'text-xs' : 'text-base'}`}></i>
                      </button>
                    )}
                    {lyricsDocUrl && (
                      <button
                        onClick={() => { if (sidePanel === 'lyrics' && showQueue) { setShowQueue(false); } else { setSidePanel('lyrics'); setShowQueue(true); } }}
                        className={`rounded-full flex items-center justify-center transition-all ${isShort ? 'w-7 h-7' : 'w-9 h-9'} ${
                          showQueue && sidePanel === 'lyrics'
                            ? 'text-indigo-600 hover:bg-indigo-50'
                            : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                        }`}
                        title={showQueue && sidePanel === 'lyrics' ? 'Hide lyrics' : 'Show lyrics'}
                      >
                        <i className={`fa-solid fa-align-left ${isShort ? 'text-xs' : 'text-sm'}`}></i>
                      </button>
                    )}
                    <button
                      onClick={() => { if (sidePanel === 'queue' && showQueue) { setShowQueue(false); } else { setSidePanel('queue'); setShowQueue(true); } }}
                      className={`rounded-full flex items-center justify-center transition-all ${isShort ? 'w-7 h-7' : 'w-9 h-9'} ${
                        showQueue && sidePanel === 'queue'
                          ? 'text-indigo-600 hover:bg-indigo-50'
                          : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                      }`}
                      title={showQueue && sidePanel === 'queue' ? 'Hide queue' : 'Show queue'}
                    >
                      <i className={`fa-solid fa-list ${isShort ? 'text-xs' : 'text-sm'}`}></i>
                    </button>
                    <button
                      onClick={isJukeboxMode ? onStopJukebox : onStartJukebox}
                      className={`rounded-full flex items-center justify-center transition-all ${isShort ? 'w-7 h-7' : 'w-9 h-9'} ${
                        isJukeboxMode
                          ? 'text-amber-500 hover:bg-amber-50'
                          : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                      }`}
                      title={isJukeboxMode ? 'Stop radio' : 'Start radio'}
                    >
                      <i className={`fa-solid fa-radio ${isShort ? 'text-xs' : 'text-sm'}`}></i>
                    </button>
                    {player.submissionId && (
                      <button
                        onClick={handleShare}
                        className={`rounded-full flex items-center justify-center transition-all ${isShort ? 'w-7 h-7' : 'w-9 h-9'} ${
                          showCopied
                            ? 'text-green-500'
                            : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                        }`}
                        title={showCopied ? 'Link copied!' : 'Copy link to song'}
                      >
                        <i className={`fa-solid ${showCopied ? 'fa-check' : 'fa-share-from-square'} ${isShort ? 'text-xs' : 'text-sm'}`}></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Seek Bar */}
                <div className={`w-full ${isShort ? 'mt-2' : 'mt-4 xl:mt-5'}`}>
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
                  <div className={`flex justify-between text-slate-400 font-mono ${isShort ? 'text-[9px] mt-0.5' : 'text-[11px] mt-1'}`}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Transport Controls */}
                <div className={`flex items-center w-full ${isShort ? 'justify-start gap-3 py-1' : 'justify-center gap-6 xl:gap-8 py-3'}`}>
                  <button
                    className={`rounded-full flex items-center justify-center text-slate-400 cursor-not-allowed ${isShort ? 'w-8 h-8' : 'w-11 h-11 xl:w-12 xl:h-12'}`}
                    disabled
                  >
                    <i className={`fa-solid fa-backward-step ${isShort ? 'text-sm' : 'text-xl'}`}></i>
                  </button>
                  <button
                    onClick={togglePlayPause}
                    disabled={isLoading}
                    className={`rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg ${isLoading ? 'opacity-50' : 'hover:bg-indigo-700 hover:scale-105 active:scale-95'} transition-all ${isShort ? 'w-12 h-12' : 'w-16 h-16 xl:w-20 xl:h-20'}`}
                  >
                    <i className={`fa-solid ${isLoading ? 'fa-spinner fa-spin' : isPlaying ? 'fa-pause' : 'fa-play ml-0.5'} ${isShort ? 'text-lg' : 'text-2xl xl:text-3xl'}`}></i>
                  </button>
                  <button
                    onClick={onPlayNext}
                    className={`rounded-full flex items-center justify-center transition-all ${isShort ? 'w-8 h-8' : 'w-11 h-11 xl:w-12 xl:h-12'} ${queue.length > 0 ? 'text-slate-600 hover:text-slate-800 hover:bg-slate-200 active:scale-95' : 'text-slate-400 cursor-not-allowed'}`}
                    disabled={queue.length === 0}
                  >
                    <i className={`fa-solid fa-forward-step ${isShort ? 'text-sm' : 'text-xl'}`}></i>
                  </button>
                </div>

                {/* Volume — hidden on mobile and short viewports */}
                {!isShort && (
                  isMobile ? (
                    <p className="text-[10px] text-slate-400 text-center pb-2">
                      <i className="fa-solid fa-volume-high mr-1"></i>
                      Use device volume buttons
                    </p>
                  ) : (
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
                  )
                )}
              </div>
            </div>

            {/* Right: Side panel (Queue or Lyrics) */}
            {showQueue && (sidePanel === 'lyrics' ? !!lyricsDocUrl : (queue.length > 0 || isJukeboxMode)) && (
              <div className={`w-full border-t border-slate-200 pt-3 mt-2 ${isShort ? 'flex-1 min-h-0 overflow-y-auto lg:overflow-y-visible lg:border-t-0 lg:border-l lg:pt-0 lg:mt-0 lg:max-w-none lg:flex-shrink-0 lg:flex lg:flex-col lg:py-2 lg:pl-5 lg:w-56 lg:max-h-[90vh]' : 'md:border-t-0 md:border-l md:pt-0 md:mt-0 md:max-w-none md:flex-shrink-0 md:flex md:flex-col md:py-2 max-w-sm md:pl-8 xl:pl-10 md:w-96 xl:w-[28rem] 2xl:w-[32rem] md:max-h-[85vh]'}`}>
              {sidePanel === 'lyrics' ? (
                <>
                  <div className="flex items-center justify-between mb-3 flex-shrink-0 pr-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lyrics</p>
                  </div>
                  <div className="md:overflow-y-auto md:min-h-0 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                    {lyricsLoading ? (
                      <div className="flex items-center justify-center py-8 text-slate-400">
                        <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                      </div>
                    ) : lyrics && lyrics.length > 0 ? (
                      <div className="text-sm text-slate-700 leading-relaxed font-serif">
                        {lyrics.map((seg, i) =>
                          seg.text === '\n' ? <br key={i} /> :
                          seg.bold && seg.italic ? <strong key={i}><em>{seg.text}</em></strong> :
                          seg.bold ? <strong key={i}>{seg.text}</strong> :
                          seg.italic ? <em key={i}>{seg.text}</em> :
                          <span key={i}>{seg.text}</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm italic py-4">No lyrics available.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                <div className="flex items-center justify-between mb-3 flex-shrink-0 pr-1">
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
                  <div className="space-y-1 md:overflow-y-auto md:min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                    {queue.map((track, i) => (
                      <div key={i} className="relative overflow-hidden rounded-lg">
                        {/* Red delete zone revealed behind the item */}
                        {isMobile && (
                          <button
                            onClick={() => handleSwipeDelete(i)}
                            className="absolute inset-y-0 right-0 w-[72px] bg-red-500 flex items-center justify-center text-white"
                          >
                            <i className="fa-solid fa-trash text-sm"></i>
                          </button>
                        )}
                      <div
                        draggable={!isMobile}
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                        onDragEnd={() => {
                          if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                            onReorderQueue?.(dragIndex, dragOverIndex);
                          }
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onTouchStart={(e) => handleSwipeStart(e, i)}
                        onTouchMove={(e) => handleSwipeMove(e, i)}
                        onTouchEnd={() => handleSwipeEnd(i)}
                        className={`relative flex items-center group rounded-lg bg-slate-100 hover:bg-slate-200/50 ${isShort ? 'gap-2 px-1.5 py-1' : 'gap-3 px-2 py-1.5'} ${
                          dragIndex === i ? 'opacity-40' : ''
                        } ${dragOverIndex === i && dragIndex !== i ? 'border-t-2 border-indigo-400' : 'border-t-2 border-transparent'}`}
                        style={{
                          transform: `translateX(${swipeOffsets[i] || 0}px)`,
                          transition: swipeStartX.current !== null ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          ...(removingIndex === i ? { transform: 'translateX(-110%)', transition: 'transform 0.25s ease-in' } : {})
                        }}
                      >
                        {!isMobile && !isShort && <i className="fa-solid fa-grip-vertical text-slate-300 text-xs cursor-grab active:cursor-grabbing flex-shrink-0"></i>}
                        <div className={`rounded-lg overflow-hidden bg-slate-200 flex-shrink-0 ${isShort ? 'w-7 h-7' : 'w-10 h-10'}`}>
                          <ArtworkImage
                            fileId={track.artworkFileId}
                            fallbackUrl={track.artworkUrl}
                            alt={track.title}
                            className="w-full h-full object-cover"
                            containerClassName="w-full h-full"
                            fallback={
                              <div className="w-full h-full flex items-center justify-center">
                                <i className={`fa-solid fa-music text-slate-300 ${isShort ? 'text-[8px]' : 'text-xs'}`}></i>
                              </div>
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          {track.submissionId ? (
                            <button
                              onClick={() => onNavigateToSong?.(track.submissionId!)}
                              className={`text-slate-800 font-medium truncate block text-left hover:underline max-w-full ${isShort ? 'text-xs' : 'text-sm'}`}
                            >
                              {track.title}
                            </button>
                          ) : (
                            <p className={`text-slate-800 font-medium truncate ${isShort ? 'text-xs' : 'text-sm'}`}>{track.title}</p>
                          )}
                          <p className={`text-slate-500 truncate ${isShort ? 'text-[10px]' : 'text-xs'}`}>{track.artist}{track.assignmentTitle ? ` · ${track.assignmentTitle}` : ''}</p>
                        </div>
                        {!isMobile && (
                          <button
                            onClick={() => onRemoveFromQueue(i)}
                            className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <i className="fa-solid fa-xmark text-sm"></i>
                          </button>
                        )}
                      </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm py-4">Loading next song...</p>
                )}
                </>
              )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NowPlayingOverlay;
