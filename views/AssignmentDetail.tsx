
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Prompt, Submission, PlayableTrack, ViewState, Event, Boca, CamperProfile, Collaboration } from '../types';
import { DateFormat, formatDate, getDisplayArtist, trackFromSubmission, getTerm, getTermSortKey, isCurrentOrFutureTerm } from '../utils';
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
  onUpdate?: (assignment: Assignment) => void;
  onAddPrompt?: (prompt: Prompt) => Promise<void>;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  onAddSubmission?: (submission: Submission) => void;
  onCreateEvent?: (assignmentId: string) => Promise<void>;
  currentUser?: { name: string; email: string };
  spreadsheetId?: string;
  availableTags?: string[];
  bocas?: Boca[];
  campers?: CamperProfile[];
  dateFormat: DateFormat;
  favoritedSubmissionIds?: string[];
  onToggleFavorite?: (submissionId: string) => void;
  collaborations: Collaboration[];
  onAddCollaborators?: (submissionId: string, collaborators: Array<{ camperId: string; camperName: string; role: string }>) => void;
}

const AssignmentDetail: React.FC<AssignmentDetailProps> = ({ assignment, prompt, prompts, assignments, submissions, events, campersCount, onNavigate, onUpdate, onAddPrompt, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, onAddSubmission, onCreateEvent, currentUser, spreadsheetId, availableTags = [], bocas = [], campers = [], dateFormat, favoritedSubmissionIds = [], onToggleFavorite, collaborations = [], onAddCollaborators }) => {
  const isPastSemester = !isCurrentOrFutureTerm(getTerm(assignment.dueDate));
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [submissionsViewMode, setSubmissionsViewMode] = useState<'cards' | 'list'>('cards');

  // Initialize promptIds from assignment, falling back to single promptId
  const initialPromptIds = assignment.promptIds?.length ? assignment.promptIds : [assignment.promptId].filter(Boolean);
  const [editForm, setEditForm] = useState({
    title: assignment.title,
    promptIds: initialPromptIds,
    extraCreditPromptIds: assignment.extraCreditPromptIds || [] as string[],
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

  // Count unique participants: submitters + collaborators
  const participantEmails = new Set<string>();
  submissions.forEach(sub => {
    if (sub.camperId) participantEmails.add(sub.camperId.toLowerCase());
    collaborations.filter(c => c.submissionId === sub.id).forEach(c => {
      if (c.camperId) participantEmails.add(c.camperId.toLowerCase());
    });
  });
  const participantCount = participantEmails.size;

  // Total campers = those whose intake semester is on or before the assignment's semester
  const assignmentTerm = assignment.dueDate ? getTerm(assignment.dueDate) : null;
  const assignmentTermKey = assignmentTerm ? getTermSortKey(assignmentTerm) : null;
  const activeCampers = assignmentTermKey !== null
    ? campers.filter(c => c.intakeSemester && getTermSortKey(c.intakeSemester) <= assignmentTermKey).length
    : campers.length;
  const totalCampers = activeCampers || campersCount || 0;
  const submissionRate = totalCampers > 0 ? Math.min(Math.round((participantCount / totalCampers) * 100), 100) : 0;

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
        extraCreditPromptIds: assignment.extraCreditPromptIds || [],
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
      extraCreditPromptIds: editForm.extraCreditPromptIds,
      startDate: editForm.startDate,
      dueDate: editForm.dueDate,
      instructions: editForm.instructions.trim(),
      status: editForm.status
    };
    onUpdate?.(updatedAssignment);
    setShowEditModal(false);
  };

  const handleCloseAssignment = () => {
    if (!window.confirm('Close this assignment? This will prevent new submissions and mark it as archived.')) return;
    onUpdate?.({ ...assignment, status: 'Closed' });
  };

  const handleDeleteAssignment = () => {
    if (!window.confirm('Delete this assignment? It will be hidden but can be restored later.')) return;
    onUpdate?.({
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => onNavigate('assignments')}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 truncate">{assignment.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                assignment.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {assignment.status}
              </span>
              {assignment.startDate && (
                <span className="text-slate-400 text-xs font-medium">Started {formatDate(assignment.startDate, dateFormat)}</span>
              )}
              <span className="text-slate-400 text-xs font-medium">Due {formatDate(assignment.dueDate, dateFormat)}</span>
            </div>
          </div>
        </div>
        {currentUser && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isPastSemester && (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-colors"
              >
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <span className="hidden sm:inline">Submit Song</span>
              </button>
            )}
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
            >
              <i className="fa-solid fa-pen"></i>
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Compact activity ring */}
          <div className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <svg width="48" height="48" viewBox="0 0 48 48" className="flex-shrink-0 text-slate-800 dark:text-slate-100">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#f1f5f9" strokeWidth="5" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke="#6366f1" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - submissionRate / 100)}`}
                transform="rotate(-90 24 24)"
              />
              <text x="24" y="25" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-black" fill="currentColor">
                {submissionRate}%
              </text>
            </svg>
            <div>
              <p className="text-sm font-bold text-slate-700">{participantCount} / {totalCampers} Campers</p>
              <p className="text-[11px] text-slate-400">Submission Rate</p>
            </div>
          </div>

          {/* Listening Party inline */}
          {assignmentEvent ? (
            assignment.status === 'Closed' ? (
              <div className="flex items-center gap-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-calendar-days text-slate-500 text-sm"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">Listening Party</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {formatEventDateTime(assignmentEvent.startDateTime).dateStr} · {formatEventDateTime(assignmentEvent.startDateTime).timeStr}
                    {assignmentEvent.location && ` · ${assignmentEvent.location}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border border-green-200 shadow-sm px-5 py-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-calendar-days text-green-700 text-sm"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-green-900 truncate">Listening Party</p>
                  <p className="text-[11px] text-green-700 truncate">
                    {formatEventDateTime(assignmentEvent.startDateTime).dateStr} · {formatEventDateTime(assignmentEvent.startDateTime).timeStr}
                    {assignmentEvent.location && ` · ${assignmentEvent.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {assignmentEvent.meetLink && (
                    <a
                      href={assignmentEvent.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
                      title="Join Google Meet"
                    >
                      <i className="fa-solid fa-video text-xs"></i>
                    </a>
                  )}
                  <button
                    onClick={handleEditEvent}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-green-700 border border-green-300 hover:bg-green-50 transition-colors"
                    title="Edit event"
                  >
                    <i className="fa-solid fa-pen text-xs"></i>
                  </button>
                  <button
                    onClick={handleSyncFromCalendar}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-green-700 border border-green-300 hover:bg-green-50 transition-colors"
                    title="Sync from Google Calendar"
                  >
                    <i className="fa-solid fa-rotate text-xs"></i>
                  </button>
                </div>
              </div>
            )
          ) : assignment.status !== 'Closed' && currentUser && onCreateEvent ? (
            <button
              onClick={async () => {
                setIsCreatingEvent(true);
                try {
                  await onCreateEvent(assignment.id);
                } finally {
                  setIsCreatingEvent(false);
                }
              }}
              disabled={isCreatingEvent}
              className="flex items-center gap-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-sm px-5 py-4 hover:border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <i className={`fa-solid ${isCreatingEvent ? 'fa-spinner fa-spin' : 'fa-calendar-plus'} text-slate-400 text-sm`}></i>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500">{isCreatingEvent ? 'Creating...' : 'Create Listening Party'}</p>
                <p className="text-[11px] text-slate-400">No event scheduled yet</p>
              </div>
            </button>
          ) : null}
        </div>

        <div className="space-y-6">
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
            {(() => {
              const ecPromptIds = assignment.extraCreditPromptIds || [];
              const ecPrompts = ecPromptIds.map(pid => prompts.find(p => p.id === pid)).filter(Boolean);
              if (ecPrompts.length === 0) return null;
              return (
                <div className="bg-amber-50 p-6 border-t border-amber-100">
                  <p className="text-[10px] font-bold text-amber-600 uppercase mb-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-star text-[8px]"></i>
                    Extra Credit Prompt{ecPrompts.length > 1 ? 's' : ''} ({ecPrompts.length})
                  </p>
                  <div className="space-y-2">
                    {ecPrompts.map(p => (
                      <div
                        key={p!.id}
                        onClick={() => onNavigate('prompt-detail', p!.id)}
                        className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                            <i className="fa-solid fa-star text-sm"></i>
                          </div>
                          <span className="font-semibold text-sm text-slate-800 group-hover:text-amber-700 transition-colors">
                            {p!.title}
                          </span>
                        </div>
                        <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-amber-400 transition-colors"></i>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>

          {(() => {
            const regularSubmissions = submissions.filter(s => !s.isExtraCredit);
            const extraCreditSubmissions = submissions.filter(s => s.isExtraCredit);

            const renderSubmissionCard = (s: Submission, isEC = false) => {
              const track = trackFromSubmission(s, collaborations);
              const bocaCount = bocas.filter(b => b.submissionId === s.id).length;
              const isFav = favoritedSubmissionIds.includes(s.id);
              const accent = isEC ? { bg: 'bg-amber-50', text: 'text-amber-600', hover: 'hover:bg-amber-100', border: 'border-amber-200', hoverBorder: 'hover:border-amber-300', hoverText: 'group-hover:text-amber-700', icon: 'fa-star' } : { bg: 'bg-indigo-50', text: 'text-indigo-600', hover: 'hover:bg-indigo-100', border: 'border-slate-200', hoverBorder: 'hover:border-indigo-300', hoverText: 'group-hover:text-indigo-600', icon: 'fa-music' };
              return (
                <div key={s.id} onClick={() => onNavigate('song-detail', s.id)} className={`bg-white p-6 rounded-2xl border ${accent.border} shadow-sm hover:shadow-md ${accent.hoverBorder} transition-all cursor-pointer group`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-10 h-10 ${accent.bg} ${accent.text} rounded-lg flex items-center justify-center ${accent.hover} transition-colors`}>
                      <i className={`fa-solid ${accent.icon}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold text-slate-800 ${accent.hoverText} transition-colors truncate`}>{s.title}</h4>
                        {bocaCount > 0 && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                            <i className="fa-solid fa-star text-[8px]"></i>
                            {bocaCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{getDisplayArtist(s, collaborations)}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(s.id); }} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isFav ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-300 border border-slate-200 hover:text-red-400 hover:bg-red-50'}`} title={isFav ? 'Remove from favorites' : 'Add to favorites'}>
                        <i className={`${isFav ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
                      </button>
                      {track && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }} disabled={playingTrackId === track.versionId} className={`w-8 h-8 rounded-lg ${accent.bg} ${accent.text} flex items-center justify-center ${accent.hover} transition-colors`} title="Play">
                            <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }} disabled={queueingTrackId === track.versionId} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors" title="Add to queue">
                            <i className={`fa-solid ${queueingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-list'} text-xs`}></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>{s.versions.length} VERSION{s.versions.length !== 1 ? 'S' : ''}</span>
                    <span>UPDATED {formatDate(s.updatedAt, dateFormat)}</span>
                  </div>
                </div>
              );
            };

            const renderSubmissionRow = (s: Submission, isEC = false) => {
              const track = trackFromSubmission(s, collaborations);
              const bocaCount = bocas.filter(b => b.submissionId === s.id).length;
              return (
                <tr key={s.id} onClick={() => onNavigate('song-detail', s.id)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${isEC ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <i className={`fa-solid ${isEC ? 'fa-star' : 'fa-music'} text-xs`}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 truncate">{s.title}</span>
                          {bocaCount > 0 && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5 flex-shrink-0">
                              <i className="fa-solid fa-star text-[7px]"></i>{bocaCount}
                            </span>
                          )}
                          {isEC && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0">EC</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">{getDisplayArtist(s, collaborations)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-500">{formatDate(s.updatedAt, dateFormat)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex gap-1.5 justify-end">
                      {track && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }} disabled={playingTrackId === track.versionId} className={`w-7 h-7 rounded-lg ${isEC ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'} flex items-center justify-center hover:opacity-80 transition-colors`} title="Play">
                            <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-[10px]`}></i>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }} disabled={queueingTrackId === track.versionId} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors" title="Add to queue">
                            <i className={`fa-solid ${queueingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-list'} text-[10px]`}></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            };

            const allDisplaySubmissions = [...regularSubmissions, ...extraCreditSubmissions];

            return (<>
          <section>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-slate-800">Submitted Songs</h3>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{allDisplaySubmissions.length}</span>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1">
                  <button onClick={() => setSubmissionsViewMode('cards')} className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${submissionsViewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Cards</button>
                  <button onClick={() => setSubmissionsViewMode('list')} className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${submissionsViewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>List</button>
                </div>
              </div>
              {submissions.some(s => s.versions?.length > 0 && s.versions[0].id) && (
                <button
                  onClick={async () => {
                    const playable = submissions.map(s => trackFromSubmission(s, collaborations)).filter((t): t is PlayableTrack => t !== null);
                    if (playable.length === 0) return;
                    const shuffled = [...playable].sort(() => Math.random() - 0.5);
                    await onPlayTrack(shuffled[0]);
                    for (let i = 1; i < shuffled.length; i++) {
                      onAddToQueue(shuffled[i]);
                    }
                  }}
                  disabled={!!playingTrackId}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-70"
                >
                  <i className={`fa-solid ${playingTrackId ? 'fa-spinner fa-spin' : 'fa-shuffle'} text-xs`}></i>
                  <span className="hidden sm:inline">Shuffle All ({submissions.filter(s => s.versions?.length > 0).length})</span>
                </button>
              )}
            </div>

            {allDisplaySubmissions.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                <i className="fa-solid fa-music text-3xl mb-4 opacity-20"></i>
                <p className="font-medium">No submissions for this project yet.</p>
              </div>
            ) : submissionsViewMode === 'cards' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {regularSubmissions.map(s => renderSubmissionCard(s, false))}
                </div>
                {extraCreditSubmissions.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <h4 className="text-sm font-bold text-amber-700 uppercase tracking-widest">Extra Credit</h4>
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <i className="fa-solid fa-star text-[8px]"></i>
                        {extraCreditSubmissions.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {extraCreditSubmissions.map(s => renderSubmissionCard(s, true))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="px-3 sm:px-4 py-3">Song</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Updated</th>
                      <th className="px-4 py-3 hidden sm:table-cell"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {regularSubmissions.map(s => renderSubmissionRow(s, false))}
                    {extraCreditSubmissions.map(s => renderSubmissionRow(s, true))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </>);
          })()}
        </div>
      </div>

      {currentUser && (
        <CommentsSection
          entityType="assignment"
          entityId={assignment.id}
          spreadsheetId={spreadsheetId}
          currentUser={currentUser}
          campers={campers}
          entityTitle={assignment.title}
        />
      )}

      {showEditModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-xl text-slate-800">Edit Assignment</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto overflow-x-hidden flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
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
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Extra Credit Prompts <span className="text-slate-400 font-normal normal-case">(optional)</span>
                  </label>
                  <MultiPromptSelector
                    prompts={prompts}
                    assignments={assignments}
                    selectedPromptIds={editForm.extraCreditPromptIds}
                    onChange={(extraCreditPromptIds) => setEditForm({...editForm, extraCreditPromptIds})}
                    onCreatePrompt={onAddPrompt}
                    availableTags={availableTags}
                    spreadsheetId={spreadsheetId}
                    userEmail={currentUser?.email}
                    placeholder="Search for extra credit prompts..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                      value={editForm.startDate}
                      onChange={e => setEditForm({...editForm, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                    <input
                      required
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                    value={editForm.status}
                    onChange={e => setEditForm({...editForm, status: e.target.value as 'Open' | 'Closed'})}
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 shrink-0 space-y-3">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  Save Changes
                </button>
                <div className="flex gap-3">
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
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showEventEditModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4" onClick={() => setShowEventEditModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-xl text-slate-800">Edit Event</h3>
              <button onClick={() => setShowEventEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEventEditSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto overflow-x-hidden flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Event Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                    value={editEventForm.title}
                    onChange={e => setEditEventForm({...editEventForm, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <textarea
                    required
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500 h-24"
                    value={editEventForm.description}
                    onChange={e => setEditEventForm({...editEventForm, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                      value={editEventForm.startDateTime}
                      onChange={e => setEditEventForm({...editEventForm, startDateTime: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                      value={editEventForm.endDateTime}
                      onChange={e => setEditEventForm({...editEventForm, endDateTime: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                    value={editEventForm.location}
                    onChange={e => setEditEventForm({...editEventForm, location: e.target.value})}
                    placeholder="Virtual (Google Meet)"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 shrink-0">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  Save Event Changes
                </button>
              </div>
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
          onAdd={(sub) => { onAddSubmission?.(sub); setShowSubmitModal(false); }}
          onClose={() => setShowSubmitModal(false)}
          campers={campers}
          onAddCollaborators={onAddCollaborators}
        />
      )}
    </div>
    </>
  );
};

export default AssignmentDetail;
