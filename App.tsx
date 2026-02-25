import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Prompt, Assignment, Submission, ViewState, PromptStatus, CamperProfile, Event, PlayableTrack, Boca, StatusUpdate, Comment, Collaboration, CollaboratorRole } from './types';
import { buildPath, parsePath, parseHash, resolveShortId, getDefaultPageMeta, updateMetaTags, PageMeta } from './router';
import { DateFormat } from './utils';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import PromptsPage from './views/PromptsPage';
import AssignmentsPage from './views/AssignmentsPage';
import SubmissionsPage from './views/SubmissionsPage';
import EventsPage from './views/EventsPage';
import PromptDetail from './views/PromptDetail';
import AssignmentDetail from './views/AssignmentDetail';
import SongDetail from './views/SongDetail';
import SettingsPage from './views/SettingsPage';
import CampersPage from './views/CampersPage';
import CamperDetail from './views/CamperDetail';
import InboxPage from './views/InboxPage';
import BOCAsPage from './views/BOCAsPage';
import FavoritesPage from './views/FavoritesPage';
import SemestersPage from './views/SemestersPage';
import SemesterDetail from './views/SemesterDetail';
import * as googleService from './services/googleService';
import { getTerm, getTermSortKey, getDisplayArtist } from './utils';

const CAMP_QUOTES = [
  'Raise a flag, grab your sleeping bag, every song lights a lamp, at camp sweet camp',
  "I've folded my sorrows, makes sense I've been long in that rut",
  "Bury all the memories with your mother's shovel, do a couple pushups and build up those chest muscles",
  'Two pieces white bread, horseradish mustard',
];

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ id?: string; name?: string; email?: string; picture?: string; location?: string; status?: string; pictureOverrideUrl?: string } | null>(null);
  const [campers, setCampers] = useState<CamperProfile[]>([]);
  const [upvotedPromptIds, setUpvotedPromptIds] = useState<string[]>([]);
  const [favoritedSubmissionIds, setFavoritedSubmissionIds] = useState<string[]>([]);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [bocas, setBocas] = useState<Boca[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [promptsSearch, setPromptsSearch] = useState('');
  const [promptsStatusFilter, setPromptsStatusFilter] = useState<'all' | PromptStatus>('all');
  const [promptsSortBy, setPromptsSortBy] = useState<'newest' | 'oldest' | 'upvotes' | 'title'>('newest');
  const [promptsViewMode, setPromptsViewMode] = useState<'cards' | 'list'>('list');
  const [assignmentsViewMode, setAssignmentsViewMode] = useState<'list' | 'cards'>('list');
  const [assignmentsSearch, setAssignmentsSearch] = useState('');
  const [assignmentsStatusFilter, setAssignmentsStatusFilter] = useState<'all' | 'Open' | 'Closed'>('all');
  const [assignmentsPromptFilter, setAssignmentsPromptFilter] = useState('all');
  const [assignmentsSortBy, setAssignmentsSortBy] = useState<'title-asc' | 'title-desc' | 'due-asc' | 'due-desc' | 'start-asc' | 'start-desc' | 'prompt-asc' | 'prompt-desc' | 'semester-desc' | 'semester-asc'>('due-asc');
  const [assignmentsSemesterFilter, setAssignmentsSemesterFilter] = useState('all');
  const [submissionsViewMode, setSubmissionsViewMode] = useState<'cards' | 'list'>('list');
  const [submissionsGridSize, setSubmissionsGridSize] = useState<3 | 4 | 5>(() => {
    const stored = window.localStorage.getItem('camp-songs-grid');
    if (stored === '3' || stored === '4' || stored === '5') return Number(stored) as 3 | 4 | 5;
    return 3;
  });
  const [submissionsSearch, setSubmissionsSearch] = useState('');
  const [submissionsAssignmentFilter, setSubmissionsAssignmentFilter] = useState('all');
  const [submissionsPromptFilter, setSubmissionsPromptFilter] = useState('all');
  const [submissionsSortBy, setSubmissionsSortBy] = useState<'date-desc' | 'date-asc' | 'title-asc' | 'title-desc' | 'assignment-asc' | 'assignment-desc' | 'prompt-asc' | 'prompt-desc' | 'semester-desc' | 'semester-asc'>('date-desc');
  const [submissionsSemesterFilter, setSubmissionsSemesterFilter] = useState('all');
  const [campersViewMode, setCampersViewMode] = useState<'list' | 'cards'>('list');
  const [camperDetailSongsView, setCamperDetailSongsView] = useState<'cards' | 'list'>('list');
  const [camperDetailSearch, setCamperDetailSearch] = useState('');
  const [camperDetailSelectedTags, setCamperDetailSelectedTags] = useState<string[]>([]);
  const [bocasViewMode, setBocasViewMode] = useState<'cards' | 'list'>('cards');
  const [bocasSearch, setBocasSearch] = useState('');
  const [semestersViewMode, setSemestersViewMode] = useState<'cards' | 'list'>('list');
  const [eventsViewMode, setEventsViewMode] = useState<'cards' | 'list'>('list');
  const [bocasSortBy, setBocasSortBy] = useState<'count-desc' | 'count-asc' | 'title-asc' | 'title-desc' | 'artist-asc' | 'artist-desc' | 'recent'>('count-desc');
  const [player, setPlayer] = useState<{
    src: string;
    title: string;
    artist: string;
    camperId?: string;
    submissionId?: string;
    assignmentId?: string;
    assignmentTitle?: string;
    artworkFileId?: string;
    artworkUrl?: string;
  } | null>(null);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [queueingTrackId, setQueueingTrackId] = useState<string | null>(null);
  const [queue, setQueue] = useState<{
    src: string;
    title: string;
    artist: string;
    camperId?: string;
    submissionId?: string;
    assignmentId?: string;
    assignmentTitle?: string;
    artworkFileId?: string;
    artworkUrl?: string;
  }[]>([]);
  const [rememberMe, setRememberMe] = useState(() => window.localStorage.getItem('camp-remember') !== '0');
  const visualTheme = 'modern';
  const previousAudioUrl = useRef<string | null>(null);
  const [isJukeboxMode, setIsJukeboxMode] = useState(false);
  const isJukeboxModeRef = useRef(false);
  const jukeboxPoolRef = useRef<PlayableTrack[]>([]);
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = window.localStorage.getItem('camp-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });
  const [dateFormat, setDateFormat] = useState<DateFormat>(() => {
    const stored = window.localStorage.getItem('camp-date-format');
    if (stored === 'yyyy-mm-dd' || stored === 'mm/dd/yyyy' || stored === 'dd/mm/yyyy' || stored === 'short' || stored === 'system') {
      return stored as DateFormat;
    }
    return 'system';
  });

  useEffect(() => {
    const init = () => {
      googleService.initGoogleAuth(() => {
        setIsLoggedIn(true);
        googleService.fetchUserProfile()
          .then((profile) => {
            const normalized = {
              id: profile.sub || profile.id,
              name: profile.name,
              email: profile.email,
              picture: profile.picture
            };
            setUserProfile(normalized);
            window.localStorage.setItem('camp-auth', '1');
            if (normalized.email) {
              window.localStorage.setItem('camp-last-email', normalized.email);
            }
            handleInitialSync(normalized);
          })
          .catch((err) => {
            console.error('Failed to fetch user profile', err);
            handleInitialSync(null);
          });
      });
      if (window.localStorage.getItem('camp-auth') === '1') {
        const hint = window.localStorage.getItem('camp-last-email') || undefined;
        googleService.trySilentSignIn(hint);
      }
    };

    let retries = 0;
    const checkGoogle = setInterval(() => {
      // @ts-ignore
      if (typeof google !== 'undefined') {
        clearInterval(checkGoogle);
        init();
      } else if (retries > 20) {
        clearInterval(checkGoogle);
        console.error('Google GSI script failed to load.');
      }
      retries++;
    }, 500);

    return () => clearInterval(checkGoogle);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = themePreference === 'system' ? (media.matches ? 'dark' : 'light') : themePreference;
      root.dataset.theme = resolved;
    };

    applyTheme();
    if (themePreference === 'system') {
      const handler = () => applyTheme();
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
  }, [themePreference]);

  useEffect(() => {
    window.localStorage.setItem('camp-theme', themePreference);
  }, [themePreference]);

  useEffect(() => {
    window.localStorage.setItem('camp-date-format', dateFormat);
  }, [dateFormat]);

  useEffect(() => {
    window.localStorage.setItem('camp-songs-grid', String(submissionsGridSize));
  }, [submissionsGridSize]);

  useEffect(() => {
    window.localStorage.setItem('camp-remember', rememberMe ? '1' : '0');
  }, [rememberMe]);

  useEffect(() => {
    document.documentElement.dataset.skin = visualTheme;
  }, [visualTheme]);

  useEffect(() => {
    return () => {
      if (previousAudioUrl.current) {
        URL.revokeObjectURL(previousAudioUrl.current);
      }
    };
  }, []);

  // Polling effect: refresh data every 10 seconds
  useEffect(() => {
    if (!isLoggedIn || !spreadsheetId) return;

    const POLL_INTERVAL = 30000; // 30 seconds
    let intervalId: NodeJS.Timeout | null = null;
    let isPageVisible = !document.hidden;

    const startPolling = () => {
      if (intervalId) return; // Already polling
      intervalId = setInterval(() => {
        if (isPageVisible) {
          syncData();
        }
      }, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) {
        // Page became visible - sync immediately and resume polling
        syncData();
        startPolling();
      } else {
        // Page hidden - stop polling to save quota
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, spreadsheetId, userProfile?.email]);

  const handleInitialSync = async (profile: { id?: string; name?: string; email?: string; picture?: string } | null) => {
    setIsSyncing(true);
    try {
      await googleService.ensureSpreadsheetAccess();
      const sId = await googleService.findOrCreateDatabase();
      setSpreadsheetId(sId);
      if (profile?.email) {
        await googleService.upsertUserProfile(sId, {
          id: profile.id || profile.email,
          name: profile.name || profile.email,
          email: profile.email,
          picture: profile.picture
        });
      } else {
        window.localStorage.removeItem('camp-auth');
      }
      const data = await googleService.fetchAllData(sId, profile?.email);
      setPrompts(data.prompts);
      setAssignments(data.assignments);
      setSubmissions(data.submissions.map(s => s.lyricsDocUrl ? { ...s, lyrics: '' } : s));
      setComments(data.comments);
      setCampers(data.campers);
      setEvents(data.events);
      setAvailableTags(data.tags);
      setCollaborations(data.collaborations);
      setBocas(data.bocas);
      setStatusUpdates(data.statusUpdates);
      if (profile?.email) {
        setUpvotedPromptIds(data.upvotedPromptIds);
        setFavoritedSubmissionIds(data.favoritedSubmissionIds);
        const match = data.campers.find((camper) => camper.email === profile.email);
        if (match) {
          setUserProfile((prev) => ({
            ...prev,
            location: match.location,
            status: match.status,
            pictureOverrideUrl: match.pictureOverrideUrl
          }));
        }
      } else {
        setUpvotedPromptIds([]);
        setFavoritedSubmissionIds([]);
      }

      // One-time: clear lyrics from sheet for songs that have a Google Doc
      googleService.clearLyricsForDocSongs(sId).catch(e => console.error('Failed to clear lyrics', e));

      // Sync events from Google Calendar (initial load only)
      const syncedEvents = await Promise.allSettled(
        data.events
          .filter(event => !event.deletedAt)
          .map(event => googleService.syncEventFromCalendar(sId, event))
      );
      const updatedEvents = syncedEvents.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        return data.events.filter(e => !e.deletedAt)[index];
      });
      // Merge synced events with deleted ones
      const deletedEvents = data.events.filter(e => e.deletedAt);
      setEvents([...updatedEvents, ...deletedEvents]);
    } catch (e) {
      console.error('Initial sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncData = async () => {
    if (!spreadsheetId || !isLoggedIn) return;

    try {
      const data = await googleService.fetchAllData(spreadsheetId, userProfile?.email);
      setPrompts(data.prompts);
      setAssignments(data.assignments);
      setSubmissions(data.submissions.map(s => s.lyricsDocUrl ? { ...s, lyrics: '' } : s));
      setComments(data.comments);
      setCampers(data.campers);
      setEvents(data.events);
      setAvailableTags(data.tags);
      setCollaborations(data.collaborations);
      setBocas(data.bocas);
      setStatusUpdates(data.statusUpdates);

      if (userProfile?.email) {
        setUpvotedPromptIds(data.upvotedPromptIds);
        setFavoritedSubmissionIds(data.favoritedSubmissionIds);
        const match = data.campers.find((camper) => camper.email === userProfile.email);
        if (match) {
          setUserProfile((prev) => ({
            ...prev,
            location: match.location,
            status: match.status,
            pictureOverrideUrl: match.pictureOverrideUrl
          }));
        }
      }
    } catch (e) {
      console.error('Background sync failed', e);
    }
  };

  const handleGiveBoca = async (submissionId: string) => {
    if (!userProfile?.email || !spreadsheetId) return;
    const boca = await googleService.createBoca(spreadsheetId, {
      fromEmail: userProfile.email,
      submissionId
    });
    setBocas(prev => [...prev, boca]);
  };

  const getTitleForEntity = (view: ViewState, id: string | null): string | null => {
    if (!id) return null;
    switch (view) {
      case 'prompt-detail':
        return prompts.find(p => p.id === id)?.title || null;
      case 'assignment-detail':
        return assignments.find(a => a.id === id)?.title || null;
      case 'song-detail':
        return submissions.find(s => s.id === id)?.title || null;
      case 'event-detail':
        return events.find(e => e.id === id)?.title || null;
      case 'camper-detail': {
        const camper = campers.find(c => c.id === id || c.email === id);
        return camper?.name || null;
      }
      case 'semester-detail':
        return id;
      default:
        return null;
    }
  };

  const getPageMeta = (view: ViewState, id: string | null): PageMeta => {
    if (!id) return getDefaultPageMeta(view);
    switch (view) {
      case 'song-detail': {
        const sub = submissions.find(s => s.id === id);
        if (!sub) return { title: 'Song' };
        const assignment = assignments.find(a => a.id === sub.assignmentId);
        const image = sub.artworkFileId
          ? `https://drive.google.com/thumbnail?id=${sub.artworkFileId}&sz=w600`
          : undefined;
        return {
          title: sub.title,
          description: `By ${sub.camperName}${assignment ? ` · ${assignment.title}` : ''}`,
          image,
        };
      }
      case 'prompt-detail': {
        const prompt = prompts.find(p => p.id === id);
        if (!prompt) return { title: 'Prompt' };
        return {
          title: prompt.title,
          description: prompt.description?.slice(0, 200) || undefined,
        };
      }
      case 'assignment-detail': {
        const a = assignments.find(x => x.id === id);
        if (!a) return { title: 'Assignment' };
        return {
          title: a.title,
          description: a.instructions?.slice(0, 200) || undefined,
        };
      }
      case 'event-detail': {
        const ev = events.find(e => e.id === id);
        if (!ev) return { title: 'Event' };
        const dateStr = new Date(ev.startDateTime).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        });
        return {
          title: ev.title,
          description: `${dateStr}${ev.description ? ` · ${ev.description.slice(0, 150)}` : ''}`,
        };
      }
      case 'camper-detail': {
        const camper = campers.find(c => c.id === id || c.email === id);
        if (!camper) return { title: 'Camper' };
        return {
          title: camper.name,
          description: camper.status ? `"${camper.status}"${camper.location ? ` · ${camper.location}` : ''}` : camper.location || undefined,
        };
      }
      case 'semester-detail':
        return { title: id || 'Semester' };
      default:
        return getDefaultPageMeta(view);
    }
  };

  const navigateTo = (view: ViewState, id: string | null = null, { replace = false } = {}) => {
    setActiveView(view);
    setSelectedId(id);
    window.scrollTo(0, 0);
    const title = getTitleForEntity(view, id);
    const urlPath = buildPath(view, id, title);
    const state = { view, id };
    if (replace) {
      window.history.replaceState(state, '', urlPath);
    } else {
      window.history.pushState(state, '', urlPath);
    }
    updateMetaTags(getPageMeta(view, id));
  };

  // Handle URL routing: initialize from pathname on mount + browser back/forward
  useEffect(() => {
    // Legacy hash redirect: convert old /#/songs/... URLs to path URLs
    const hash = window.location.hash;
    if (hash && hash !== '#/' && hash !== '#') {
      const parsed = parseHash(hash);
      const title = getTitleForEntity(parsed.view, parsed.id);
      const newPath = buildPath(parsed.view, parsed.id, title);
      setActiveView(parsed.view);
      setSelectedId(parsed.id);
      window.history.replaceState({ view: parsed.view, id: parsed.id }, '', newPath);
    } else {
      // Normal path-based routing
      const parsed = parsePath(window.location.pathname);
      if (parsed.view !== 'dashboard' || parsed.id) {
        setActiveView(parsed.view);
        setSelectedId(parsed.id);
        window.history.replaceState({ view: parsed.view, id: parsed.id }, '', window.location.pathname);
      } else {
        window.history.replaceState({ view: activeView, id: selectedId }, '', window.location.pathname);
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      const view = e.state?.view || parsePath(window.location.pathname).view;
      const id = e.state?.id || parsePath(window.location.pathname).id;
      setActiveView(view);
      setSelectedId(id || null);
      window.scrollTo(0, 0);
      updateMetaTags(getPageMeta(view, id || null));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-resolve URL after data loads (handles shared links opened in new tab)
  const hasResolvedUrl = useRef(false);
  useEffect(() => {
    if (hasResolvedUrl.current) return;
    if (prompts.length === 0 && assignments.length === 0 && submissions.length === 0 && campers.length === 0) return;

    const parsed = parsePath(window.location.pathname);
    if (!parsed.id) return;

    hasResolvedUrl.current = true;

    let resolvedId: string | null = parsed.id;
    switch (parsed.view) {
      case 'prompt-detail':
        resolvedId = resolveShortId(parsed.id, prompts.map(p => p.id));
        break;
      case 'assignment-detail':
        resolvedId = resolveShortId(parsed.id, assignments.map(a => a.id));
        break;
      case 'song-detail':
        resolvedId = resolveShortId(parsed.id, submissions.map(s => s.id));
        break;
      case 'event-detail':
        resolvedId = resolveShortId(parsed.id, events.map(e => e.id));
        break;
      case 'camper-detail':
        resolvedId = resolveShortId(parsed.id, [
          ...campers.map(c => c.id),
          ...campers.map(c => c.email)
        ]);
        break;
    }

    if (resolvedId) {
      setActiveView(parsed.view);
      setSelectedId(resolvedId);
      window.history.replaceState({ view: parsed.view, id: resolvedId }, '', window.location.pathname);
      updateMetaTags(getPageMeta(parsed.view, resolvedId));
    }
  }, [prompts, assignments, submissions, campers, events]);

  const handleAddPrompt = async (newPrompt: Prompt) => {
    setPrompts(prev => [newPrompt, ...prev]);
    if (spreadsheetId) {
      try {
        await googleService.appendSheetRow(spreadsheetId, 'Prompts!A1', [[
          newPrompt.id, newPrompt.title, newPrompt.description, newPrompt.tags.join(','),
          newPrompt.upvotes, newPrompt.status, newPrompt.createdAt, newPrompt.createdBy,
          newPrompt.deletedAt || '', newPrompt.deletedBy || ''
        ]]);
      } catch (error) {
        console.error('Failed to save prompt to sheet', error);
        alert('Prompt saved locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handleUpdatePrompt = async (updatedPrompt: Prompt) => {
    setPrompts(prev => prev.map(p => p.id === updatedPrompt.id ? updatedPrompt : p));
    if (spreadsheetId) {
      try {
        await googleService.updatePromptRow(spreadsheetId, updatedPrompt);
      } catch (error) {
        console.error('Failed to update prompt in sheet', error);
        alert('Prompt updated locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handlePromptUpvote = async (prompt: Prompt) => {
    if (!userProfile?.email) {
      alert('Please sign in to upvote prompts.');
      return;
    }
    if (upvotedPromptIds.includes(prompt.id)) return;

    const updatedPrompt = { ...prompt, upvotes: prompt.upvotes + 1 };
    setPrompts(prev => prev.map(p => p.id === prompt.id ? updatedPrompt : p));
    setUpvotedPromptIds(prev => [...prev, prompt.id]);

    if (!spreadsheetId) return;
    try {
      await googleService.appendPromptUpvote(spreadsheetId, {
        promptId: prompt.id,
        userEmail: userProfile.email,
        userName: userProfile.name || userProfile.email
      });
      await googleService.updatePromptRow(spreadsheetId, updatedPrompt);
    } catch (error) {
      console.error('Failed to upvote prompt', error);
      setPrompts(prev => prev.map(p => p.id === prompt.id ? prompt : p));
      setUpvotedPromptIds(prev => prev.filter(id => id !== prompt.id));
      alert('Upvote failed to sync. Please try again.');
    }
  };

  const handleToggleFavorite = async (submissionId: string) => {
    if (!userProfile?.email || !spreadsheetId) return;
    const isFavorited = favoritedSubmissionIds.includes(submissionId);
    if (isFavorited) {
      setFavoritedSubmissionIds(prev => prev.filter(id => id !== submissionId));
      try {
        await googleService.removeFavorite(spreadsheetId, userProfile.email, submissionId);
      } catch (error) {
        console.error('Failed to remove favorite', error);
        setFavoritedSubmissionIds(prev => [...prev, submissionId]);
      }
    } else {
      setFavoritedSubmissionIds(prev => [...prev, submissionId]);
      try {
        await googleService.appendFavorite(spreadsheetId, {
          userEmail: userProfile.email,
          submissionId
        });
      } catch (error) {
        console.error('Failed to add favorite', error);
        setFavoritedSubmissionIds(prev => prev.filter(id => id !== submissionId));
      }
    }
  };

  const handleAddCollaborator = async (submissionId: string, camperId: string, camperName: string, role: string) => {
    if (!spreadsheetId) return;
    const tempId = Math.random().toString(36).substr(2, 9);
    const newCollab: Collaboration = { id: tempId, submissionId, camperId, camperName, role: role as CollaboratorRole, createdAt: new Date().toISOString() };
    setCollaborations(prev => [...prev, newCollab]);
    try {
      const realId = await googleService.addCollaborator(spreadsheetId, { submissionId, camperId, camperName, role });
      setCollaborations(prev => prev.map(c => c.id === tempId ? { ...c, id: realId } : c));
    } catch (error) {
      console.error('Failed to add collaborator', error);
      setCollaborations(prev => prev.filter(c => c.id !== tempId));
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!spreadsheetId) return;
    const removed = collaborations.find(c => c.id === collaboratorId);
    setCollaborations(prev => prev.filter(c => c.id !== collaboratorId));
    try {
      await googleService.removeCollaborator(spreadsheetId, collaboratorId);
    } catch (error) {
      console.error('Failed to remove collaborator', error);
      if (removed) setCollaborations(prev => [...prev, removed]);
    }
  };

  const handleAddCollaborators = (submissionId: string, collaborators: Array<{ camperId: string; camperName: string; role: string }>) => {
    for (const c of collaborators) {
      handleAddCollaborator(submissionId, c.camperId, c.camperName, c.role);
    }
  };

  const handleAddAssignment = async (newAssignment: Assignment) => {
    let assignmentWithFolderAndEvent = newAssignment;
    if (spreadsheetId && userProfile?.email) {
      // Create Drive folder
      try {
        const folderId = await googleService.createAssignmentFolder(newAssignment.title);
        assignmentWithFolderAndEvent = { ...assignmentWithFolderAndEvent, driveFolderId: folderId };
      } catch (error) {
        console.error('Failed to create Drive folder for assignment', error);
        alert('Assignment saved, but Drive folder could not be created.');
      }

      // Auto-create calendar event (7pm on due date)
      try {
        const [y, m, d] = newAssignment.dueDate.split('-').map(Number);
        const eventStart = new Date(y, m - 1, d, 19, 0, 0, 0); // 7:00 PM local
        const eventEnd = new Date(y, m - 1, d, 21, 0, 0, 0); // 9:00 PM local

        const event = await googleService.createEvent(spreadsheetId, {
          assignmentId: newAssignment.id,
          title: `${newAssignment.title} - Listening Party`,
          description: newAssignment.instructions,
          startDateTime: eventStart.toISOString(),
          endDateTime: eventEnd.toISOString(),
          attendees: campers.map(c => c.email.trim()).filter(e => e && e.includes('@')),
          location: 'Virtual (Google Meet)',
          createdBy: userProfile.email
        });

        assignmentWithFolderAndEvent = { ...assignmentWithFolderAndEvent, eventId: event.id };
        setEvents(prev => [event, ...prev]);
      } catch (error) {
        console.error('Failed to create calendar event for assignment', error);
        alert('Assignment saved, but calendar event could not be created.');
      }
    }

    setAssignments(prev => [assignmentWithFolderAndEvent, ...prev]);
    if (spreadsheetId) {
      try {
        const promptIdsStr = (assignmentWithFolderAndEvent.promptIds?.length ? assignmentWithFolderAndEvent.promptIds : [assignmentWithFolderAndEvent.promptId]).filter(Boolean).join(',');
        await googleService.appendSheetRow(spreadsheetId, 'Assignments!A1', [[
          assignmentWithFolderAndEvent.id,
          promptIdsStr,
          assignmentWithFolderAndEvent.title,
          assignmentWithFolderAndEvent.startDate || '',
          assignmentWithFolderAndEvent.dueDate,
          assignmentWithFolderAndEvent.assignedTo.join(','),
          assignmentWithFolderAndEvent.instructions,
          assignmentWithFolderAndEvent.status,
          assignmentWithFolderAndEvent.driveFolderId || '',
          assignmentWithFolderAndEvent.eventId || '',
          assignmentWithFolderAndEvent.deletedAt || '',
          assignmentWithFolderAndEvent.deletedBy || ''
        ]]);
      } catch (error) {
        console.error('Failed to save assignment to sheet', error);
        alert('Assignment saved locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handleAddSubmission = async (newSubmission: Submission) => {
    setSubmissions(prev => [newSubmission, ...prev]);
    if (spreadsheetId) {
      try {
        await googleService.appendSheetRow(spreadsheetId, 'Submissions!A1', [[
          newSubmission.id, newSubmission.assignmentId, newSubmission.camperId, newSubmission.camperName,
          newSubmission.title, newSubmission.lyrics, JSON.stringify(newSubmission.versions),
          newSubmission.details, newSubmission.updatedAt, newSubmission.lyricsDocUrl || '',
          newSubmission.lyricsRevisionCount ?? 0,
          newSubmission.artworkFileId || '', newSubmission.artworkUrl || '',
          newSubmission.deletedAt || '', newSubmission.deletedBy || ''
        ]]);
      } catch (error) {
        console.error('Failed to save submission to sheet', error);
        alert('Submission saved locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handleUpdateSubmission = async (updatedSubmission: Submission) => {
    setSubmissions(prev => prev.map(s => s.id === updatedSubmission.id ? updatedSubmission : s));
    if (spreadsheetId) {
      try {
        await googleService.updateSubmissionRow(spreadsheetId, updatedSubmission);
      } catch (error) {
        console.error('Failed to update submission in sheet', error);
        alert('Song updated locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handleCreateEventForAssignment = async (assignmentId: string) => {
    if (!spreadsheetId || !userProfile?.email) return;

    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    try {
      const [y, m, d] = assignment.dueDate.split('-').map(Number);
      const eventStart = new Date(y, m - 1, d, 19, 0, 0, 0); // 7:00 PM local
      const eventEnd = new Date(y, m - 1, d, 21, 0, 0, 0); // 9:00 PM local

      const event = await googleService.createEvent(spreadsheetId, {
        assignmentId: assignment.id,
        title: `${assignment.title} - Listening Party`,
        description: assignment.instructions,
        startDateTime: eventStart.toISOString(),
        endDateTime: eventEnd.toISOString(),
        attendees: campers.map(c => c.email.trim()).filter(e => e && e.includes('@')),
        location: 'Virtual (Google Meet)',
        createdBy: userProfile.email
      });

      setEvents(prev => [event, ...prev]);

      const updatedAssignment = { ...assignment, eventId: event.id };
      setAssignments(prev => prev.map(a => a.id === assignmentId ? updatedAssignment : a));

      try {
        await googleService.updateAssignmentRow(spreadsheetId, updatedAssignment);
      } catch (error) {
        console.error('Failed to update assignment with event ID', error);
      }
    } catch (error: any) {
      console.error('Failed to create calendar event', error);
      alert(`Failed to create calendar event: ${error?.message || error}\n\nCheck the browser console for more details.`);
    }
  };

  const handleUpdateAssignment = async (updatedAssignment: Assignment) => {
    setAssignments(prev => prev.map(a => a.id === updatedAssignment.id ? updatedAssignment : a));
    if (spreadsheetId) {
      try {
        await googleService.updateAssignmentRow(spreadsheetId, updatedAssignment);
      } catch (error) {
        console.error('Failed to update assignment in sheet', error);
        alert('Assignment updated locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handleUpdateEvent = async (updatedEvent: Event) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    if (spreadsheetId) {
      try {
        // Skip calendar update if event is being deleted
        if (!updatedEvent.deletedAt) {
          await googleService.updateCalendarEvent(updatedEvent.calendarEventId, {
            title: updatedEvent.title,
            description: updatedEvent.description,
            startDateTime: updatedEvent.startDateTime,
            endDateTime: updatedEvent.endDateTime,
            attendees: updatedEvent.attendees.map(a => ({ email: a.email })),
            location: updatedEvent.location
          });
        }
        // Always update sheet
        await googleService.updateEventRow(spreadsheetId, updatedEvent);
      } catch (error) {
        console.error('Failed to update event', error);
        alert('Event updated locally, but failed to sync to Calendar/Sheet. Please try again.');
      }
    }
  };

  const handleSyncEventFromCalendar = async (eventId: string) => {
    if (!spreadsheetId) return;
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const updatedEvent = await googleService.syncEventFromCalendar(spreadsheetId, event);
      setEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
    } catch (error) {
      console.error('Failed to sync event from calendar', error);
      alert('Failed to sync event from Google Calendar. Please try again.');
    }
  };

  const getAssignmentInfo = (submissionId?: string): { id?: string; title?: string } => {
    if (!submissionId) return {};
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub?.assignmentId) return {};
    const a = assignments.find(a => a.id === sub.assignmentId);
    return a ? { id: a.id, title: a.title } : {};
  };

  const handlePlayTrack = async (track: {
    versionId: string;
    title: string;
    artist: string;
    camperId?: string;
    submissionId?: string;
    assignmentId?: string;
    assignmentTitle?: string;
    artworkFileId?: string;
    artworkUrl?: string;
  }) => {
    setPlayingTrackId(track.versionId);
    const info = getAssignmentInfo(track.submissionId);
    const assignmentId = track.assignmentId || info.id;
    const assignmentTitle = track.assignmentTitle || info.title;
    // Show player immediately with track info while audio loads
    setPlayer({
      src: '',
      title: track.title,
      artist: track.artist,
      camperId: track.camperId,
      submissionId: track.submissionId,
      assignmentId,
      assignmentTitle,
      artworkFileId: track.artworkFileId,
      artworkUrl: track.artworkUrl
    });
    setIsPlayerLoading(true);
    try {
      const blob = await googleService.fetchDriveFile(track.versionId);
      const url = URL.createObjectURL(blob);
      if (previousAudioUrl.current) {
        URL.revokeObjectURL(previousAudioUrl.current);
      }
      previousAudioUrl.current = url;
      setPlayer({
        src: url,
        title: track.title,
        artist: track.artist,
        camperId: track.camperId,
        submissionId: track.submissionId,
        assignmentId,
        assignmentTitle,
        artworkFileId: track.artworkFileId,
        artworkUrl: track.artworkUrl
      });
    } catch (error) {
      console.error('Failed to load audio', error);
      if (error instanceof googleService.DriveAccessError) {
        // File needs re-authorization via Picker — keep overlay open
        const confirmed = window.confirm(
          'This song was uploaded before the app\'s permissions were updated. To play it, select the file from your Google Drive.\n\nOpen Google Drive file picker?'
        );
        if (confirmed) {
          try {
            const files = await googleService.openDrivePicker({
              mimeTypes: 'audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/flac',
              multiSelect: false,
              title: 'Select the audio file to re-authorize',
            });
            if (files.length > 0) {
              // Share re-linked file so all campers can access it
              googleService.shareFilePublicly(files[0].id).catch(() => {});
              // Retry playback — Picker granted access to the selected file
              await handlePlayTrack({ ...track, versionId: files[0].id });
            }
          } catch (pickerError) {
            console.error('Picker failed', pickerError);
          }
        }
      } else {
        alert('Failed to load audio from Drive. Please try again.');
      }
    } finally {
      setIsPlayerLoading(false);
      setPlayingTrackId(null);
    }
  };

  const handleAddToQueue = async (track: {
    versionId: string;
    title: string;
    artist: string;
    camperId?: string;
    submissionId?: string;
    assignmentId?: string;
    assignmentTitle?: string;
    artworkFileId?: string;
    artworkUrl?: string;
  }) => {
    setQueueingTrackId(track.versionId);
    try {
      const blob = await googleService.fetchDriveFile(track.versionId);
      const url = URL.createObjectURL(blob);
      const info = getAssignmentInfo(track.submissionId);
      const assignmentId = track.assignmentId || info.id;
      const assignmentTitle = track.assignmentTitle || info.title;
      setQueue(prev => [...prev, {
        src: url,
        title: track.title,
        artist: track.artist,
        camperId: track.camperId,
        submissionId: track.submissionId,
        assignmentId,
        assignmentTitle,
        artworkFileId: track.artworkFileId,
        artworkUrl: track.artworkUrl
      }]);
    } catch (error) {
      console.error('Failed to add to queue', error);
      if (error instanceof googleService.DriveAccessError) {
        const confirmed = window.confirm(
          'This song needs to be re-authorized. Select the file from your Google Drive to re-link it.\n\nOpen Google Drive file picker?'
        );
        if (confirmed) {
          try {
            const files = await googleService.openDrivePicker({
              mimeTypes: 'audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/flac',
              multiSelect: false,
              title: 'Select the audio file to re-authorize',
            });
            if (files.length > 0) {
              // Share re-linked file so all campers can access it
              googleService.shareFilePublicly(files[0].id).catch(() => {});
              await handleAddToQueue({ ...track, versionId: files[0].id });
            }
          } catch (pickerError) {
            console.error('Picker failed', pickerError);
          }
        }
      } else {
        alert('Failed to load audio from Drive. Please try again.');
      }
    } finally {
      setQueueingTrackId(null);
    }
  };

  const handleReorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const handleClearQueue = () => {
    setQueue(prev => {
      prev.forEach(t => URL.revokeObjectURL(t.src));
      return [];
    });
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.src);
      return prev.filter((_, i) => i !== index);
    });
  };

  useEffect(() => { isJukeboxModeRef.current = isJukeboxMode; }, [isJukeboxMode]);

  const handlePlayNext = () => {
    if (queue.length === 0) {
      setPlayer(null);
      setIsJukeboxMode(false);
      return;
    }
    const [next, ...rest] = queue;
    if (previousAudioUrl.current) {
      URL.revokeObjectURL(previousAudioUrl.current);
    }
    previousAudioUrl.current = next.src;
    setPlayer(next);
    setQueue(rest);

    // Jukebox: auto-add another random track
    if (isJukeboxModeRef.current && jukeboxPoolRef.current.length > 0) {
      const pool = jukeboxPoolRef.current;
      const candidates = pool.filter(t => t.submissionId !== next.submissionId);
      const pick = candidates.length > 0 ? candidates : pool;
      const nextTrack = pick[Math.floor(Math.random() * pick.length)];
      handleAddToQueue(nextTrack);
    }
  };

  const handleStartJukebox = async (tracks: PlayableTrack[]) => {
    if (tracks.length === 0) return;
    jukeboxPoolRef.current = tracks;
    setIsJukeboxMode(true);
    queue.forEach(t => URL.revokeObjectURL(t.src));
    setQueue([]);
    // Shuffle and pick up to 10 unique tracks for the initial queue
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    await handlePlayTrack(shuffled[0]);
    const queueSize = Math.min(9, shuffled.length - 1);
    for (let i = 1; i <= queueSize; i++) {
      handleAddToQueue(shuffled[i]);
    }
  };

  const handleStopJukebox = () => {
    setIsJukeboxMode(false);
    jukeboxPoolRef.current = [];
  };

  const handleProfileUpdate = async (updates: { location?: string; status?: string; pictureOverrideUrl?: string }) => {
    if (!spreadsheetId || !userProfile?.email) return;
    try {
      await googleService.updateUserProfileDetails(spreadsheetId, {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        location: updates.location,
        status: updates.status,
        pictureOverrideUrl: updates.pictureOverrideUrl
      });
      setUserProfile((prev) => ({
        ...prev,
        location: updates.location ?? prev?.location,
        status: updates.status ?? prev?.status,
        pictureOverrideUrl: updates.pictureOverrideUrl ?? prev?.pictureOverrideUrl
      }));
      const statusChanged = updates.status !== undefined && updates.status !== userProfile?.status;
      setCampers((prev) =>
        prev.map((camper) =>
          camper.email === userProfile.email
            ? {
                ...camper,
                location: updates.location ?? camper.location,
                status: updates.status ?? camper.status,
                pictureOverrideUrl: updates.pictureOverrideUrl ?? camper.pictureOverrideUrl,
              }
            : camper
        )
      );
      if (statusChanged && updates.status) {
        const entry = await googleService.createStatusUpdate(spreadsheetId, {
          camperEmail: userProfile.email,
          camperName: userProfile.name,
          status: updates.status
        });
        setStatusUpdates(prev => [entry, ...prev]);
      }
    } catch (error) {
      console.error('Failed to update profile', error);
      alert('Profile update failed. Please try again.');
    }
  };

  const [heroQuote] = useState(() => CAMP_QUOTES[Math.floor(Math.random() * CAMP_QUOTES.length)]);

  const allSemesters = useMemo(() => {
    const terms = new Set<string>();
    assignments.filter(a => !a.deletedAt).forEach(a => terms.add(getTerm(a.dueDate)));
    submissions.filter(s => !s.deletedAt).forEach(s => {
      const date = s.versions?.length ? s.versions[0].timestamp : s.updatedAt;
      terms.add(getTerm(date));
    });
    return Array.from(terms).sort((a, b) => getTermSortKey(b) - getTermSortKey(a));
  }, [assignments, submissions]);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            prompts={prompts.filter((p) => !p.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            submissions={submissions.filter((s) => !s.deletedAt)}
            events={events.filter((e) => !e.deletedAt)}
            campersCount={campers.length}
            isSyncing={isSyncing}
            onNavigate={navigateTo}
            onPlayTrack={handlePlayTrack}
            playingTrackId={playingTrackId}
            bocas={bocas}
            statusUpdates={statusUpdates}
            comments={comments}
            dateFormat={dateFormat}
            collaborations={collaborations}
          />
        );
      case 'inbox':
        return (
          <InboxPage
            prompts={prompts.filter(p => !p.deletedAt)}
            assignments={assignments.filter(a => !a.deletedAt)}
            submissions={submissions.filter(s => !s.deletedAt)}
            campers={campers}
            comments={comments}
            onNavigate={navigateTo}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            favoritedSubmissionIds={favoritedSubmissionIds}
            onToggleFavorite={handleToggleFavorite}
            bocas={bocas}
            statusUpdates={statusUpdates}
            dateFormat={dateFormat}
            collaborations={collaborations}
          />
        );
      case 'prompts':
        return spreadsheetId ? (
          <PromptsPage
            prompts={prompts.filter((p) => !p.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            onAdd={handleAddPrompt}
            onUpdate={handleUpdatePrompt}
            onUpvote={handlePromptUpvote}
            onViewDetail={(id) => navigateTo('prompt-detail', id)}
            userProfile={userProfile}
            upvotedPromptIds={upvotedPromptIds}
            spreadsheetId={spreadsheetId}
            searchTerm={promptsSearch}
            onSearchTermChange={setPromptsSearch}
            statusFilter={promptsStatusFilter}
            onStatusFilterChange={setPromptsStatusFilter}
            sortBy={promptsSortBy}
            onSortByChange={setPromptsSortBy}
            viewMode={promptsViewMode}
            onViewModeChange={setPromptsViewMode}
          />
        ) : null;
      case 'assignments':
        return spreadsheetId ? (
          <AssignmentsPage
            assignments={assignments.filter((a) => !a.deletedAt)}
            prompts={prompts.filter((p) => !p.deletedAt)}
            campersCount={campers.length}
            onAdd={handleAddAssignment}
            onViewDetail={(id) => navigateTo('assignment-detail', id)}
            onAddPrompt={handleAddPrompt}
            userProfile={userProfile}
            spreadsheetId={spreadsheetId}
            availableTags={availableTags}
            viewMode={assignmentsViewMode}
            onViewModeChange={setAssignmentsViewMode}
            searchTerm={assignmentsSearch}
            onSearchTermChange={setAssignmentsSearch}
            statusFilter={assignmentsStatusFilter}
            onStatusFilterChange={setAssignmentsStatusFilter}
            promptFilter={assignmentsPromptFilter}
            onPromptFilterChange={setAssignmentsPromptFilter}
            sortBy={assignmentsSortBy}
            onSortByChange={setAssignmentsSortBy}
            semesterFilter={assignmentsSemesterFilter}
            onSemesterFilterChange={setAssignmentsSemesterFilter}
            dateFormat={dateFormat}
          />
        ) : null;
      case 'submissions':
        return (
          <SubmissionsPage
            submissions={submissions.filter((s) => !s.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            prompts={prompts.filter((p) => !p.deletedAt)}
            onAdd={handleAddSubmission}
            onViewDetail={(id) => navigateTo('song-detail', id)}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            onStartJukebox={handleStartJukebox}
            userProfile={userProfile}
            viewMode={submissionsViewMode}
            onViewModeChange={setSubmissionsViewMode}
            searchTerm={submissionsSearch}
            onSearchTermChange={setSubmissionsSearch}
            assignmentFilter={submissionsAssignmentFilter}
            onAssignmentFilterChange={setSubmissionsAssignmentFilter}
            promptFilter={submissionsPromptFilter}
            onPromptFilterChange={setSubmissionsPromptFilter}
            sortBy={submissionsSortBy}
            onSortByChange={setSubmissionsSortBy}
            semesterFilter={submissionsSemesterFilter}
            onSemesterFilterChange={setSubmissionsSemesterFilter}
            bocas={bocas}
            dateFormat={dateFormat}
            gridSize={submissionsGridSize}
            onGridSizeChange={setSubmissionsGridSize}
            favoritedSubmissionIds={favoritedSubmissionIds}
            onToggleFavorite={handleToggleFavorite}
            collaborations={collaborations}
            campers={campers}
            onAddCollaborators={handleAddCollaborators}
          />
        );
      case 'events':
        return (
          <EventsPage
            events={events.filter((e) => !e.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            onNavigate={navigateTo}
            onUpdateEvent={handleUpdateEvent}
            spreadsheetId={spreadsheetId || undefined}
            currentUser={userProfile}
            viewMode={eventsViewMode}
            onViewModeChange={setEventsViewMode}
          />
        );
      case 'prompt-detail':
        const p = prompts.find(pr => pr.id === selectedId);
        return p && spreadsheetId ? (
          <PromptDetail
            prompt={p}
            assignments={assignments.filter(a => (a.promptIds?.includes(p.id) || a.promptId === p.id) && !a.deletedAt)}
            submissions={submissions.filter(s => {
              const assignment = assignments.find(asn => asn.id === s.assignmentId);
              return assignment && (assignment.promptIds?.includes(p.id) || assignment.promptId === p.id) && !s.deletedAt;
            })}
            onNavigate={navigateTo}
            onUpdate={handleUpdatePrompt}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            onUpvote={handlePromptUpvote}
            upvotedPromptIds={upvotedPromptIds}
            currentUser={userProfile}
            spreadsheetId={spreadsheetId}
            bocas={bocas}
            campers={campers}
            dateFormat={dateFormat}
            favoritedSubmissionIds={favoritedSubmissionIds}
            onToggleFavorite={handleToggleFavorite}
            collaborations={collaborations}
          />
        ) : null;
      case 'assignment-detail':
        const a = assignments.find(as => as.id === selectedId);
        return a && spreadsheetId ? (
          <AssignmentDetail
            assignment={a}
            prompt={prompts.find(pr => pr.id === a.promptId)}
            prompts={prompts.filter((p) => !p.deletedAt)}
            assignments={assignments.filter((asn) => !asn.deletedAt)}
            submissions={submissions.filter(s => s.assignmentId === a.id && !s.deletedAt)}
            events={events.filter((e) => !e.deletedAt)}
            campersCount={campers.length}
            onNavigate={navigateTo}
            onUpdate={handleUpdateAssignment}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            onAddSubmission={handleAddSubmission}
            onCreateEvent={handleCreateEventForAssignment}
            currentUser={userProfile}
            spreadsheetId={spreadsheetId}
            onAddPrompt={handleAddPrompt}
            availableTags={availableTags}
            bocas={bocas}
            campers={campers}
            dateFormat={dateFormat}
            favoritedSubmissionIds={favoritedSubmissionIds}
            onToggleFavorite={handleToggleFavorite}
            collaborations={collaborations}
            onAddCollaborators={handleAddCollaborators}
          />
        ) : null;
      case 'song-detail':
        const s = submissions.find(su => su.id === selectedId);
        return s && spreadsheetId && userProfile ? (
          <SongDetail
            submission={s}
            assignment={assignments.find(as => as.id === s.assignmentId && !as.deletedAt)}
            prompt={prompts.find(pr => pr.id === assignments.find(as => as.id === s.assignmentId && !as.deletedAt)?.promptId)}
            onNavigate={navigateTo}
            onUpdate={handleUpdateSubmission}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            currentUser={{ name: userProfile.name || 'Anonymous', email: userProfile.email || '' }}
            spreadsheetId={spreadsheetId}
            bocas={bocas}
            currentUserEmail={userProfile.email || ''}
            onGiveBoca={handleGiveBoca}
            campers={campers}
            dateFormat={dateFormat}
            isFavorited={favoritedSubmissionIds.includes(s.id)}
            onToggleFavorite={handleToggleFavorite}
            collaborations={collaborations}
            onAddCollaborator={handleAddCollaborator}
            onRemoveCollaborator={handleRemoveCollaborator}
          />
        ) : null;
      case 'bocas':
        return (
          <BOCAsPage
            bocas={bocas}
            submissions={submissions.filter(sub => !sub.deletedAt)}
            currentUserEmail={userProfile?.email || ''}
            onNavigate={navigateTo}
            onPlayTrack={handlePlayTrack}
            playingTrackId={playingTrackId}
            onGiveBoca={handleGiveBoca}
            viewMode={bocasViewMode}
            onViewModeChange={setBocasViewMode}
            searchTerm={bocasSearch}
            onSearchTermChange={setBocasSearch}
            sortBy={bocasSortBy}
            onSortByChange={setBocasSortBy}
            dateFormat={dateFormat}
            collaborations={collaborations}
          />
        );
      case 'favorites':
        return (
          <FavoritesPage
            submissions={submissions.filter(s => !s.deletedAt && favoritedSubmissionIds.includes(s.id))}
            assignments={assignments.filter(a => !a.deletedAt)}
            onViewDetail={(id) => navigateTo('song-detail', id)}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            onStartJukebox={handleStartJukebox}
            favoritedSubmissionIds={favoritedSubmissionIds}
            onToggleFavorite={handleToggleFavorite}
            bocas={bocas}
            dateFormat={dateFormat}
            gridSize={submissionsGridSize}
            onGridSizeChange={setSubmissionsGridSize}
            collaborations={collaborations}
          />
        );
      case 'semesters':
        return (
          <SemestersPage
            semesters={allSemesters}
            assignments={assignments.filter(a => !a.deletedAt)}
            submissions={submissions.filter(s => !s.deletedAt)}
            prompts={prompts.filter(p => !p.deletedAt)}
            onViewDetail={(semester) => navigateTo('semester-detail', semester)}
            viewMode={semestersViewMode}
            onViewModeChange={setSemestersViewMode}
          />
        );
      case 'semester-detail': {
        const semesterName = selectedId;
        const semAssignments = assignments.filter(a => !a.deletedAt && getTerm(a.dueDate) === semesterName);
        const semSubmissions = submissions.filter(s => {
          if (s.deletedAt) return false;
          const date = s.versions?.length ? s.versions[0].timestamp : s.updatedAt;
          return getTerm(date) === semesterName;
        });
        return semesterName ? (
          <SemesterDetail
            semester={semesterName}
            assignments={semAssignments}
            submissions={semSubmissions}
            prompts={prompts.filter(p => !p.deletedAt)}
            bocas={bocas}
            onNavigate={navigateTo}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            onStartJukebox={handleStartJukebox}
            favoritedSubmissionIds={favoritedSubmissionIds}
            onToggleFavorite={handleToggleFavorite}
            dateFormat={dateFormat}
            gridSize={submissionsGridSize}
            onGridSizeChange={setSubmissionsGridSize}
            collaborations={collaborations}
          />
        ) : null;
      }
      case 'settings':
        return (
          <SettingsPage
            themePreference={themePreference}
            onThemeChange={setThemePreference}
            userProfile={userProfile}
            onProfileUpdate={handleProfileUpdate}
            rememberMe={rememberMe}
            onRememberMeChange={setRememberMe}
            dateFormat={dateFormat}
            onDateFormatChange={setDateFormat}
            submissions={submissions}
          />
        );
      case 'campers':
        return <CampersPage campers={campers} onNavigate={navigateTo} viewMode={campersViewMode} onViewModeChange={setCampersViewMode} dateFormat={dateFormat} />;
      case 'camper-detail':
        const camper = campers.find((item) => item.id === selectedId || item.email === selectedId);
        return camper ? (
          <CamperDetail
            camper={camper}
            prompts={prompts.filter((prompt) => !prompt.deletedAt && (prompt.createdBy === camper.email || prompt.createdBy === camper.name))}
            allPrompts={prompts.filter((p) => !p.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            submissions={submissions.filter((submission) => !submission.deletedAt && (submission.camperId === camper.email || submission.camperName === camper.name || collaborations.some(c => c.submissionId === submission.id && (c.camperId === camper.email || c.camperName === camper.name))))}
            onNavigate={navigateTo}
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
            playingTrackId={playingTrackId}
            queueingTrackId={queueingTrackId}
            onStartJukebox={handleStartJukebox}
            songsView={camperDetailSongsView}
            onSongsViewChange={setCamperDetailSongsView}
            searchTerm={camperDetailSearch}
            onSearchTermChange={setCamperDetailSearch}
            selectedTags={camperDetailSelectedTags}
            onSelectedTagsChange={setCamperDetailSelectedTags}
            favoritedSubmissionIds={favoritedSubmissionIds}
            onToggleFavorite={handleToggleFavorite}
            bocas={bocas}
            dateFormat={dateFormat}
            gridSize={submissionsGridSize}
            onGridSizeChange={setSubmissionsGridSize}
            collaborations={collaborations}
          />
        ) : null;
      default:
        return (
          <Dashboard
            prompts={prompts.filter((p) => !p.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            submissions={submissions.filter((s) => !s.deletedAt)}
            events={events.filter((e) => !e.deletedAt)}
            campersCount={campers.length}
            isSyncing={isSyncing}
            onNavigate={navigateTo}
            onPlayTrack={handlePlayTrack}
            playingTrackId={playingTrackId}
            bocas={bocas}
            statusUpdates={statusUpdates}
            comments={comments}
            dateFormat={dateFormat}
            collaborations={collaborations}
          />
        );
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
        <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 max-w-2xl w-full">
          <div className="mb-10 mx-auto text-center">
            <i className="fa-solid fa-campground text-[6rem] text-indigo-600 rotate-2 hover:rotate-0 transition-transform duration-500"></i>
          </div>
          <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Camp</h2>
          <p className="text-slate-500 text-lg mb-12 leading-relaxed font-medium italic">
            "{heroQuote}"
          </p>

          <button
            onClick={googleService.signIn}
            className="group relative w-full bg-slate-900 text-white px-10 py-6 rounded-[1.5rem] font-bold text-xl hover:bg-black transition-all flex items-center justify-center gap-5 overflow-hidden active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <i className="fa-brands fa-google text-2xl"></i>
            Connect with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      activeView={activeView}
      onViewChange={(v) => navigateTo(v)}
      isSyncing={isSyncing}
      isLoggedIn={isLoggedIn}
      hasInitialData={!!spreadsheetId}
      userProfile={userProfile}
      player={player}
      isPlayerLoading={isPlayerLoading}
      queue={queue}
      onPlayNext={handlePlayNext}
      onRemoveFromQueue={handleRemoveFromQueue}
      onReorderQueue={handleReorderQueue}
      onClearQueue={handleClearQueue}
      onNavigateToSong={(id) => navigateTo('song-detail', id)}
      onNavigateToCamper={(id) => navigateTo('camper-detail', id)}
      onNavigateToAssignment={(id) => navigateTo('assignment-detail', id)}
      isJukeboxMode={isJukeboxMode}
      onStopJukebox={handleStopJukebox}
      onStartJukebox={() => {
        const tracks = submissions
          .filter(s => s.versions?.length && s.versions[0].id)
          .map(s => ({
            versionId: s.versions[0].id,
            title: s.title,
            artist: getDisplayArtist(s, collaborations),
            camperId: s.camperId,
            submissionId: s.id,
            artworkFileId: s.artworkFileId,
            artworkUrl: s.artworkUrl,
          } as PlayableTrack));
        if (tracks.length > 0) handleStartJukebox(tracks);
      }}
      currentTrackBocaCount={player ? bocas.filter(b => b.submissionId === player.submissionId).length : 0}
      isCurrentTrackFavorited={player?.submissionId ? favoritedSubmissionIds.includes(player.submissionId) : false}
      onToggleFavorite={handleToggleFavorite}
      onLogout={() => {
        window.localStorage.removeItem('camp-auth');
        if (!rememberMe) {
          window.localStorage.removeItem('camp-last-email');
        }
        googleService.logout();
      }}
    >
      {renderView()}
    </Layout>
  );
};

export default App;
