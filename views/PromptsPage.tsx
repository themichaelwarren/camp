
import React, { useState } from 'react';
import { Prompt, PromptStatus } from '../types';

interface PromptsPageProps {
  prompts: Prompt[];
  onAdd: (prompt: Prompt) => void;
  onUpdate: (prompt: Prompt) => void;
  onViewDetail: (id: string) => void;
  userProfile?: { name?: string; email?: string } | null;
}

const PromptsPage: React.FC<PromptsPageProps> = ({ prompts, onAdd, onUpdate, onViewDetail, userProfile }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ title: '', description: '', tags: '' });

  const handleUpvote = (prompt: Prompt) => {
    onUpdate({ ...prompt, upvotes: prompt.upvotes + 1 });
  };

  const handleStatusChange = (prompt: Prompt, status: PromptStatus) => {
    onUpdate({ ...prompt, status });
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt: Prompt = {
      id: Math.random().toString(36).substr(2, 9),
      title: newPrompt.title,
      description: newPrompt.description,
      tags: newPrompt.tags.split(',').map(t => t.trim()).filter(t => t),
      upvotes: 0,
      status: PromptStatus.DRAFT,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: userProfile?.email || userProfile?.name || 'Admin'
    };
    onAdd(prompt);
    setShowAddModal(false);
    setNewPrompt({ title: '', description: '', tags: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Prompt Library</h2>
          <p className="text-slate-500 text-sm">Collective inspiration for your next masterpiece.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          <i className="fa-solid fa-plus"></i>
          New Prompt
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Title & Description</th>
              <th className="px-6 py-4">Tags</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Upvotes</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prompts.map(prompt => (
              <tr 
                key={prompt.id} 
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => onViewDetail(prompt.id)}
              >
                <td className="px-6 py-4 max-w-xs">
                  <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{prompt.title}</h4>
                  <p className="text-sm text-slate-500 line-clamp-1">{prompt.description}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                  <select 
                    value={prompt.status}
                    onChange={(e) => handleStatusChange(prompt, e.target.value as PromptStatus)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border-none focus:ring-2 focus:ring-indigo-200 cursor-pointer ${
                      prompt.status === PromptStatus.ACTIVE ? 'bg-green-100 text-green-700' :
                      prompt.status === PromptStatus.DRAFT ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <option value={PromptStatus.DRAFT}>Draft</option>
                    <option value={PromptStatus.ACTIVE}>Active</option>
                    <option value={PromptStatus.ARCHIVED}>Archived</option>
                  </select>
                </td>
                <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => handleUpvote(prompt)}
                    className="flex items-center gap-2 hover:text-indigo-600 font-bold text-slate-500 transition-colors"
                  >
                    <i className="fa-solid fa-heart text-slate-300 group-hover:text-red-400"></i>
                    {prompt.upvotes}
                  </button>
                </td>
                <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                  <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800">Add New Prompt</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleManualAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newPrompt.title}
                  onChange={e => setNewPrompt({...newPrompt, title: e.target.value})}
                  placeholder="e.g. Moonlight Sonata Reimagined"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea 
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                  value={newPrompt.description}
                  onChange={e => setNewPrompt({...newPrompt, description: e.target.value})}
                  placeholder="Describe the challenge..."
                ></textarea>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags (comma separated)</label>
                <input 
                  type="text" 
                  placeholder="Acoustic, Pop, Melancholic"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newPrompt.tags}
                  onChange={e => setNewPrompt({...newPrompt, tags: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                Create Prompt
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptsPage;
