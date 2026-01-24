
export enum PromptStatus {
  DRAFT = 'Draft',
  ACTIVE = 'Active',
  ARCHIVED = 'Archived'
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
  promptId: string;
  title: string;
  dueDate: string;
  assignedTo: string[];
  instructions: string;
  status: 'Open' | 'Closed';
  driveFolderId?: string;
  deletedAt?: string;
  deletedBy?: string;
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
  details: string;
  updatedAt: string;
  lyricsDocUrl?: string;
  lyricsRevisionCount?: number;
  artworkFileId?: string;
  artworkUrl?: string;
  deletedAt?: string;
  deletedBy?: string;
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
}

export interface Comment {
  id: string;
  songId: string;
  parentId: string | null;
  author: string;
  authorEmail: string;
  text: string;
  timestamp: string;
  reactions: Record<string, string[]>; // emoji -> array of user emails who reacted
}

export type ViewState =
  | 'dashboard'
  | 'prompts'
  | 'assignments'
  | 'submissions'
  | 'campers'
  | 'settings'
  | 'prompt-detail'
  | 'assignment-detail'
  | 'song-detail'
  | 'camper-detail';
