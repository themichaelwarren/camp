import { Assignment, PromptStatus } from './types';

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
