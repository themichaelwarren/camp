import { Prompt, Assignment, Submission, PromptStatus, Comment, Event, EventAttendee } from '../types';

// Global declaration for the Google Identity Services script
declare var google: any;

const CLIENT_ID = '663447130691-qgv94vgu9ecbt9a6ntohv3bf50rvlfr6.apps.googleusercontent.com'; 
const SCOPES = 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/calendar.events';
const SPREADSHEET_ID = '1ihYCXKBQKTS7Jz4XgybQONAnDfbmkBiCwnAam3td2Vg';
const ASSIGNMENTS_PARENT_FOLDER_ID = '1Lifl1lByscTeluVSfZWSXNuCTh7JSppQ';

let accessToken: string | null = null;
let tokenClient: any = null;
let authReadyCallback: (() => void) | null = null;

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
    if (authReadyCallback) {
      authReadyCallback();
      authReadyCallback = null;
    }
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

export const trySilentSignIn = (hint?: string) => {
  if (tokenClient) {
    tokenClient.requestAccessToken(hint ? { prompt: '', hint } : { prompt: '' });
  } else {
    authReadyCallback = () => tokenClient?.requestAccessToken(hint ? { prompt: '', hint } : { prompt: '' });
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
  const requiredSheets = ['Prompts', 'Assignments', 'Submissions', 'Users', 'PromptUpvotes', 'Comments', 'Tags', 'Events'];
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
    'Prompts!A1:J1',
    'Assignments!A1:L1',
    'Submissions!A1:O1',
    'Users!A1:H1',
    'PromptUpvotes!A1:E1',
    'Comments!A1:I1',
    'Tags!A1:C1',
    'Events!A1:M1'
  ];
  const headerParams = headerRanges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
  const headersCheckUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${headerParams}`;
  const headersResult = await callGoogleApi(headersCheckUrl);
  const headerValues = headersResult.valueRanges || [];

  const promptsHeader = headerValues[0]?.values?.[0] || [];
  if (promptsHeader.length < 10) {
    await updateSheetRows(SPREADSHEET_ID, 'Prompts!A1', [[
      'id',
      'title',
      'description',
      'tags',
      'upvotes',
      'status',
      'createdAt',
      'createdBy',
      'deletedAt',
      'deletedBy'
    ]]);
  }
  const assignmentsHeader = headerValues[1]?.values?.[0] || [];
  if (assignmentsHeader.length < 13) {
    await updateSheetRows(SPREADSHEET_ID, 'Assignments!A1', [[
      'id',
      'promptId',
      'title',
      'startDate',
      'dueDate',
      'assignedTo',
      'instructions',
      'status',
      'driveFolderId',
      'eventId',
      'deletedAt',
      'deletedBy',
      'createdAt'
    ]]);
  }
  const submissionsHeader = headerValues[2]?.values?.[0] || [];
  if (submissionsHeader.length < 15) {
    await updateSheetRows(SPREADSHEET_ID, 'Submissions!A1', [[
      'id',
      'assignmentId',
      'camperId',
      'camperName',
      'title',
      'lyrics',
      'versionsJson',
      'details',
      'updatedAt',
      'lyricsDocUrl',
      'lyricsRevisionCount',
      'artworkFileId',
      'artworkUrl',
      'deletedAt',
      'deletedBy'
    ]]);
  }

  const usersHeader = headerValues[3]?.values?.[0] || [];
  if (usersHeader.length < 8) {
    await updateSheetRows(SPREADSHEET_ID, 'Users!A1', [[
      'id',
      'name',
      'email',
      'picture',
      'lastSignedInAt',
      'location',
      'status',
      'pictureOverrideUrl'
    ]]);
  }

  const upvotesHeader = headerValues[4]?.values?.[0] || [];
  if (upvotesHeader.length < 5) {
    await updateSheetRows(SPREADSHEET_ID, 'PromptUpvotes!A1', [[
      'id',
      'promptId',
      'userEmail',
      'userName',
      'createdAt'
    ]]);
  }

  const commentsHeader = headerValues[5]?.values?.[0] || [];
  if (commentsHeader.length < 9) {
    await updateSheetRows(SPREADSHEET_ID, 'Comments!A1', [[
      'id',
      'entityType',
      'entityId',
      'parentId',
      'author',
      'authorEmail',
      'text',
      'timestamp',
      'reactions'
    ]]);
  }

  const tagsHeader = headerValues[6]?.values?.[0] || [];
  if (tagsHeader.length < 3) {
    await updateSheetRows(SPREADSHEET_ID, 'Tags!A1', [[
      'id',
      'name',
      'createdAt'
    ]]);
  }

  const eventsHeader = headerValues[7]?.values?.[0] || [];
  if (eventsHeader.length < 13) {
    await updateSheetRows(SPREADSHEET_ID, 'Events!A1', [[
      'id',
      'assignmentId',
      'calendarEventId',
      'title',
      'description',
      'startDateTime',
      'endDateTime',
      'location',
      'meetLink',
      'attendeesJson',
      'createdBy',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'deletedBy'
    ]]);
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
    prompt.createdBy,
    prompt.deletedAt || '',
    prompt.deletedBy || ''
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Prompts!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Prompts!A${sheetRow}:J${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const updateAssignmentRow = async (spreadsheetId: string, assignment: Assignment) => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A2:M1000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === assignment.id);
  // Serialize promptIds as comma-separated, falling back to single promptId
  const promptIdsStr = (assignment.promptIds?.length ? assignment.promptIds : [assignment.promptId]).filter(Boolean).join(',');
  const rowValues = [[
    assignment.id,
    promptIdsStr,
    assignment.title,
    assignment.startDate || '',
    assignment.dueDate,
    assignment.assignedTo.join(','),
    assignment.instructions,
    assignment.status,
    assignment.driveFolderId || '',
    assignment.eventId || '',
    assignment.deletedAt || '',
    assignment.deletedBy || '',
    assignment.createdAt || ''
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Assignments!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Assignments!A${sheetRow}:M${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const updateSubmissionRow = async (spreadsheetId: string, submission: Submission) => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Submissions!A2:O1000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === submission.id);
  const rowValues = [[
    submission.id,
    submission.assignmentId,
    submission.camperId,
    submission.camperName,
    submission.title,
    submission.lyrics,
    JSON.stringify(submission.versions),
    submission.details,
    submission.updatedAt,
    submission.lyricsDocUrl || '',
    submission.lyricsRevisionCount ?? 0,
    submission.artworkFileId || '',
    submission.artworkUrl || '',
    submission.deletedAt || '',
    submission.deletedBy || ''
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Submissions!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Submissions!A${sheetRow}:O${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const fetchAllData = async (spreadsheetId: string) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Prompts!A2:J1000&ranges=Assignments!A2:M1000&ranges=Submissions!A2:O1000`;
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
    status: (row[5] as PromptStatus) || PromptStatus.UNUSED,
    createdAt: row[6] || new Date().toISOString(),
    createdBy: row[7] || 'Admin',
    deletedAt: row[8] || '',
    deletedBy: row[9] || ''
  }));

  const assignments: Assignment[] = assignmentsRaw.map((row: any[]) => {
    const promptIdRaw = row[1] || '';
    const promptIdArray = promptIdRaw.split(',').map((id: string) => id.trim()).filter(Boolean);
    return {
      id: row[0] || Math.random().toString(36).substr(2, 9),
      promptId: promptIdArray[0] || '',           // First prompt for backwards compat
      promptIds: promptIdArray,                    // All prompts
      title: row[2] || 'Untitled Assignment',
      startDate: row[3] || '',
      dueDate: row[4] || '',
      assignedTo: (row[5] || '').split(','),
      instructions: row[6] || '',
      status: (row[7] as 'Open' | 'Closed') || 'Open',
      driveFolderId: row[8] || '',
      eventId: row[9] || '',
      deletedAt: row[10] || '',
      deletedBy: row[11] || '',
      createdAt: row[12] || ''
    };
  });

  const submissions: Submission[] = submissionsRaw.map((row: any[]) => {
    const rawRevision = row[10];
    const rawArtworkId = row[11];
    const rawArtworkUrl = row[12];
    const rawDeletedAt = row[13];
    const rawDeletedBy = row[14];
    const legacyArtworkId = row[10];
    const legacyArtworkUrl = row[11];
    const revisionCount = Number.isFinite(parseInt(rawRevision, 10)) ? parseInt(rawRevision, 10) : 0;

    let artworkFileId = rawArtworkId || '';
    let artworkUrl = rawArtworkUrl || '';
    if (!rawArtworkUrl && typeof rawArtworkId === 'string' && rawArtworkId.includes('http')) {
      artworkFileId = '';
      artworkUrl = rawArtworkId;
    }
    if (!artworkFileId && !artworkUrl && legacyArtworkId) {
      artworkFileId = legacyArtworkId;
      artworkUrl = legacyArtworkUrl || '';
    }

    return {
      id: row[0] || Math.random().toString(36).substr(2, 9),
      assignmentId: row[1] || '',
      camperId: row[2] || '',
      camperName: row[3] || 'Anonymous',
      title: row[4] || 'Untitled Song',
      lyrics: row[5] || '',
      versions: (() => { try { return JSON.parse(row[6] || '[]'); } catch { return []; } })(),
      details: row[7] || '',
      updatedAt: row[8] || new Date().toISOString(),
      lyricsDocUrl: row[9] || '',
      lyricsRevisionCount: revisionCount,
      artworkFileId,
      artworkUrl,
      deletedAt: rawDeletedAt || '',
      deletedBy: rawDeletedBy || ''
    };
  });

  return { prompts, assignments, submissions };
};

export const upsertUserProfile = async (spreadsheetId: string, profile: { id: string; name: string; email: string; picture?: string }) => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:H1000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === profile.id || row[2] === profile.email);
  const now = new Date().toISOString();
  const existingRow = rowIndex === -1 ? [] : rows[rowIndex];
  const rowValues = [[
    profile.id,
    profile.name,
    profile.email,
    profile.picture || '',
    now,
    existingRow[5] || '',
    existingRow[6] || '',
    existingRow[7] || ''
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Users!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Users!A${sheetRow}:H${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const fetchCampers = async (spreadsheetId: string) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:H1000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];
  return rows.map((row: any[]) => ({
    id: row[0] || '',
    name: row[1] || '',
    email: row[2] || '',
    picture: row[3] || '',
    lastSignedInAt: row[4] || '',
    location: row[5] || '',
    status: row[6] || '',
    pictureOverrideUrl: row[7] || ''
  }));
};

export const updateUserProfileDetails = async (
  spreadsheetId: string,
  data: { id?: string; email?: string; name?: string; location?: string; status?: string; pictureOverrideUrl?: string }
) => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:H1000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === data.id || row[2] === data.email);
  if (rowIndex === -1) {
    throw new Error('User profile not found');
  }
  const existingRow = rows[rowIndex];
  const rowValues = [[
    existingRow[0],
    data.name || existingRow[1] || '',
    existingRow[2],
    existingRow[3] || '',
    existingRow[4] || '',
    data.location || existingRow[5] || '',
    data.status || existingRow[6] || '',
    data.pictureOverrideUrl || existingRow[7] || ''
  ]];

  const sheetRow = rowIndex + 2;
  const range = `Users!A${sheetRow}:H${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const fetchUserUpvotes = async (spreadsheetId: string, userEmail: string) => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/PromptUpvotes!A2:E5000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];
  return rows
    .filter((row: any[]) => row[2] === userEmail)
    .map((row: any[]) => row[1])
    .filter(Boolean);
};

export const appendPromptUpvote = async (
  spreadsheetId: string,
  data: { promptId: string; userEmail: string; userName: string }
) => {
  const now = new Date().toISOString();
  const row = [[
    Math.random().toString(36).substr(2, 9),
    data.promptId,
    data.userEmail,
    data.userName,
    now
  ]];
  return appendSheetRow(spreadsheetId, 'PromptUpvotes!A1', row);
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

const getAudioMimeType = (file: File) => {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
};

export const uploadAudioToDriveInFolder = async (file: File, folderId?: string) => {
  return uploadFileToDriveInFolder(file, folderId, getAudioMimeType(file));
};

export const uploadArtworkToDriveInFolder = async (file: File, folderId?: string) => {
  return uploadFileToDriveInFolder(file, folderId);
};

export const uploadProfilePhoto = async (file: File) => {
  return uploadFileToDriveInFolder(file, ASSIGNMENTS_PARENT_FOLDER_ID);
};

const uploadFileToDriveInFolder = async (file: File, folderId?: string, mimeTypeOverride?: string) => {
  const metadata = {
    name: file.name,
    mimeType: mimeTypeOverride || file.type,
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
  const nowLabel = `v1 ${new Date().toISOString().slice(0, 10)}`;
  await callGoogleApi(docsUrl, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        insertText: {
          location: { index: 1 },
          text: `${nowLabel}\n${lyrics || ''}`
        }
      }]
    })
  });

  return {
    id: docId,
    webViewLink: `https://docs.google.com/document/d/${docId}/edit`
  };
};

export const appendLyricsRevision = async (
  docId: string,
  revisionLabel: string,
  lyrics: string
) => {
  const doc = await callGoogleApi(`https://docs.googleapis.com/v1/documents/${docId}`);
  const content = doc.body?.content || [];
  const last = content[content.length - 1];
  const endIndex = last?.endIndex ? last.endIndex - 1 : 1;
  const text = `\n\n${revisionLabel}\n${lyrics || ''}`;

  const docsUrl = `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`;
  await callGoogleApi(docsUrl, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        insertText: {
          location: { index: endIndex },
          text
        }
      }]
    })
  });
};

export const fetchDriveFile = async (fileId: string) => {
  if (!accessToken) throw new Error('Not authenticated');
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Failed to fetch Drive file');
  return response.blob();
};

// Comments functions
export const fetchComments = async (
  spreadsheetId: string,
  entityType: 'song' | 'prompt' | 'assignment',
  entityId: string
): Promise<Comment[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Comments!A2:I5000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];

  return rows
    .filter((row: any[]) => row[1] === entityType && row[2] === entityId)
    .map((row: any[]) => ({
      id: row[0] || '',
      entityType: row[1] as 'song' | 'prompt' | 'assignment',
      entityId: row[2] || '',
      parentId: row[3] || null,
      author: row[4] || 'Anonymous',
      authorEmail: row[5] || '',
      text: row[6] || '',
      timestamp: row[7] || new Date().toISOString(),
      reactions: row[8] ? JSON.parse(row[8]) : {}
    }));
};

export const fetchAllComments = async (
  spreadsheetId: string
): Promise<Comment[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Comments!A2:I5000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];

  return rows.map((row: any[]) => ({
    id: row[0] || '',
    entityType: row[1] as 'song' | 'prompt' | 'assignment',
    entityId: row[2] || '',
    parentId: row[3] || null,
    author: row[4] || 'Anonymous',
    authorEmail: row[5] || '',
    text: row[6] || '',
    timestamp: row[7] || new Date().toISOString(),
    reactions: row[8] ? JSON.parse(row[8]) : {}
  }));
};

export const createComment = async (
  spreadsheetId: string,
  data: {
    entityType: 'song' | 'prompt' | 'assignment';
    entityId: string;
    parentId: string | null;
    author: string;
    authorEmail: string;
    text: string;
  }
): Promise<Comment> => {
  const comment: Comment = {
    id: Math.random().toString(36).substr(2, 9),
    entityType: data.entityType,
    entityId: data.entityId,
    parentId: data.parentId,
    author: data.author,
    authorEmail: data.authorEmail,
    text: data.text,
    timestamp: new Date().toISOString(),
    reactions: {}
  };

  const rowValues = [[
    comment.id,
    comment.entityType,
    comment.entityId,
    comment.parentId || '',
    comment.author,
    comment.authorEmail,
    comment.text,
    comment.timestamp,
    JSON.stringify(comment.reactions)
  ]];

  await appendSheetRow(spreadsheetId, 'Comments!A1', rowValues);
  return comment;
};

export const updateCommentRow = async (spreadsheetId: string, comment: Comment) => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Comments!A2:I5000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === comment.id);

  if (rowIndex === -1) {
    throw new Error('Comment not found');
  }

  const rowValues = [[
    comment.id,
    comment.entityType,
    comment.entityId,
    comment.parentId || '',
    comment.author,
    comment.authorEmail,
    comment.text,
    comment.timestamp,
    JSON.stringify(comment.reactions)
  ]];

  const sheetRow = rowIndex + 2;
  const range = `Comments!A${sheetRow}:I${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const toggleReaction = async (
  spreadsheetId: string,
  commentId: string,
  emoji: string,
  userEmail: string
): Promise<Comment> => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Comments!A2:I5000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === commentId);

  if (rowIndex === -1) {
    throw new Error('Comment not found');
  }

  const row = rows[rowIndex];
  const comment: Comment = {
    id: row[0],
    entityType: row[1] as 'song' | 'prompt' | 'assignment',
    entityId: row[2],
    parentId: row[3] || null,
    author: row[4],
    authorEmail: row[5],
    text: row[6],
    timestamp: row[7],
    reactions: row[8] ? JSON.parse(row[8]) : {}
  };

  // Toggle the reaction
  if (!comment.reactions[emoji]) {
    comment.reactions[emoji] = [];
  }

  const userIndex = comment.reactions[emoji].indexOf(userEmail);
  if (userIndex > -1) {
    comment.reactions[emoji].splice(userIndex, 1);
    if (comment.reactions[emoji].length === 0) {
      delete comment.reactions[emoji];
    }
  } else {
    comment.reactions[emoji].push(userEmail);
  }

  await updateCommentRow(spreadsheetId, comment);
  return comment;
};

// Tags functions
export const fetchTags = async (spreadsheetId: string): Promise<string[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tags!A2:C1000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];
  return rows.map((row: any[]) => row[1] || '').filter(Boolean);
};

export const createTag = async (spreadsheetId: string, tagName: string): Promise<string> => {
  const normalized = tagName.trim();
  if (!normalized) throw new Error('Tag name cannot be empty');

  // Check if tag already exists
  const existing = await fetchTags(spreadsheetId);
  if (existing.includes(normalized)) {
    return normalized;
  }

  const row = [[
    Math.random().toString(36).substr(2, 9),
    normalized,
    new Date().toISOString()
  ]];
  await appendSheetRow(spreadsheetId, 'Tags!A1', row);
  return normalized;
};

export const deleteTag = async (spreadsheetId: string, tagName: string): Promise<void> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tags!A2:C1000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[1] === tagName);
  if (rowIndex === -1) throw new Error('Tag not found');

  // Get the Tags sheet numeric ID
  const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const metadata = await callGoogleApi(metadataUrl);
  const tagsSheet = metadata.sheets.find((s: any) => s.properties.title === 'Tags');
  const sheetId = tagsSheet.properties.sheetId;

  // Delete the row (rowIndex is 0-based from row 2, so actual sheet row is rowIndex + 1)
  const sheetRow = rowIndex + 1; // +1 for the header row
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await callGoogleApi(batchUrl, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: sheetRow,
            endIndex: sheetRow + 1
          }
        }
      }]
    })
  });
};

// Calendar API functions
export const createCalendarEvent = async (eventData: {
  title: string;
  description: string;
  startDateTime: string; // ISO 8601
  endDateTime: string; // ISO 8601
  attendees?: { email: string }[];
  location?: string;
}): Promise<{ id: string; meetLink?: string }> => {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const calendarEvent = {
    summary: eventData.title,
    description: eventData.description,
    start: {
      dateTime: eventData.startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: eventData.endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    attendees: eventData.attendees || [],
    location: eventData.location || '',
    conferenceData: {
      createRequest: {
        requestId: Math.random().toString(36).substr(2, 9),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };

  const result = await callGoogleApi(url + '?conferenceDataVersion=1', {
    method: 'POST',
    body: JSON.stringify(calendarEvent)
  });

  return {
    id: result.id,
    meetLink: result.hangoutLink || result.conferenceData?.entryPoints?.[0]?.uri
  };
};

export const updateCalendarEvent = async (
  calendarEventId: string,
  eventData: {
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: { email: string }[];
    location?: string;
  }
): Promise<{ meetLink?: string }> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`;

  const calendarEvent = {
    summary: eventData.title,
    description: eventData.description,
    start: {
      dateTime: eventData.startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: eventData.endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    attendees: eventData.attendees || [],
    location: eventData.location || ''
  };

  const result = await callGoogleApi(url, {
    method: 'PUT',
    body: JSON.stringify(calendarEvent)
  });

  return {
    meetLink: result.hangoutLink || result.conferenceData?.entryPoints?.[0]?.uri
  };
};

export const deleteCalendarEvent = async (calendarEventId: string): Promise<void> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`;
  await callGoogleApi(url, { method: 'DELETE' });
};

export const fetchCalendarEvent = async (calendarEventId: string): Promise<{
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  meetLink?: string;
  attendees: EventAttendee[];
}> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`;
  const result = await callGoogleApi(url);

  return {
    title: result.summary || '',
    description: result.description || '',
    startDateTime: result.start?.dateTime || result.start?.date || '',
    endDateTime: result.end?.dateTime || result.end?.date || '',
    location: result.location || '',
    meetLink: result.hangoutLink || result.conferenceData?.entryPoints?.[0]?.uri,
    attendees: (result.attendees || []).map((a: any) => ({
      email: a.email,
      name: a.displayName,
      responseStatus: a.responseStatus || 'needsAction'
    }))
  };
};

// Events sheet functions
export const fetchEvents = async (spreadsheetId: string): Promise<Event[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Events!A2:O5000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];

  return rows.map((row: any[]) => ({
    id: row[0] || '',
    assignmentId: row[1] || null,
    calendarEventId: row[2] || '',
    title: row[3] || '',
    description: row[4] || '',
    startDateTime: row[5] || '',
    endDateTime: row[6] || '',
    location: row[7] || '',
    meetLink: row[8] || '',
    attendees: row[9] ? JSON.parse(row[9]) : [],
    createdBy: row[10] || '',
    createdAt: row[11] || '',
    updatedAt: row[12] || '',
    deletedAt: row[13] || undefined,
    deletedBy: row[14] || undefined
  }));
};

export const createEvent = async (
  spreadsheetId: string,
  eventData: {
    assignmentId: string | null;
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: string[]; // array of email addresses
    location?: string;
    createdBy: string;
  }
): Promise<Event> => {
  // Create the Calendar event first
  const calendarResult = await createCalendarEvent({
    title: eventData.title,
    description: eventData.description,
    startDateTime: eventData.startDateTime,
    endDateTime: eventData.endDateTime,
    attendees: (eventData.attendees || []).map(email => ({ email })),
    location: eventData.location
  });

  // Create the event record in our sheet
  const event: Event = {
    id: Math.random().toString(36).substr(2, 9),
    assignmentId: eventData.assignmentId,
    calendarEventId: calendarResult.id,
    title: eventData.title,
    description: eventData.description,
    startDateTime: eventData.startDateTime,
    endDateTime: eventData.endDateTime,
    location: eventData.location || '',
    meetLink: calendarResult.meetLink || '',
    attendees: (eventData.attendees || []).map(email => ({
      email,
      responseStatus: 'needsAction' as const
    })),
    createdBy: eventData.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const rowValues = [[
    event.id,
    event.assignmentId || '',
    event.calendarEventId,
    event.title,
    event.description,
    event.startDateTime,
    event.endDateTime,
    event.location,
    event.meetLink,
    JSON.stringify(event.attendees),
    event.createdBy,
    event.createdAt,
    event.updatedAt,
    event.deletedAt || '',
    event.deletedBy || ''
  ]];

  await appendSheetRow(spreadsheetId, 'Events!A1', rowValues);
  return event;
};

export const updateEventRow = async (spreadsheetId: string, event: Event) => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Events!A2:O5000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === event.id);

  if (rowIndex === -1) {
    throw new Error('Event not found');
  }

  const rowValues = [[
    event.id,
    event.assignmentId || '',
    event.calendarEventId,
    event.title,
    event.description,
    event.startDateTime,
    event.endDateTime,
    event.location,
    event.meetLink,
    JSON.stringify(event.attendees),
    event.createdBy,
    event.createdAt,
    event.updatedAt,
    event.deletedAt || '',
    event.deletedBy || ''
  ]];

  const sheetRow = rowIndex + 2;
  const range = `Events!A${sheetRow}:O${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const syncEventFromCalendar = async (spreadsheetId: string, event: Event): Promise<Event> => {
  // Fetch latest data from Google Calendar
  const calendarData = await fetchCalendarEvent(event.calendarEventId);

  // Update our event with the latest data from Calendar
  const updatedEvent: Event = {
    ...event,
    title: calendarData.title,
    description: calendarData.description,
    startDateTime: calendarData.startDateTime,
    endDateTime: calendarData.endDateTime,
    location: calendarData.location || '',
    meetLink: calendarData.meetLink || event.meetLink,
    attendees: calendarData.attendees,
    updatedAt: new Date().toISOString()
  };

  // Update the sheet
  await updateEventRow(spreadsheetId, updatedEvent);
  return updatedEvent;
};
