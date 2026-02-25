import React from 'react';

const Section: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="bg-white border border-slate-200 rounded-3xl p-8">
    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
      <i className={`fa-solid ${icon} text-indigo-500`}></i>
      {title}
    </h3>
    <div className="text-sm text-slate-600 mt-3 space-y-2">{children}</div>
  </section>
);

const AboutPage: React.FC = () => {
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

      <Section icon="fa-campground" title="Home">
        <p>Your dashboard and activity overview. See recent songs, comments, BOCAs, and status updates from across the community at a glance.</p>
      </Section>

      <Section icon="fa-inbox" title="Inbox">
        <p>A chronological activity feed of everything happening in Camp — new songs, comments, BOCAs, prompts, assignments, and status updates.</p>
        <p>Items are grouped by date (Today, Yesterday, This Week, etc.). Use the <strong>Filters</strong> button to narrow by activity type, time range, or a specific camper.</p>
      </Section>

      <Section icon="fa-music" title="Songs">
        <p>Browse all shared songs. Switch between grid and list views, and filter by assignment or semester.</p>
        <p>Click any song to play it, or use the queue button to add it to your Up Next list. Songs default to <strong>Private</strong> when submitted and only become visible to others once the artist toggles them to <strong>Shared</strong>.</p>
      </Section>

      <Section icon="fa-heart" title="Favorites">
        <p>Songs you've favorited for quick access. Tap the heart icon on any song card or song detail page to add it here.</p>
      </Section>

      <Section icon="fa-tasks" title="Assignments">
        <p>Songwriting assignments with due dates and instructions. Each assignment can be linked to one or more prompts and may include an associated listening party event.</p>
        <p>Submit your song from the assignment detail page. Your submission can include audio, lyrics, artwork, production notes, and collaborators.</p>
      </Section>

      <Section icon="fa-lightbulb" title="Prompts">
        <p>Songwriting prompt ideas submitted by campers. Upvote the ones you like — prompts with the most votes can be turned into official assignments.</p>
      </Section>

      <Section icon="fa-calendar-days" title="Events">
        <p>Calendar events for listening parties, workshops, and other camp activities. Events linked to assignments are created automatically and include Google Meet links and attendee lists.</p>
      </Section>

      <Section icon="fa-graduation-cap" title="Semesters">
        <p>Browse songs organized by semester (e.g., Spring 2025, Summer 2025). A convenient way to explore the camp's musical history over time.</p>
      </Section>

      <Section icon="fa-star" title="BOCAs">
        <p><strong>Best Of Camp Awards.</strong> Give a BOCA to songs you love — each camper can award one BOCA per song. Songs with the most BOCAs rise to the top of the leaderboard.</p>
      </Section>

      <Section icon="fa-users" title="Campers">
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

      <Section icon="fa-play" title="Audio Player">
        <p>Play songs directly in the app. The player supports:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Queue</strong> — add songs to Up Next; reorder by dragging (desktop) or swipe to remove (mobile)</li>
          <li><strong>Jukebox Mode</strong> — shuffles through all shared songs automatically</li>
          <li><strong>Lock Screen Controls</strong> — play/pause and skip from your phone's lock screen or notification shade</li>
        </ul>
        <p>On mobile, use your device's volume buttons to control playback volume.</p>
      </Section>

      <Section icon="fa-comments" title="Comments & Reactions">
        <p>Comment on songs, prompts, and assignments. Reply to comments to start threads, and react with emoji to show appreciation. You can edit or delete your own comments.</p>
      </Section>

      <Section icon="fa-gear" title="Settings">
        <p>Customize your experience:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li><strong>Profile</strong> — set your location, status, and profile photo</li>
          <li><strong>Appearance</strong> — light, dark, or system theme</li>
          <li><strong>Date Format</strong> — choose how dates are displayed throughout the app</li>
          <li><strong>Remember Me</strong> — stay signed in across sessions</li>
        </ul>
      </Section>
    </div>
  );
};

export default AboutPage;
