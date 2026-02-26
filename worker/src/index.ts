interface Env {
  ORIGIN_URL: string;
  GOOGLE_API_KEY: string;
  SPREADSHEET_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
}

interface OgMeta {
  title: string;
  description: string;
  image?: string;
  url: string;
}

// --- Service Account JWT + Token Minting ---

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPemKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

let cachedServiceToken: { token: string; expiry: number } | null = null;

async function getServiceAccountToken(env: Env): Promise<string> {
  if (cachedServiceToken && Date.now() < cachedServiceToken.expiry) {
    return cachedServiceToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const key = await importPemKey(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );

  const jwt = `${header}.${payload}.${base64url(signature)}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Service account token exchange failed: ${err}`);
  }

  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedServiceToken = { token: data.access_token, expiry: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

const verifiedTokens = new Map<string, number>();

async function verifyCallerToken(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  // Return cached verification if still valid (5 min TTL)
  const cached = verifiedTokens.get(token);
  if (cached && Date.now() < cached) return true;

  const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
  if (!resp.ok) return false;

  verifiedTokens.set(token, Date.now() + 5 * 60 * 1000);
  // Prune old entries
  if (verifiedTokens.size > 100) {
    const now = Date.now();
    for (const [k, v] of verifiedTokens) {
      if (now >= v) verifiedTokens.delete(k);
    }
  }
  return true;
}

// --- Sheets Proxy Endpoint ---

interface SheetsProxyRequest {
  action: 'metadata' | 'get' | 'batchGet' | 'update' | 'append' | 'batchUpdate' | 'batchValueUpdate';
  range?: string;
  ranges?: string[];
  values?: any[][];
  requests?: any[];
  data?: any[];
  valueInputOption?: string;
}

async function handleSheetsProxy(request: Request, env: Env): Promise<Response> {
  // Verify caller is authenticated
  const isValid = await verifyCallerToken(request.headers.get('Authorization'));
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const body = await request.json() as SheetsProxyRequest;
  const saToken = await getServiceAccountToken(env);
  const sid = env.SPREADSHEET_ID;
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sid}`;
  const headers = {
    Authorization: `Bearer ${saToken}`,
    'Content-Type': 'application/json',
  };

  let url: string;
  let init: RequestInit = { headers };

  switch (body.action) {
    case 'metadata':
      url = base;
      break;

    case 'get':
      url = `${base}/values/${encodeURIComponent(body.range!)}`;
      break;

    case 'batchGet': {
      const params = body.ranges!.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
      url = `${base}/values:batchGet?${params}`;
      break;
    }

    case 'update':
      url = `${base}/values/${encodeURIComponent(body.range!)}?valueInputOption=${body.valueInputOption || 'USER_ENTERED'}`;
      init = { method: 'PUT', headers, body: JSON.stringify({ values: body.values }) };
      break;

    case 'append':
      url = `${base}/values/${encodeURIComponent(body.range!)}:append?valueInputOption=${body.valueInputOption || 'USER_ENTERED'}`;
      init = { method: 'POST', headers, body: JSON.stringify({ values: body.values }) };
      break;

    case 'batchUpdate':
      url = `${base}:batchUpdate`;
      init = { method: 'POST', headers, body: JSON.stringify({ requests: body.requests }) };
      break;

    case 'batchValueUpdate':
      url = `${base}/values:batchUpdate`;
      init = { method: 'POST', headers, body: JSON.stringify({ valueInputOption: body.valueInputOption || 'USER_ENTERED', data: body.data }) };
      break;

    default:
      return new Response(JSON.stringify({ error: `Unknown action: ${(body as any).action}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
  }

  const resp = await fetch(url, init);
  const responseBody = await resp.text();

  return new Response(responseBody, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// --- Route Parsing (mirrors router.ts) ---

const SEGMENT_TO_TYPE: Record<string, string> = {
  songs: 'song',
  prompts: 'prompt',
  assignments: 'assignment',
};

function parseDetailRoute(pathname: string): { type: string; shortId: string } | null {
  const path = pathname.replace(/^\/camp\/?/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const type = SEGMENT_TO_TYPE[segments[0]];
  if (!type) return null;
  const shortId = segments[1].slice(-6);
  return { type, shortId };
}

// --- Google Sheets ---

async function fetchSheet(env: Env, range: string, cacheKey: string): Promise<string[][]> {
  const cache = caches.default;
  const cacheUrl = `https://sheets-cache.internal/${cacheKey}`;
  const cached = await cache.match(new Request(cacheUrl));
  if (cached) return cached.json();

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${env.GOOGLE_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`fetchSheet ${range} failed: ${resp.status}`, await resp.text().catch(() => ''));
    return [];
  }

  const data = (await resp.json()) as { values?: string[][] };
  const rows = data.values || [];

  // Cache for 5 minutes
  await cache.put(
    new Request(cacheUrl),
    new Response(JSON.stringify(rows), { headers: { 'Cache-Control': 'max-age=300' } })
  );
  return rows;
}

function findByShortId(rows: string[][], shortId: string): string[] | null {
  return rows.find(r => r[0]?.endsWith(shortId)) || null;
}

// --- Resolve OG metadata from Sheets ---

async function getOgMeta(env: Env, type: string, shortId: string, requestUrl: string): Promise<OgMeta | null> {
  if (type === 'song') {
    const [submissions, assignments] = await Promise.all([
      fetchSheet(env, 'Submissions!A2:O1000', 'submissions'),
      fetchSheet(env, 'Assignments!A2:M1000', 'assignments'),
    ]);

    const row = findByShortId(submissions, shortId);
    if (!row || row[13]) return null; // not found or deleted

    const title = row[4] || 'Untitled Song';
    const camperName = row[3] || 'Anonymous';
    const assignmentId = row[1] || '';

    // Artwork: row[11] is artworkFileId, with legacy fallback
    const rawRevision = row[10];
    const isLegacy = rawRevision && !Number.isFinite(parseInt(rawRevision, 10));
    const artworkFileId = isLegacy ? (row[10] || '') : (row[11] || '');

    const assignmentRow = assignments.find(r => r[0] === assignmentId);
    const assignmentTitle = assignmentRow?.[2] || '';
    const description = `By ${camperName}${assignmentTitle ? ` · ${assignmentTitle}` : ''}`;
    const image = artworkFileId ? `https://drive.google.com/thumbnail?id=${artworkFileId}&sz=w600` : undefined;

    return { title, description, image, url: requestUrl };
  }

  if (type === 'prompt') {
    const prompts = await fetchSheet(env, 'Prompts!A2:J1000', 'prompts');
    const row = findByShortId(prompts, shortId);
    if (!row || row[8]) return null; // not found or deleted
    return {
      title: row[1] || 'Untitled Prompt',
      description: (row[2] || '').slice(0, 200),
      url: requestUrl,
    };
  }

  if (type === 'assignment') {
    const assignments = await fetchSheet(env, 'Assignments!A2:M1000', 'assignments');
    const row = findByShortId(assignments, shortId);
    if (!row || row[10]) return null; // not found or deleted
    return {
      title: row[2] || 'Untitled Assignment',
      description: (row[6] || '').slice(0, 200),
      url: requestUrl,
    };
  }

  return null;
}

// --- HTML Rewriting ---

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectOgTags(html: string, meta: OgMeta): string {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)} · Camp</title>`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(meta.title)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(meta.description)}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(meta.url)}">`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(meta.description)}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(meta.title)}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(meta.description)}">`);

  if (meta.image) {
    html = html.replace(
      /<meta name="twitter:card" content="[^"]*">/,
      `<meta name="twitter:card" content="summary_large_image">\n    <meta property="og:image" content="${esc(meta.image)}">\n    <meta name="twitter:image" content="${esc(meta.image)}">`
    );
  }

  return html;
}

// --- Public Data API ---

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handlePublicData(env: Env): Promise<Response> {
  const [assignments, submissions, campers, collaborators, bocas, statusUpdates] = await Promise.all([
    fetchSheet(env, 'Assignments!A2:M1000', 'pub-assignments'),
    fetchSheet(env, 'Submissions!A2:Q1000', 'pub-submissions'),
    fetchSheet(env, 'Users!A2:J1000', 'pub-campers'),
    fetchSheet(env, 'Collaborators!A2:F5000', 'pub-collaborators'),
    fetchSheet(env, 'BOCAs!A2:D5000', 'pub-bocas'),
    fetchSheet(env, 'StatusUpdates!A2:E5000', 'pub-statusupdates'),
  ]);
  return new Response(JSON.stringify({ assignments, submissions, campers, collaborators, bocas, statusUpdates }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120', ...CORS_HEADERS },
  });
}

// --- Main Handler ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight for all API routes
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Public data API
    if (url.pathname === '/api/public-data') {
      return handlePublicData(env);
    }

    // Sheets proxy API
    if (url.pathname === '/api/sheets' && request.method === 'POST') {
      return handleSheetsProxy(request, env);
    }

    // Pass through non-HTML requests (assets)
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json|webp|avif|mp3|wav|ogg)$/i.test(url.pathname)) {
      return fetch(`${env.ORIGIN_URL}${url.pathname}`, { headers: request.headers });
    }

    // Fetch the SPA HTML from origin
    const originResp = await fetch(`${env.ORIGIN_URL}/camp/index.html`);
    if (!originResp.ok) {
      return fetch(`${env.ORIGIN_URL}${url.pathname}`, { headers: request.headers });
    }

    let html = await originResp.text();

    // For detail pages, inject entity-specific OG tags
    const detail = parseDetailRoute(url.pathname);
    if (detail) {
      const meta = await getOgMeta(env, detail.type, detail.shortId, url.toString());
      if (meta) {
        html = injectOgTags(html, meta);
      }
    }

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  },
};
