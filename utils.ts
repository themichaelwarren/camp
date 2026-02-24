import { Assignment, PromptStatus } from './types';

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
