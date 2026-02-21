
import React, { useEffect, useRef, useState } from 'react';
import { ViewState } from '../types';
import ArtworkImage from './ArtworkImage';
import NowPlayingOverlay from './NowPlayingOverlay';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  isSyncing?: boolean;
  isLoggedIn?: boolean;
  isPlayerLoading?: boolean;
  userProfile?: { name?: string; email?: string; picture?: string; pictureOverrideUrl?: string } | null;
  player?: { src: string; title: string; artist: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string } | null;
  queue?: { src: string; title: string; artist: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string }[];
  onPlayNext?: () => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
  onNavigateToSong?: (submissionId: string) => void;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, isSyncing, isLoggedIn, isPlayerLoading, userProfile, player, queue = [], onPlayNext, onRemoveFromQueue, onReorderQueue, onNavigateToSong, onLogout }) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<number | null>(null);
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'prompts', label: 'Prompt Library', icon: 'fa-lightbulb' },
    { id: 'assignments', label: 'Assignments', icon: 'fa-tasks' },
    { id: 'submissions', label: 'Song Submissions', icon: 'fa-music' },
    { id: 'events', label: 'Events', icon: 'fa-calendar-days' },
    { id: 'campers', label: 'Campers', icon: 'fa-users' },
  ];

  const handleNavigate = (view: ViewState) => {
    onViewChange(view);
    setIsMobileNavOpen(false);
    setIsUserMenuOpen(false);
  };

  // Auto-open overlay when a track starts loading/playing
  useEffect(() => {
    if (player) {
      setShowNowPlaying(true);
    }
  }, [player?.title, player?.artist]);

  useEffect(() => {
    if (player?.src && audioRef.current) {
      audioRef.current.play().catch(() => undefined);
      setIsPlaying(true);
    }
  }, [player?.src]);

  useEffect(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    if (isSyncing) {
      setToastMessage('Cloud Sync in Progress');
      setShowToast(true);
    } else if (showToast) {
      setToastMessage('Changes Saved to Sheets');
      toastTimeoutRef.current = window.setTimeout(() => {
        setShowToast(false);
      }, 3000);
    }

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [isSyncing]);

  const sidebarContent = (
    <>
      <div className="p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span aria-hidden="true" className="text-2xl leading-none">🤘</span>
            <span className="sr-only">Koi Camp</span>
            <span>Koi Camp</span>
          </h1>
          <p className="text-indigo-300 text-[10px] mt-1 uppercase tracking-widest font-bold opacity-60">Toolkit v2.0</p>
        </div>
        <button
          onClick={() => setIsMobileNavOpen(false)}
          className="md:hidden text-indigo-200 hover:text-white"
          aria-label="Close navigation"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id as ViewState)}
            disabled={!isLoggedIn && item.id !== 'dashboard'}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeView === item.id 
                ? 'bg-indigo-700 text-white shadow-lg' 
                : 'text-indigo-100 hover:bg-indigo-800'
            } ${!isLoggedIn && item.id !== 'dashboard' ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <i className={`fa-solid ${item.icon} w-5`}></i>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 bg-indigo-950/50 mt-auto relative space-y-4">
        {player && (
          <div className="bg-indigo-950/70 border border-indigo-800 rounded-sm p-3 cursor-pointer hover:bg-indigo-950/90 transition-colors" onClick={() => setShowNowPlaying(true)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                <ArtworkImage
                  fileId={player.artworkFileId}
                  fallbackUrl={player.artworkUrl}
                  alt={`${player.title} artwork`}
                  className="w-full h-full object-cover"
                  containerClassName="w-full h-full"
                  fallback={<i className="fa-solid fa-compact-disc text-sm"></i>}
                />
              </div>
              <div className="flex-1 min-w-0">
                {player.submissionId ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigateToSong?.(player.submissionId!); setShowNowPlaying(false); }}
                    className="text-sm font-semibold text-white truncate block hover:underline text-left w-full"
                  >
                    {player.title}
                  </button>
                ) : (
                  <p className="text-sm font-semibold text-white truncate">{player.title}</p>
                )}
                <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold truncate">{player.artist}</p>
              </div>
              {isPlayerLoading ? (
                <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!audioRef.current) return;
                    if (audioRef.current.paused) {
                      audioRef.current.play().catch(() => undefined);
                      setIsPlaying(true);
                    } else {
                      audioRef.current.pause();
                      setIsPlaying(false);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center flex-shrink-0"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`}></i>
                </button>
              )}
            </div>
            {queue.length > 0 && (
              <p className="text-[10px] text-indigo-400 mt-2 pl-1">{queue.length} song{queue.length !== 1 ? 's' : ''} in queue</p>
            )}
            <audio
              ref={audioRef}
              src={player.src || undefined}
              className="hidden"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => { setIsPlaying(false); onPlayNext?.(); }}
            />
          </div>
        )}
        {isLoggedIn ? (
          <>
            <button
              onClick={() => setIsUserMenuOpen((open) => !open)}
              className="w-full flex items-center gap-3 text-left"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
            >
            {userProfile?.pictureOverrideUrl || userProfile?.picture ? (
              <ArtworkImage
                fileId={undefined}
                fallbackUrl={userProfile.pictureOverrideUrl || userProfile.picture}
                alt={userProfile.name || 'User profile'}
                className="w-10 h-10 rounded-full object-cover border border-white/30"
                fallback={
                  <div className="w-10 h-10 rounded-full bg-amber-400 text-indigo-900 flex items-center justify-center font-bold">
                    KC
                  </div>
                }
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-400 text-indigo-900 flex items-center justify-center font-bold">
                KC
              </div>
            )}
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-semibold truncate">{userProfile?.name || 'Camp Admin'}</p>
                <p className="text-[10px] text-indigo-400 font-bold uppercase flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}></span>
                  {isSyncing ? 'Syncing...' : 'Connected'}
                </p>
              </div>
              <i className={`fa-solid ${isUserMenuOpen ? 'fa-chevron-down' : 'fa-chevron-up'} text-indigo-200 text-xs`}></i>
            </button>
            {isUserMenuOpen && (
              <div className="absolute bottom-full mb-3 left-4 right-4 bg-indigo-950 border border-indigo-800 rounded-2xl shadow-xl overflow-hidden">
                <button
                  onClick={() => handleNavigate('settings')}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-indigo-100 hover:bg-indigo-900/60 flex items-center gap-3"
                >
                  <i className="fa-solid fa-gear"></i>
                  Settings
                </button>
                {isLoggedIn && (
                  <button
                    onClick={onLogout}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-rose-200 hover:bg-rose-500/10 flex items-center gap-3"
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket"></i>
                    Log out
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-2">
            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Offline Mode</p>
            <button className="text-xs bg-indigo-800 hover:bg-indigo-700 w-full py-2 rounded-lg font-bold transition-colors">
              Waiting for Auth
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-indigo-900 text-white flex flex-col hidden md:flex shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="relative z-10 w-72 bg-indigo-900 text-white flex flex-col h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
             <button
               className="md:hidden text-indigo-900 text-xl"
               onClick={() => setIsMobileNavOpen(true)}
               aria-label="Open navigation"
             >
               <i className="fa-solid fa-bars"></i>
             </button>
             <h2 className="text-lg font-semibold text-slate-800 capitalize">
               {activeView.split('-').join(' ')}
             </h2>
          </div>
          {player && (
            <button
              className="md:hidden text-indigo-900 text-lg w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center"
              onClick={() => setShowNowPlaying(true)}
              aria-label="Open player"
            >
              <i className={`fa-solid ${isPlaying ? 'fa-music' : 'fa-play'}`}></i>
            </button>
          )}
        </header>

        {showNowPlaying && player && (
          <NowPlayingOverlay
            player={player}
            queue={queue}
            audioRef={audioRef as React.RefObject<HTMLAudioElement>}
            isLoading={isPlayerLoading}
            onClose={() => setShowNowPlaying(false)}
            onPlayNext={() => onPlayNext?.()}
            onRemoveFromQueue={(i) => onRemoveFromQueue?.(i)}
            onReorderQueue={(from, to) => onReorderQueue?.(from, to)}
            onNavigateToSong={(id) => { onNavigateToSong?.(id); setShowNowPlaying(false); }}
          />
        )}

        <div className="p-8 overflow-auto flex-1">
          {children}
        </div>

        <footer className="border-t border-slate-200 bg-white px-4 md:px-8 py-3 text-[10px] text-slate-400">
          Build: {import.meta.env.VITE_BUILD_ID || 'dev'}
        </footer>
      </main>

      {isLoggedIn && showToast && (
        <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
          showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}>
          <div className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg border ${
            isSyncing
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <i className={`fa-solid ${isSyncing ? 'fa-arrows-rotate animate-spin' : 'fa-cloud-check'}`}></i>
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
