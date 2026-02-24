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
      className="fixed inset-0 z-[9999] bg-slate-100 flex flex-col animate-in slide-in-from-bottom duration-300"
      onClick={onClose}
    >
      {/* Full-bleed container */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0">
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
            <div className="flex flex-col items-center w-full max-w-sm md:max-w-none md:w-96 lg:w-[30rem] xl:w-[38rem] 2xl:w-[46rem] md:flex-shrink-0">
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
              </div>

              {isJukeboxMode && (
                <button
                  onClick={onStopJukebox}
                  className="mt-2 flex items-center gap-2 bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-amber-100 transition-colors"
                >
                  <i className="fa-solid fa-shuffle"></i>
                  Jukebox Mode
                  <i className="fa-solid fa-xmark ml-1"></i>
                </button>
              )}

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

            {/* Right: Queue — keep column mounted in jukebox mode to avoid layout shift */}
            {(queue.length > 0 || isJukeboxMode) && (
              <div className="w-full max-w-sm border-t border-slate-200 pt-4 mt-2 md:border-t-0 md:border-l md:pt-0 md:mt-0 md:pl-8 xl:pl-10 md:w-80 xl:w-96 md:max-w-none md:flex-shrink-0 md:max-h-[70vh] md:overflow-y-auto md:py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Up Next</p>
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
                          <p className="text-slate-500 text-xs truncate">{track.artist}</p>
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
