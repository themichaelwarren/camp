import React, { useState, useEffect, useRef } from 'react';
import { Prompt, Assignment, Submission, ViewState, PromptStatus, CamperProfile } from './types';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import PromptsPage from './views/PromptsPage';
import AssignmentsPage from './views/AssignmentsPage';
import SubmissionsPage from './views/SubmissionsPage';
import PromptDetail from './views/PromptDetail';
import AssignmentDetail from './views/AssignmentDetail';
import SongDetail from './views/SongDetail';
import SettingsPage from './views/SettingsPage';
import CampersPage from './views/CampersPage';
import CamperDetail from './views/CamperDetail';
import * as googleService from './services/googleService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ id?: string; name?: string; email?: string; picture?: string; location?: string; status?: string; pictureOverrideUrl?: string } | null>(null);
  const [campers, setCampers] = useState<CamperProfile[]>([]);
  const [upvotedPromptIds, setUpvotedPromptIds] = useState<string[]>([]);
  const [player, setPlayer] = useState<{
    src: string;
    title: string;
    artist: string;
    artworkFileId?: string;
    artworkUrl?: string;
  } | null>(null);
  const [rememberMe, setRememberMe] = useState(() => window.localStorage.getItem('camp-remember') === '1');
  const [visualTheme, setVisualTheme] = useState<'default' | 'notebook'>(() => {
    const stored = window.localStorage.getItem('camp-skin');
    return stored === 'notebook' ? 'notebook' : 'default';
  });
  const previousAudioUrl = useRef<string | null>(null);
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = window.localStorage.getItem('camp-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
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
      if (window.localStorage.getItem('camp-auth') === '1' && rememberMe) {
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
    window.localStorage.setItem('camp-remember', rememberMe ? '1' : '0');
  }, [rememberMe]);

  useEffect(() => {
    document.documentElement.dataset.skin = visualTheme;
    window.localStorage.setItem('camp-skin', visualTheme);
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

    const POLL_INTERVAL = 10000; // 10 seconds
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
      const data = await googleService.fetchAllData(sId);
      setPrompts(data.prompts);
      setAssignments(data.assignments);
      setSubmissions(data.submissions);
      const campersData = await googleService.fetchCampers(sId);
      setCampers(campersData);
      if (profile?.email) {
        const match = campersData.find((camper) => camper.email === profile.email);
        if (match) {
          setUserProfile((prev) => ({
            ...prev,
            location: match.location,
            status: match.status,
            pictureOverrideUrl: match.pictureOverrideUrl
          }));
        }
      }
      if (profile?.email) {
        const upvoted = await googleService.fetchUserUpvotes(sId, profile.email);
        setUpvotedPromptIds(upvoted);
      } else {
        setUpvotedPromptIds([]);
      }
    } catch (e) {
      console.error('Initial sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncData = async () => {
    if (!spreadsheetId || !isLoggedIn) return;

    try {
      const data = await googleService.fetchAllData(spreadsheetId);
      setPrompts(data.prompts);
      setAssignments(data.assignments);
      setSubmissions(data.submissions);

      const campersData = await googleService.fetchCampers(spreadsheetId);
      setCampers(campersData);

      if (userProfile?.email) {
        const match = campersData.find((camper) => camper.email === userProfile.email);
        if (match) {
          setUserProfile((prev) => ({
            ...prev,
            location: match.location,
            status: match.status,
            pictureOverrideUrl: match.pictureOverrideUrl
          }));
        }

        const upvoted = await googleService.fetchUserUpvotes(spreadsheetId, userProfile.email);
        setUpvotedPromptIds(upvoted);
      }
    } catch (e) {
      console.error('Background sync failed', e);
    }
  };

  const navigateTo = (view: ViewState, id: string | null = null) => {
    setActiveView(view);
    setSelectedId(id);
    window.scrollTo(0, 0);
  };

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

  const handleAddAssignment = async (newAssignment: Assignment) => {
    let assignmentWithFolder = newAssignment;
    if (spreadsheetId) {
      try {
        const folderId = await googleService.createAssignmentFolder(newAssignment.title);
        assignmentWithFolder = { ...newAssignment, driveFolderId: folderId };
      } catch (error) {
        console.error('Failed to create Drive folder for assignment', error);
        alert('Assignment saved, but Drive folder could not be created.');
      }
    }
    setAssignments(prev => [assignmentWithFolder, ...prev]);
    if (spreadsheetId) {
      try {
        await googleService.appendSheetRow(spreadsheetId, 'Assignments!A1', [[
          assignmentWithFolder.id, assignmentWithFolder.promptId, assignmentWithFolder.title, assignmentWithFolder.dueDate,
          assignmentWithFolder.assignedTo.join(','), assignmentWithFolder.instructions, assignmentWithFolder.status,
          assignmentWithFolder.driveFolderId || '',
          assignmentWithFolder.deletedAt || '', assignmentWithFolder.deletedBy || ''
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

  const handlePlayTrack = async (track: {
    versionId: string;
    title: string;
    artist: string;
    artworkFileId?: string;
    artworkUrl?: string;
  }) => {
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
        artworkFileId: track.artworkFileId,
        artworkUrl: track.artworkUrl
      });
    } catch (error) {
      console.error('Failed to load audio', error);
      alert('Failed to load audio from Drive. Please try again.');
    }
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
      setCampers((prev) =>
        prev.map((camper) =>
          camper.email === userProfile.email
            ? {
                ...camper,
                location: updates.location ?? camper.location,
                status: updates.status ?? camper.status,
                pictureOverrideUrl: updates.pictureOverrideUrl ?? camper.pictureOverrideUrl
              }
            : camper
        )
      );
    } catch (error) {
      console.error('Failed to update profile', error);
      alert('Profile update failed. Please try again.');
    }
  };

  const renderView = () => {
    if (!isLoggedIn) {
      const currentOrigin = window.location.origin;
      return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] p-6 text-center animate-in fade-in duration-1000">
          <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 max-w-2xl w-full">
            <div className="w-28 h-28 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-5xl mb-10 mx-auto shadow-xl shadow-indigo-100 rotate-2 hover:rotate-0 transition-transform duration-500">
              <span aria-hidden="true">🤘</span>
              <span className="sr-only">Koi Camp</span>
            </div>
            <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Koi Camp Portal</h2>
            <p className="text-slate-500 text-lg mb-12 leading-relaxed font-medium">
              Songwriter toolset powered by your own Google Drive. Log in to sync your lyrics, prompts, and audio drafts.
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

    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            prompts={prompts.filter((p) => !p.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            submissions={submissions.filter((s) => !s.deletedAt)}
            campersCount={campers.length}
            isSyncing={isSyncing}
            onNavigate={navigateTo}
          />
        );
      case 'prompts':
        return spreadsheetId ? (
          <PromptsPage
            prompts={prompts.filter((p) => !p.deletedAt)}
            onAdd={handleAddPrompt}
            onUpdate={handleUpdatePrompt}
            onUpvote={handlePromptUpvote}
            onViewDetail={(id) => navigateTo('prompt-detail', id)}
            userProfile={userProfile}
            upvotedPromptIds={upvotedPromptIds}
            spreadsheetId={spreadsheetId}
          />
        ) : null;
      case 'assignments':
        return (
          <AssignmentsPage
            assignments={assignments.filter((a) => !a.deletedAt)}
            prompts={prompts.filter((p) => !p.deletedAt)}
            campersCount={campers.length}
            onAdd={handleAddAssignment}
            onViewDetail={(id) => navigateTo('assignment-detail', id)}
          />
        );
      case 'submissions':
        return (
          <SubmissionsPage
            submissions={submissions.filter((s) => !s.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            onAdd={handleAddSubmission}
            onViewDetail={(id) => navigateTo('song-detail', id)}
            userProfile={userProfile}
          />
        );
      case 'prompt-detail':
        const p = prompts.find(pr => pr.id === selectedId);
        return p && spreadsheetId ? (
          <PromptDetail
            prompt={p}
            assignments={assignments.filter(a => a.promptId === p.id && !a.deletedAt)}
            submissions={submissions.filter(s => assignments.find(a => a.id === s.assignmentId)?.promptId === p.id && !s.deletedAt)}
            onNavigate={navigateTo}
            onUpdate={handleUpdatePrompt}
            currentUser={userProfile}
            spreadsheetId={spreadsheetId}
          />
        ) : null;
      case 'assignment-detail':
        const a = assignments.find(as => as.id === selectedId);
        return a ? (
          <AssignmentDetail
            assignment={a}
            prompt={prompts.find(pr => pr.id === a.promptId)}
            prompts={prompts.filter((p) => !p.deletedAt)}
            submissions={submissions.filter(s => s.assignmentId === a.id && !s.deletedAt)}
            campersCount={campers.length}
            onNavigate={navigateTo}
            onUpdate={handleUpdateAssignment}
            currentUser={userProfile}
            spreadsheetId={spreadsheetId}
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
            currentUser={{ name: userProfile.name || 'Anonymous', email: userProfile.email || '' }}
            spreadsheetId={spreadsheetId}
          />
        ) : null;
      case 'settings':
        return (
          <SettingsPage
            themePreference={themePreference}
            onThemeChange={setThemePreference}
            userProfile={userProfile}
            onProfileUpdate={handleProfileUpdate}
            rememberMe={rememberMe}
            onRememberMeChange={setRememberMe}
            visualTheme={visualTheme}
            onVisualThemeChange={setVisualTheme}
          />
        );
      case 'campers':
        return <CampersPage campers={campers} onNavigate={navigateTo} />;
      case 'camper-detail':
        const camper = campers.find((item) => item.id === selectedId || item.email === selectedId);
        return camper ? (
          <CamperDetail
            camper={camper}
            prompts={prompts.filter((prompt) => !prompt.deletedAt && (prompt.createdBy === camper.email || prompt.createdBy === camper.name))}
            submissions={submissions.filter((submission) => !submission.deletedAt && (submission.camperId === camper.email || submission.camperName === camper.name))}
            onNavigate={navigateTo}
          />
        ) : null;
      default:
        return (
          <Dashboard
            prompts={prompts.filter((p) => !p.deletedAt)}
            assignments={assignments.filter((a) => !a.deletedAt)}
            submissions={submissions.filter((s) => !s.deletedAt)}
            campersCount={campers.length}
            isSyncing={isSyncing}
            onNavigate={navigateTo}
          />
        );
    }
  };

  return (
    <Layout 
      activeView={activeView} 
      onViewChange={(v) => navigateTo(v)}
      isSyncing={isSyncing}
      isLoggedIn={isLoggedIn}
      userProfile={userProfile}
      player={player}
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
