import { Prompt, Assignment, Submission, PromptStatus, Comment, Event, EventAttendee, Collaboration, CollaboratorRole, CamperProfile, Boca, StatusUpdate, Notification, NotificationType } from '../types';
import { getTerm } from '../utils';

// Global declaration for the Google Identity Services script
declare var google: any;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const ASSIGNMENTS_PARENT_FOLDER_ID = import.meta.env.VITE_ASSIGNMENTS_PARENT_FOLDER_ID;

const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SCOPES = isLocalDev
  ? 'openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.events'
  : 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events';

let accessToken: string | null = null;
let tokenClient: any = null;
let authReadyCallback: (() => void) | null = null;

const TOKEN_CACHE_KEY = 'camp-token';
const TOKEN_EXPIRY_KEY = 'camp-token-expiry';

const cacheToken = (token: string, expiresIn: number) => {
  try {
    // Store with a 5-minute buffer so we don't use nearly-expired tokens
    const expiry = Date.now() + (expiresIn - 300) * 1000;
    sessionStorage.setItem(TOKEN_CACHE_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
  } catch { /* storage full or unavailable */ }
};

const clearCachedToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_CACHE_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {}
};

const getCachedToken = (): string | null => {
  try {
    const token = sessionStorage.getItem(TOKEN_CACHE_KEY);
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token && expiry && Date.now() < Number(expiry)) {
      return token;
    }
    clearCachedToken();
  } catch {}
  return null;
};

export const getAccessToken = () => accessToken;

/** Try to restore a cached token without any popup. Returns true if successful. */
export const tryCachedSignIn = (onAuthSuccess: (token: string) => void): boolean => {
  const cached = getCachedToken();
  if (cached) {
    accessToken = cached;
    onAuthSuccess(cached);
    return true;
  }
  return false;
};

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
          cacheToken(response.access_token, response.expires_in || 3600);
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
  clearCachedToken();
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
      window.location.reload();
    });
  }
};

// Silent token refresh — resolves when the auth callback fires with a new token
let refreshPromise: Promise<void> | null = null;

const refreshAccessToken = (): Promise<void> => {
  // Check cache first (might have been refreshed in another tab)
  const cached = getCachedToken();
  if (cached) {
    accessToken = cached;
    return Promise.resolve();
  }
  if (!tokenClient) return Promise.reject(new Error('Session expired — please sign in again.'));
  if (refreshPromise) return refreshPromise;

  refreshPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      refreshPromise = null;
      reject(new Error('Session expired — please sign in again.'));
    }, 8000);

    // Poll for the token to be set by the auth callback
    const check = setInterval(() => {
      if (accessToken) {
        clearTimeout(timeout);
        clearInterval(check);
        refreshPromise = null;
        resolve();
      }
    }, 100);

    tokenClient.requestAccessToken({ prompt: '' });
  });
  return refreshPromise;
};

const callGoogleApi = async (url: string, options: RequestInit = {}, retries = 3): Promise<any> => {
  // Auto-refresh expired token before throwing
  if (!accessToken) {
    try {
      await refreshAccessToken();
    } catch {
      throw new Error('Not authenticated');
    }
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  // Token expired at Google's end — try silent refresh once
  if (response.status === 401 && retries > 0) {
    console.warn('Google API returned 401, attempting token refresh...');
    accessToken = null;
    clearCachedToken();
    try {
      await refreshAccessToken();
      return callGoogleApi(url, options, retries - 1);
    } catch {
      throw new Error('Session expired — please sign in again.');
    }
  }
  if (response.status === 429 && retries > 0) {
    const delay = (4 - retries) * 1500; // 1.5s, 3s, 4.5s
    console.warn(`Google API rate limited (429), retrying in ${delay}ms...`, url);
    await new Promise(r => setTimeout(r, delay));
    return callGoogleApi(url, options, retries - 1);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    const msg = error.error?.message || 'API Call failed';
    console.error(`Google API error ${response.status} on ${options.method || 'GET'} ${url}:`, msg);
    throw new Error(msg);
  }
  return response.json();
};

// --- Sheets Proxy (production routes through Worker; local dev uses direct API) ---

const callSheetsProxy = async (action: string, params: Record<string, any> = {}) => {
  if (!accessToken) {
    try { await refreshAccessToken(); } catch { throw new Error('Not authenticated'); }
  }
  const response = await fetch('/api/sheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...params }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || 'Sheets proxy call failed');
  }
  return response.json();
};

const callSheetsGet = async (range: string) => {
  if (isLocalDev) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
    return callGoogleApi(url);
  }
  return callSheetsProxy('get', { range });
};

const callSheetsBatchGet = async (ranges: string[]) => {
  if (isLocalDev) {
    const params = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${params}`;
    return callGoogleApi(url);
  }
  return callSheetsProxy('batchGet', { ranges });
};

const callSheetsMetadata = async () => {
  if (isLocalDev) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
    return callGoogleApi(url);
  }
  return callSheetsProxy('metadata');
};

const callSheetsBatchUpdate = async (requests: any[]) => {
  if (isLocalDev) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
    return callGoogleApi(url, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }
  return callSheetsProxy('batchUpdate', { requests });
};

export const ensureSpreadsheetAccess = async (): Promise<void> => {
  if (!accessToken) throw new Error('Not authenticated');
  try {
    await callSheetsMetadata();
  } catch {
    throw new Error('Cannot access Camp spreadsheet. Make sure it has been shared with your account.');
  }
};

export const findOrCreateDatabase = async () => {
  const metadata = await callSheetsMetadata();

  const existingSheets = (metadata.sheets || []).map((sheet: any) => sheet.properties?.title);
  const requiredSheets = ['Prompts', 'Assignments', 'Submissions', 'Users', 'PromptUpvotes', 'Comments', 'Tags', 'Events', 'BOCAs', 'StatusUpdates', 'Favorites', 'Collaborators', 'Notifications', 'FeedbackUpvotes'];
  const missingSheets = requiredSheets.filter((title) => !existingSheets.includes(title));

  if (missingSheets.length > 0) {
    await callSheetsBatchUpdate(missingSheets.map((title) => ({
      addSheet: { properties: { title } }
    })));
  }

  const headerRanges = [
    'Prompts!A1:J1',
    'Assignments!A1:L1',
    'Submissions!A1:Q1',
    'Users!A1:H1',
    'PromptUpvotes!A1:E1',
    'Comments!A1:J1',
    'Tags!A1:C1',
    'Events!A1:M1',
    'BOCAs!A1:D1',
    'StatusUpdates!A1:E1',
    'Favorites!A1:D1',
    'Collaborators!A1:F1',
    'Notifications!A1:K1',
    'FeedbackUpvotes!A1:E1'
  ];
  const headersResult = await callSheetsBatchGet(headerRanges);
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
  if (submissionsHeader.length < 17) {
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
      'deletedBy',
      'primaryVersionId',
      'status'
    ]]);
  }

  const usersHeader = headerValues[3]?.values?.[0] || [];
  if (usersHeader.length < 10) {
    await updateSheetRows(SPREADSHEET_ID, 'Users!A1', [[
      'id',
      'name',
      'email',
      'picture',
      'lastSignedInAt',
      'location',
      'status',
      'pictureOverrideUrl',
      'statusUpdatedAt',
      'intakeSemester'
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
  if (commentsHeader.length < 10) {
    await updateSheetRows(SPREADSHEET_ID, 'Comments!A1', [[
      'id',
      'entityType',
      'entityId',
      'parentId',
      'author',
      'authorEmail',
      'text',
      'timestamp',
      'reactions',
      'editedAt'
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

  const bocasHeader = headerValues[8]?.values?.[0] || [];
  if (bocasHeader.length < 4) {
    await updateSheetRows(SPREADSHEET_ID, 'BOCAs!A1', [[
      'id',
      'fromEmail',
      'submissionId',
      'awardedAt'
    ]]);
  }

  const statusUpdatesHeader = headerValues[9]?.values?.[0] || [];
  if (statusUpdatesHeader.length < 5) {
    await updateSheetRows(SPREADSHEET_ID, 'StatusUpdates!A1', [[
      'id',
      'camperEmail',
      'camperName',
      'status',
      'timestamp'
    ]]);
  }

  const favoritesHeader = headerValues[10]?.values?.[0] || [];
  if (favoritesHeader.length < 4) {
    await updateSheetRows(SPREADSHEET_ID, 'Favorites!A1', [[
      'id',
      'userEmail',
      'submissionId',
      'createdAt'
    ]]);
  }

  const collaboratorsHeader = headerValues[11]?.values?.[0] || [];
  if (collaboratorsHeader.length < 6) {
    await updateSheetRows(SPREADSHEET_ID, 'Collaborators!A1', [[
      'id',
      'submissionId',
      'camperId',
      'camperName',
      'role',
      'createdAt'
    ]]);
  }

  const notificationsHeader = headerValues[12]?.values?.[0] || [];
  if (notificationsHeader.length < 11) {
    await updateSheetRows(SPREADSHEET_ID, 'Notifications!A1', [[
      'id',
      'recipientEmail',
      'type',
      'triggerUserEmail',
      'triggerUserName',
      'entityType',
      'entityId',
      'referenceId',
      'message',
      'read',
      'createdAt'
    ]]);
  }

  const feedbackUpvotesHeader = headerValues[13]?.values?.[0] || [];
  if (feedbackUpvotesHeader.length < 5) {
    await updateSheetRows(SPREADSHEET_ID, 'FeedbackUpvotes!A1', [[
      'id',
      'issueNumber',
      'userEmail',
      'userName',
      'createdAt'
    ]]);
  }

  return SPREADSHEET_ID;
};

export const updateSheetRows = async (_spreadsheetId: string, range: string, values: any[][]) => {
  if (isLocalDev) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    return callGoogleApi(url, { method: 'PUT', body: JSON.stringify({ values }) });
  }
  return callSheetsProxy('update', { range, values });
};

export const appendSheetRow = async (_spreadsheetId: string, range: string, values: any[][]) => {
  if (isLocalDev) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    return callGoogleApi(url, { method: 'POST', body: JSON.stringify({ values }) });
  }
  return callSheetsProxy('append', { range, values });
};

export const updatePromptRow = async (spreadsheetId: string, prompt: Prompt) => {
  const rowsResult = await callSheetsGet('Prompts!A2:J1000');
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
  const rowsResult = await callSheetsGet('Assignments!A2:N1000');
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
    assignment.createdAt || '',
    (assignment.extraCreditPromptIds || []).join(',')
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Assignments!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Assignments!A${sheetRow}:N${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const updateSubmissionRow = async (spreadsheetId: string, submission: Submission) => {
  const rowsResult = await callSheetsGet('Submissions!A2:R1000');
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
    submission.deletedBy || '',
    submission.primaryVersionId || '',
    submission.status || '',
    submission.isExtraCredit ? 'true' : ''
  ]];

  if (rowIndex === -1) {
    return appendSheetRow(spreadsheetId, 'Submissions!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Submissions!A${sheetRow}:R${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const clearLyricsForDocSongs = async (spreadsheetId: string) => {
  const rowsResult = await callSheetsGet('Submissions!A2:R1000');
  const rows = rowsResult.values || [];
  // Column F (index 5) = lyrics, Column J (index 9) = lyricsDocUrl
  const updates: { range: string; values: string[][] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const lyricsDocUrl = rows[i][9] || '';
    const lyrics = rows[i][5] || '';
    if (lyricsDocUrl && lyrics) {
      updates.push({ range: `Submissions!F${i + 2}`, values: [['']] });
    }
  }
  if (updates.length === 0) return 0;
  if (isLocalDev) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
    await callGoogleApi(url, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates })
    });
  } else {
    await callSheetsProxy('batchValueUpdate', { data: updates });
  }
  return updates.length;
};

export const fetchAllData = async (spreadsheetId: string, userEmail?: string) => {
  const ranges = [
    'Prompts!A2:J1000',
    'Assignments!A2:N1000',
    'Submissions!A2:R1000',
    'Comments!A2:J5000',
    'Users!A2:J1000',
    'Events!A2:O5000',
    'Tags!A2:C1000',
    'PromptUpvotes!A2:E5000',
    'Favorites!A2:D5000',
    'Collaborators!A2:F5000',
    'BOCAs!A2:D5000',
    'StatusUpdates!A2:E5000',
    'Notifications!A2:K5000',
    'FeedbackUpvotes!A2:E5000'
  ];
  const result = await callSheetsBatchGet(ranges);

  const promptsRaw = result.valueRanges[0].values || [];
  const assignmentsRaw = result.valueRanges[1].values || [];
  const submissionsRaw = result.valueRanges[2].values || [];
  const commentsRaw = result.valueRanges[3].values || [];
  const campersRaw = result.valueRanges[4].values || [];
  const eventsRaw = result.valueRanges[5].values || [];
  const tagsRaw = result.valueRanges[6].values || [];
  const upvotesRaw = result.valueRanges[7].values || [];
  const favoritesRaw = result.valueRanges[8].values || [];
  const collaboratorsRaw = result.valueRanges[9].values || [];
  const bocasRaw = result.valueRanges[10].values || [];
  const statusUpdatesRaw = result.valueRanges[11].values || [];
  const notificationsRaw = result.valueRanges[12]?.values || [];
  const feedbackUpvotesRaw = result.valueRanges[13]?.values || [];

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
      createdAt: row[12] || '',
      extraCreditPromptIds: (row[13] || '').split(',').map((id: string) => id.trim()).filter(Boolean)
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
      deletedBy: rawDeletedBy || '',
      primaryVersionId: row[15] || '',
      status: (row[16] === 'private' || row[16] === 'shared') ? row[16] : undefined,
      isExtraCredit: row[17] === 'true'
    };
  });

  const comments: Comment[] = commentsRaw.map(parseCommentRow);

  const campers: CamperProfile[] = campersRaw.map((row: any[]) => ({
    id: row[0] || '',
    name: row[1] || '',
    email: row[2] || '',
    picture: row[3] || '',
    lastSignedInAt: row[4] || '',
    location: row[5] || '',
    status: row[6] || '',
    pictureOverrideUrl: row[7] || '',
    statusUpdatedAt: row[8] || '',
    intakeSemester: row[9] || ''
  }));

  const events: Event[] = eventsRaw.map((row: any[]) => ({
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

  const tags: string[] = tagsRaw.map((row: any[]) => row[1] || '').filter(Boolean);

  const upvotedPromptIds: string[] = userEmail
    ? upvotesRaw.filter((row: any[]) => row[2] === userEmail).map((row: any[]) => row[1]).filter(Boolean)
    : [];

  const favoritedSubmissionIds: string[] = userEmail
    ? favoritesRaw.filter((row: any[]) => row[1] === userEmail).map((row: any[]) => row[2]).filter(Boolean)
    : [];

  const collaborations: Collaboration[] = collaboratorsRaw
    .filter((row: any[]) => row[0] && row[1])
    .map((row: any[]) => ({
      id: row[0],
      submissionId: row[1],
      camperId: row[2] || '',
      camperName: row[3] || '',
      role: (row[4] || '') as CollaboratorRole,
      createdAt: row[5] || ''
    }));

  const bocas = bocasRaw.map((row: any[]) => ({
    id: row[0] || '',
    fromEmail: row[1] || '',
    submissionId: row[2] || '',
    awardedAt: row[3] || ''
  }));

  const statusUpdates = statusUpdatesRaw.map((row: any[]) => ({
    id: row[0] || '',
    camperEmail: row[1] || '',
    camperName: row[2] || '',
    status: row[3] || '',
    timestamp: row[4] || ''
  }));

  const notifications: Notification[] = userEmail
    ? notificationsRaw
        .filter((row: any[]) => row[1] === userEmail)
        .map((row: any[]) => ({
          id: row[0] || '',
          recipientEmail: row[1] || '',
          type: (row[2] || '') as NotificationType,
          triggerUserEmail: row[3] || '',
          triggerUserName: row[4] || '',
          entityType: (row[5] || 'song') as 'song' | 'prompt' | 'assignment',
          entityId: row[6] || '',
          referenceId: row[7] || '',
          message: row[8] || '',
          read: row[9] === 'true',
          createdAt: row[10] || ''
        }))
    : [];

  const upvotedIssueNumbers: number[] = userEmail
    ? feedbackUpvotesRaw
        .filter((row: any[]) => row[2] === userEmail)
        .map((row: any[]) => parseInt(row[1], 10))
        .filter((n: number) => !isNaN(n))
    : [];

  return { prompts, assignments, submissions, comments, campers, events, tags, upvotedPromptIds, favoritedSubmissionIds, collaborations, bocas, statusUpdates, notifications, upvotedIssueNumbers };
};

// --- Row parsers shared between fetchAllData and fetchPublicData ---

const parseAssignmentRow = (row: any[]): Assignment => {
  const promptIdRaw = row[1] || '';
  const promptIdArray = promptIdRaw.split(',').map((id: string) => id.trim()).filter(Boolean);
  return {
    id: row[0] || Math.random().toString(36).substr(2, 9),
    promptId: promptIdArray[0] || '',
    promptIds: promptIdArray,
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
    createdAt: row[12] || '',
    extraCreditPromptIds: (row[13] || '').split(',').map((id: string) => id.trim()).filter(Boolean)
  };
};

const parseSubmissionRow = (row: any[]): Submission => {
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
    deletedBy: rawDeletedBy || '',
    primaryVersionId: row[15] || '',
    status: (row[16] === 'private' || row[16] === 'shared') ? row[16] : undefined,
    isExtraCredit: row[17] === 'true'
  };
};

const parseCamperRow = (row: any[]): CamperProfile => ({
  id: row[0] || '',
  name: row[1] || '',
  email: row[2] || '',
  picture: row[3] || '',
  lastSignedInAt: row[4] || '',
  location: row[5] || '',
  status: row[6] || '',
  pictureOverrideUrl: row[7] || '',
  statusUpdatedAt: row[8] || '',
  intakeSemester: row[9] || ''
});

const parseCollaboratorRow = (row: any[]): Collaboration => ({
  id: row[0],
  submissionId: row[1],
  camperId: row[2] || '',
  camperName: row[3] || '',
  role: (row[4] || '') as CollaboratorRole,
  createdAt: row[5] || ''
});

const parseBocaRow = (row: any[]): Boca => ({
  id: row[0] || '',
  fromEmail: row[1] || '',
  submissionId: row[2] || '',
  awardedAt: row[3] || ''
});

const parseStatusUpdateRow = (row: any[]): StatusUpdate => ({
  id: row[0] || '',
  camperEmail: row[1] || '',
  camperName: row[2] || '',
  status: row[3] || '',
  timestamp: row[4] || ''
});

export const fetchPublicData = async () => {
  // Try Worker proxy first (hides spreadsheet ID), fall back to direct API for local dev
  let rawData: { assignments: any[][]; submissions: any[][]; campers: any[][]; collaborators: any[][]; bocas: any[][]; statusUpdates: any[][] };

  try {
    const resp = await fetch('/api/public-data');
    if (resp.ok) {
      rawData = await resp.json();
    } else {
      throw new Error('Worker unavailable');
    }
  } catch {
    // Fallback: direct Sheets API for local dev
    const ranges = [
      'Assignments!A2:N1000', 'Submissions!A2:R1000', 'Users!A2:J1000',
      'Collaborators!A2:F5000', 'BOCAs!A2:D5000', 'StatusUpdates!A2:E5000'
    ];
    const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${rangeParams}&key=${API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch public data');
    const result = await resp.json();
    rawData = {
      assignments: result.valueRanges[0].values || [],
      submissions: result.valueRanges[1].values || [],
      campers: result.valueRanges[2].values || [],
      collaborators: result.valueRanges[3].values || [],
      bocas: result.valueRanges[4].values || [],
      statusUpdates: result.valueRanges[5].values || []
    };
  }

  return {
    prompts: [] as Prompt[],
    assignments: rawData.assignments.map(parseAssignmentRow),
    submissions: rawData.submissions.map(parseSubmissionRow),
    comments: [] as Comment[],
    campers: rawData.campers.map(parseCamperRow),
    events: [] as Event[],
    tags: [] as string[],
    upvotedPromptIds: [] as string[],
    favoritedSubmissionIds: [] as string[],
    collaborations: rawData.collaborators.filter((row: any[]) => row[0] && row[1]).map(parseCollaboratorRow),
    bocas: rawData.bocas.map(parseBocaRow),
    statusUpdates: rawData.statusUpdates.map(parseStatusUpdateRow)
  };
};

export const upsertUserProfile = async (spreadsheetId: string, profile: { id: string; name: string; email: string; picture?: string }) => {
  const rowsResult = await callSheetsGet('Users!A2:J1000');
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === profile.id || row[2] === profile.email);
  const now = new Date().toISOString();
  const existingRow = rowIndex === -1 ? [] : rows[rowIndex];
  const isNew = rowIndex === -1;
  const rowValues = [[
    profile.id,
    profile.name,
    profile.email,
    profile.picture || '',
    now,
    existingRow[5] || '',
    existingRow[6] || '',
    existingRow[7] || '',
    existingRow[8] || '',
    isNew ? getTerm(now) : (existingRow[9] || '')
  ]];

  if (isNew) {
    return appendSheetRow(spreadsheetId, 'Users!A1', rowValues);
  }

  const sheetRow = rowIndex + 2;
  const range = `Users!A${sheetRow}:J${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const fetchCampers = async (spreadsheetId: string) => {
  const result = await callSheetsGet('Users!A2:J1000');
  const rows = result.values || [];
  return rows.map((row: any[]) => ({
    id: row[0] || '',
    name: row[1] || '',
    email: row[2] || '',
    picture: row[3] || '',
    lastSignedInAt: row[4] || '',
    location: row[5] || '',
    status: row[6] || '',
    pictureOverrideUrl: row[7] || '',
    statusUpdatedAt: row[8] || '',
    intakeSemester: row[9] || ''
  }));
};

export const updateUserProfileDetails = async (
  spreadsheetId: string,
  data: { id?: string; email?: string; name?: string; location?: string; status?: string; pictureOverrideUrl?: string; intakeSemester?: string }
) => {
  const rowsResult = await callSheetsGet('Users!A2:J1000');
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === data.id || row[2] === data.email);
  if (rowIndex === -1) {
    throw new Error('User profile not found');
  }
  const existingRow = rows[rowIndex];
  const newStatus = data.status || existingRow[6] || '';
  const oldStatus = existingRow[6] || '';
  const statusUpdatedAt = (data.status && newStatus !== oldStatus)
    ? new Date().toISOString()
    : existingRow[8] || '';
  const rowValues = [[
    existingRow[0],
    data.name || existingRow[1] || '',
    existingRow[2],
    existingRow[3] || '',
    existingRow[4] || '',
    data.location || existingRow[5] || '',
    newStatus,
    data.pictureOverrideUrl || existingRow[7] || '',
    statusUpdatedAt,
    data.intakeSemester || existingRow[9] || ''
  ]];

  const sheetRow = rowIndex + 2;
  const range = `Users!A${sheetRow}:J${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const fetchUserUpvotes = async (spreadsheetId: string, userEmail: string) => {
  const result = await callSheetsGet('PromptUpvotes!A2:E5000');
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

// --- Feedback Upvotes ---

export const fetchFeedbackUpvoteCounts = async (spreadsheetId: string): Promise<Record<number, number>> => {
  const result = await callSheetsGet('FeedbackUpvotes!A2:E5000');
  const rows = result.values || [];
  const counts: Record<number, number> = {};
  for (const row of rows) {
    const issueNum = parseInt(row[1], 10);
    if (!isNaN(issueNum)) {
      counts[issueNum] = (counts[issueNum] || 0) + 1;
    }
  }
  return counts;
};

export const appendFeedbackUpvote = async (
  spreadsheetId: string,
  data: { issueNumber: number; userEmail: string; userName: string }
) => {
  const now = new Date().toISOString();
  const row = [[
    Math.random().toString(36).substr(2, 9),
    String(data.issueNumber),
    data.userEmail,
    data.userName,
    now
  ]];
  return appendSheetRow(spreadsheetId, 'FeedbackUpvotes!A1', row);
};

export const createGitHubIssue = async (data: {
  title: string;
  body: string;
  labels: string[];
  submittedBy: string;
}): Promise<{ number: number; html_url: string }> => {
  if (!accessToken) {
    try { await refreshAccessToken(); } catch { throw new Error('Not authenticated'); }
  }
  const baseUrl = isLocalDev ? 'https://camp.themichaelwarren.com' : '';
  const response = await fetch(`${baseUrl}/api/github/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to create issue');
  }
  return response.json();
};

// --- Favorites ---

export const fetchUserFavorites = async (spreadsheetId: string, userEmail: string): Promise<string[]> => {
  const result = await callSheetsGet('Favorites!A2:D5000');
  const rows = result.values || [];
  return rows
    .filter((row: any[]) => row[1] === userEmail)
    .map((row: any[]) => row[2])
    .filter(Boolean);
};

export const appendFavorite = async (
  spreadsheetId: string,
  data: { userEmail: string; submissionId: string }
) => {
  const now = new Date().toISOString();
  const row = [[
    Math.random().toString(36).substr(2, 9),
    data.userEmail,
    data.submissionId,
    now
  ]];
  return appendSheetRow(spreadsheetId, 'Favorites!A1', row);
};

export const removeFavorite = async (
  spreadsheetId: string,
  userEmail: string,
  submissionId: string
): Promise<void> => {
  const result = await callSheetsGet('Favorites!A2:D5000');
  const rows = result.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[1] === userEmail && row[2] === submissionId);
  if (rowIndex === -1) return;

  const metadata = await callSheetsMetadata();
  const favSheet = metadata.sheets.find((s: any) => s.properties.title === 'Favorites');
  const sheetId = favSheet.properties.sheetId;

  const sheetRow = rowIndex + 1; // +1 for header
  await callSheetsBatchUpdate([{
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: sheetRow, endIndex: sheetRow + 1 }
    }
  }]);
};

// --- Collaborators ---

export const fetchAllCollaborations = async (spreadsheetId: string): Promise<Collaboration[]> => {
  const result = await callSheetsGet('Collaborators!A2:F5000');
  const rows = result.values || [];
  return rows
    .filter((row: any[]) => row[0] && row[1])
    .map((row: any[]) => ({
      id: row[0],
      submissionId: row[1],
      camperId: row[2] || '',
      camperName: row[3] || '',
      role: (row[4] || '') as CollaboratorRole,
      createdAt: row[5] || ''
    }));
};

export const addCollaborator = async (
  spreadsheetId: string,
  data: { submissionId: string; camperId: string; camperName: string; role: string }
): Promise<string> => {
  const id = Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();
  const row = [[id, data.submissionId, data.camperId, data.camperName, data.role, now]];
  await appendSheetRow(spreadsheetId, 'Collaborators!A1', row);
  return id;
};

export const removeCollaborator = async (
  spreadsheetId: string,
  collaboratorId: string
): Promise<void> => {
  const result = await callSheetsGet('Collaborators!A2:F5000');
  const rows = result.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === collaboratorId);
  if (rowIndex === -1) return;

  const metadata = await callSheetsMetadata();
  const collabSheet = metadata.sheets.find((s: any) => s.properties.title === 'Collaborators');
  const sheetId = collabSheet.properties.sheetId;

  const sheetRow = rowIndex + 1;
  await callSheetsBatchUpdate([{
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: sheetRow, endIndex: sheetRow + 1 }
    }
  }]);
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
  const result = await response.json();
  // Share uploaded file so all camp members can access it
  shareFilePublicly(result.id).catch(() => {});
  return result;
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

export const extractDocIdFromUrl = (url: string): string | null => {
  const match = url.match(/document\/(?:u\/\d+\/)?d\/([^/]+)/);
  return match ? match[1] : null;
};

export const fetchDocContent = async (docId: string): Promise<import('../types').DocTextSegment[]> => {
  const fetchViaProxy = async () => {
    const base = isLocalDev ? 'https://camp.themichaelwarren.com' : '';
    const resp = await fetch(`${base}/api/lyrics/${docId}`);
    if (!resp.ok) throw new Error('Failed to fetch lyrics');
    return resp.json();
  };

  // Use worker proxy when not authenticated (public mode)
  if (!accessToken) return fetchViaProxy();

  // Try Docs API first; fall back to proxy for docs the user can't access directly
  try {
    const doc = await callGoogleApi(`https://docs.googleapis.com/v1/documents/${docId}`);
    const segments: import('../types').DocTextSegment[] = [];
    const content = doc.body?.content || [];
    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (block.paragraph) {
        if (i > 1) segments.push({ text: '\n' });
        for (const el of block.paragraph.elements || []) {
          if (el.textRun) {
            const text = el.textRun.content?.replace(/\n$/, '') || '';
            if (text) {
              segments.push({
                text,
                bold: el.textRun.textStyle?.bold || false,
                italic: el.textRun.textStyle?.italic || false
              });
            }
          }
        }
      }
    }
    return segments;
  } catch {
    return fetchViaProxy();
  }
};

export const replaceDocContent = async (docId: string, newText: string): Promise<void> => {
  const doc = await callGoogleApi(`https://docs.googleapis.com/v1/documents/${docId}`);
  const content = doc.body?.content || [];
  const last = content[content.length - 1];
  const endIndex = last?.endIndex ? last.endIndex - 1 : 1;

  const requests: any[] = [];
  if (endIndex > 1) {
    requests.push({
      deleteContentRange: {
        range: { startIndex: 1, endIndex }
      }
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text: newText || ''
    }
  });

  const docsUrl = `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`;
  await callGoogleApi(docsUrl, {
    method: 'POST',
    body: JSON.stringify({ requests })
  });
};

export const shareFilePublicly = async (fileId: string): Promise<void> => {
  if (!accessToken) return;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  if (!response.ok) {
    throw new Error(`Failed to share ${fileId}: ${response.status}`);
  }
};

export class DriveAccessError extends Error {
  constructor(public fileId: string, public status: number) {
    super(`Drive access denied for ${fileId} (${status})`);
    this.name = 'DriveAccessError';
  }
}

export const fetchDriveFile = async (fileId: string) => {
  const proxyUrl = isLocalDev ? `https://camp.themichaelwarren.com/api/drive/${fileId}` : `/api/drive/${fileId}`;

  if (!accessToken) {
    // Use Worker proxy for publicly shared files (avoids CORS issues)
    const proxyResponse = await fetch(proxyUrl, { cache: 'no-store' });
    if (proxyResponse.ok) return proxyResponse.blob();
    throw new Error('Not authenticated');
  }
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const fetchOpts = { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' as RequestCache };

  // Try OAuth token (with automatic retries for transient errors)
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url, fetchOpts);
      if (response.ok) return response.blob();
      // Only retry on potentially transient errors (429, 500, 502, 503, 504)
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch {
      // Network error — retry
      if (attempt === 2) break;
    }
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }

  // Fallback: try Worker proxy for publicly shared files
  if (response && (response.status === 403 || response.status === 404)) {
    try {
      const proxyResponse = await fetch(proxyUrl, { cache: 'no-store' });
      if (proxyResponse.ok) return proxyResponse.blob();
    } catch { /* network error */ }
    throw new DriveAccessError(fileId, response.status);
  }
  throw response ? new Error(`Failed to fetch Drive file (${response.status})`) : new Error('Failed to fetch Drive file (network error)');
};

// Comments functions
const parseCommentRow = (row: any[]): Comment => {
  let reactions: Record<string, string[]> = {};
  try { if (row[8]) reactions = JSON.parse(row[8]); } catch { /* corrupted JSON */ }
  return {
    id: row[0] || '',
    entityType: row[1] as 'song' | 'prompt' | 'assignment',
    entityId: row[2] || '',
    parentId: row[3] || null,
    author: row[4] || 'Anonymous',
    authorEmail: row[5] || '',
    text: row[6] || '',
    timestamp: row[7] || new Date().toISOString(),
    reactions,
    editedAt: row[9] || undefined,
  };
};

export const fetchComments = async (
  spreadsheetId: string,
  entityType: 'song' | 'prompt' | 'assignment',
  entityId: string
): Promise<Comment[]> => {
  const result = await callSheetsGet('Comments!A2:J5000');
  const rows = result.values || [];

  return rows
    .filter((row: any[]) => row[1] === entityType && row[2] === entityId)
    .map(parseCommentRow);
};

export const fetchAllComments = async (
  spreadsheetId: string
): Promise<Comment[]> => {
  const result = await callSheetsGet('Comments!A2:J5000');
  const rows = result.values || [];

  return rows.map(parseCommentRow);
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
    JSON.stringify(comment.reactions),
    comment.editedAt || '',
  ]];

  await appendSheetRow(spreadsheetId, 'Comments!A1', rowValues);
  return comment;
};

export const updateCommentRow = async (spreadsheetId: string, comment: Comment) => {
  const rowsResult = await callSheetsGet('Comments!A2:J5000');
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
    JSON.stringify(comment.reactions),
    comment.editedAt || '',
  ]];

  const sheetRow = rowIndex + 2;
  const range = `Comments!A${sheetRow}:J${sheetRow}`;
  return updateSheetRows(spreadsheetId, range, rowValues);
};

export const toggleReaction = async (
  spreadsheetId: string,
  commentId: string,
  emoji: string,
  userEmail: string
): Promise<Comment> => {
  const rowsResult = await callSheetsGet('Comments!A2:J5000');
  const rows = rowsResult.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === commentId);

  if (rowIndex === -1) {
    throw new Error('Comment not found');
  }

  const comment = parseCommentRow(rows[rowIndex]);

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
  const result = await callSheetsGet('Tags!A2:C1000');
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
  const result = await callSheetsGet('Tags!A2:C1000');
  const rows = result.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[1] === tagName);
  if (rowIndex === -1) throw new Error('Tag not found');

  const metadata = await callSheetsMetadata();
  const tagsSheet = metadata.sheets.find((s: any) => s.properties.title === 'Tags');
  const sheetId = tagsSheet.properties.sheetId;

  const sheetRow = rowIndex + 1; // +1 for the header row
  await callSheetsBatchUpdate([{
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: sheetRow, endIndex: sheetRow + 1 }
    }
  }]);
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
  const result = await callSheetsGet('Events!A2:O5000');
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
  const rowsResult = await callSheetsGet('Events!A2:O5000');
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

// BOCAs
export const fetchBocas = async (spreadsheetId: string): Promise<{ id: string; fromEmail: string; submissionId: string; awardedAt: string }[]> => {
  const result = await callSheetsGet('BOCAs!A2:D5000');
  const rows = result.values || [];
  return rows.map((row: any[]) => ({
    id: row[0] || '',
    fromEmail: row[1] || '',
    submissionId: row[2] || '',
    awardedAt: row[3] || ''
  }));
};

export const createBoca = async (
  spreadsheetId: string,
  data: { fromEmail: string; submissionId: string }
): Promise<{ id: string; fromEmail: string; submissionId: string; awardedAt: string }> => {
  const boca = {
    id: Math.random().toString(36).substr(2, 9),
    fromEmail: data.fromEmail,
    submissionId: data.submissionId,
    awardedAt: new Date().toISOString()
  };
  await appendSheetRow(spreadsheetId, 'BOCAs!A1', [[
    boca.id, boca.fromEmail, boca.submissionId, boca.awardedAt
  ]]);
  return boca;
};

// --- Status Updates ---

export const fetchStatusUpdates = async (spreadsheetId: string) => {
  const result = await callSheetsGet('StatusUpdates!A2:E5000');
  const rows = result.values || [];
  return rows.map((row: any[]) => ({
    id: row[0] || '',
    camperEmail: row[1] || '',
    camperName: row[2] || '',
    status: row[3] || '',
    timestamp: row[4] || ''
  }));
};

export const createStatusUpdate = async (
  spreadsheetId: string,
  data: { camperEmail: string; camperName: string; status: string }
) => {
  const entry = {
    id: Math.random().toString(36).substr(2, 9),
    camperEmail: data.camperEmail,
    camperName: data.camperName,
    status: data.status,
    timestamp: new Date().toISOString()
  };
  await appendSheetRow(spreadsheetId, 'StatusUpdates!A1', [[
    entry.id, entry.camperEmail, entry.camperName, entry.status, entry.timestamp
  ]]);
  return entry;
};

// --- Notifications ---

export const createNotification = async (
  spreadsheetId: string,
  data: {
    recipientEmail: string;
    type: NotificationType;
    triggerUserEmail: string;
    triggerUserName: string;
    entityType: 'song' | 'prompt' | 'assignment';
    entityId: string;
    referenceId: string;
    message: string;
  }
): Promise<Notification | null> => {
  if (data.recipientEmail === data.triggerUserEmail) return null;

  const notification: Notification = {
    id: Math.random().toString(36).substr(2, 9),
    ...data,
    read: false,
    createdAt: new Date().toISOString()
  };

  await appendSheetRow(spreadsheetId, 'Notifications!A1', [[
    notification.id,
    notification.recipientEmail,
    notification.type,
    notification.triggerUserEmail,
    notification.triggerUserName,
    notification.entityType,
    notification.entityId,
    notification.referenceId,
    notification.message,
    'false',
    notification.createdAt
  ]]);

  return notification;
};

export const createNotifications = async (
  spreadsheetId: string,
  items: Array<{
    recipientEmail: string;
    type: NotificationType;
    triggerUserEmail: string;
    triggerUserName: string;
    entityType: 'song' | 'prompt' | 'assignment';
    entityId: string;
    referenceId: string;
    message: string;
  }>
): Promise<Notification[]> => {
  const filtered = items.filter(item => item.recipientEmail !== item.triggerUserEmail);
  if (filtered.length === 0) return [];

  const notifications: Notification[] = filtered.map(item => ({
    id: Math.random().toString(36).substr(2, 9),
    ...item,
    read: false,
    createdAt: new Date().toISOString()
  }));

  const rows = notifications.map(n => [
    n.id, n.recipientEmail, n.type, n.triggerUserEmail, n.triggerUserName,
    n.entityType, n.entityId, n.referenceId, n.message, 'false', n.createdAt
  ]);

  await appendSheetRow(spreadsheetId, 'Notifications!A1', rows);
  return notifications;
};

export const markNotificationRead = async (
  spreadsheetId: string,
  notificationId: string
): Promise<void> => {
  const result = await callSheetsGet('Notifications!A2:K5000');
  const rows = result.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === notificationId);
  if (rowIndex === -1) return;

  const sheetRow = rowIndex + 2;
  await updateSheetRows(spreadsheetId, `Notifications!J${sheetRow}`, [['true']]);
};

export const markAllNotificationsRead = async (
  spreadsheetId: string,
  userEmail: string
): Promise<void> => {
  const result = await callSheetsGet('Notifications!A2:K5000');
  const rows = result.values || [];

  const updates: Promise<any>[] = [];
  rows.forEach((row: any[], index: number) => {
    if (row[1] === userEmail && row[9] !== 'true') {
      const sheetRow = index + 2;
      updates.push(updateSheetRows(spreadsheetId, `Notifications!J${sheetRow}`, [['true']]));
    }
  });

  if (updates.length > 0) await Promise.all(updates);
};

export const backfillNotifications = async (
  spreadsheetId: string,
  data: {
    comments: Comment[];
    bocas: Boca[];
    submissions: Submission[];
    campers: CamperProfile[];
  }
): Promise<number> => {
  const { comments, bocas, submissions, campers } = data;
  const submissionMap = new Map(submissions.map(s => [s.id, s]));
  const commentMap = new Map(comments.map(c => [c.id, c]));
  const camperMap = new Map(campers.map(c => [c.email, c]));
  const getName = (email: string) => camperMap.get(email)?.name || email;

  const rows: string[][] = [];

  // Comments on songs
  for (const comment of comments) {
    if (comment.parentId) continue; // skip replies, handled below
    if (comment.entityType !== 'song') continue;
    const submission = submissionMap.get(comment.entityId);
    if (!submission || submission.camperId === comment.authorEmail) continue;
    rows.push([
      Math.random().toString(36).substr(2, 9),
      submission.camperId,
      'comment_on_song',
      comment.authorEmail,
      comment.author || getName(comment.authorEmail),
      'song',
      comment.entityId,
      comment.id,
      `commented on "${submission.title}"`,
      'true',
      comment.timestamp
    ]);
  }

  // Replies
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const parent = commentMap.get(comment.parentId);
    if (!parent || parent.authorEmail === comment.authorEmail) continue;
    const submission = comment.entityType === 'song' ? submissionMap.get(comment.entityId) : null;
    const label = submission ? `"${submission.title}"` : (comment.entityType === 'song' ? 'a song' : comment.entityType === 'assignment' ? 'an assignment' : 'a prompt');
    rows.push([
      Math.random().toString(36).substr(2, 9),
      parent.authorEmail,
      'reply_to_comment',
      comment.authorEmail,
      comment.author || getName(comment.authorEmail),
      comment.entityType,
      comment.entityId,
      comment.id,
      `replied to your comment on ${label}`,
      'true',
      comment.timestamp
    ]);
  }

  // Reactions
  for (const comment of comments) {
    for (const [emoji, emails] of Object.entries(comment.reactions || {})) {
      for (const email of emails) {
        if (email === comment.authorEmail) continue;
        const submission = comment.entityType === 'song' ? submissionMap.get(comment.entityId) : null;
        const label = submission ? `"${submission.title}"` : (comment.entityType === 'song' ? 'a song' : comment.entityType === 'assignment' ? 'an assignment' : 'a prompt');
        rows.push([
          Math.random().toString(36).substr(2, 9),
          comment.authorEmail,
          'reaction_on_comment',
          email,
          getName(email),
          comment.entityType,
          comment.entityId,
          comment.id,
          `reacted ${emoji} to your comment on ${label}`,
          'true',
          comment.timestamp
        ]);
      }
    }
  }

  // BOCAs
  for (const boca of bocas) {
    const submission = submissionMap.get(boca.submissionId);
    if (!submission || submission.camperId === boca.fromEmail) continue;
    rows.push([
      Math.random().toString(36).substr(2, 9),
      submission.camperId,
      'boca_received',
      boca.fromEmail,
      getName(boca.fromEmail),
      'song',
      boca.submissionId,
      boca.id,
      `gave a BOCA to "${submission.title}"`,
      'true',
      boca.awardedAt
    ]);
  }

  if (rows.length === 0) return 0;
  await appendSheetRow(spreadsheetId, 'Notifications!A1', rows);
  return rows.length;
};

export const checkDeadlineReminders = async (
  spreadsheetId: string,
  assignments: Assignment[],
  existingNotifications: Notification[],
  userEmail: string
): Promise<Notification[]> => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thresholds = [
    { days: 7, label: 'due in 7 days' },
    { days: 2, label: 'due in 2 days' },
    { days: 1, label: 'due tomorrow' }
  ];

  const existingRefIds = new Set(existingNotifications.map(n => n.referenceId));
  const rows: string[][] = [];
  const created: Notification[] = [];

  for (const assignment of assignments) {
    if (assignment.status !== 'Open' || assignment.deletedAt) continue;
    if (!assignment.assignedTo.some(e => e.trim() === userEmail)) continue;

    const due = new Date(assignment.dueDate + 'T00:00:00');
    const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);

    for (const { days, label } of thresholds) {
      if (daysUntil !== days) continue;
      const refId = `${assignment.id}-${days}d`;
      if (existingRefIds.has(refId)) continue;

      const notification: Notification = {
        id: Math.random().toString(36).substr(2, 9),
        recipientEmail: userEmail,
        type: 'deadline_reminder',
        triggerUserEmail: 'system',
        triggerUserName: 'Camp',
        entityType: 'assignment',
        entityId: assignment.id,
        referenceId: refId,
        message: `"${assignment.title}" is ${label}`,
        read: false,
        createdAt: new Date().toISOString()
      };

      rows.push([
        notification.id, notification.recipientEmail, notification.type,
        notification.triggerUserEmail, notification.triggerUserName,
        notification.entityType, notification.entityId, notification.referenceId,
        notification.message, 'false', notification.createdAt
      ]);
      created.push(notification);
    }
  }

  if (rows.length > 0) {
    await appendSheetRow(spreadsheetId, 'Notifications!A1', rows);
  }
  return created;
};

// --- Google Drive Picker ---

export interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

let pickerApiLoaded = false;

const ensurePickerLoaded = (): Promise<void> => {
  if (pickerApiLoaded) return Promise.resolve();
  if (typeof gapi === 'undefined') return Promise.reject(new Error('Google API script not loaded'));
  return new Promise((resolve, reject) => {
    gapi.load('picker', {
      callback: () => { pickerApiLoaded = true; resolve(); },
      onerror: () => reject(new Error('Failed to load Google Picker')),
    });
  });
};

export const openDrivePicker = async (options?: {
  mimeTypes?: string;
  multiSelect?: boolean;
  title?: string;
}): Promise<PickedFile[]> => {
  if (!accessToken) throw new Error('Not authenticated');
  await ensurePickerLoaded();

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    if (options?.mimeTypes) view.setMimeTypes(options.mimeTypes);
    view.setIncludeFolders(false);

    const builder = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .addView(view)
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve(data.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            url: doc.url,
          })));
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve([]);
        }
      });

    if (options?.title) builder.setTitle(options.title);
    if (options?.multiSelect !== false) {
      builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    }

    builder.build().setVisible(true);
  });
};
