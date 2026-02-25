
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Event, Assignment, ViewState } from '../types';
import * as googleService from '../services/googleService';

interface EventsPageProps {
  events: Event[];
  assignments: Assignment[];
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdateEvent: (event: Event) => void;
  spreadsheetId?: string;
  currentUser?: { name?: string; email?: string } | null;
  viewMode: 'cards' | 'list';
  onViewModeChange: (value: 'cards' | 'list') => void;
}

const EventsPage: React.FC<EventsPageProps> = ({ events, assignments, onNavigate, onUpdateEvent, spreadsheetId, currentUser, viewMode, onViewModeChange }) => {
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [editEventForm, setEditEventForm] = useState({
    title: '',
    description: '',
    startDateTime: '',
    endDateTime: '',
    location: ''
  });
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

  const getAssignmentForEvent = (event: Event) => {
    if (!event.assignmentId) return null;
    return assignments.find(a => a.id === event.assignmentId);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);

    const startDate = new Date(event.startDateTime);
    const endDate = new Date(event.endDateTime);

    setEditEventForm({
      title: event.title,
      description: event.description,
      startDateTime: startDate.toISOString().slice(0, 16),
      endDateTime: endDate.toISOString().slice(0, 16),
      location: event.location || ''
    });
    setShowEventEditModal(true);
  };

  const handleEventEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !spreadsheetId) return;

    const updatedEvent = {
      ...selectedEvent,
      title: editEventForm.title.trim(),
      description: editEventForm.description.trim(),
      startDateTime: new Date(editEventForm.startDateTime).toISOString(),
      endDateTime: new Date(editEventForm.endDateTime).toISOString(),
      location: editEventForm.location.trim(),
      updatedAt: new Date().toISOString()
    };

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

      onUpdateEvent(updatedEvent);
      setShowEventEditModal(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Failed to update event', error);
      alert('Failed to update event. Please try again.');
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    if (!window.confirm('Delete this event? It will be removed from the calendar and hidden from the app.')) return;

    const deletedEvent = {
      ...selectedEvent,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.email || currentUser?.name || 'Unknown'
    };

    // Try to delete from Google Calendar (may already be deleted)
    try {
      await googleService.deleteCalendarEvent(selectedEvent.calendarEventId);
    } catch (error) {
      console.warn('Calendar event may already be deleted', error);
    }

    onUpdateEvent(deletedEvent);
    setShowEventEditModal(false);
    setSelectedEvent(null);
  };

  // Separate upcoming and past events
  const now = new Date();
  const upcomingEvents = events
    .filter(e => !e.deletedAt && new Date(e.startDateTime) >= now)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  const pastEvents = events
    .filter(e => !e.deletedAt && new Date(e.startDateTime) < now)
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Events</h2>
          <p className="text-slate-500 text-sm">Listening parties and camp meetups</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 w-fit">
        <button
          onClick={() => onViewModeChange('cards')}
          className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
            viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cards
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
            viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          List
        </button>
      </div>

      {/* Upcoming Events */}
      <section>
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-calendar-days text-indigo-600"></i>
          Upcoming Events
          <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
            {upcomingEvents.length}
          </span>
        </h3>

        {upcomingEvents.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 text-3xl">
              <i className="fa-solid fa-calendar"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-xl">No upcoming events</h3>
            <p className="text-slate-500 mt-2">Events will appear here when assignments are created</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4 hidden md:table-cell">Location</th>
                  <th className="px-6 py-4 hidden md:table-cell">Attendees</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingEvents.map(event => {
                  const { dateStr, timeStr } = formatEventDateTime(event.startDateTime);
                  const assignment = getAssignmentForEvent(event);
                  return (
                    <tr
                      key={event.id}
                      onClick={() => handleEditEvent(event)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex flex-col items-center justify-center flex-shrink-0">
                            <p className="text-[8px] font-bold uppercase leading-none">{new Date(event.startDateTime).toLocaleString('default', { month: 'short' })}</p>
                            <p className="text-sm font-bold leading-tight">{new Date(event.startDateTime).getDate()}</p>
                          </div>
                          <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{event.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{dateStr} at {timeStr}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell truncate max-w-[160px]">{event.location || 'Virtual'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell">{event.attendees.length || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          {event.meetLink && (
                            <a
                              href={event.meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-green-700 transition-colors"
                            >
                              <i className="fa-solid fa-video"></i>
                              Join
                            </a>
                          )}
                          {assignment && (
                            <button
                              onClick={() => onNavigate('assignment-detail', assignment.id)}
                              className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors"
                            >
                              <i className="fa-solid fa-tasks"></i>
                              Assignment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcomingEvents.map(event => {
              const { dateStr, timeStr } = formatEventDateTime(event.startDateTime);
              const assignment = getAssignmentForEvent(event);

              return (
                <div
                  key={event.id}
                  onClick={() => handleEditEvent(event)}
                  className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 h-16 bg-indigo-100 rounded-xl flex flex-col items-center justify-center">
                      <p className="text-xs font-bold text-indigo-600 uppercase">
                        {new Date(event.startDateTime).toLocaleString('default', { month: 'short' })}
                      </p>
                      <p className="text-2xl font-bold text-indigo-700">
                        {new Date(event.startDateTime).getDate()}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-lg mb-1">{event.title}</h4>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p className="flex items-center gap-2">
                          <i className="fa-solid fa-clock text-slate-400 w-4"></i>
                          {dateStr} at {timeStr}
                        </p>
                        <p className="flex items-center gap-2">
                          <i className="fa-solid fa-location-dot text-slate-400 w-4"></i>
                          {event.location || 'Virtual'}
                        </p>
                        {event.attendees.length > 0 && (
                          <p className="flex items-center gap-2">
                            <i className="fa-solid fa-users text-slate-400 w-4"></i>
                            {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        {event.meetLink && (
                          <a
                            href={event.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <i className="fa-solid fa-video"></i>
                            Join Meet
                          </a>
                        )}
                        {assignment && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onNavigate('assignment-detail', assignment.id); }}
                            className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                          >
                            <i className="fa-solid fa-tasks"></i>
                            View Assignment
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
            Past Events
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {pastEvents.length}
            </span>
          </h3>

          {viewMode === 'list' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4 hidden md:table-cell">Location</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pastEvents.map(event => {
                    const { dateStr, timeStr } = formatEventDateTime(event.startDateTime);
                    const assignment = getAssignmentForEvent(event);
                    return (
                      <tr
                        key={event.id}
                        onClick={() => handleEditEvent(event)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-200 text-slate-500 flex flex-col items-center justify-center flex-shrink-0">
                              <p className="text-[8px] font-bold uppercase leading-none">{new Date(event.startDateTime).toLocaleString('default', { month: 'short' })}</p>
                              <p className="text-sm font-bold leading-tight">{new Date(event.startDateTime).getDate()}</p>
                            </div>
                            <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors truncate">{event.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{dateStr} at {timeStr}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 hidden md:table-cell truncate max-w-[160px]">{event.location || 'Virtual'}</td>
                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                          {assignment && (
                            <button
                              onClick={() => onNavigate('assignment-detail', assignment.id)}
                              className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors"
                            >
                              <i className="fa-solid fa-tasks"></i>
                              Assignment
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pastEvents.map(event => {
                const { dateStr, timeStr } = formatEventDateTime(event.startDateTime);
                const assignment = getAssignmentForEvent(event);

                return (
                  <div
                    key={event.id}
                    onClick={() => handleEditEvent(event)}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-6 opacity-75 cursor-pointer hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-16 h-16 bg-slate-200 rounded-xl flex flex-col items-center justify-center">
                        <p className="text-xs font-bold text-slate-500 uppercase">
                          {new Date(event.startDateTime).toLocaleString('default', { month: 'short' })}
                        </p>
                        <p className="text-2xl font-bold text-slate-600">
                          {new Date(event.startDateTime).getDate()}
                        </p>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-700 text-lg mb-1">{event.title}</h4>
                        <div className="space-y-2 text-sm text-slate-600">
                          <p className="flex items-center gap-2">
                            <i className="fa-solid fa-clock text-slate-400 w-4"></i>
                            {dateStr} at {timeStr}
                          </p>
                          {assignment && (
                            <button
                              onClick={() => onNavigate('assignment-detail', assignment.id)}
                              className="inline-flex items-center gap-2 bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors mt-2"
                            >
                              <i className="fa-solid fa-tasks"></i>
                              View Assignment
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {showEventEditModal && selectedEvent && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-xl text-slate-800">Edit Event</h3>
              <button onClick={() => setShowEventEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleEventEditSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
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
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    Save Event Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="px-5 py-3 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EventsPage;
