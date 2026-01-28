
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Prompt, Submission, ViewState } from '../types';
import PromptSelector from '../components/PromptSelector';

interface AssignmentDetailProps {
  assignment: Assignment;
  prompt?: Prompt;
  prompts: Prompt[];
  submissions: Submission[];
  campersCount: number;
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdate: (assignment: Assignment) => void;
  currentUser?: { name: string; email: string };
}

const AssignmentDetail: React.FC<AssignmentDetailProps> = ({ assignment, prompt, prompts, submissions, campersCount, onNavigate, onUpdate, currentUser }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: assignment.title,
    promptId: assignment.promptId,
    startDate: assignment.startDate || '',
    dueDate: assignment.dueDate,
    instructions: assignment.instructions,
    status: assignment.status
  });

  const totalCampers = campersCount || 0;
  const submissionRate = totalCampers > 0 ? Math.round((submissions.length / totalCampers) * 100) : 0;
  const progressInset = totalCampers > 0 ? 100 - (submissions.length / totalCampers * 100) : 100;

  useEffect(() => {
    setEditForm({
      title: assignment.title,
      promptId: assignment.promptId,
      startDate: assignment.startDate || '',
      dueDate: assignment.dueDate,
      instructions: assignment.instructions,
      status: assignment.status
    });
  }, [assignment]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAssignment: Assignment = {
      ...assignment,
      title: editForm.title.trim(),
      promptId: editForm.promptId,
      startDate: editForm.startDate,
      dueDate: editForm.dueDate,
      instructions: editForm.instructions.trim(),
      status: editForm.status
    };
    onUpdate(updatedAssignment);
    setShowEditModal(false);
  };

  const handleCloseAssignment = () => {
    if (!window.confirm('Close this assignment? This will prevent new submissions and mark it as archived.')) return;
    onUpdate({ ...assignment, status: 'Closed' });
  };

  const handleDeleteAssignment = () => {
    if (!window.confirm('Delete this assignment? It will be hidden but can be restored later.')) return;
    onUpdate({
      ...assignment,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.email || currentUser?.name || 'Unknown'
    });
    onNavigate('assignments');
  };

  return (
    <>
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('assignments')}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{assignment.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                assignment.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {assignment.status}
              </span>
              {assignment.startDate && (
                <span className="text-slate-400 text-xs font-medium">Started {assignment.startDate}</span>
              )}
              <span className="text-slate-400 text-xs font-medium">Due {assignment.dueDate}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          <i className="fa-solid fa-pen"></i>
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Instructions</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {assignment.instructions}
              </p>
            </div>
            {prompt && (
              <div 
                onClick={() => onNavigate('prompt-detail', prompt.id)}
                className="bg-slate-50 p-8 flex items-center justify-between cursor-pointer hover:bg-indigo-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                    <i className="fa-solid fa-lightbulb"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Linked Prompt</p>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{prompt.title}</p>
                  </div>
                </div>
                <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-indigo-400 transition-colors"></i>
              </div>
            )}
          </section>

          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Submitted Songs</h3>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{submissions.length} Submissions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {submissions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => onNavigate('song-detail', s.id)}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                      <i className="fa-solid fa-music"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate max-w-[150px]">{s.title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{s.camperName}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 h-16 overflow-hidden">
                    <p className="text-[10px] font-serif italic text-slate-500 line-clamp-2">
                      {s.lyrics}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>{s.versions.length} VERSION{s.versions.length !== 1 ? 'S' : ''}</span>
                    <span>UPDATED {new Date(s.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {submissions.length === 0 && (
                <div className="col-span-2 p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                  <i className="fa-solid fa-music text-3xl mb-4 opacity-20"></i>
                  <p className="font-medium">No submissions for this project yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Project Progress</h3>
            <div className="flex flex-col items-center">
               <div className="w-32 h-32 rounded-full border-8 border-slate-50 flex items-center justify-center relative mb-4">
                 <div className="absolute inset-0 border-8 border-indigo-500 rounded-full" style={{ clipPath: `inset(0 0 ${progressInset}% 0)` }}></div>
                 <span className="text-2xl font-black text-slate-800">{submissionRate}%</span>
               </div>
               <p className="text-sm font-bold text-slate-600 mb-1">{submissions.length} / {totalCampers} Campers</p>
               <p className="text-xs text-slate-400">Submission Rate</p>
            </div>
          </section>

          {assignment.status === 'Open' && (
            <section className="bg-amber-400 p-6 rounded-3xl text-amber-950 shadow-lg shadow-amber-100">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Deadline Management
              </h4>
              <p className="text-amber-900 text-sm mb-4 leading-relaxed">Closing an assignment prevents new submissions and marks the project as archived.</p>
              <button
                onClick={handleCloseAssignment}
                className="w-full bg-amber-950 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors"
              >
                Close Assignment
              </button>
            </section>
          )}

          <section className="bg-white p-6 rounded-3xl border border-rose-200 text-rose-600">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <i className="fa-solid fa-trash"></i>
              Delete
            </h4>
            <p className="text-rose-500 text-sm mb-4 leading-relaxed">Hide this assignment without removing the data.</p>
            <button
              onClick={handleDeleteAssignment}
              className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl hover:bg-rose-700 transition-colors"
            >
              Delete Assignment
            </button>
          </section>
        </div>
      </div>

      {showEditModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-visible animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800">Edit Assignment</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-visible">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={editForm.title}
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Prompt</label>
                <PromptSelector
                  prompts={prompts}
                  selectedPromptId={editForm.promptId}
                  onChange={(promptId) => setEditForm({...editForm, promptId})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={editForm.startDate}
                    onChange={e => setEditForm({...editForm, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={editForm.dueDate}
                    onChange={e => setEditForm({...editForm, dueDate: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instructions / Specific Goals</label>
                <textarea
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-32"
                  value={editForm.instructions}
                  onChange={e => setEditForm({...editForm, instructions: e.target.value})}
                  placeholder="e.g. Focus on complex chord changes or experimental vocals..."
                ></textarea>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={editForm.status}
                  onChange={e => setEditForm({...editForm, status: e.target.value as 'Open' | 'Closed'})}
                >
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                Save Changes
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
    </>
  );
};

export default AssignmentDetail;
