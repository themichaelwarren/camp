import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Submission, Assignment, Collaboration } from '../types';
import { getDisplayArtist, getPrimaryVersion } from '../utils';
import ArtworkImage from './ArtworkImage';

interface SongPickerModalProps {
  submissions: Submission[];
  assignments: Assignment[];
  collaborations: Collaboration[];
  excludeIds: string[];
  onSelect: (submissionIds: string[]) => void;
  onClose: () => void;
}

const SongPickerModal: React.FC<SongPickerModalProps> = ({ submissions, assignments, collaborations, excludeIds, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const available = useMemo(() => {
    const excludeSet = new Set(excludeIds);
    return submissions
      .filter(s => !s.deletedAt && !excludeSet.has(s.id) && getPrimaryVersion(s)?.id)
      .filter(s => {
        if (assignmentFilter !== 'all' && s.assignmentId !== assignmentFilter) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.camperName.toLowerCase().includes(q) || getDisplayArtist(s, collaborations).toLowerCase().includes(q);
      });
  }, [submissions, excludeIds, search, assignmentFilter, collaborations]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Add Songs</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <i className="fa-solid fa-xmark text-slate-500 text-sm"></i>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search by title or artist..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
            autoFocus
          />
          <select
            value={assignmentFilter}
            onChange={e => setAssignmentFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Assignments</option>
            {assignments.filter(a => !a.deletedAt).map(a => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {available.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No songs found</p>
          ) : available.map(s => {
            const isSelected = selectedIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                  isSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                }`}>
                  {isSelected && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                </div>
                <ArtworkImage
                  fileId={s.artworkFileId}
                  fallbackUrl={s.artworkUrl}
                  alt={s.title}
                  className="w-10 h-10 rounded-lg object-cover"
                  fallback={
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                      <i className="fa-solid fa-music text-slate-400 text-xs"></i>
                    </div>
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
                  <p className="text-xs text-slate-400 truncate">{getDisplayArtist(s, collaborations)}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {selectedIds.size > 0 ? `${selectedIds.size} song${selectedIds.size === 1 ? '' : 's'} selected` : 'Select songs to add'}
          </p>
          <button
            onClick={() => { onSelect(Array.from(selectedIds)); onClose(); }}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add {selectedIds.size > 0 ? selectedIds.size : ''} Song{selectedIds.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SongPickerModal;
