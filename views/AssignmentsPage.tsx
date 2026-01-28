
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Assignments</h2>
          <p className="text-slate-500 text-sm">Turn prompts into focused creative projects.</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          <i className="fa-solid fa-calendar-plus"></i>
          Create Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {assignments.map(a => {
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
