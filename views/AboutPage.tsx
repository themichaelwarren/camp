import React, { useState } from 'react';
import { ViewState } from '../types';

interface AboutPageProps {
  onNavigate?: (view: ViewState) => void;
  onStartRadio?: () => void;
}

const Section: React.FC<{ icon: string; title: string; onNavigate?: () => void; children: React.ReactNode }> = ({ icon, title, onNavigate, children }) => (
  <section className="bg-white border border-slate-200 rounded-3xl p-8">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
        <i className={`fa-solid ${icon} text-indigo-500`}></i>
        {title}
      </h3>
      {onNavigate && (
        <button
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors"
        >
          Go to {title}
          <i className="fa-solid fa-arrow-right text-[10px]"></i>
        </button>
      )}
    </div>
    <div className="text-sm text-slate-600 mt-3 space-y-2">{children}</div>
  </section>
);

const AboutPage: React.FC<AboutPageProps> = ({ onNavigate, onStartRadio }) => {
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');

  const handleSubmitFeedback = () => {
    if (!feedbackTitle.trim()) return;
    const label = feedbackType === 'bug' ? 'bug' : 'enhancement';
    const prefix = feedbackType === 'bug' ? '[Bug] ' : '[Feature] ';
    const title = encodeURIComponent(prefix + feedbackTitle.trim());
    const body = encodeURIComponent(feedbackBody.trim());
    window.open(
      `https://github.com/themichaelwarren/camp/issues/new?title=${title}&body=${body}&labels=${label}`,
      '_blank'
    );
    setFeedbackTitle('');
    setFeedbackBody('');
  };

  const nav = (view: ViewState) => onNavigate ? () => onNavigate(view) : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800">About Camp</h2>
        <p className="text-slate-500 text-sm mt-2">
          Camp is a collaborative songwriting platform. Campers submit songs to assignments,
          give each other BOCAs (Best Of Camp Awards), comment on each other's work, and
          track their creative journey across semesters.
        </p>
      </div>

      <Section icon="fa-campground" title="Home" onNavigate={nav('dashboard')}>
        <p>Your dashboard and activity overview. See recent songs, comments, BOCAs, and status updates from across the community at a glance.</p>
      </Section>

      <Section icon="fa-inbox" title="Inbox" onNavigate={nav('inbox')}>
        <p>A chronological activity feed of everything happening in Camp — new songs, comments, BOCAs, prompts, assignments, and status updates.</p>
        <p>Items are grouped by date (Today, Yesterday, This Week, etc.). Use the <strong>Filters</strong> button to narrow by activity type, time range, or a specific camper.</p>
      </Section>

      <Section icon="fa-music" title="Songs" onNavigate={nav('submissions')}>
        <p>Browse all shared songs. Switch between grid and list views, and filter by assignment or semester.</p>
        <p>Click any song to play it, or use the queue button to add it to your Up Next list. Songs default to <strong>Private</strong> when submitted and only become visible to others once the artist toggles them to <strong>Shared</strong>.</p>
      </Section>

      <Section icon="fa-heart" title="Favorites" onNavigate={nav('favorites')}>
        <p>Songs you've favorited for quick access. Tap the heart icon on any song card or song detail page to add it here.</p>
      </Section>

      <Section icon="fa-tasks" title="Assignments" onNavigate={nav('assignments')}>
        <p>Songwriting assignments with due dates and instructions. Each assignment can be linked to one or more prompts and may include an associated listening party event.</p>
        <p>Submit your song from the assignment detail page. Your submission can include audio, lyrics, artwork, production notes, and collaborators.</p>
      </Section>

      <Section icon="fa-lightbulb" title="Prompts" onNavigate={nav('prompts')}>
        <p>Songwriting prompt ideas submitted by campers. Upvote the ones you like — prompts with the most votes can be turned into official assignments.</p>
      </Section>

      <Section icon="fa-calendar-days" title="Events" onNavigate={nav('events')}>
        <p>Calendar events for listening parties, workshops, and other camp activities. Events linked to assignments are created automatically and include Google Meet links and attendee lists.</p>
      </Section>

      <Section icon="fa-graduation-cap" title="Semesters" onNavigate={nav('semesters')}>
        <p>Browse songs organized by semester (e.g., Spring 2025, Summer 2025). A convenient way to explore the camp's musical history over time.</p>
      </Section>

      <Section icon="fa-star" title="BOCAs" onNavigate={nav('bocas')}>
        <p><strong>Best Of Camp Awards.</strong> Give a BOCA to songs you love — each camper can award one BOCA per song. Songs with the most BOCAs rise to the top of the leaderboard.</p>
      </Section>

      <Section icon="fa-users" title="Campers" onNavigate={nav('campers')}>
        <p>Browse all camp members. Each camper's profile shows their songs, prompts, collaborations, and BOCAs received.</p>
      </Section>

      <Section icon="fa-compact-disc" title="Song Detail">
        <p>The full view of a song, including:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Lyrics</strong> — synced from a Google Doc that's created automatically when you submit</li>
          <li><strong>Versions</strong> — upload new versions as your song evolves</li>
          <li><strong>Collaborators</strong> — add featured artists, producers, and co-writers</li>
          <li><strong>Artwork</strong> — upload cover art from your device or Google Drive</li>
          <li><strong>Comments</strong> — discuss the song with other campers</li>
          <li><strong>Private / Shared</strong> — control who can see your song</li>
        </ul>
      </Section>

      <section className="bg-white border border-slate-200 rounded-3xl p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
            <i className="fa-solid fa-radio text-amber-500"></i>
            Audio Player
          </h3>
          {onStartRadio && (
            <button
              onClick={onStartRadio}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-600 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:from-amber-500 hover:to-amber-700 transition-all shadow-sm"
            >
              <i className="fa-solid fa-radio"></i>
              Start Camp Radio
            </button>
          )}
        </div>
        <div className="text-sm text-slate-600 mt-3 space-y-2">
          <p>Play songs directly in the app. The player supports:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><strong>Queue</strong> — add songs to Up Next; reorder by dragging (desktop) or swipe to remove (mobile)</li>
            <li><strong>Camp Radio</strong> — shuffles through all shared songs automatically</li>
            <li><strong>Lock Screen Controls</strong> — play/pause and skip from your phone's lock screen or notification shade</li>
          </ul>
          <p>On mobile, use your device's volume buttons to control playback volume.</p>
        </div>
      </section>

      <Section icon="fa-comments" title="Comments & Reactions">
        <p>Comment on songs, prompts, and assignments. Reply to comments to start threads, and react with emoji to show appreciation. You can edit or delete your own comments.</p>
      </Section>

      <Section icon="fa-gear" title="Settings" onNavigate={nav('settings')}>
        <p>Customize your experience:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Profile</strong> — set your location, status, and profile photo</li>
          <li><strong>Appearance</strong> — light, dark, or system theme</li>
          <li><strong>Date Format</strong> — choose how dates are displayed throughout the app</li>
          <li><strong>Remember Me</strong> — stay signed in across sessions</li>
        </ul>
      </Section>

      {/* Bug Report / Feature Request */}
      <section className="bg-white border border-slate-200 rounded-3xl p-8">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
          <i className="fa-solid fa-bug text-rose-500"></i>
          Feedback & Requests
        </h3>
        <p className="text-sm text-slate-500 mt-2">Found a bug or have an idea for Camp? Submit it below and it'll be tracked on GitHub.</p>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 w-fit">
            <button
              onClick={() => setFeedbackType('bug')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                feedbackType === 'bug' ? 'bg-rose-500 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="fa-solid fa-bug text-[9px]"></i>
              Bug Report
            </button>
            <button
              onClick={() => setFeedbackType('feature')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                feedbackType === 'feature' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="fa-solid fa-lightbulb text-[9px]"></i>
              Feature Request
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              {feedbackType === 'bug' ? 'What went wrong?' : 'What would you like to see?'}
            </label>
            <input
              type="text"
              value={feedbackTitle}
              onChange={e => setFeedbackTitle(e.target.value)}
              placeholder={feedbackType === 'bug' ? 'e.g. Player stops when switching pages' : 'e.g. Dark mode for the audio player'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Details <span className="text-slate-300 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={feedbackBody}
              onChange={e => setFeedbackBody(e.target.value)}
              placeholder={feedbackType === 'bug' ? 'Steps to reproduce, what you expected, what happened instead...' : 'Describe your idea in more detail...'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedbackTitle.trim()}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${
                feedbackType === 'bug'
                  ? 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              <i className="fa-brands fa-github"></i>
              {feedbackType === 'bug' ? 'Report Bug' : 'Request Feature'}
            </button>
            <a
              href="https://github.com/themichaelwarren/camp/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <i className="fa-brands fa-github text-sm"></i>
              View all issues
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
