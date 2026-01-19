import React, { useState, useEffect } from 'react';
import { Prompt, Assignment, Submission, ViewState, PromptStatus } from './types';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import PromptsPage from './views/PromptsPage';
import AssignmentsPage from './views/AssignmentsPage';
import SubmissionsPage from './views/SubmissionsPage';
import PromptDetail from './views/PromptDetail';
import AssignmentDetail from './views/AssignmentDetail';
import SongDetail from './views/SongDetail';
import ProfilePage from './views/ProfilePage';
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
  const [userProfile, setUserProfile] = useState<{ name?: string; email?: string; picture?: string } | null>(null);

  useEffect(() => {
    const init = () => {
      googleService.initGoogleAuth((token) => {
        setIsLoggedIn(true);
        googleService.fetchUserProfile()
          .then((profile) => setUserProfile(profile))
          .catch((err) => console.error('Failed to fetch user profile', err));
        handleInitialSync();
      });
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

  const handleInitialSync = async () => {
    setIsSyncing(true);
    try {
      const sId = await googleService.findOrCreateDatabase();
      setSpreadsheetId(sId);
      const data = await googleService.fetchAllData(sId);
      setPrompts(data.prompts);
      setAssignments(data.assignments);
      setSubmissions(data.submissions);
    } catch (e) {
      console.error('Initial sync failed', e);
    } finally {
      setIsSyncing(false);
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
          newPrompt.upvotes, newPrompt.status, newPrompt.createdAt, newPrompt.createdBy
        ]]);
      } catch (error) {
        console.error('Failed to save prompt to sheet', error);
        alert('Prompt saved locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handleUpdatePrompt = async (updatedPrompt: Prompt) => {
    setPrompts(prompts.map(p => p.id === updatedPrompt.id ? updatedPrompt : p));
    if (spreadsheetId) {
      try {
        await googleService.updatePromptRow(spreadsheetId, updatedPrompt);
      } catch (error) {
        console.error('Failed to update prompt in sheet', error);
        alert('Prompt updated locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const handleAddAssignment = async (newAssignment: Assignment) => {
    setAssignments(prev => [newAssignment, ...prev]);
    if (spreadsheetId) {
      try {
        await googleService.appendSheetRow(spreadsheetId, 'Assignments!A1', [[
          newAssignment.id, newAssignment.promptId, newAssignment.title, newAssignment.dueDate,
          newAssignment.assignedTo.join(','), newAssignment.instructions, newAssignment.status
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
          newSubmission.details, newSubmission.updatedAt
        ]]);
      } catch (error) {
        console.error('Failed to save submission to sheet', error);
        alert('Submission saved locally, but failed to sync to the sheet. Please try again.');
      }
    }
  };

  const renderView = () => {
    if (!isLoggedIn) {
      const currentOrigin = window.location.origin;
      return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] p-6 text-center animate-in fade-in duration-1000">
          <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 max-w-2xl w-full">
            <div className="w-28 h-28 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-5xl mb-10 mx-auto shadow-xl shadow-indigo-100 rotate-2 hover:rotate-0 transition-transform duration-500">
              <i className="fa-solid fa-fish-fins"></i>
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

            <div className="mt-16 p-8 bg-amber-50 rounded-[2rem] border border-amber-100 text-left">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 animate-pulse">
                   <i className="fa-solid fa-screwdriver-wrench text-sm"></i>
                 </div>
                 <h4 className="text-sm font-black text-amber-800 uppercase tracking-widest">
                   Fixing Error 400 (Policy/storagerelay)
                 </h4>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white/50 p-4 rounded-xl border border-amber-200/50">
                  <p className="text-[10px] font-black text-amber-700 uppercase mb-2">1. Verify Origin</p>
                  <p className="text-xs text-slate-600 leading-normal">
                    In Google Console, "Authorized JavaScript origins" MUST be exactly:
                    <br/><code className="bg-amber-100 px-2 py-0.5 rounded font-bold text-slate-800 mt-1 inline-block select-all">{currentOrigin}</code>
                  </p>
                </div>

                <div className="bg-white/50 p-4 rounded-xl border border-amber-200/50">
                  <p className="text-[10px] font-black text-amber-700 uppercase mb-2">2. Clear Redirect URIs</p>
                  <p className="text-xs text-slate-600 leading-normal">
                    The "Authorized redirect URIs" section must be <b className="text-amber-800 underline">COMPLETELY EMPTY</b>. Delete any localhost entries there.
                  </p>
                </div>

                <div className="bg-white/50 p-4 rounded-xl border border-amber-200/50">
                  <p className="text-[10px] font-black text-amber-700 uppercase mb-2">3. Cookies / Incognito</p>
                  <p className="text-xs text-slate-600 leading-normal">
                    If you are in Incognito, Google blocks the login. Ensure "Third-party cookies" are enabled for <code className="bg-slate-100 px-1">accounts.google.com</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return <Dashboard prompts={prompts} assignments={assignments} submissions={submissions} onNavigate={navigateTo} />;
      case 'prompts':
        return <PromptsPage prompts={prompts} onAdd={handleAddPrompt} onUpdate={handleUpdatePrompt} onViewDetail={(id) => navigateTo('prompt-detail', id)} />;
      case 'assignments':
        return <AssignmentsPage assignments={assignments} prompts={prompts} onAdd={handleAddAssignment} onViewDetail={(id) => navigateTo('assignment-detail', id)} />;
      case 'submissions':
        return <SubmissionsPage submissions={submissions} assignments={assignments} onAdd={handleAddSubmission} onViewDetail={(id) => navigateTo('song-detail', id)} />;
      case 'prompt-detail':
        const p = prompts.find(pr => pr.id === selectedId);
        return p ? (
          <PromptDetail
            prompt={p}
            assignments={assignments.filter(a => a.promptId === p.id)}
            submissions={submissions.filter(s => assignments.find(a => a.id === s.assignmentId)?.promptId === p.id)}
            onNavigate={navigateTo}
            onUpdate={handleUpdatePrompt}
          />
        ) : null;
      case 'assignment-detail':
        const a = assignments.find(as => as.id === selectedId);
        return a ? <AssignmentDetail assignment={a} prompt={prompts.find(pr => pr.id === a.promptId)} submissions={submissions.filter(s => s.assignmentId === a.id)} onNavigate={navigateTo} /> : null;
      case 'song-detail':
        const s = submissions.find(su => su.id === selectedId);
        return s ? <SongDetail submission={s} assignment={assignments.find(as => as.id === s.assignmentId)} prompt={prompts.find(pr => pr.id === assignments.find(as => as.id === s.assignmentId)?.promptId)} onNavigate={navigateTo} /> : null;
      case 'profile':
        return <ProfilePage userProfile={userProfile} spreadsheetId={spreadsheetId} />;
      default:
        return <Dashboard prompts={prompts} assignments={assignments} submissions={submissions} onNavigate={navigateTo} />;
    }
  };

  return (
    <Layout 
      activeView={activeView} 
      onViewChange={(v) => navigateTo(v)}
      isSyncing={isSyncing}
      isLoggedIn={isLoggedIn}
      userProfile={userProfile}
      onLogout={googleService.logout}
    >
      {renderView()}
    </Layout>
  );
};

export default App;
