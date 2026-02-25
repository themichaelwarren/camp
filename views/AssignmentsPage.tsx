
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Prompt } from '../types';
import { getTerm, getTermSortKey, DateFormat, formatDate } from '../utils';
import MultiPromptSelector from '../components/MultiPromptSelector';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownPreview from '../components/MarkdownPreview';

type AssignmentsSortBy = 'title-asc' | 'title-desc' | 'due-asc' | 'due-desc' | 'start-asc' | 'start-desc' | 'prompt-asc' | 'prompt-desc' | 'semester-desc' | 'semester-asc';

interface AssignmentsPageProps {
  assignments: Assignment[];
  prompts: Prompt[];
  campersCount: number;
  onAdd: (assignment: Assignment) => void;
  onAddPrompt: (prompt: Prompt) => Promise<void>;
  onViewDetail: (id: string) => void;
  userProfile?: { name?: string; email?: string } | null;
  spreadsheetId: string | null;
  availableTags: string[];
  viewMode: 'list' | 'cards';
  onViewModeChange: (value: 'list' | 'cards') => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: 'all' | 'Open' | 'Closed';
  onStatusFilterChange: (value: 'all' | 'Open' | 'Closed') => void;
  promptFilter: string;
  onPromptFilterChange: (value: string) => void;
  sortBy: AssignmentsSortBy;
  onSortByChange: (value: AssignmentsSortBy) => void;
  semesterFilter: string;
  onSemesterFilterChange: (value: string) => void;
  dateFormat: DateFormat;
}

const AssignmentsPage: React.FC<AssignmentsPageProps> = ({ assignments, prompts, campersCount, onAdd, onAddPrompt, onViewDetail, userProfile, spreadsheetId, availableTags, viewMode, onViewModeChange, searchTerm, onSearchTermChange, statusFilter, onStatusFilterChange, promptFilter, onPromptFilterChange, sortBy, onSortByChange, semesterFilter, onSemesterFilterChange, dateFormat }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState({ title: '', promptIds: [] as string[], startDate: '', dueDate: '', instructions: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignment: Assignment = {
      id: Math.random().toString(36).substr(2, 9),
      title: form.title,
      promptId: form.promptIds[0] || '',      // First prompt for backwards compat
      promptIds: form.promptIds,               // All prompts
      startDate: form.startDate,
      dueDate: form.dueDate,
      instructions: form.instructions,
      assignedTo: ['All Campers'],
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    onAdd(assignment);
    setShowAdd(false);
    setForm({ title: '', promptIds: [], startDate: '', dueDate: '', instructions: '' });
  };

  const availableSemesters = useMemo(() => {
    const terms = new Set<string>(assignments.map(a => getTerm(a.dueDate)));
    return Array.from(terms).sort((a, b) => getTermSortKey(b) - getTermSortKey(a));
  }, [assignments]);

  // Filter and sort assignments
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredAssignments = assignments
    .filter((assignment) => {
      // Term filter
      if (semesterFilter !== 'all' && getTerm(assignment.dueDate) !== semesterFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && assignment.status !== statusFilter) return false;

      // Prompt filter - check both promptIds array and legacy promptId
      if (promptFilter !== 'all') {
        const hasPrompt = assignment.promptIds?.includes(promptFilter) || assignment.promptId === promptFilter;
        if (!hasPrompt) return false;
      }

      // Search filter
      if (!normalizedSearch) return true;
      const prompt = prompts.find(p => p.id === assignment.promptId);
      const inTitle = assignment.title.toLowerCase().includes(normalizedSearch);
      const inInstructions = assignment.instructions.toLowerCase().includes(normalizedSearch);
      const inPrompt = prompt?.title.toLowerCase().includes(normalizedSearch) || false;
      return inTitle || inInstructions || inPrompt;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'due-asc': {
          // Upcoming deadlines first, sorted by closeness to today
          const now = new Date().getTime();
          const aDue = new Date(a.dueDate).getTime();
          const bDue = new Date(b.dueDate).getTime();
          const aIsFuture = aDue >= now;
          const bIsFuture = bDue >= now;

          // Both future: show closest first
          if (aIsFuture && bIsFuture) return aDue - bDue;
          // Both past: show most recent first
          if (!aIsFuture && !bIsFuture) return bDue - aDue;
          // Future dates come before past dates
          return aIsFuture ? -1 : 1;
        }
        case 'due-desc':
          // Chronological: oldest to newest
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'start-asc': {
          const aStart = a.startDate || '';
          const bStart = b.startDate || '';
          if (!aStart && !bStart) return 0;
          if (!aStart) return 1;
          if (!bStart) return -1;
          return new Date(aStart).getTime() - new Date(bStart).getTime();
        }
        case 'start-desc': {
          const aStart = a.startDate || '';
          const bStart = b.startDate || '';
          if (!aStart && !bStart) return 0;
          if (!aStart) return 1;
          if (!bStart) return -1;
          return new Date(bStart).getTime() - new Date(aStart).getTime();
        }
        case 'prompt-asc': {
          const aPrompt = prompts.find(p => p.id === a.promptId)?.title || '';
          const bPrompt = prompts.find(p => p.id === b.promptId)?.title || '';
          return aPrompt.localeCompare(bPrompt);
        }
        case 'prompt-desc': {
          const aPrompt = prompts.find(p => p.id === a.promptId)?.title || '';
          const bPrompt = prompts.find(p => p.id === b.promptId)?.title || '';
          return bPrompt.localeCompare(aPrompt);
        }
        case 'semester-desc':
        case 'semester-asc': {
          const aKey = getTermSortKey(getTerm(a.dueDate));
          const bKey = getTermSortKey(getTerm(b.dueDate));
          const termCmp = sortBy === 'semester-desc' ? bKey - aKey : aKey - bKey;
          if (termCmp !== 0) return termCmp;
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        }
        default:
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
    });

  const isSemesterSort = sortBy === 'semester-desc' || sortBy === 'semester-asc';
  const groupedBySemester: [string, Assignment[]][] = useMemo(() => {
    if (!isSemesterSort) return [];
    const groups: Record<string, Assignment[]> = {};
    filteredAssignments.forEach(a => {
      const term = getTerm(a.dueDate);
      if (!groups[term]) groups[term] = [];
      groups[term].push(a);
    });
    return Object.entries(groups);
  }, [filteredAssignments, isSemesterSort]);

  const renderRow = (a: Assignment) => {
    const assignmentPromptIds = a.promptIds?.length ? a.promptIds : [a.promptId].filter(Boolean);
    const assignmentPrompts = assignmentPromptIds.map(pid => prompts.find(p => p.id === pid)).filter(Boolean);
    return (
      <tr
        key={a.id}
        className="hover:bg-slate-50 transition-colors cursor-pointer group"
        onClick={() => onViewDetail(a.id)}
      >
        <td className="px-6 py-4 max-w-xs">
          <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{a.title}</h4>
          <p className="text-xs text-slate-500 line-clamp-1">{a.instructions.substring(0, 60)}...</p>
        </td>
        <td className="px-6 py-4 max-w-[200px]">
          <div className="flex flex-wrap gap-1">
            {assignmentPrompts.length > 0 ? (
              <>
                {assignmentPrompts.slice(0, 2).map(p => (
                  <span key={p!.id} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium truncate max-w-[160px]">
                    {p!.title}
                  </span>
                ))}
                {assignmentPrompts.length > 2 && (
                  <span className="text-xs text-slate-400">+{assignmentPrompts.length - 2}</span>
                )}
              </>
            ) : (
              <span className="text-sm text-slate-400">No Prompt</span>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-slate-700">{formatDate(a.dueDate, dateFormat)}</div>
          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-semibold">{getTerm(a.dueDate)}</span>
        </td>
        <td className="px-6 py-4">
          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
            a.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {a.status}
          </span>
        </td>
      </tr>
    );
  };

  const renderCard = (a: Assignment) => {
    const cardPromptIds = a.promptIds?.length ? a.promptIds : [a.promptId].filter(Boolean);
    const cardPrompts = cardPromptIds.map(pid => prompts.find(p => p.id === pid)).filter(Boolean);
    return (
      <div
        key={a.id}
        onClick={() => onViewDetail(a.id)}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${
              a.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {a.status}
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-semibold">{getTerm(a.dueDate)}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase">Due {formatDate(a.dueDate, dateFormat)}</span>
        </div>
        <h3 className="font-bold text-lg text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{a.title}</h3>
        <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 line-clamp-3 overflow-hidden">
          <MarkdownPreview content={a.instructions} className="text-xs" />
        </div>
        {cardPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cardPrompts.slice(0, 2).map(p => (
              <span key={p!.id} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {p!.title}
              </span>
            ))}
            {cardPrompts.length > 2 && (
              <span className="text-xs text-slate-400">+{cardPrompts.length - 2}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                <img src={`https://picsum.photos/seed/${i + 20}/32`} alt="avatar" />
              </div>
            ))}
            <div className="w-6 h-6 rounded-full border-2 border-white bg-indigo-100 text-[10px] font-bold text-indigo-600 flex items-center justify-center">
              {campersCount > 0 ? `+${campersCount}` : '0'}
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">Assigned to {campersCount || 0} campers</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">Assignments</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{assignments.length}</span>
          </div>
          <p className="text-slate-500 text-sm">Turn prompts into focused creative projects.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="self-start md:self-auto bg-indigo-600 text-white px-4 py-1.5 md:px-6 md:py-2.5 rounded-xl text-sm md:text-base font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-calendar-plus"></i>
          Create Assignment
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search assignments, prompts, instructions..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors flex-shrink-0 ${
              showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="fa-solid fa-sliders"></i>
            Filters
            <i className={`fa-solid fa-chevron-${showFilters ? 'up' : 'down'} text-[10px]`}></i>
          </button>
        </div>
        <div className={`${showFilters ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Semester</label>
              <select
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={semesterFilter}
                onChange={(e) => onSemesterFilterChange(e.target.value)}
              >
                <option value="all">All Semesters</option>
                {availableSemesters.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</label>
              <select
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'Open' | 'Closed')}
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prompt</label>
              <select
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={promptFilter}
                onChange={(e) => onPromptFilterChange(e.target.value)}
              >
                <option value="all">All Prompts</option>
                {prompts.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort By</label>
              <select
                className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as AssignmentsSortBy)}
              >
                <option value="due-asc">Due Date: Upcoming First</option>
                <option value="due-desc">Due Date: Oldest First</option>
                <option value="start-asc">Start Date: Oldest First</option>
                <option value="start-desc">Start Date: Newest First</option>
                <option value="title-asc">Title: A-Z</option>
                <option value="title-desc">Title: Z-A</option>
                <option value="prompt-asc">Prompt: A-Z</option>
                <option value="prompt-desc">Prompt: Z-A</option>
                <option value="term-desc">Semester: Newest</option>
                <option value="term-asc">Semester: Oldest</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List View */}
      {/* View toggle */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 w-fit">
        <button
          onClick={() => onViewModeChange('cards')}
          className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
            viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cards
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
            viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          List
        </button>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-2">
          {isSemesterSort ? (
            groupedBySemester.map(([term, items]) => (
              <React.Fragment key={term}>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest pt-4 first:pt-0">{term}</div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-100">
                      {items.map(a => renderRow(a))}
                    </tbody>
                  </table>
                </div>
              </React.Fragment>
            ))
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Assignment</th>
                    <th className="px-6 py-4">Prompt</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssignments.map(a => renderRow(a))}
                  {filteredAssignments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                        No assignments match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Cards View */
        <div className="space-y-2">
          {isSemesterSort ? (
            groupedBySemester.map(([term, items]) => (
              <React.Fragment key={term}>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest pt-4 first:pt-0">{term}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map(a => renderCard(a))}
                </div>
              </React.Fragment>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAssignments.map(a => renderCard(a))}
            </div>
          )}
        </div>
      )}

      {showAdd && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-xl text-slate-800">Create Assignment</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto overflow-x-hidden flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    placeholder="e.g. Winter Songwriting Challenge"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Prompts</label>
                  <MultiPromptSelector
                    prompts={prompts}
                    assignments={assignments}
                    selectedPromptIds={form.promptIds}
                    onChange={(promptIds) => setForm({...form, promptIds})}
                    onCreatePrompt={onAddPrompt}
                    availableTags={availableTags}
                    spreadsheetId={spreadsheetId || ''}
                    userEmail={userProfile?.email}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="overflow-hidden">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                      value={form.startDate}
                      onChange={e => setForm({...form, startDate: e.target.value})}
                    />
                  </div>
                  <div className="overflow-hidden">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                    <input
                      required
                      type="date"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                      value={form.dueDate}
                      onChange={e => setForm({...form, dueDate: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instructions / Specific Goals</label>
                  <MarkdownEditor
                    value={form.instructions}
                    onChange={(instructions) => setForm({...form, instructions})}
                    placeholder="e.g. Focus on complex chord changes or experimental vocals..."
                    required
                    minHeight="h-48"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 shrink-0">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  Launch Assignment
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AssignmentsPage;
