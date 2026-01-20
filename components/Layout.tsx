
import React, { useState } from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  isSyncing?: boolean;
  isLoggedIn?: boolean;
  userProfile?: { name?: string; email?: string; picture?: string } | null;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, isSyncing, isLoggedIn, userProfile, onLogout }) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'prompts', label: 'Prompt Library', icon: 'fa-lightbulb' },
    { id: 'assignments', label: 'Assignments', icon: 'fa-tasks' },
    { id: 'submissions', label: 'Song Submissions', icon: 'fa-music' },
    { id: 'profile', label: 'Profile', icon: 'fa-user' },
  ];

  const handleNavigate = (view: ViewState) => {
    onViewChange(view);
    setIsMobileNavOpen(false);
  };

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

      <div className="p-4 bg-indigo-950/50 mt-auto">
        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            {userProfile?.picture ? (
              <img
                src={userProfile.picture}
                alt={userProfile.name || 'User profile'}
                className="w-10 h-10 rounded-full object-cover border border-white/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-400 text-indigo-900 flex items-center justify-center font-bold">
                KC
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{userProfile?.name || 'Camp Admin'}</p>
              <p className="text-[10px] text-indigo-400 font-bold uppercase flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`}></span>
                {isSyncing ? 'Syncing...' : 'Connected'}
              </p>
            </div>
          </div>
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
          <div className="flex items-center gap-4">
            {isLoggedIn && (
              <span className={`text-[10px] px-3 py-1 rounded-full font-bold flex items-center gap-2 border ${
                isSyncing ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-green-50 border-green-100 text-green-700'
              }`}>
                <i className={`fa-solid ${isSyncing ? 'fa-arrows-rotate animate-spin' : 'fa-cloud-check'}`}></i>
                {isSyncing ? 'Cloud Sync in Progress' : 'Changes Saved to Sheets'}
              </span>
            )}
            <button
              className="text-slate-500 hover:text-indigo-600 transition-colors w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center"
              onClick={() => handleNavigate('settings')}
              aria-label="Open settings"
            >
              <i className="fa-solid fa-gear"></i>
            </button>
            {isLoggedIn && (
              <button
                onClick={onLogout}
                className="text-slate-500 hover:text-red-600 transition-colors px-3 h-9 rounded-full hover:bg-red-50 flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                Log out
              </button>
            )}
          </div>
        </header>

        <div className="p-8 overflow-auto flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
