
export enum PromptStatus {
  UNUSED = 'Unused',
  ACTIVE = 'Active',
  CLOSED = 'Closed'
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  tags: string[];
  upvotes: number;
  status: PromptStatus;
  createdAt: string;
  createdBy: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Assignment {
  id: string;
  promptId: string;           // Keep for backwards compatibility
  promptIds?: string[];       // Primary field for multiple prompts
  title: string;
  startDate?: string;
  dueDate: string;
  assignedTo: string[];
  instructions: string;
  status: 'Open' | 'Closed';
  driveFolderId?: string;
  eventId?: string;
  createdAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  extraCreditPromptIds?: string[];
}

export interface SongVersion {
  id: string;
  timestamp: string;
  audioUrl: string;
  fileName: string;
  notes: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  camperId: string;
  camperName: string;
  title: string;
  lyrics: string;
  versions: SongVersion[];
  primaryVersionId?: string;
  details: string;
  updatedAt: string;
  lyricsDocUrl?: string;
  lyricsRevisionCount?: number;
  artworkFileId?: string;
  artworkUrl?: string;
  deletedAt?: string;
  deletedBy?: string;
  status?: 'private' | 'shared';
  isExtraCredit?: boolean;
  aboutDocUrl?: string;
}

export interface CamperProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
  lastSignedInAt: string;
  location?: string;
  status?: string;
  pictureOverrideUrl?: string;
  statusUpdatedAt?: string;
  intakeSemester?: string;
}

export interface Comment {
  id: string;
  entityType: 'song' | 'prompt' | 'assignment';
  entityId: string;
  parentId: string | null;
  author: string;
  authorEmail: string;
  text: string;
  timestamp: string;
  reactions: Record<string, string[]>; // emoji -> array of user emails who reacted
  editedAt?: string;
}

export interface EventAttendee {
  email: string;
  name?: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface Event {
  id: string;
  assignmentId: string | null;
  calendarEventId: string;
  title: string;
  description: string;
  startDateTime: string; // ISO 8601 datetime
  endDateTime: string; // ISO 8601 datetime
  location?: string;
  meetLink?: string;
  attendees: EventAttendee[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Boca {
  id: string;
  fromEmail: string;
  submissionId: string;
  awardedAt: string;
}

export interface StatusUpdate {
  id: string;
  camperEmail: string;
  camperName: string;
  status: string;
  timestamp: string;
}

export type CollaboratorRole = '' | 'collaborator' | 'featured' | 'producer';

export interface Collaboration {
  id: string;
  submissionId: string;
  camperId: string;
  camperName: string;
  role: CollaboratorRole;
  createdAt: string;
}

export type NotificationType = 'comment_on_song' | 'reply_to_comment' | 'boca_received' | 'reaction_on_comment' | 'new_assignment' | 'deadline_reminder';

export interface Notification {
  id: string;
  recipientEmail: string;
  type: NotificationType;
  triggerUserEmail: string;
  triggerUserName: string;
  entityType: 'song' | 'prompt' | 'assignment';
  entityId: string;
  referenceId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type DocTextSegment = { text: string; bold?: boolean; italic?: boolean };

export interface PlayableTrack {
  versionId: string;
  title: string;
  artist: string;
  camperId?: string;
  submissionId?: string;
  assignmentId?: string;
  assignmentTitle?: string;
  artworkFileId?: string;
  artworkUrl?: string;
}

export type ViewState =
  | 'dashboard'
  | 'inbox'
  | 'prompts'
  | 'assignments'
  | 'submissions'
  | 'events'
  | 'campers'
  | 'settings'
  | 'prompt-detail'
  | 'assignment-detail'
  | 'song-detail'
  | 'event-detail'
  | 'camper-detail'
  | 'bocas'
  | 'favorites'
  | 'semesters'
  | 'semester-detail'
  | 'changelog'
  | 'about'
  | 'feedback';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  comments: number;
}
