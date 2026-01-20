
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
}

export type ViewState = 
  | 'dashboard' 
  | 'prompts' 
  | 'assignments' 
  | 'submissions'
  | 'profile'
  | 'settings'
  | 'prompt-detail'
  | 'assignment-detail'
  | 'song-detail';
