
import React from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  isSyncing?: boolean;
  isLoggedIn?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, isSyncing, isLoggedIn }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'prompts', label: 'Prompt Library', icon: 'fa-lightbulb' },
    { id: 'assignments', label: 'Assignments', icon: 'fa-tasks' },
    { id: 'submissions', label: 'Song Submissions', icon: 'fa-music' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-indigo-900 text-white flex flex-col hidden md:flex shrink-0 h-screen sticky top-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <i className="fa-solid fa-fish text-amber-400"></i>
            <span>Koi Camp</span>
          </h1>
          <p className="text-indigo-300 text-[10px] mt-1 uppercase tracking-widest font-bold opacity-60">Toolkit v2.0</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as ViewState)}
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
              <div className="w-10 h-10 rounded-full bg-amber-400 text-indigo-900 flex items-center justify-center font-bold">
                KC
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate">Camp Admin</p>
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
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
             <button className="md:hidden text-indigo-900 text-xl">
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
            <button className="text-slate-500 hover:text-indigo-600 transition-colors w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center">
              <i className="fa-solid fa-gear"></i>
            </button>
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
