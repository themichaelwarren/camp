
import React from 'react';
import { Prompt, Assignment, Submission, ViewState } from '../types';

interface DashboardProps {
  prompts: Prompt[];
  assignments: Assignment[];
  submissions: Submission[];
  campersCount: number;
  onNavigate: (view: ViewState, id?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ prompts, assignments, submissions, campersCount, onNavigate }) => {
  const stats = [
    { label: 'Active Prompts', value: prompts.filter(p => p.status === 'Active').length, icon: 'fa-lightbulb', color: 'bg-amber-100 text-amber-600', view: 'prompts' },
    { label: 'Live Assignments', value: assignments.filter(a => a.status === 'Open').length, icon: 'fa-tasks', color: 'bg-indigo-100 text-indigo-600', view: 'assignments' },
    { label: 'Total Songs', value: submissions.length, icon: 'fa-music', color: 'bg-green-100 text-green-600', view: 'submissions' },
    { label: 'Campers Active', value: campersCount, icon: 'fa-users', color: 'bg-purple-100 text-purple-600', view: 'campers' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div 
            key={idx} 
            onClick={() => onNavigate(stat.view as ViewState)}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-indigo-300 transition-all"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${stat.color}`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg">Recent Prompts</h3>
              <button onClick={() => onNavigate('prompts')} className="text-indigo-600 text-sm font-semibold hover:underline">View All</button>
            </div>
            <div className="divide-y divide-slate-100">
              {prompts.slice(0, 3).map((prompt) => (
                <div 
                  key={prompt.id} 
                  onClick={() => onNavigate('prompt-detail', prompt.id)}
                  className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center cursor-pointer"
                >
                  <div>
                    <h4 className="font-semibold text-slate-700">{prompt.title}</h4>
                    <p className="text-xs text-slate-500 truncate max-w-md">{prompt.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                      <i className="fa-solid fa-heart"></i> {prompt.upvotes}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${
                      prompt.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {prompt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100">
               <h3 className="font-bold text-slate-800 text-lg">Upcoming Deadlines</h3>
             </div>
             <div className="p-6">
               {assignments.length > 0 ? (
                  <div className="space-y-4">
                    {assignments.map(a => (
                      <div 
                        key={a.id} 
                        className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50"
                      >
                        <div className="text-center bg-white p-2 rounded-lg border border-slate-200 min-w-[60px]">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(a.dueDate).toLocaleString('default', { month: 'short' })}</p>
                          <p className="text-xl font-bold text-indigo-600">{new Date(a.dueDate).getDate()}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{a.title}</p>
                          <p className="text-xs text-slate-500">Assignment • {a.status}</p>
                        </div>
                        <button 
                          onClick={() => onNavigate('assignment-detail', a.id)}
                          className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
               ) : (
                 <p className="text-slate-500 text-center py-8 italic">No active assignments</p>
               )}
             </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <i className="fa-solid fa-guitar text-amber-400 text-xl"></i>
              <h3 className="font-bold text-lg">Next Live Session</h3>
            </div>
            <p className="text-indigo-200 text-sm mb-6">
              Tonight at 7:00 PM: Group listening and acoustic walkthrough of "Digital Silence" drafts.
            </p>
            <button className="w-full bg-white text-indigo-900 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg">
              RSVP for Session
            </button>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h3 className="font-bold text-slate-800 text-lg mb-4">Camp Activity</h3>
             <div className="space-y-6">
                {submissions.slice(0, 4).map((sub, i) => (
                  <div key={sub.id} className="flex gap-3 relative cursor-pointer group" onClick={() => onNavigate('song-detail', sub.id)}>
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 z-10 group-hover:bg-indigo-100">
                      <i className="fa-solid fa-music text-xs"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        <span className="font-bold">{sub.camperName}</span> submitted <span className="text-indigo-600 font-semibold">"{sub.title}"</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(sub.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
