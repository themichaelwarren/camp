
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Prompt, Submission, PlayableTrack, ViewState, Event } from '../types';
import MultiPromptSelector from '../components/MultiPromptSelector';
import MarkdownPreview from '../components/MarkdownPreview';
import MarkdownEditor from '../components/MarkdownEditor';
import CommentsSection from '../components/CommentsSection';
import SubmitSongModal from '../components/SubmitSongModal';
import * as googleService from '../services/googleService';

interface AssignmentDetailProps {
  assignment: Assignment;
  prompt?: Prompt;
  prompts: Prompt[];
  assignments: Assignment[];
  submissions: Submission[];
  events: Event[];
  campersCount: number;
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdate: (assignment: Assignment) => void;
  onAddPrompt: (prompt: Prompt) => Promise<void>;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  onAddSubmission: (submission: Submission) => void;
  currentUser?: { name: string; email: string };
  spreadsheetId: string;
  availableTags: string[];
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

const AssignmentDetail: React.FC<AssignmentDetailProps> = ({ assignment, prompt, prompts, assignments, submissions, events, campersCount, onNavigate, onUpdate, onAddPrompt, onPlayTrack, onAddToQueue, onAddSubmission, currentUser, spreadsheetId, availableTags }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Initialize promptIds from assignment, falling back to single promptId
  const initialPromptIds = assignment.promptIds?.length ? assignment.promptIds : [assignment.promptId].filter(Boolean);
  const [editForm, setEditForm] = useState({
    title: assignment.title,
    promptIds: initialPromptIds,
    startDate: assignment.startDate || '',
    dueDate: assignment.dueDate,
    instructions: assignment.instructions,
    status: assignment.status
  });

  const [editEventForm, setEditEventForm] = useState({
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    location: ''
  });

  const totalCampers = campersCount || 0;
  const submissionRate = totalCampers > 0 ? Math.round((submissions.length / totalCampers) * 100) : 0;
  const progressInset = totalCampers > 0 ? 100 - (submissions.length / totalCampers * 100) : 100;

  // Find the event associated with this assignment
  const assignmentEvent = assignment.eventId ? events.find(e => e.id === assignment.eventId) : null;

  const formatEventDateTime = (isoDateTime: string) => {
    const date = new Date(isoDateTime);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return { dateStr, timeStr };
  };

  useEffect(() => {
    // Only sync form state when modal is closed to avoid overwriting user's edits
    if (!showEditModal) {
      const promptIds = assignment.promptIds?.length ? assignment.promptIds : [assignment.promptId].filter(Boolean);
      setEditForm({
        title: assignment.title,
        promptIds,
        startDate: assignment.startDate || '',
        dueDate: assignment.dueDate,
        instructions: assignment.instructions,
        status: assignment.status
      });
    }
  }, [assignment, showEditModal]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAssignment: Assignment = {
      ...assignment,
      title: editForm.title.trim(),
      promptId: editForm.promptIds[0] || '',    // First prompt for backwards compat
      promptIds: editForm.promptIds,             // All prompts
      startDate: editForm.startDate,
      dueDate: editForm.dueDate,
      instructions: editForm.instructions.trim(),
      status: editForm.status
    };
    onUpdate(updatedAssignment);
    setShowEditModal(false);
  };

  const handleCloseAssignment = () => {
    if (!window.confirm('Close this assignment? This will prevent new submissions and mark it as archived.')) return;
    onUpdate({ ...assignment, status: 'Closed' });
  };

  const handleDeleteAssignment = () => {
    if (!window.confirm('Delete this assignment? It will be hidden but can be restored later.')) return;
    onUpdate({
      ...assignment,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.email || currentUser?.name || 'Unknown'
    });
    onNavigate('assignments');
  };

  const handleEditEvent = () => {
    if (!assignmentEvent) return;

    // Convert ISO datetime to local datetime-local input format
    const startDate = new Date(assignmentEvent.startDateTime);
    const endDate = new Date(assignmentEvent.endDateTime);

    setEditEventForm({
      title: assignmentEvent.title,
      description: assignmentEvent.description,
      startDateTime: startDate.toISOString().slice(0, 16), // Format for datetime-local input
      endDateTime: endDate.toISOString().slice(0, 16),
      location: assignmentEvent.location || ''
    });
    setShowEventEditModal(true);
  };

  const handleEventEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentEvent || !spreadsheetId) return;

    const updatedEvent = {
      ...assignmentEvent,
      title: editEventForm.title.trim(),
      description: editEventForm.description.trim(),
      startDateTime: new Date(editEventForm.startDateTime).toISOString(),
      endDateTime: new Date(editEventForm.endDateTime).toISOString(),
      location: editEventForm.location.trim(),
      updatedAt: new Date().toISOString()
    };

    // Update via googleService (will sync to both Calendar and Sheet)
    try {
      await googleService.updateCalendarEvent(updatedEvent.calendarEventId, {
        title: updatedEvent.title,
        description: updatedEvent.description,
        startDateTime: updatedEvent.startDateTime,
        endDateTime: updatedEvent.endDateTime,
        attendees: updatedEvent.attendees.map(a => ({ email: a.email })),
        location: updatedEvent.location
      });
      await googleService.updateEventRow(spreadsheetId, updatedEvent);

      setShowEventEditModal(false);
      alert('Event updated! Page will refresh to show changes.');
      window.location.reload(); // Simple refresh to get updated data
    } catch (error) {
      console.error('Failed to update event', error);
      alert('Failed to update event. Please try again.');
    }
  };

  const handleSyncFromCalendar = async () => {
    if (!assignmentEvent || !spreadsheetId) return;

    try {
      await googleService.syncEventFromCalendar(spreadsheetId, assignmentEvent);
      alert('Event synced from Google Calendar! Page will refresh.');
      window.location.reload();
    } catch (error) {
      console.error('Failed to sync event from calendar', error);
      alert('Failed to sync from Google Calendar. Please try again.');
    }
  };

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('assignments')}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{assignment.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                assignment.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {assignment.status}
              </span>
              {assignment.startDate && (
                <span className="text-slate-400 text-xs font-medium">Started {assignment.startDate}</span>
              )}
              <span className="text-slate-400 text-xs font-medium">Due {assignment.dueDate}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSubmitModal(true)}
            className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg shadow-green-200"
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            Submit Song
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
          >
            <i className="fa-solid fa-pen"></i>
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Instructions</h3>
              <MarkdownPreview content={assignment.instructions} className="text-slate-700" />
            </div>
            {(() => {
              const linkedPromptIds = assignment.promptIds?.length ? assignment.promptIds : [assignment.promptId].filter(Boolean);
              const linkedPrompts = linkedPromptIds.map(pid => prompts.find(p => p.id === pid)).filter(Boolean);
              if (linkedPrompts.length === 0) return null;
              return (
                <div className="bg-slate-50 p-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">
                    Linked Prompt{linkedPrompts.length > 1 ? 's' : ''} ({linkedPrompts.length})
                  </p>
                  <div className="space-y-2">
                    {linkedPrompts.map(p => (
                      <div
                        key={p!.id}
                        onClick={() => onNavigate('prompt-detail', p!.id)}
                        className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                            <i className="fa-solid fa-lightbulb text-sm"></i>
                          </div>
                          <span className="font-semibold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                            {p!.title}
                          </span>
                        </div>
                        <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-indigo-400 transition-colors"></i>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>

          <section>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">Submitted Songs</h3>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{submissions.length} Submissions</span>
              </div>
              {submissions.some(s => s.versions?.length > 0 && s.versions[0].id) && (
                <button
                  onClick={async () => {
                    const playable = submissions.map(s => trackFromSubmission(s)).filter((t): t is PlayableTrack => t !== null);
                    if (playable.length === 0) return;
                    await onPlayTrack(playable[0]);
                    for (let i = 1; i < playable.length; i++) {
                      onAddToQueue(playable[i]);
                    }
                  }}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <i className="fa-solid fa-play"></i>
                  Play All ({submissions.filter(s => s.versions?.length > 0).length})
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.map(s => {
                const track = trackFromSubmission(s);
                return (
                  <div
                    key={s.id}
                    onClick={() => onNavigate('song-detail', s.id)}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                        <i className="fa-solid fa-music"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{s.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{s.camperName}</p>
                      </div>
                      {track && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                            title="Play"
                          >
                            <i className="fa-solid fa-play text-xs"></i>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                            title="Add to queue"
                          >
                            <i className="fa-solid fa-list text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 h-16 overflow-hidden">
                      <p className="text-[10px] font-serif italic text-slate-500 line-clamp-2">
                        {s.lyrics}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                      <span>{s.versions.length} VERSION{s.versions.length !== 1 ? 'S' : ''}</span>
                      <span>UPDATED {new Date(s.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
              {submissions.length === 0 && (
                <div className="col-span-2 p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                  <i className="fa-solid fa-music text-3xl mb-4 opacity-20"></i>
                  <p className="font-medium">No submissions for this project yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Project Progress</h3>
            <div className="flex flex-col items-center">
               <div className="w-32 h-32 rounded-full border-8 border-slate-50 flex items-center justify-center relative mb-4">
                 <div className="absolute inset-0 border-8 border-indigo-500 rounded-full" style={{ clipPath: `inset(0 0 ${progressInset}% 0)` }}></div>
                 <span className="text-2xl font-black text-slate-800">{submissionRate}%</span>
               </div>
               <p className="text-sm font-bold text-slate-600 mb-1">{submissions.length} / {totalCampers} Campers</p>
               <p className="text-xs text-slate-400">Submission Rate</p>
            </div>
          </section>

          {assignmentEvent && (
            <section className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-3xl border border-green-200 shadow-sm">
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fa-solid fa-calendar-days"></i>
                Listening Party
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-green-600 font-bold mb-1">Date & Time</p>
                  <p className="text-sm text-green-900 font-semibold">
                    {formatEventDateTime(assignmentEvent.startDateTime).dateStr}
                  </p>
                  <p className="text-sm text-green-800">
                    {formatEventDateTime(assignmentEvent.startDateTime).timeStr}
                  </p>
                </div>
                {assignmentEvent.location && (
                  <div>
                    <p className="text-xs text-green-600 font-bold mb-1">Location</p>
                    <p className="text-sm text-green-900">{assignmentEvent.location}</p>
                  </div>
                )}
                {assignmentEvent.attendees.length > 0 && (
                  <div>
                    <p className="text-xs text-green-600 font-bold mb-1">Attendees</p>
                    <p className="text-sm text-green-900">
                      {assignmentEvent.attendees.length} invited
                    </p>
                  </div>
                )}
                <div className="pt-3 space-y-2">
                  {assignmentEvent.meetLink && (
                    <a
                      href={assignmentEvent.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors"
                    >
                      <i className="fa-solid fa-video"></i>
                      Join Google Meet
                    </a>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleEditEvent}
                      className="flex items-center justify-center gap-2 bg-white text-green-700 border border-green-300 font-bold py-2 rounded-xl hover:bg-green-50 transition-colors text-sm"
                    >
                      <i className="fa-solid fa-pen"></i>
                      Edit
                    </button>
                    <button
                      onClick={handleSyncFromCalendar}
                      className="flex items-center justify-center gap-2 bg-white text-green-700 border border-green-300 font-bold py-2 rounded-xl hover:bg-green-50 transition-colors text-sm"
                      title="Sync changes from Google Calendar"
                    >
                      <i className="fa-solid fa-rotate"></i>
                      Sync
                    </button>
                  </div>
                  <button
                    onClick={() => onNavigate('events')}
                    className="w-full flex items-center justify-center gap-2 bg-white text-green-700 border border-green-300 font-bold py-2 rounded-xl hover:bg-green-50 transition-colors text-sm"
                  >
                    <i className="fa-solid fa-calendar"></i>
                    View All Events
                  </button>
                </div>
              </div>
            </section>
          )}

        </div>
      </div>

      {currentUser && (
        <CommentsSection
          entityType="assignment"
          entityId={assignment.id}
          spreadsheetId={spreadsheetId}
          currentUser={currentUser}
        />
      )}

      {showEditModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-visible animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800">Edit Assignment</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-visible">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={editForm.title}
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Prompts</label>
                <MultiPromptSelector
                  prompts={prompts}
                  assignments={assignments}
                  selectedPromptIds={editForm.promptIds}
                  onChange={(promptIds) => setEditForm({...editForm, promptIds})}
                  onCreatePrompt={onAddPrompt}
                  availableTags={availableTags}
                  spreadsheetId={spreadsheetId}
                  userEmail={currentUser?.email}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={editForm.startDate}
                    onChange={e => setEditForm({...editForm, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={editForm.dueDate}
                    onChange={e => setEditForm({...editForm, dueDate: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instructions / Specific Goals</label>
                <MarkdownEditor
                  value={editForm.instructions}
                  onChange={(instructions) => setEditForm({...editForm, instructions})}
                  placeholder="e.g. Focus on complex chord changes or experimental vocals..."
                  required
                  minHeight="h-48"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={editForm.status}
                  onChange={e => setEditForm({...editForm, status: e.target.value as 'Open' | 'Closed'})}
                >
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                Save Changes
              </button>
              <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100">
                {assignment.status === 'Open' && (
                  <button
                    type="button"
                    onClick={() => { handleCloseAssignment(); setShowEditModal(false); }}
                    className="flex-1 text-amber-600 border border-amber-200 py-2 rounded-xl text-sm font-semibold hover:bg-amber-50 transition-colors"
                  >
                    Close Assignment
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDeleteAssignment}
                  className="flex-1 text-rose-600 border border-rose-200 py-2 rounded-xl text-sm font-semibold hover:bg-rose-50 transition-colors"
                >
                  Delete Assignment
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showEventEditModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-visible animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800">Edit Event</h3>
              <button onClick={() => setShowEventEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleEventEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Event Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={editEventForm.title}
                  onChange={e => setEditEventForm({...editEventForm, title: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-24"
                  value={editEventForm.description}
                  onChange={e => setEditEventForm({...editEventForm, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date & Time</label>
                  <input
                    required
                    type="datetime-local"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={editEventForm.startDateTime}
                    onChange={e => setEditEventForm({...editEventForm, startDateTime: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date & Time</label>
                  <input
                    required
                    type="datetime-local"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={editEventForm.endDateTime}
                    onChange={e => setEditEventForm({...editEventForm, endDateTime: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={editEventForm.location}
                  onChange={e => setEditEventForm({...editEventForm, location: e.target.value})}
                  placeholder="Virtual (Google Meet)"
                />
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                Save Event Changes
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
      {showSubmitModal && (
        <SubmitSongModal
          assignments={[assignment]}
          defaultAssignmentId={assignment.id}
          lockAssignment
          userProfile={currentUser}
          onAdd={(sub) => { onAddSubmission(sub); setShowSubmitModal(false); }}
          onClose={() => setShowSubmitModal(false)}
        />
      )}
    </div>
    </>
  );
};

export default AssignmentDetail;
