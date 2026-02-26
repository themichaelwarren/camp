import { ViewState } from './types';

// --- Public Mode ---

export const PUBLIC_VIEWS: Set<ViewState> = new Set([
  'assignments', 'submissions', 'campers', 'semesters',
  'assignment-detail', 'song-detail', 'camper-detail', 'semester-detail',
]);
export const PUBLIC_DEFAULT_VIEW: ViewState = 'submissions';
export function isPublicView(view: ViewState): boolean { return PUBLIC_VIEWS.has(view); }

// --- Base Path ---

// Vite injects BASE_URL from the `base` config: '/camp/' in production, '/' in dev.
const RAW_BASE = import.meta.env.BASE_URL || '/';
export const BASE_PATH = RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE;
// production: '/camp', dev: ''

// --- Slug Utilities ---

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function makeSlug(title: string, id: string): string {
  const slug = slugify(title);
  const shortId = id.slice(-6);
  return slug ? `${slug}-${shortId}` : shortId;
}

export function extractIdFromSlug(slug: string): string {
  return slug.slice(-6);
}

// --- Route Mapping ---

const VIEW_TO_SEGMENT: Record<string, string> = {
  dashboard: '',
  inbox: 'inbox',
  prompts: 'prompts',
  assignments: 'assignments',
  submissions: 'songs',
  events: 'events',
  campers: 'campers',
  settings: 'settings',
  bocas: 'bocas',
  favorites: 'favorites',
  semesters: 'semesters',
  changelog: 'whats-new',
  about: 'about',
};

const DETAIL_VIEW_TO_SEGMENT: Record<string, string> = {
  'prompt-detail': 'prompts',
  'assignment-detail': 'assignments',
  'song-detail': 'songs',
  'event-detail': 'events',
  'camper-detail': 'campers',
  'semester-detail': 'semesters',
};

const SEGMENT_TO_VIEW: Record<string, ViewState> = {
  '': 'dashboard',
  inbox: 'inbox',
  prompts: 'prompts',
  assignments: 'assignments',
  songs: 'submissions',
  events: 'events',
  campers: 'campers',
  settings: 'settings',
  bocas: 'bocas',
  favorites: 'favorites',
  semesters: 'semesters',
  'whats-new': 'changelog',
  about: 'about',
};

const SEGMENT_TO_DETAIL_VIEW: Record<string, ViewState> = {
  prompts: 'prompt-detail',
  assignments: 'assignment-detail',
  songs: 'song-detail',
  events: 'event-detail',
  campers: 'camper-detail',
  semesters: 'semester-detail',
};

// --- Building URLs ---

export function buildPath(
  view: ViewState,
  id: string | null = null,
  title: string | null = null
): string {
  const detailSegment = DETAIL_VIEW_TO_SEGMENT[view];
  if (detailSegment && id) {
    // Semester IDs are term strings ("Winter 2026"), not entity IDs
    const slug = view === 'semester-detail' ? slugify(id) : (title ? makeSlug(title, id) : id.slice(-6));
    return `${BASE_PATH}/${detailSegment}/${slug}`;
  }

  const segment = VIEW_TO_SEGMENT[view];
  if (segment !== undefined) {
    return segment ? `${BASE_PATH}/${segment}` : `${BASE_PATH}/`;
  }

  return `${BASE_PATH}/`;
}

// --- Parsing URLs ---

export interface RouteInfo {
  view: ViewState;
  id: string | null;
}

function parseSegments(segments: string[]): RouteInfo {
  if (segments.length === 0) {
    return { view: 'dashboard', id: null };
  }

  const firstSegment = segments[0];

  if (segments.length >= 2) {
    // Semester slugs are term strings ("winter-2026"), not entity short IDs
    if (firstSegment === 'semesters') {
      const parts = segments[1].split('-');
      const season = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const year = parts[1];
      return { view: 'semester-detail', id: `${season} ${year}` };
    }
    const detailView = SEGMENT_TO_DETAIL_VIEW[firstSegment];
    if (detailView) {
      const shortId = extractIdFromSlug(segments[1]);
      return { view: detailView, id: shortId };
    }
  }

  const indexView = SEGMENT_TO_VIEW[firstSegment];
  if (indexView) {
    return { view: indexView, id: null };
  }

  return { view: 'dashboard', id: null };
}

export function parsePath(pathname: string): RouteInfo {
  let path = pathname;
  if (BASE_PATH && path.startsWith(BASE_PATH)) {
    path = path.slice(BASE_PATH.length);
  }
  const segments = path.split('/').filter(Boolean);
  return parseSegments(segments);
}

// Legacy: parse hash URLs for backwards-compatible redirect
export function parseHash(hash: string): RouteInfo {
  const path = hash.replace(/^#\/?/, '');
  const segments = path.split('/').filter(Boolean);
  return parseSegments(segments);
}

// --- Resolving short IDs ---

export function resolveShortId(shortId: string, entityIds: string[]): string | null {
  return entityIds.find(fullId => fullId.endsWith(shortId)) || null;
}

// --- OG Meta Tags ---

export interface PageMeta {
  title: string;
  description?: string;
  image?: string;
}

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  inbox: 'Activity',
  prompts: 'Prompts',
  assignments: 'Assignments',
  submissions: 'Song Vault',
  events: 'Events',
  campers: 'Campers',
  settings: 'Settings',
  bocas: 'BOCAs',
  favorites: 'Favorites',
  semesters: 'Semesters',
  changelog: "What's New",
  about: 'About Camp',
};

export function getDefaultPageMeta(view: ViewState): PageMeta {
  return { title: VIEW_TITLES[view] || 'Camp' };
}

export function updateMetaTags(meta: PageMeta): void {
  const displayTitle = meta.title ? `${meta.title} · Camp` : 'Camp · Songwriter Toolkit';
  document.title = displayTitle;

  const url = window.location.href;
  const defaultDesc = 'A collaborative toolkit for songwriting camps.';

  const setProperty = (prop: string, content: string) => {
    let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', prop);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const setName = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setProperty('og:title', meta.title || 'Camp');
  setProperty('og:description', meta.description || defaultDesc);
  setProperty('og:url', url);
  setProperty('og:type', 'website');
  setName('description', meta.description || defaultDesc);

  if (meta.image) {
    setProperty('og:image', meta.image);
    setName('twitter:image', meta.image);
    setName('twitter:card', 'summary_large_image');
  } else {
    setName('twitter:card', 'summary');
    // Remove stale image tags from previous navigation
    document.querySelector('meta[property="og:image"]')?.remove();
    document.querySelector('meta[name="twitter:image"]')?.remove();
  }

  setName('twitter:title', meta.title || 'Camp');
  setName('twitter:description', meta.description || defaultDesc);
}
