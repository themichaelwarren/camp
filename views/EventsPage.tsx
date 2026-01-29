
import React from 'react';
import { Event, Assignment, ViewState } from '../types';

interface EventsPageProps {
  events: Event[];
  assignments: Assignment[];
  onNavigate: (view: ViewState, id?: string) => void;
}

const EventsPage: React.FC<EventsPageProps> = ({ events, assignments, onNavigate }) => {
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

  // Separate upcoming and past events
  const now = new Date();
  const upcomingEvents = events
    .filter(e => !e.deletedAt && new Date(e.startDateTime) >= now)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  const pastEvents = events
    .filter(e => !e.deletedAt && new Date(e.startDateTime) < now)
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Events</h2>
          <p className="text-slate-500 text-sm">Listening parties and camp meetups</p>
        </div>
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
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {upcomingEvents.map(event => {
              const { dateStr, timeStr } = formatEventDateTime(event.startDateTime);
              const assignment = getAssignmentForEvent(event);

              return (
                <div
                  key={event.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md transition-all"
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
                          >
                            <i className="fa-solid fa-video"></i>
                            Join Meet
                          </a>
                        )}
                        {assignment && (
                          <button
                            onClick={() => onNavigate('assignment-detail', assignment.id)}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pastEvents.map(event => {
              const { dateStr, timeStr } = formatEventDateTime(event.startDateTime);
              const assignment = getAssignmentForEvent(event);

              return (
                <div
                  key={event.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-6 opacity-75"
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
        </section>
      )}
    </div>
  );
};

export default EventsPage;
