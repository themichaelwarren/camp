import { Prompt, Assignment, Submission, PromptStatus } from '../types';

// Global declaration for the Google Identity Services script
declare var google: any;

const CLIENT_ID = '663447130691-qgv94vgu9ecbt9a6ntohv3bf50rvlfr6.apps.googleusercontent.com'; 
const SCOPES = 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents';
const SPREADSHEET_ID = '1ihYCXKBQKTS7Jz4XgybQONAnDfbmkBiCwnAam3td2Vg';
const ASSIGNMENTS_PARENT_FOLDER_ID = '1Lifl1lByscTeluVSfZWSXNuCTh7JSppQ';

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
  const metadata = await callGoogleApi(metadataUrl);

  const existingSheets = (metadata.sheets || []).map((sheet: any) => sheet.properties?.title);
  const requiredSheets = ['Prompts', 'Assignments', 'Submissions'];
  const missingSheets = requiredSheets.filter((title) => !existingSheets.includes(title));

  if (missingSheets.length > 0) {
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
    await callGoogleApi(batchUrl, {
      method: 'POST',
      body: JSON.stringify({
        requests: missingSheets.map((title) => ({
          addSheet: { properties: { title } }
        }))
      })
    });
  }

  const headerRanges = [
    'Prompts!A1:H1',
    'Assignments!A1:H1',
    'Submissions!A1:J1'
  ];
  const headerParams = headerRanges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
  const headersCheckUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${headerParams}`;
  const headersResult = await callGoogleApi(headersCheckUrl);
  const headerValues = headersResult.valueRanges || [];

  if (!headerValues[0]?.values?.length) {
    await updateSheetRows(SPREADSHEET_ID, 'Prompts!A1', [['id', 'title', 'description', 'tags', 'upvotes', 'status', 'createdAt', 'createdBy']]);
  }
  const assignmentsHeader = headerValues[1]?.values?.[0] || [];
  if (assignmentsHeader.length < 8) {
    await updateSheetRows(SPREADSHEET_ID, 'Assignments!A1', [['id', 'promptId', 'title', 'dueDate', 'assignedTo', 'instructions', 'status', 'driveFolderId']]);
  }
  const submissionsHeader = headerValues[2]?.values?.[0] || [];
  if (submissionsHeader.length < 10) {
    await updateSheetRows(SPREADSHEET_ID, 'Submissions!A1', [['id', 'assignmentId', 'camperId', 'camperName', 'title', 'lyrics', 'versionsJson', 'details', 'updatedAt', 'lyricsDocUrl']]);
  }

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

export const updatePromptRow = async (spreadsheetId: string, prompt: Prompt) => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Prompts!A2:H1000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === prompt.id);
  const rowValues = [[
    prompt.id,
    prompt.title,
    prompt.description,
    prompt.tags.join(','),
    prompt.upvotes,
    prompt.status,
    prompt.createdAt,
    prompt.createdBy
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Prompts!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Prompts!A${sheetRow}:H${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const fetchAllData = async (spreadsheetId: string) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Prompts!A2:H1000&ranges=Assignments!A2:H1000&ranges=Submissions!A2:J1000`;
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
    status: (row[6] as 'Open' | 'Closed') || 'Open',
    driveFolderId: row[7] || ''
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
    updatedAt: row[8] || new Date().toISOString(),
    lyricsDocUrl: row[9] || ''
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

export const createAssignmentFolder = async (assignmentTitle: string) => {
  const url = 'https://www.googleapis.com/drive/v3/files';
  const response = await callGoogleApi(url, {
    method: 'POST',
    body: JSON.stringify({
      name: assignmentTitle,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [ASSIGNMENTS_PARENT_FOLDER_ID]
    })
  });
  return response.id as string;
};

export const uploadAudioToDriveInFolder = async (file: File, folderId?: string) => {
  const metadata = {
    name: file.name,
    mimeType: file.type,
    parents: folderId ? [folderId] : []
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

export const createLyricsDoc = async (title: string, userLabel: string, lyrics: string, folderId?: string) => {
  const safeTitle = title.trim() || 'Untitled Song';
  const safeUser = userLabel.trim() || 'Anonymous';
  const docName = `${safeTitle} - ${safeUser}`;
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const docFile = await callGoogleApi(createUrl, {
    method: 'POST',
    body: JSON.stringify({
      name: docName,
      mimeType: 'application/vnd.google-apps.document',
      parents: folderId ? [folderId] : []
    })
  });

  const docId = docFile.id as string;
  const docsUrl = `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`;
  await callGoogleApi(docsUrl, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        insertText: {
          location: { index: 1 },
          text: lyrics || ''
        }
      }]
    })
  });

  return {
    id: docId,
    webViewLink: `https://docs.google.com/document/d/${docId}/edit`
  };
};
