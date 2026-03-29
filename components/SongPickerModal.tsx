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
  onSelect: (entries: string[]) => void;
  onClose: () => void;
}

const SongPickerModal: React.FC<SongPickerModalProps> = ({ submissions, assignments, collaborations, excludeIds, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);

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

  const toggleEntry = (entry: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entry)) next.delete(entry); else next.add(entry);
      return next;
    });
  };

  const isAnythingSelectedForSong = (submissionId: string) => {
    return Array.from(selectedEntries).some(e => e === submissionId || e.startsWith(submissionId + ':'));
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
            const hasMultipleVersions = s.versions && s.versions.length > 1;
            const isExpanded = expandedSongId === s.id;
            const songSelected = isAnythingSelectedForSong(s.id);
            return (
              <div key={s.id}>
                <button
                  onClick={() => {
                    if (hasMultipleVersions) {
                      setExpandedSongId(isExpanded ? null : s.id);
                    } else {
                      toggleEntry(s.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                    songSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    songSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                  }`}>
                    {songSelected && <i className="fa-solid fa-check text-white text-[10px]"></i>}
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
                  {hasMultipleVersions && (
                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      {s.versions.length}v <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[8px] ml-0.5`}></i>
                    </span>
                  )}
                </button>
                {isExpanded && hasMultipleVersions && (
                  <div className="ml-10 pl-3 border-l-2 border-indigo-100 mt-1 mb-2 space-y-1">
                    {s.versions.map((v, idx) => {
                      const entry = `${s.id}:${v.id}`;
                      const isVersionSelected = selectedEntries.has(entry);
                      const isPrimary = s.primaryVersionId ? v.id === s.primaryVersionId : idx === 0;
                      return (
                        <button
                          key={v.id}
                          onClick={() => toggleEntry(entry)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                            isVersionSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isVersionSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                          }`}>
                            {isVersionSelected && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700 truncate">
                              {v.notes || `Version ${s.versions.length - idx}`}
                              {isPrimary && <span className="ml-1.5 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">PRIMARY</span>}
                            </p>
                            <p className="text-[10px] text-slate-400">{new Date(v.timestamp).toLocaleDateString()}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {selectedEntries.size > 0 ? `${selectedEntries.size} item${selectedEntries.size === 1 ? '' : 's'} selected` : 'Select songs to add'}
          </p>
          <button
            onClick={() => { onSelect(Array.from(selectedEntries)); onClose(); }}
            disabled={selectedEntries.size === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add {selectedEntries.size > 0 ? selectedEntries.size : ''} Song{selectedEntries.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SongPickerModal;
