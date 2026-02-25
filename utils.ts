import { Assignment, PromptStatus, Submission, SongVersion, Collaboration, CollaboratorRole, PlayableTrack } from './types';

export function isSubmissionVisible(
  sub: Submission,
  currentUserEmail: string,
  collaborations: Collaboration[]
): boolean {
  if (sub.deletedAt) return false;
  if (!sub.status || sub.status === 'shared') return true;
  if (sub.camperId === currentUserEmail) return true;
  return collaborations.some(c => c.submissionId === sub.id && c.camperId === currentUserEmail);
}

export function getTerm(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  const m = d.getMonth();
  const y = d.getFullYear();
  const season = m < 3 ? 'Winter' : m < 6 ? 'Spring' : m < 9 ? 'Summer' : 'Fall';
  return `${season} ${y}`;
}

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };

export function getTermSortKey(term: string): number {
  const [season, year] = term.split(' ');
  return parseInt(year) * 10 + (SEASON_ORDER[season] ?? 0);
}

export function getPromptStatus(promptId: string, assignments: Assignment[]): PromptStatus {
  const relevant = assignments.filter(
    a => !a.deletedAt && (a.promptIds?.includes(promptId) || a.promptId === promptId)
  );
  if (relevant.length === 0) return PromptStatus.UNUSED;
  if (relevant.some(a => a.status === 'Open')) return PromptStatus.ACTIVE;
  return PromptStatus.CLOSED;
}

export function getPromptStatusStyle(status: PromptStatus): string {
  switch (status) {
    case PromptStatus.ACTIVE: return 'bg-green-100 text-green-700';
    case PromptStatus.CLOSED: return 'bg-slate-100 text-slate-600';
    case PromptStatus.UNUSED:
    default: return 'bg-amber-100 text-amber-700';
  }
}

export type DateFormat = 'system' | 'yyyy-mm-dd' | 'mm/dd/yyyy' | 'dd/mm/yyyy' | 'short';

export function formatDate(input: string | Date, format: DateFormat): string {
  const date = typeof input === 'string' ? new Date(input.includes('T') ? input : input + 'T00:00:00') : input;
  if (isNaN(date.getTime())) return String(input);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  switch (format) {
    case 'yyyy-mm-dd': return `${y}-${m}-${d}`;
    case 'mm/dd/yyyy': return `${m}/${d}/${y}`;
    case 'dd/mm/yyyy': return `${d}/${m}/${y}`;
    case 'short': return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    case 'system': default: return date.toLocaleDateString();
  }
}

export interface ArtistSegment {
  name: string;
  camperId: string;
  role: CollaboratorRole;
}

export function getDisplayArtist(submission: Submission, collaborations: Collaboration[]): string {
  const collabs = collaborations.filter(c => c.submissionId === submission.id);
  if (collabs.length === 0) return submission.camperName;

  const primaries: string[] = [submission.camperName];
  const featured: string[] = [];
  const producers: string[] = [];

  for (const c of collabs) {
    const role = c.role || 'collaborator';
    if (role === '' || role === 'collaborator') primaries.push(c.camperName);
    else if (role === 'featured') featured.push(c.camperName);
    else if (role === 'producer') producers.push(c.camperName);
  }

  let result = primaries.join(' & ');
  if (featured.length > 0) result += ' ft. ' + featured.join(' & ');
  if (producers.length > 0) result += ' (prod. ' + producers.join(' & ') + ')';
  return result;
}

export function getArtistSegments(submission: Submission, collaborations: Collaboration[]): ArtistSegment[] {
  const segments: ArtistSegment[] = [{
    name: submission.camperName,
    camperId: submission.camperId,
    role: '' as CollaboratorRole
  }];
  const collabs = collaborations.filter(c => c.submissionId === submission.id);
  for (const c of collabs) {
    segments.push({ name: c.camperName, camperId: c.camperId, role: c.role });
  }
  return segments;
}

export function getPrimaryVersion(sub: Submission): SongVersion | null {
  if (!sub.versions?.length) return null;
  if (sub.primaryVersionId) {
    const found = sub.versions.find(v => v.id === sub.primaryVersionId);
    if (found) return found;
  }
  return sub.versions[0];
}

export function trackFromSubmission(sub: Submission, collaborations: Collaboration[]): PlayableTrack | null {
  const primary = getPrimaryVersion(sub);
  if (!primary) return null;
  return {
    versionId: primary.id,
    title: sub.title,
    artist: getDisplayArtist(sub, collaborations),
    camperId: sub.camperId,
    submissionId: sub.id,
    artworkFileId: sub.artworkFileId,
    artworkUrl: sub.artworkUrl
  };
}
