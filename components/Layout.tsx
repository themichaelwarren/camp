
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
  player?: { src: string; title: string; artist: string; camperId?: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string } | null;
  queue?: { src: string; title: string; artist: string; camperId?: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string }[];
  onPlayNext?: () => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
  onNavigateToSong?: (submissionId: string) => void;
  onNavigateToCamper?: (camperId: string) => void;
  isJukeboxMode?: boolean;
  onStopJukebox?: () => void;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, isSyncing, isLoggedIn, isPlayerLoading, userProfile, player, queue = [], onPlayNext, onRemoveFromQueue, onReorderQueue, onNavigateToSong, onNavigateToCamper, isJukeboxMode, onStopJukebox, onLogout }) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<number | null>(null);
  const [nowPlayingToast, setNowPlayingToast] = useState<{ title: string; artist: string } | null>(null);
  const nowPlayingToastRef = useRef<number | null>(null);
  const hadPlayerRef = useRef(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed)); } catch {}
  }, [isSidebarCollapsed]);

  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: 'fa-campground' },
    { id: 'inbox', label: 'Inbox', icon: 'fa-inbox' },
    { id: 'prompts', label: 'Prompts', icon: 'fa-lightbulb' },
    { id: 'assignments', label: 'Assignments', icon: 'fa-tasks' },
    { id: 'submissions', label: 'Songs', icon: 'fa-music' },
    { id: 'events', label: 'Events', icon: 'fa-calendar-days' },
    { id: 'campers', label: 'Campers', icon: 'fa-users' },
    { id: 'bocas', label: 'BOCAs', icon: 'fa-star' },
  ];

  const handleNavigate = (view: ViewState) => {
    onViewChange(view);
    setIsMobileNavOpen(false);
    setIsUserMenuOpen(false);
  };

  // Auto-open overlay on first play; show toast for subsequent song changes
  useEffect(() => {
    if (!player) {
      hadPlayerRef.current = false;
      return;
    }

    if (!hadPlayerRef.current) {
      // First play action — open the full overlay
      hadPlayerRef.current = true;
      setShowNowPlaying(true);
      return;
    }

    // Song changed (queue advance, jukebox, play-all, etc.)
    // If overlay is already open, it updates naturally — do nothing
    if (showNowPlaying) return;

    // Overlay is closed — show a non-intrusive toast
    setNowPlayingToast({ title: player.title, artist: player.artist });
    if (nowPlayingToastRef.current) clearTimeout(nowPlayingToastRef.current);
    nowPlayingToastRef.current = window.setTimeout(() => {
      setNowPlayingToast(null);
    }, 4000);
  }, [player?.title, player?.artist]);

  useEffect(() => {
    if (player?.src && audioRef.current) {
      audioRef.current.play().catch(() => undefined);
      setIsPlaying(true);
    }
  }, [player?.src]);

  // Media Session API — system media controls (lock screen, notification area, etc.)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (player) {
      const artwork: MediaImage[] = [];
      if (player.artworkFileId) {
        artwork.push({ src: `https://drive.google.com/thumbnail?id=${player.artworkFileId}&sz=w512`, sizes: '512x512', type: 'image/jpeg' });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: player.title,
        artist: player.artist,
        album: 'Camp',
        artwork,
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [player?.title, player?.artist, player?.artworkFileId]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;

    navigator.mediaSession.setActionHandler('play', () => { audio?.play().catch(() => undefined); });
    navigator.mediaSession.setActionHandler('pause', () => { audio?.pause(); });
    navigator.mediaSession.setActionHandler('nexttrack', queue.length > 0 || isJukeboxMode ? () => { onPlayNext?.(); } : null);
    navigator.mediaSession.setActionHandler('previoustrack', null);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [queue.length, isJukeboxMode, onPlayNext]);

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

  useEffect(() => {
    return () => {
      if (nowPlayingToastRef.current) clearTimeout(nowPlayingToastRef.current);
    };
  }, []);

  const renderSidebarContent = (collapsed: boolean) => (
    <>
      {/* Header */}
      <div className={`flex items-center ${collapsed ? 'flex-col gap-1 px-2 py-4' : 'justify-between p-6'}`}>
        {!collapsed ? (
          <>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span aria-hidden="true" className="text-2xl leading-none">⛺️</span>
                <span>Camp</span>
              </h1>
              <p className="text-indigo-300 text-[10px] mt-1 uppercase tracking-widest font-bold opacity-60">V2.0</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden md:flex w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 items-center justify-center text-indigo-200 hover:text-white transition-colors"
                aria-label="Collapse sidebar"
              >
                <i className="fa-solid fa-angles-left text-xs"></i>
              </button>
              <button
                onClick={() => setIsMobileNavOpen(false)}
                className="md:hidden text-indigo-200 hover:text-white"
                aria-label="Close navigation"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="text-xl leading-none">⛺️</span>
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-indigo-200 hover:text-white transition-colors"
              aria-label="Expand sidebar"
            >
              <i className="fa-solid fa-angles-right text-[10px]"></i>
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-4'} py-4 space-y-1`}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id as ViewState)}
            disabled={!isLoggedIn && item.id !== 'dashboard'}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${
              activeView === item.id
                ? 'bg-indigo-700 text-white shadow-lg'
                : 'text-indigo-100 hover:bg-indigo-800'
            } ${!isLoggedIn && item.id !== 'dashboard' ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom panel */}
      <div className={`${collapsed ? 'p-2' : 'p-4'} bg-indigo-950/50 mt-auto relative ${collapsed ? 'space-y-3 flex flex-col items-center' : 'space-y-4'}`}>
        {player && (
          collapsed ? (
            <button
              onClick={() => setShowNowPlaying(true)}
              className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
              title={`${player.title} — ${player.artist}`}
            >
              <ArtworkImage
                fileId={player.artworkFileId}
                fallbackUrl={player.artworkUrl}
                alt={`${player.title} artwork`}
                className="w-full h-full object-cover"
                containerClassName="w-full h-full flex items-center justify-center bg-indigo-100"
                fallback={<i className="fa-solid fa-compact-disc text-sm text-indigo-400"></i>}
              />
            </button>
          ) : (
            <div className="bg-indigo-950/70 border border-indigo-800 rounded-sm p-3 cursor-pointer hover:bg-indigo-950/90 transition-colors" onClick={() => setShowNowPlaying(true)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <ArtworkImage
                    fileId={player.artworkFileId}
                    fallbackUrl={player.artworkUrl}
                    alt={`${player.title} artwork`}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full flex items-center justify-center"
                    fallback={<i className="fa-solid fa-compact-disc text-sm"></i>}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{player.title}</p>
                  <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold truncate">{player.artist}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isPlayerLoading ? (
                    <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center">
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
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`}></i>
                    </button>
                  )}
                  {queue.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPlayNext?.(); }}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                      aria-label="Next track"
                    >
                      <i className="fa-solid fa-forward-step text-xs"></i>
                    </button>
                  )}
                </div>
              </div>
              {queue.length > 0 && (
                <p className="text-[10px] text-indigo-400 mt-2 pl-1">{queue.length} song{queue.length !== 1 ? 's' : ''} in queue</p>
              )}
            </div>
          )
        )}
        {isLoggedIn ? (
          <>
            <button
              onClick={() => setIsUserMenuOpen((open) => !open)}
              className={`${collapsed ? '' : 'w-full'} flex items-center ${collapsed ? 'justify-center' : 'gap-3 text-left'}`}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              title={collapsed ? (userProfile?.name || 'User menu') : undefined}
            >
            {userProfile?.pictureOverrideUrl || userProfile?.picture ? (
              <ArtworkImage
                fileId={undefined}
                fallbackUrl={userProfile.pictureOverrideUrl || userProfile.picture}
                alt={userProfile.name || 'User profile'}
                className={`${collapsed ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover border border-white/30`}
                fallback={
                  <div className={`${collapsed ? 'w-8 h-8 text-xs' : 'w-10 h-10'} rounded-full bg-amber-400 text-indigo-900 flex items-center justify-center font-bold`}>
                    KC
                  </div>
                }
              />
            ) : (
              <div className={`${collapsed ? 'w-8 h-8 text-xs' : 'w-10 h-10'} rounded-full bg-amber-400 text-indigo-900 flex items-center justify-center font-bold`}>
                KC
              </div>
            )}
              {!collapsed && (
                <>
                  <div className="overflow-hidden flex-1">
                    <p className="text-sm font-semibold truncate">{userProfile?.name || 'Camp Admin'}</p>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}></span>
                      {isSyncing ? 'Syncing...' : 'Connected'}
                    </p>
                  </div>
                  <i className={`fa-solid ${isUserMenuOpen ? 'fa-chevron-down' : 'fa-chevron-up'} text-indigo-200 text-xs`}></i>
                </>
              )}
            </button>
            {isUserMenuOpen && (
              <div className={`absolute z-50 bg-indigo-950 border border-indigo-800 rounded-2xl shadow-xl overflow-hidden ${collapsed ? 'bottom-0 left-full ml-2 min-w-[160px]' : 'bottom-full mb-3 left-4 right-4'}`}>
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
          !collapsed && (
            <div className="text-center p-2">
              <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Offline Mode</p>
              <button className="text-xs bg-indigo-800 hover:bg-indigo-700 w-full py-2 rounded-lg font-bold transition-colors">
                Waiting for Auth
              </button>
            </div>
          )
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`camp-sidebar ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'} bg-indigo-900 text-white flex-col hidden md:flex shrink-0 h-screen sticky top-0 transition-[width] duration-200`}>
        {renderSidebarContent(isSidebarCollapsed)}
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="camp-sidebar relative z-10 w-72 bg-indigo-900 text-white flex flex-col h-full shadow-2xl">
            {renderSidebarContent(false)}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
             <button
               className="md:hidden text-indigo-900 text-xl"
               onClick={() => setIsMobileNavOpen(true)}
               aria-label="Open navigation"
             >
               <i className="fa-solid fa-bars"></i>
             </button>
             <h2 className="text-lg font-semibold text-slate-800 capitalize">
               {(() => {
                 const labels: Record<string, string> = { dashboard: 'Home', prompts: 'Prompts', assignments: 'Assignments', submissions: 'Songs', events: 'Events', campers: 'Campers', inbox: 'Inbox', bocas: 'BOCAs', settings: 'Settings' };
                 return labels[activeView] || activeView.split('-').join(' ');
               })()}
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
            onNavigateToCamper={(id) => { onNavigateToCamper?.(id); setShowNowPlaying(false); }}
            isJukeboxMode={isJukeboxMode}
            onStopJukebox={onStopJukebox}
          />
        )}

        <div className="p-5 md:p-6 overflow-auto flex-1">
          {children}
        </div>

        <footer className="border-t border-slate-200 bg-white px-4 md:px-6 py-2 text-[10px] text-slate-400">
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

      {nowPlayingToast && (
        <button
          onClick={() => { setNowPlayingToast(null); setShowNowPlaying(true); }}
          className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom fade-in duration-300 max-w-xs"
        >
          <div className="flex items-center gap-3 bg-slate-900 text-white pl-3 pr-4 py-3 rounded-2xl shadow-2xl border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-music text-indigo-400 text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Now Playing</p>
              <p className="text-sm font-semibold truncate">{nowPlayingToast.title}</p>
              <p className="text-xs text-white/50 truncate">{nowPlayingToast.artist}</p>
            </div>
          </div>
        </button>
      )}

      {player && (
        <audio
          ref={audioRef}
          src={player.src || undefined}
          className="hidden"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); onPlayNext?.(); }}
        />
      )}
    </div>
  );
};

export default Layout;
