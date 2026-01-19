
import React, { useEffect, useState } from 'react';
import { Prompt, Assignment, Submission, ViewState, PromptStatus } from '../types';

interface PromptDetailProps {
  prompt: Prompt;
  assignments: Assignment[];
  submissions: Submission[];
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdate: (prompt: Prompt) => void;
}

const PromptDetail: React.FC<PromptDetailProps> = ({ prompt, assignments, submissions, onNavigate, onUpdate }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState({
    title: prompt.title,
    description: prompt.description,
    tags: prompt.tags.join(', '),
    status: prompt.status
  });

  useEffect(() => {
    setEditPrompt({
      title: prompt.title,
      description: prompt.description,
      tags: prompt.tags.join(', '),
      status: prompt.status
    });
  }, [prompt]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPrompt: Prompt = {
      ...prompt,
      title: editPrompt.title.trim(),
      description: editPrompt.description.trim(),
      tags: editPrompt.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      status: editPrompt.status
    };
    onUpdate(updatedPrompt);
    setShowEditModal(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate('prompts')}
          className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{prompt.title}</h2>
          <p className="text-slate-500 font-medium">Prompt ID: {prompt.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Prompt Context</h3>
            <p className="text-lg text-slate-700 leading-relaxed mb-6 italic border-l-4 border-indigo-200 pl-6">
              "{prompt.description}"
            </p>
            <div className="flex flex-wrap gap-2">
              {prompt.tags.map(tag => (
                <span key={tag} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Assignments using this Prompt</h3>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{assignments.length} Total</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => onNavigate('assignment-detail', a.id)}
                  className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-bold text-slate-800">{a.title}</h4>
                    <p className="text-xs text-slate-500">Due {a.dueDate}</p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-slate-300"></i>
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="col-span-2 p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                  This prompt hasn't been assigned yet.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Songs Inspired by this Prompt</h3>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{submissions.length} Submissions</span>
            </div>
            <div className="space-y-4">
              {submissions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => onNavigate('song-detail', s.id)}
                  className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-6 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                    <i className="fa-solid fa-music"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{s.title}</h4>
                    <p className="text-xs text-slate-500">by {s.camperName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Last Update</p>
                    <p className="text-xs font-semibold text-slate-700">{new Date(s.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {submissions.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                  No songs have been submitted for this prompt yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Prompt Meta</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500 font-medium">Created By</span>
                <span className="text-sm text-slate-800 font-bold">{prompt.createdBy}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500 font-medium">Creation Date</span>
                <span className="text-sm text-slate-800 font-bold">{prompt.createdAt}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500 font-medium">Status</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  prompt.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {prompt.status}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-500 font-medium">Total Hearts</span>
                <span className="text-sm text-red-500 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-heart"></i> {prompt.upvotes}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-100">
            <h4 className="font-bold mb-2">Need a refresh?</h4>
            <p className="text-indigo-100 text-sm mb-4 leading-relaxed">You can modify this prompt's details or archive it if it's no longer serving the camp.</p>
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              Edit Prompt Details
            </button>
          </section>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800">Edit Prompt</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editPrompt.title}
                  onChange={e => setEditPrompt({ ...editPrompt, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                  value={editPrompt.description}
                  onChange={e => setEditPrompt({ ...editPrompt, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editPrompt.tags}
                  onChange={e => setEditPrompt({ ...editPrompt, tags: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editPrompt.status}
                  onChange={e => setEditPrompt({ ...editPrompt, status: e.target.value as PromptStatus })}
                >
                  <option value={PromptStatus.DRAFT}>Draft</option>
                  <option value={PromptStatus.ACTIVE}>Active</option>
                  <option value={PromptStatus.ARCHIVED}>Archived</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptDetail;
