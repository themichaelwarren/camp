
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Prompt } from '../types';
import PromptSelector from '../components/PromptSelector';
import MarkdownEditor from '../components/MarkdownEditor';

interface AssignmentsPageProps {
  assignments: Assignment[];
  prompts: Prompt[];
  campersCount: number;
  onAdd: (assignment: Assignment) => void;
  onViewDetail: (id: string) => void;
}

const AssignmentsPage: React.FC<AssignmentsPageProps> = ({ assignments, prompts, campersCount, onAdd, onViewDetail }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', promptId: '', startDate: '', dueDate: '', instructions: '' });
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Open' | 'Closed'>('all');
  const [promptFilter, setPromptFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'due-asc' | 'due-desc' | 'start-asc' | 'start-desc' | 'prompt-asc' | 'prompt-desc'>('due-asc');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignment: Assignment = {
      id: Math.random().toString(36).substr(2, 9),
      title: form.title,
      promptId: form.promptId,
      startDate: form.startDate,
      dueDate: form.dueDate,
      instructions: form.instructions,
      assignedTo: ['All Campers'],
      status: 'Open'
    };
    onAdd(assignment);
    setShowAdd(false);
    setForm({ title: '', promptId: '', startDate: '', dueDate: '', instructions: '' });
  };

  // Filter and sort assignments
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredAssignments = assignments
    .filter((assignment) => {
      // Status filter
      if (statusFilter !== 'all' && assignment.status !== statusFilter) return false;

      // Prompt filter
      if (promptFilter !== 'all' && assignment.promptId !== promptFilter) return false;

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
        case 'due-asc':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'due-desc':
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
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
        default:
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Assignments</h2>
          <p className="text-slate-500 text-sm">Turn prompts into focused creative projects.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full p-1 w-fit">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cards
            </button>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
          >
            <i className="fa-solid fa-calendar-plus"></i>
            Create Assignment
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Search</label>
          <input
            type="text"
            className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search assignments, prompts, instructions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</label>
            <select
              className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'Open' | 'Closed')}
            >
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prompt</label>
            <select
              className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={promptFilter}
              onChange={(e) => setPromptFilter(e.target.value)}
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
              className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'title-asc' | 'title-desc' | 'due-asc' | 'due-desc' | 'start-asc' | 'start-desc' | 'prompt-asc' | 'prompt-desc')}
            >
              <option value="due-asc">Due Date (Soonest)</option>
              <option value="due-desc">Due Date (Latest)</option>
              <option value="start-asc">Start Date (Oldest)</option>
              <option value="start-desc">Start Date (Newest)</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="prompt-asc">Prompt A-Z</option>
              <option value="prompt-desc">Prompt Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' ? (
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
              {filteredAssignments.map(a => {
                const prompt = prompts.find(p => p.id === a.promptId);
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
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700">{prompt?.title || 'No Prompt'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700">{a.dueDate}</div>
                      {a.startDate && <div className="text-xs text-slate-400">Started {a.startDate}</div>}
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
              })}
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
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAssignments.map(a => {
          const prompt = prompts.find(p => p.id === a.promptId);
          return (
            <div 
              key={a.id} 
              onClick={() => onViewDetail(a.id)}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${
                  a.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {a.status}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Due {a.dueDate}</span>
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{a.title}</h3>
              <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 italic line-clamp-2">
                "{prompt?.description}"
              </p>
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
        })}
      </div>
      )}

      {showAdd && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-visible animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800">Create Assignment</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-visible">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="e.g. Winter Songwriting Challenge"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Prompt</label>
                <PromptSelector
                  prompts={prompts}
                  selectedPromptId={form.promptId}
                  onChange={(promptId) => setForm({...form, promptId})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={form.startDate}
                    onChange={e => setForm({...form, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
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
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                Launch Assignment
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AssignmentsPage;
