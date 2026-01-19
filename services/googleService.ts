import { Prompt, Assignment, Submission, PromptStatus } from '../types';

// Global declaration for the Google Identity Services script
declare var google: any;

const CLIENT_ID = '663447130691-qgv94vgu9ecbt9a6ntohv3bf50rvlfr6.apps.googleusercontent.com'; 
const SCOPES = 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const SPREADSHEET_ID = '1ihYCXKBQKTS7Jz4XgybQONAnDfbmkBiCwnAam3td2Vg';

let accessToken: string | null = null;
let tokenClient: any = null;

export const initGoogleAuth = (onAuthSuccess: (token: string) => void) => {
  if (typeof google === 'undefined') {
    console.error('Google GSI library not found.');
    return;
  }

  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          console.error('Google Auth Error:', response.error, response.error_description);
          // Don't alert here to avoid spamming the user during retries
          return;
        }
        if (response.access_token) {
          accessToken = response.access_token;
          onAuthSuccess(accessToken!);
        }
      },
    });
    console.log('Google Auth Client Initialized');
  } catch (err) {
    console.error('Failed to initialize Google Token Client', err);
  }
};

export const signIn = () => {
  if (tokenClient) {
    // 'select_account' forces the account picker, often resolving 400 policy errors
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  } else {
    alert('Google Identity library is still loading. Please try again in 2 seconds.');
  }
};

export const logout = () => {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      window.location.reload();
    });
  }
};

const callGoogleApi = async (url: string, options: RequestInit = {}) => {
  if (!accessToken) throw new Error('Not authenticated');
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || 'API Call failed');
  }
  return response.json();
};

export const findOrCreateDatabase = async () => {
  const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
  await callGoogleApi(metadataUrl);
  return SPREADSHEET_ID;
};

export const updateSheetRows = async (spreadsheetId: string, range: string, values: any[][]) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  return callGoogleApi(url, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });
};

export const appendSheetRow = async (spreadsheetId: string, range: string, values: any[][]) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  return callGoogleApi(url, {
    method: 'POST',
    body: JSON.stringify({ values })
  });
};

export const fetchAllData = async (spreadsheetId: string) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Prompts!A2:H1000&ranges=Assignments!A2:G1000&ranges=Submissions!A2:I1000`;
  const result = await callGoogleApi(url);
  
  const promptsRaw = result.valueRanges[0].values || [];
  const assignmentsRaw = result.valueRanges[1].values || [];
  const submissionsRaw = result.valueRanges[2].values || [];

  const prompts: Prompt[] = promptsRaw.map((row: any[]) => ({
    id: row[0] || Math.random().toString(36).substr(2, 9),
    title: row[1] || 'Untitled Prompt',
    description: row[2] || '',
    tags: (row[3] || '').split(',').filter((t: string) => t),
    upvotes: parseInt(row[4]) || 0,
    status: (row[5] as PromptStatus) || PromptStatus.DRAFT,
    createdAt: row[6] || new Date().toISOString(),
    createdBy: row[7] || 'Admin'
  }));

  const assignments: Assignment[] = assignmentsRaw.map((row: any[]) => ({
    id: row[0] || Math.random().toString(36).substr(2, 9),
    promptId: row[1] || '',
    title: row[2] || 'Untitled Assignment',
    dueDate: row[3] || '',
    assignedTo: (row[4] || '').split(','),
    instructions: row[5] || '',
    status: (row[6] as 'Open' | 'Closed') || 'Open'
  }));

  const submissions: Submission[] = submissionsRaw.map((row: any[]) => ({
    id: row[0] || Math.random().toString(36).substr(2, 9),
    assignmentId: row[1] || '',
    camperId: row[2] || '',
    camperName: row[3] || 'Anonymous',
    title: row[4] || 'Untitled Song',
    lyrics: row[5] || '',
    versions: JSON.parse(row[6] || '[]'),
    details: row[7] || '',
    updatedAt: row[8] || new Date().toISOString()
  }));

  return { prompts, assignments, submissions };
};

export const fetchUserProfile = async () => {
  const url = 'https://www.googleapis.com/oauth2/v3/userinfo';
  return callGoogleApi(url);
};

export const uploadAudioToDrive = async (file: File) => {
  const metadata = {
    name: file.name,
    mimeType: file.type,
    parents: [] 
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });

  if (!response.ok) throw new Error('Upload to Drive failed');
  return response.json();
};
