
import React, { useEffect, useRef, useState } from 'react';
import { ViewState, Notification } from '../types';
import NotificationPanel from './NotificationPanel';
import { getTerm } from '../utils';
import ArtworkImage from './ArtworkImage';
import NowPlayingOverlay from './NowPlayingOverlay';
import * as googleService from '../services/googleService';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  isSyncing?: boolean;
  isLoggedIn?: boolean;
  hasInitialData?: boolean;
  isPlayerLoading?: boolean;
  userProfile?: { name?: string; email?: string; picture?: string; pictureOverrideUrl?: string } | null;
  player?: { src: string; title: string; artist: string; camperId?: string; submissionId?: string; assignmentId?: string; assignmentTitle?: string; artworkFileId?: string; artworkUrl?: string } | null;
  queue?: { src: string; title: string; artist: string; camperId?: string; submissionId?: string; assignmentId?: string; assignmentTitle?: string; artworkFileId?: string; artworkUrl?: string }[];
  onPlayNext?: () => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
  onClearQueue?: () => void;
  onNavigateToSong?: (submissionId: string) => void;
  onNavigateToCamper?: (camperId: string) => void;
  onNavigateToAssignment?: (assignmentId: string) => void;
  isJukeboxMode?: boolean;
  onStopJukebox?: () => void;
  onLogout?: () => void;
  onStartJukebox?: () => void;
  currentTrackLyricsDocUrl?: string;
  currentTrackBocaCount?: number;
  isCurrentTrackFavorited?: boolean;
  onToggleFavorite?: (submissionId: string) => void;
  isPublicMode?: boolean;
  onSignIn?: () => void;
  themePreference?: 'light' | 'dark' | 'system';
  onThemeChange?: (value: 'light' | 'dark' | 'system') => void;
  notifications?: Notification[];
  unreadNotificationCount?: number;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onNotificationNavigate?: (view: ViewState, id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, isSyncing, isLoggedIn, hasInitialData, isPlayerLoading, userProfile, player, queue = [], onPlayNext, onRemoveFromQueue, onReorderQueue, onClearQueue, onNavigateToSong, onNavigateToCamper, onNavigateToAssignment, isJukeboxMode, onStopJukebox, onLogout, onStartJukebox, currentTrackLyricsDocUrl, currentTrackBocaCount, isCurrentTrackFavorited, onToggleFavorite, isPublicMode, onSignIn, themePreference, onThemeChange, notifications, unreadNotificationCount, onMarkNotificationRead, onMarkAllNotificationsRead, onNotificationNavigate }) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nowPlayingToast, setNowPlayingToast] = useState<{ title: string; artist: string } | null>(null);
  const nowPlayingToastRef = useRef<number | null>(null);
  const hadPlayerRef = useRef(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed)); } catch {}
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isNotificationPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(e.target as Node)) {
        setIsNotificationPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isNotificationPanelOpen]);

  const allMenuGroups = [
    { label: 'Activity', items: [
      { id: 'dashboard', label: 'Home', icon: 'fa-campground' },
      { id: 'inbox', label: 'Inbox', icon: 'fa-inbox' },
    ]},
    { label: 'Music', items: [
      { id: 'submissions', label: 'Songs', icon: 'fa-music' },
      { id: 'favorites', label: 'Favorites', icon: 'fa-heart' },
      { id: 'bocas', label: 'BOCAs', icon: 'fa-star' },
    ]},
    { label: 'Program', items: [
      { id: 'assignments', label: 'Assignments', icon: 'fa-tasks' },
      { id: 'prompts', label: 'Prompts', icon: 'fa-lightbulb' },
      { id: 'events', label: 'Events', icon: 'fa-calendar-days' },
      { id: 'semesters', label: 'Semesters', icon: 'fa-graduation-cap' },
    ]},
    { label: 'Community', items: [
      { id: 'campers', label: 'Campers', icon: 'fa-users' },
    ]},
  ];

  const PUBLIC_MENU_IDS = new Set(['submissions', 'assignments', 'semesters', 'campers', 'bocas']);
  const menuGroups = isPublicMode
    ? allMenuGroups.map(g => ({ ...g, items: g.items.filter(i => PUBLIC_MENU_IDS.has(i.id)) })).filter(g => g.items.length > 0)
    : allMenuGroups;

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
      hadPlayerRef.current = true;
      if (isJukeboxMode) {
        // Jukebox start — show toast + mini player, don't open full overlay
        setNowPlayingToast({ title: player.title, artist: player.artist });
        if (nowPlayingToastRef.current) clearTimeout(nowPlayingToastRef.current);
        nowPlayingToastRef.current = window.setTimeout(() => {
          setNowPlayingToast(null);
        }, 4000);
      } else {
        // Normal play — open the full overlay
        setShowNowPlaying(true);
      }
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
  const [mediaSessionArtwork, setMediaSessionArtwork] = useState<string | null>(null);

  useEffect(() => {
    if (!player?.artworkFileId) { setMediaSessionArtwork(null); return; }
    let cancelled = false;
    googleService.fetchDriveFile(player.artworkFileId)
      .then(blob => {
        if (cancelled) return;
        setMediaSessionArtwork(URL.createObjectURL(blob));
      })
      .catch(() => setMediaSessionArtwork(null));
    return () => { cancelled = true; };
  }, [player?.artworkFileId]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (player) {
      const artwork: MediaImage[] = [];
      if (mediaSessionArtwork) {
        artwork.push({ src: mediaSessionArtwork, sizes: '512x512', type: 'image/jpeg' });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: player.title,
        artist: player.artist,
        album: player.assignmentTitle || 'Camp',
        artwork,
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [player?.title, player?.artist, player?.assignmentTitle, mediaSessionArtwork]);

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
              <p className="text-indigo-300 text-[10px] mt-1 uppercase tracking-widest font-bold opacity-60">{getTerm(new Date().toISOString())}</p>
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
            <p className="text-indigo-300 text-[8px] uppercase tracking-widest font-bold opacity-60">
              {(() => { const t = getTerm(new Date().toISOString()); const [season, year] = t.split(' '); return `${season[0]}${year?.slice(-2)}`; })()}
            </p>
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
      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-4'} py-4`}>
        {menuGroups.map((group, gi) => (
          <div key={group.label}>
            {collapsed ? (
              gi > 0 && <div className="my-2 mx-2 border-t border-indigo-700/50"></div>
            ) : (
              <p className={`text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest px-4 ${gi === 0 ? 'mb-1' : 'mt-4 mb-1'}`}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id as ViewState)}
                  disabled={!isLoggedIn && !isPublicMode && item.id !== 'dashboard'}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl transition-all ${
                    activeView === item.id
                      ? 'bg-indigo-700 text-white shadow-lg'
                      : 'text-indigo-100 hover:bg-indigo-800'
                  } ${!isLoggedIn && !isPublicMode && item.id !== 'dashboard' ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom panel */}
      <div className={`${collapsed ? 'p-2' : 'p-4'} bg-indigo-950/50 mt-auto ${collapsed ? 'space-y-3 flex flex-col items-center' : 'space-y-4'}`}>
        {player ? (
          collapsed ? (
            <button
              onClick={() => { setShowNowPlaying(true); setIsMobileNavOpen(false); }}
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
            <div className={`rounded-xl p-3 cursor-pointer transition-colors group/mini ${isJukeboxMode ? 'bg-indigo-950/70 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]' : 'bg-indigo-950/70 border border-indigo-800 hover:border-indigo-600'}`} onClick={() => { setShowNowPlaying(true); setIsMobileNavOpen(false); }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                  <ArtworkImage
                    fileId={player.artworkFileId}
                    fallbackUrl={player.artworkUrl}
                    alt={`${player.title} artwork`}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full flex items-center justify-center"
                    fallback={<i className="fa-solid fa-compact-disc text-sm"></i>}
                  />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/mini:opacity-100 transition-opacity rounded-lg">
                    <i className="fa-solid fa-chevron-up text-white text-sm"></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (player.submissionId) { onNavigateToSong?.(player.submissionId); setIsMobileNavOpen(false); } }}
                    className="text-sm font-semibold text-white truncate block max-w-full text-left hover:text-indigo-300 hover:underline transition-colors"
                  >
                    {player.title}
                  </button>
                  <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold truncate">{player.artist}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                {!!currentTrackBocaCount && currentTrackBocaCount > 0 && (
                  <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>
                )}
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
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 hover:scale-110 text-white flex items-center justify-center transition-all"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`}></i>
                    </button>
                  )}
                  {queue.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPlayNext?.(); }}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 hover:scale-110 text-white flex items-center justify-center transition-all"
                      aria-label="Next track"
                    >
                      <i className="fa-solid fa-forward-step text-xs"></i>
                    </button>
                  )}
                </div>
              </div>
              {(queue.length > 0 || isJukeboxMode) && (
                <p className="text-[10px] text-indigo-400 mt-2 pl-1 flex items-center gap-1.5">
                  {isJukeboxMode && <i className="fa-solid fa-radio text-amber-400 text-[9px]"></i>}
                  {queue.length > 0 ? `${queue.length} song${queue.length !== 1 ? 's' : ''} in queue` : 'Camp Radio'}
                </p>
              )}
            </div>
          )
        ) : (isLoggedIn || isPublicMode) && onStartJukebox && (
          collapsed ? (
            <button
              onClick={onStartJukebox}
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white flex items-center justify-center transition-all shadow-lg shadow-amber-500/20"
              title="Start Jukebox"
            >
              <i className="fa-solid fa-radio text-sm"></i>
            </button>
          ) : (
            <button
              onClick={onStartJukebox}
              className="w-full flex items-center gap-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-3 hover:from-amber-500/30 hover:to-orange-500/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-radio text-sm"></i>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Camp Radio</p>
                <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold">Shuffle all songs</p>
              </div>
            </button>
          )
        )}
        {isLoggedIn ? (
          <div className="relative" ref={userMenuRef}>
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
              <div className={`absolute z-50 bg-indigo-950 border border-indigo-800 rounded-2xl shadow-xl overflow-hidden ${collapsed ? 'bottom-0 left-full ml-2 min-w-[160px]' : 'bottom-full mb-3 left-0 right-0'}`}>
                {onThemeChange && (
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-1 bg-white/20 rounded-full p-1">
                      {([
                        { mode: 'light' as const, icon: 'fa-sun', label: 'Light' },
                        { mode: 'dark' as const, icon: 'fa-moon', label: 'Dark' },
                        { mode: 'system' as const, icon: 'fa-desktop', label: 'System' },
                      ]).map(({ mode, icon, label }) => (
                        <button
                          key={mode}
                          onClick={(e) => { e.stopPropagation(); onThemeChange(mode); }}
                          className={`theme-picker-btn flex-1 h-8 rounded-full flex items-center justify-center transition-colors ${
                            themePreference === mode
                              ? 'bg-indigo-500 theme-picker-active'
                              : 'opacity-50 hover:opacity-100'
                          }`}
                          title={label}
                        >
                          <i className={`fa-solid ${icon} text-xs`}></i>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleNavigate('settings')}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-indigo-100 hover:bg-indigo-900/60 flex items-center gap-3"
                >
                  <i className="fa-solid fa-gear"></i>
                  Settings
                </button>
                <button
                  onClick={() => handleNavigate('changelog')}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-indigo-100 hover:bg-indigo-900/60 flex items-center gap-3"
                >
                  <i className="fa-solid fa-bolt"></i>
                  What's New
                </button>
                <button
                  onClick={() => handleNavigate('about')}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-indigo-100 hover:bg-indigo-900/60 flex items-center gap-3"
                >
                  <i className="fa-solid fa-circle-info"></i>
                  About Camp
                </button>
                <button
                  onClick={() => handleNavigate('feedback')}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-indigo-100 hover:bg-indigo-900/60 flex items-center gap-3"
                >
                  <i className="fa-solid fa-comment-dots"></i>
                  Feedback
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
          </div>
        ) : isPublicMode && onSignIn ? (
          collapsed ? (
            <button
              onClick={onSignIn}
              className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white flex items-center justify-center transition-colors"
              title="Sign in with Google"
            >
              <i className="fa-brands fa-google text-sm"></i>
            </button>
          ) : (
            <div className="text-center p-2 space-y-2">
              <p className="text-[10px] text-indigo-400 font-bold uppercase">Read-only mode</p>
              <button
                onClick={onSignIn}
                className="text-xs bg-white/10 hover:bg-white/20 w-full py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-brands fa-google"></i>
                Sign in with Google
              </button>
            </div>
          )
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
      <aside className={`camp-sidebar ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'} bg-indigo-900 text-white flex-col hidden md:flex shrink-0 h-screen sticky top-0 z-20 transition-[width] duration-200`}>
        {renderSidebarContent(isSidebarCollapsed)}
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="camp-sidebar relative z-10 w-full bg-indigo-900 text-white flex flex-col h-full shadow-2xl">
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
                 const labels: Record<string, string> = { dashboard: 'Home', prompts: 'Prompts', assignments: 'Assignments', submissions: 'Songs', events: 'Events', campers: 'Campers', inbox: 'Inbox', bocas: 'BOCAs', semesters: 'Semesters', settings: 'Settings', changelog: "What's New", about: 'About Camp', feedback: 'Feedback' };
                 return labels[activeView] || activeView.split('-').join(' ');
               })()}
             </h2>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn && !isPublicMode && (
              <div className="relative" ref={notificationPanelRef}>
                <button
                  onClick={() => setIsNotificationPanelOpen(prev => !prev)}
                  className="relative text-slate-500 hover:text-slate-700 text-sm w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                  aria-label="Notifications"
                >
                  <i className="fa-solid fa-bell"></i>
                  {(unreadNotificationCount ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {unreadNotificationCount! > 9 ? '9+' : unreadNotificationCount}
                    </span>
                  )}
                </button>

                {isNotificationPanelOpen && (
                  <NotificationPanel
                    notifications={notifications || []}
                    onMarkRead={(id) => { onMarkNotificationRead?.(id); }}
                    onMarkAllRead={() => { onMarkAllNotificationsRead?.(); }}
                    onNavigate={(view, id) => {
                      onNotificationNavigate?.(view, id);
                      setIsNotificationPanelOpen(false);
                    }}
                    onClose={() => setIsNotificationPanelOpen(false)}
                  />
                )}
              </div>
            )}
            {!player && (isLoggedIn || isPublicMode) && onStartJukebox && (
              <button
                className="md:hidden text-amber-600 text-sm w-9 h-9 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center hover:bg-amber-100 transition-colors"
                onClick={onStartJukebox}
                aria-label="Camp Radio"
              >
                <i className="fa-solid fa-radio"></i>
              </button>
            )}
            {player && (
              <button
                className="md:hidden text-indigo-900 text-lg w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center"
                onClick={() => setShowNowPlaying(true)}
                aria-label="Open player"
              >
                <i className={`fa-solid ${isPlaying ? 'fa-music' : 'fa-play'}`}></i>
              </button>
            )}
          </div>
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
            onClearQueue={() => onClearQueue?.()}
            onNavigateToSong={(id) => { onNavigateToSong?.(id); setShowNowPlaying(false); setIsMobileNavOpen(false); }}
            onNavigateToCamper={(id) => { onNavigateToCamper?.(id); setShowNowPlaying(false); setIsMobileNavOpen(false); }}
            onNavigateToAssignment={(id) => { onNavigateToAssignment?.(id); setShowNowPlaying(false); setIsMobileNavOpen(false); }}
            isJukeboxMode={isJukeboxMode}
            onStartJukebox={onStartJukebox}
            onStopJukebox={onStopJukebox}
            lyricsDocUrl={currentTrackLyricsDocUrl}
            bocaCount={currentTrackBocaCount}
            isFavorited={isCurrentTrackFavorited}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        <div className="p-5 md:p-6 overflow-auto flex-1">
          {isLoggedIn && !hasInitialData ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
              <i className="fa-solid fa-arrows-rotate animate-spin text-3xl text-indigo-400"></i>
              <p className="text-sm font-semibold">Loading your data...</p>
            </div>
          ) : (
            <div className="max-w-[1600px]">
              {children}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white px-4 md:px-6 py-2 text-[10px] text-slate-400">
          Build: {import.meta.env.VITE_BUILD_ID || 'dev'}
        </footer>
      </main>


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
