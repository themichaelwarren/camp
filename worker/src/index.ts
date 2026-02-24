interface Env {
  ORIGIN_URL: string;
  GOOGLE_API_KEY: string;
  SPREADSHEET_ID: string;
}

interface OgMeta {
  title: string;
  description: string;
  image?: string;
  url: string;
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
  if (!resp.ok) return [];

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
    const description = `By ${camperName}${assignmentTitle ? ` \u00b7 ${assignmentTitle}` : ''}`;
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
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)} \u00b7 Camp</title>`);
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

// --- Main Handler ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
