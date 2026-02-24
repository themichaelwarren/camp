
import React from 'react';
import { Prompt, Assignment, Submission, Event, PlayableTrack, ViewState, Boca, StatusUpdate } from '../types';
import { getPromptStatus } from '../utils';

interface DashboardProps {
  prompts: Prompt[];
  assignments: Assignment[];
  submissions: Submission[];
  events: Event[];
  campersCount: number;
  isSyncing: boolean;
  onNavigate: (view: ViewState, id?: string) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  bocas?: Boca[];
  statusUpdates?: StatusUpdate[];
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

const Dashboard: React.FC<DashboardProps> = ({ prompts, assignments, submissions, events, campersCount, isSyncing, onNavigate, onPlayTrack, playingTrackId, bocas = [], statusUpdates = [] }) => {
  const stats = [
    { label: 'Active Prompts', value: prompts.filter(p => getPromptStatus(p.id, assignments) === 'Active').length, icon: 'fa-lightbulb', color: 'bg-amber-100 text-amber-600', view: 'prompts' },
    { label: 'Live Assignments', value: assignments.filter(a => a.status === 'Open').length, icon: 'fa-tasks', color: 'bg-indigo-100 text-indigo-600', view: 'assignments' },
    { label: 'Total Songs', value: submissions.length, icon: 'fa-music', color: 'bg-green-100 text-green-600', view: 'submissions' },
    { label: 'Campers Active', value: campersCount, icon: 'fa-users', color: 'bg-purple-100 text-purple-600', view: 'campers' },
  ];

  if (isSyncing) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-indigo-600 text-white text-3xl flex items-center justify-center animate-spin">
            🤘
          </div>
          <p className="text-sm font-semibold text-slate-500">Syncing camp data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100">
               <h3 className="font-bold text-slate-800 text-lg">Upcoming Deadlines</h3>
             </div>
             <div className="p-6">
               {assignments.filter(a => a.status === 'Open').length > 0 ? (
                  <div className="space-y-4">
                    {[...assignments].filter(a => a.status === 'Open').reverse().map(a => (
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

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-800 text-lg">Camp Activity</h3>
               <button
                 onClick={() => onNavigate('inbox')}
                 className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
               >
                 See All Activity
                 <i className="fa-solid fa-arrow-right text-[10px]"></i>
               </button>
             </div>
             <div className="space-y-5">
                {(() => {
                  type ActivityItem = { type: 'song'; date: string; data: typeof submissions[0] }
                    | { type: 'prompt'; date: string; data: typeof prompts[0] }
                    | { type: 'assignment'; date: string; data: typeof assignments[0] }
                    | { type: 'status'; date: string; data: StatusUpdate };

                  const items: ActivityItem[] = [
                    ...submissions.map(s => ({ type: 'song' as const, date: s.versions?.length ? s.versions[0].timestamp : s.updatedAt, data: s })),
                    ...prompts.map(p => ({ type: 'prompt' as const, date: p.createdAt, data: p })),
                    ...assignments.map(a => ({ type: 'assignment' as const, date: a.createdAt || a.startDate || a.dueDate, data: a })),
                    ...statusUpdates.map(su => ({ type: 'status' as const, date: su.timestamp, data: su })),
                  ];
                  items.sort((a, b) => {
                    const ta = new Date(a.date).getTime() || 0;
                    const tb = new Date(b.date).getTime() || 0;
                    return tb - ta;
                  });

                  return items.slice(0, 8).map((item) => {
                    if (item.type === 'song') {
                      const sub = item.data as typeof submissions[0];
                      const track = trackFromSubmission(sub);
                      const bocaCount = bocas.filter(b => b.submissionId === sub.id).length;
                      return (
                        <div key={`song-${sub.id}`} className="flex gap-3 relative cursor-pointer group" onClick={() => onNavigate('song-detail', sub.id)}>
                          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0 z-10 group-hover:bg-green-100">
                            <i className="fa-solid fa-music text-xs"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">
                              <span className="font-bold">{sub.camperName}</span> submitted <span className="text-indigo-600 font-semibold">"{sub.title}"</span>
                              {bocaCount > 0 && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold align-middle">
                                  <i className="fa-solid fa-star text-[8px]"></i>
                                  {bocaCount}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{new Date(item.date).toLocaleDateString()}</p>
                          </div>
                          {track && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                              disabled={playingTrackId === track.versionId}
                              className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors flex-shrink-0 self-center"
                              title="Play"
                            >
                              <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
                            </button>
                          )}
                        </div>
                      );
                    }
                    if (item.type === 'prompt') {
                      const p = item.data as typeof prompts[0];
                      return (
                        <div key={`prompt-${p.id}`} className="flex gap-3 relative cursor-pointer group" onClick={() => onNavigate('prompt-detail', p.id)}>
                          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 z-10 group-hover:bg-amber-100">
                            <i className="fa-solid fa-lightbulb text-xs"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">
                              New prompt: <span className="text-indigo-600 font-semibold">"{p.title}"</span>
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{new Date(item.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      );
                    }
                    if (item.type === 'status') {
                      const su = item.data as StatusUpdate;
                      return (
                        <div key={`status-${su.id}`} className="flex gap-3 relative cursor-pointer group" onClick={() => onNavigate('camper-detail', su.camperEmail)}>
                          <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 shrink-0 z-10 group-hover:bg-sky-100">
                            <i className="fa-solid fa-circle-info text-xs"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">
                              <span className="font-bold">{su.camperName}</span> updated their status
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 italic truncate">"{su.status}"</p>
                            <p className="text-xs text-slate-400 mt-1">{new Date(item.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      );
                    }
                    const a = item.data as typeof assignments[0];
                    return (
                      <div key={`assignment-${a.id}`} className="flex gap-3 relative cursor-pointer group" onClick={() => onNavigate('assignment-detail', a.id)}>
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 z-10 group-hover:bg-indigo-100">
                          <i className="fa-solid fa-tasks text-xs"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700">
                            New assignment: <span className="text-indigo-600 font-semibold">"{a.title}"</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(item.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  });
                })()}
             </div>
          </section>
        </div>

        <div className="space-y-6">
          {(() => {
            const now = new Date();
            const upcomingEvent = events
              .filter(e => !e.deletedAt && new Date(e.startDateTime) >= now)
              .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())[0];

            return upcomingEvent ? (
              <section
                className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl cursor-pointer hover:bg-indigo-800 transition-colors"
                onClick={() => onNavigate('events')}
              >
                <div className="flex items-center gap-3 mb-4">
                  <i className="fa-solid fa-calendar-days text-amber-400 text-xl"></i>
                  <h3 className="font-bold text-lg">Next Live Session</h3>
                </div>
                <p className="text-white text-sm mb-2 font-semibold">
                  {upcomingEvent.title}
                </p>
                <p className="text-white/60 text-xs mb-4">
                  {new Date(upcomingEvent.startDateTime).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })} at {new Date(upcomingEvent.startDateTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
                {upcomingEvent.meetLink ? (
                  <a
                    href={upcomingEvent.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block w-full bg-green-600 text-white font-bold py-2 md:py-3 text-sm md:text-base rounded-xl hover:bg-green-700 transition-colors text-center"
                  >
                    <i className="fa-solid fa-video mr-2"></i>
                    Join Meet
                  </a>
                ) : (
                  <button className="w-full bg-white text-indigo-900 font-bold py-2 md:py-3 text-sm md:text-base rounded-xl hover:bg-indigo-50 transition-colors">
                    View Details
                  </button>
                )}
              </section>
            ) : (
              <section className="bg-slate-100 rounded-2xl p-6 border-2 border-dashed border-slate-300">
                <div className="flex items-center gap-3 mb-4">
                  <i className="fa-solid fa-calendar-days text-slate-400 text-xl"></i>
                  <h3 className="font-bold text-lg text-slate-600">Next Live Session</h3>
                </div>
                <p className="text-slate-500 text-sm mb-6">
                  No upcoming events scheduled. Check back soon!
                </p>
                <button
                  onClick={() => onNavigate('events')}
                  className="w-full bg-indigo-600 text-white font-bold py-2 md:py-3 text-sm md:text-base rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  View All Events
                </button>
              </section>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
