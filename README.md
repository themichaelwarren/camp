<div align="center">

# ⛺ Camp

**A collaborative songwriting toolkit built on Google Workspace**

Manage creative prompts, assignments, song submissions, and listening parties — all backed by Google Sheets, Drive, Calendar, and Docs.

</div>

---

## Overview

Camp is a single-page React app designed for running songwriting camps. It gives organizers and participants a shared space to propose creative prompts, receive assignments, submit song versions, collaborate on lyrics, and host listening parties — without needing a traditional backend. Everything syncs to a Google Spreadsheet and uses Google Drive for file storage.

## Features

### Prompts
Propose and vote on creative writing prompts. Each prompt supports markdown descriptions, custom tags, and an upvote system. Prompt status is automatically calculated based on assignment activity: **Unused** → **Active** → **Closed**.

### Assignments
Create assignments from one or more prompts with due dates, instructions (markdown), and optional camper assignments. Creating an assignment automatically provisions a Google Drive folder for submissions and a Google Calendar listening party event.

### Song Submissions
Submit songs with multiple audio versions, lyrics, artwork, and notes. Each version is timestamped so you can track a song's evolution. Lyrics can optionally link to a Google Doc for real-time collaborative editing with revision tracking.

### Audio Player
A built-in music player with queue management, drag-to-reorder, and a Jukebox mode that shuffles through all available songs. A mini player sits in the sidebar, and a full overlay shows the complete queue. Toast notifications appear when songs change while the overlay is closed.

### Listening Parties & Events
Google Calendar integration for scheduling listening sessions. Events auto-generate Google Meet links and sync attendee RSVP status. Events can be linked to assignments and edited directly from the app.

### Inbox
A unified activity feed showing new songs, comments, reactions, prompts, and assignments in reverse chronological order. Filter by type (songs, comments, prompts, assignments) and time range (today, last 7 days, etc.). Polls for updates every 15 seconds.

### Comments & Reactions
Threaded comments on songs, prompts, and assignments with emoji reactions. Comments support markdown and are synced to Google Sheets in real time.

### Camper Profiles
A directory of all participants with profile photos, locations, and custom status fields. Each camper's profile page shows their submitted songs (filterable by prompt tags) and authored prompts.

### Tags
A flexible tagging system for organizing prompts. Tags can be created, searched, and managed through a dedicated interface. Songs inherit tags from their associated prompts for filtering.

### Themes
Three visual themes — **Default**, **Notebook**, and **Modern** — each with light and dark mode support. Theme preference and dark mode setting persist across sessions.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Google Sheets (database), Google Drive (file storage) |
| Auth | Google OAuth 2.0 / Google Identity Services |
| Calendar | Google Calendar API |
| Docs | Google Docs API (lyrics collaboration) |
| Icons | Font Awesome 6 |
| Fonts | Inter, Outfit, IBM Plex Mono |
| Build | Vite |

---

## Google Sheets Schema

Camp uses a single Google Spreadsheet as its database with the following sheets:

| Sheet | Purpose |
|-------|---------|
| `Prompts` | Creative prompts with tags, upvotes, and metadata |
| `Assignments` | Projects linking prompts to due dates and instructions |
| `Submissions` | Song entries with version history (JSON), lyrics, artwork |
| `Users` | Camper profiles, locations, status, profile photos |
| `Comments` | Threaded comments with emoji reactions (JSON) |
| `PromptUpvotes` | Tracks which users upvoted which prompts |
| `Tags` | Tag definitions and creation timestamps |
| `Events` | Google Calendar event records and sync metadata |

Sheets are auto-initialized with headers on first use.

---

## Project Structure

```
camp/
├── App.tsx                    # Root component, routing, and centralized state
├── types.ts                   # TypeScript interfaces and enums
├── utils.ts                   # Shared utility functions
├── index.html                 # Entry point, theme CSS, fonts
│
├── views/
│   ├── Dashboard.tsx          # Home — stats, recent activity, deadlines
│   ├── InboxPage.tsx          # Activity feed with filters
│   ├── PromptsPage.tsx        # Browse, create, and vote on prompts
│   ├── PromptDetail.tsx       # Single prompt with related songs
│   ├── AssignmentsPage.tsx    # Browse and create assignments
│   ├── AssignmentDetail.tsx   # Single assignment with submissions
│   ├── SubmissionsPage.tsx    # Browse all songs, jukebox mode
│   ├── SongDetail.tsx         # Single song with versions and lyrics
│   ├── EventsPage.tsx         # Calendar events and listening parties
│   ├── CampersPage.tsx        # Participant directory
│   ├── CamperDetail.tsx       # Individual camper profile
│   └── SettingsPage.tsx       # Theme, profile, and account settings
│
├── components/
│   ├── Layout.tsx             # Collapsible sidebar, header, mini player
│   ├── NowPlayingOverlay.tsx  # Full-screen player with queue
│   ├── CommentsSection.tsx    # Comment threads
│   ├── Comment.tsx            # Single comment with reactions
│   ├── CommentForm.tsx        # New comment / reply form
│   ├── ReactionPicker.tsx     # Emoji reaction selector
│   ├── SubmitSongModal.tsx    # Song upload form
│   ├── MarkdownEditor.tsx     # Write/preview markdown editor
│   ├── MarkdownPreview.tsx    # Markdown renderer
│   ├── TagInput.tsx           # Multi-select tag input
│   ├── TagManager.tsx         # Tag CRUD interface
│   ├── PromptSelector.tsx     # Single prompt picker
│   ├── MultiPromptSelector.tsx# Multi-prompt picker for assignments
│   └── ArtworkImage.tsx       # Image display with Drive fallback
│
└── services/
    ├── googleService.ts       # All Google API interactions
    └── geminiService.ts       # AI prompt generation and lyrics analysis
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Cloud project with the following APIs enabled:
  - Google Sheets API
  - Google Drive API
  - Google Calendar API
  - Google Docs API
- An OAuth 2.0 Client ID (Web application type)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/camp.git
   cd camp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Google OAuth Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Sign in with Google. On first use, Camp will create a new spreadsheet in your Google Drive and initialize all required sheets automatically.

### Build for Production

```bash
npm run build
```

Output is written to `dist/`.

---

## How It Works

1. **Authentication** — Users sign in with Google OAuth. The app requests scopes for Sheets, Drive, Calendar, and Docs.
2. **Data sync** — On login, all data is fetched from the spreadsheet. A 10-second polling loop keeps everything in sync while the tab is visible.
3. **File storage** — Audio files, artwork, and profile photos are uploaded to Google Drive. The app streams audio directly from Drive for playback.
4. **Calendar sync** — Events created in the app are pushed to Google Calendar. Changes made in Calendar sync back on the next poll cycle.
5. **Collaboration** — Lyrics docs are created in Google Docs and linked from song entries, enabling real-time collaborative editing with revision history.

---

## License

MIT
