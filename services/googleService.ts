import { Prompt, Assignment, Submission, PromptStatus, Comment } from '../types';

// Global declaration for the Google Identity Services script
declare var google: any;

const CLIENT_ID = '663447130691-qgv94vgu9ecbt9a6ntohv3bf50rvlfr6.apps.googleusercontent.com'; 
const SCOPES = 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents';
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
  const requiredSheets = ['Prompts', 'Assignments', 'Submissions', 'Users', 'PromptUpvotes', 'Comments', 'Tags'];
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
    'Assignments!A1:J1',
    'Submissions!A1:O1',
    'Users!A1:H1',
    'PromptUpvotes!A1:E1',
    'Comments!A1:H1',
    'Tags!A1:C1'
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
  if (assignmentsHeader.length < 10) {
    await updateSheetRows(SPREADSHEET_ID, 'Assignments!A1', [[
      'id',
      'promptId',
      'title',
      'dueDate',
      'assignedTo',
      'instructions',
      'status',
      'driveFolderId',
      'deletedAt',
      'deletedBy'
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
  if (commentsHeader.length < 8) {
    await updateSheetRows(SPREADSHEET_ID, 'Comments!A1', [[
      'id',
      'songId',
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
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A2:J1000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === assignment.id);
  const rowValues = [[
    assignment.id,
    assignment.promptId,
    assignment.title,
    assignment.dueDate,
    assignment.assignedTo.join(','),
    assignment.instructions,
    assignment.status,
    assignment.driveFolderId || '',
    assignment.deletedAt || '',
    assignment.deletedBy || ''
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Assignments!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Assignments!A${sheetRow}:J${sheetRow}`;
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
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Prompts!A2:J1000&ranges=Assignments!A2:J1000&ranges=Submissions!A2:O1000`;
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
    createdBy: row[7] || 'Admin',
    deletedAt: row[8] || '',
    deletedBy: row[9] || ''
  }));

  const assignments: Assignment[] = assignmentsRaw.map((row: any[]) => ({
    id: row[0] || Math.random().toString(36).substr(2, 9),
    promptId: row[1] || '',
    title: row[2] || 'Untitled Assignment',
    dueDate: row[3] || '',
    assignedTo: (row[4] || '').split(','),
    instructions: row[5] || '',
    status: (row[6] as 'Open' | 'Closed') || 'Open',
    driveFolderId: row[7] || '',
    deletedAt: row[8] || '',
    deletedBy: row[9] || ''
  }));

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
      versions: JSON.parse(row[6] || '[]'),
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
export const fetchCommentsForSong = async (spreadsheetId: string, songId: string): Promise<Comment[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Comments!A2:H5000`;
  const result = await callGoogleApi(url);
  const rows = result.values || [];

  return rows
    .filter((row: any[]) => row[1] === songId)
    .map((row: any[]) => ({
      id: row[0] || '',
      songId: row[1] || '',
      parentId: row[2] || null,
      author: row[3] || 'Anonymous',
      authorEmail: row[4] || '',
      text: row[5] || '',
      timestamp: row[6] || new Date().toISOString(),
      reactions: row[7] ? JSON.parse(row[7]) : {}
    }));
};

export const createComment = async (
  spreadsheetId: string,
  data: {
    songId: string;
    parentId: string | null;
    author: string;
    authorEmail: string;
    text: string;
  }
): Promise<Comment> => {
  const comment: Comment = {
    id: Math.random().toString(36).substr(2, 9),
    songId: data.songId,
    parentId: data.parentId,
    author: data.author,
    authorEmail: data.authorEmail,
    text: data.text,
    timestamp: new Date().toISOString(),
    reactions: {}
  };

  const rowValues = [[
    comment.id,
    comment.songId,
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
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Comments!A2:H5000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === comment.id);

  if (rowIndex === -1) {
    throw new Error('Comment not found');
  }

  const rowValues = [[
    comment.id,
    comment.songId,
    comment.parentId || '',
    comment.author,
    comment.authorEmail,
    comment.text,
    comment.timestamp,
    JSON.stringify(comment.reactions)
  ]];

  const sheetRow = rowIndex + 2;
  const range = `Comments!A${sheetRow}:H${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const toggleReaction = async (
  spreadsheetId: string,
  commentId: string,
  emoji: string,
  userEmail: string
): Promise<Comment> => {
  const rowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Comments!A2:H5000`;
  const rowsResult = await callGoogleApi(rowsUrl);
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === commentId);

  if (rowIndex === -1) {
    throw new Error('Comment not found');
  }

  const row = rows[rowIndex];
  const comment: Comment = {
    id: row[0],
    songId: row[1],
    parentId: row[2] || null,
    author: row[3],
    authorEmail: row[4],
    text: row[5],
    timestamp: row[6],
    reactions: row[7] ? JSON.parse(row[7]) : {}
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
