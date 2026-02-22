import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Prompt } from '../types';
import * as googleService from '../services/googleService';

interface TagManagerProps {
  spreadsheetId: string;
  prompts: Prompt[];
  onClose: () => void;
  onTagsChanged: () => void;
}

const TagManager: React.FC<TagManagerProps> = ({ spreadsheetId, prompts, onClose, onTagsChanged }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const fetched = await googleService.fetchTags(spreadsheetId);
      setTags(fetched.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error('Failed to load tags', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tagName: string) => {
    if (!window.confirm(`Delete tag "${tagName}"? It will be removed from suggestions. Existing prompts will keep the tag until manually edited.`)) return;
    setDeleting(tagName);
    try {
      await googleService.deleteTag(spreadsheetId, tagName);
      setTags(prev => prev.filter(t => t !== tagName));
      onTagsChanged();
    } catch (error) {
      console.error('Failed to delete tag', error);
    } finally {
      setDeleting(null);
    }
  };

  const getPromptCount = (tagName: string) => prompts.filter(p => p.tags.includes(tagName)).length;

  const filtered = tags.filter(t => t.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl text-slate-800">Manage Tags</h3>
            <p className="text-xs text-slate-400 mt-1">{tags.length} tag{tags.length !== 1 ? 's' : ''} total</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">
              <i className="fa-solid fa-spinner fa-spin text-lg mb-2"></i>
              <p className="text-sm">Loading tags...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">{searchTerm ? 'No tags match your search.' : 'No tags yet.'}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(tag => {
                const count = getPromptCount(tag);
                return (
                  <div key={tag} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full text-xs font-bold truncate">{tag}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{count} prompt{count !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(tag)}
                      disabled={deleting === tag}
                      className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2"
                    >
                      {deleting === tag ? (
                        <i className="fa-solid fa-spinner fa-spin text-sm"></i>
                      ) : (
                        <i className="fa-solid fa-trash text-sm"></i>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 text-center">Deleting a tag removes it from suggestions. Existing prompts keep the tag until manually edited.</p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TagManager;
