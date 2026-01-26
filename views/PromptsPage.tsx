
import React, { useState, useEffect } from 'react';
import { Prompt, PromptStatus } from '../types';
import TagInput from '../components/TagInput';
import * as googleService from '../services/googleService';

interface PromptsPageProps {
  prompts: Prompt[];
  onAdd: (prompt: Prompt) => void;
  onUpdate: (prompt: Prompt) => void;
  onUpvote: (prompt: Prompt) => void;
  onViewDetail: (id: string) => void;
  userProfile?: { name?: string; email?: string } | null;
  upvotedPromptIds: string[];
  spreadsheetId: string;
}

const PromptsPage: React.FC<PromptsPageProps> = ({ prompts, onAdd, onUpdate, onUpvote, onViewDetail, userProfile, upvotedPromptIds, spreadsheetId }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ title: '', description: '', tags: [] as string[] });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PromptStatus>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'upvotes' | 'title'>('newest');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const tags = await googleService.fetchTags(spreadsheetId);
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to load tags', error);
    }
  };

  const handleUpvote = (prompt: Prompt) => {
    onUpvote(prompt);
  };

  const handleStatusChange = (prompt: Prompt, status: PromptStatus) => {
    onUpdate({ ...prompt, status });
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    // Create any new tags that don't exist yet
    const newTags = newPrompt.tags.filter((tag: string) => !availableTags.includes(tag));
    for (const tag of newTags) {
      try {
        await googleService.createTag(spreadsheetId, tag);
      } catch (error) {
        console.error('Failed to create tag', error);
      }
    }

    // Reload tags to include newly created ones
    if (newTags.length > 0) {
      await loadTags();
    }

    const prompt: Prompt = {
      id: Math.random().toString(36).substr(2, 9),
      title: newPrompt.title,
      description: newPrompt.description,
      tags: newPrompt.tags,
      upvotes: 0,
      status: PromptStatus.DRAFT,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: userProfile?.email || userProfile?.name || 'Admin'
    };
    onAdd(prompt);
    setShowAddModal(false);
    setNewPrompt({ title: '', description: '', tags: [] });
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredPrompts = prompts
    .filter((prompt) => {
      if (statusFilter !== 'all' && prompt.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const inTitle = prompt.title.toLowerCase().includes(normalizedSearch);
      const inDescription = prompt.description.toLowerCase().includes(normalizedSearch);
      const inTags = prompt.tags.join(' ').toLowerCase().includes(normalizedSearch);
      return inTitle || inDescription || inTags;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'upvotes':
          return b.upvotes - a.upvotes;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Search</label>
          <input
            type="text"
            className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search title, description, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</label>
            <select
              className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | PromptStatus)}
            >
              <option value="all">All</option>
              <option value={PromptStatus.DRAFT}>Draft</option>
              <option value={PromptStatus.ACTIVE}>Active</option>
              <option value={PromptStatus.ARCHIVED}>Archived</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort</label>
            <select
              className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'upvotes' | 'title')}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="upvotes">Most upvoted</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Title & Description</th>
              <th className="px-6 py-4">Tags</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Upvotes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPrompts.map(prompt => (
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
                    disabled={upvotedPromptIds.includes(prompt.id)}
                    className={`flex items-center gap-2 font-bold transition-colors ${
                      upvotedPromptIds.includes(prompt.id)
                        ? 'text-rose-500 cursor-not-allowed'
                        : 'text-slate-500 hover:text-indigo-600'
                    }`}
                  >
                    <i className={`fa-solid fa-heart ${upvotedPromptIds.includes(prompt.id) ? 'text-rose-400' : 'text-slate-300 group-hover:text-red-400'}`}></i>
                    {prompt.upvotes}
                  </button>
                </td>
              </tr>
            ))}
            {filteredPrompts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                  No prompts match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredPrompts.map(prompt => (
          <div
            key={prompt.id}
            onClick={() => onViewDetail(prompt.id)}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 className="font-bold text-slate-800 flex-1">{prompt.title}</h4>
              <div onClick={e => e.stopPropagation()}>
                <select
                  value={prompt.status}
                  onChange={(e) => handleStatusChange(prompt, e.target.value as PromptStatus)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border-none focus:ring-2 focus:ring-indigo-200 cursor-pointer ${
                    prompt.status === PromptStatus.ACTIVE ? 'bg-green-100 text-green-700' :
                    prompt.status === PromptStatus.DRAFT ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}
                >
                  <option value={PromptStatus.DRAFT}>Draft</option>
                  <option value={PromptStatus.ACTIVE}>Active</option>
                  <option value={PromptStatus.ARCHIVED}>Archived</option>
                </select>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3 line-clamp-2">{prompt.description}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {prompt.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">By {prompt.createdBy}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpvote(prompt);
                }}
                disabled={upvotedPromptIds.includes(prompt.id)}
                className={`flex items-center gap-1 text-sm font-bold ${
                  upvotedPromptIds.includes(prompt.id)
                    ? 'text-rose-500 cursor-not-allowed'
                    : 'text-slate-500'
                }`}
              >
                <i className={`fa-solid fa-heart ${upvotedPromptIds.includes(prompt.id) ? 'text-rose-400' : 'text-slate-300'}`}></i>
                {prompt.upvotes}
              </button>
            </div>
          </div>
        ))}
        {filteredPrompts.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            No prompts match your filters.
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center rounded-t-3xl overflow-hidden">
              <h3 className="font-bold text-xl text-slate-800">Add New Prompt</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleManualAdd} className="p-6 space-y-4 overflow-visible rounded-b-3xl">
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags</label>
                <TagInput
                  value={newPrompt.tags}
                  onChange={(tags) => setNewPrompt({ ...newPrompt, tags })}
                  availableTags={availableTags}
                  onCreateTag={async () => {}} // No-op: tags created on form submit
                  placeholder="Type to add tags..."
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
