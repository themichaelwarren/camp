import { ViewState } from './types';

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
};

const DETAIL_VIEW_TO_SEGMENT: Record<string, string> = {
  'prompt-detail': 'prompts',
  'assignment-detail': 'assignments',
  'song-detail': 'songs',
  'event-detail': 'events',
  'camper-detail': 'campers',
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
};

const SEGMENT_TO_DETAIL_VIEW: Record<string, ViewState> = {
  prompts: 'prompt-detail',
  assignments: 'assignment-detail',
  songs: 'song-detail',
  events: 'event-detail',
  campers: 'camper-detail',
};

// --- Building URLs ---

export function buildHashPath(
  view: ViewState,
  id: string | null = null,
  title: string | null = null
): string {
  const detailSegment = DETAIL_VIEW_TO_SEGMENT[view];
  if (detailSegment && id) {
    const slug = title ? makeSlug(title, id) : id.slice(-6);
    return `#/${detailSegment}/${slug}`;
  }

  const segment = VIEW_TO_SEGMENT[view];
  if (segment !== undefined) {
    return segment ? `#/${segment}` : '#/';
  }

  return '#/';
}

// --- Parsing URLs ---

export interface RouteInfo {
  view: ViewState;
  id: string | null;
}

export function parseHash(hash: string): RouteInfo {
  const path = hash.replace(/^#\/?/, '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { view: 'dashboard', id: null };
  }

  const firstSegment = segments[0];

  if (segments.length >= 2) {
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
