
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Prompt, Assignment, Submission, PlayableTrack, ViewState, Boca } from '../types';
import TagInput from '../components/TagInput';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownPreview from '../components/MarkdownPreview';
import CommentsSection from '../components/CommentsSection';
import * as googleService from '../services/googleService';
import { getPromptStatus, getPromptStatusStyle } from '../utils';

interface PromptDetailProps {
  prompt: Prompt;
  assignments: Assignment[];
  submissions: Submission[];
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdate: (prompt: Prompt) => void;
  onPlayTrack: (track: PlayableTrack) => Promise<void>;
  onAddToQueue: (track: PlayableTrack) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  onUpvote: (prompt: Prompt) => void;
  upvotedPromptIds: string[];
  currentUser?: { name: string; email: string };
  spreadsheetId: string;
  bocas?: Boca[];
}

const trackFromSubmission = (sub: Submission): PlayableTrack | null => {
  if (!sub.versions?.length || !sub.versions[0].id) return null;
  return { versionId: sub.versions[0].id, title: sub.title, artist: sub.camperName, camperId: sub.camperId, submissionId: sub.id, artworkFileId: sub.artworkFileId, artworkUrl: sub.artworkUrl };
};

const PromptDetail: React.FC<PromptDetailProps> = ({ prompt, assignments, submissions, onNavigate, onUpdate, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, onUpvote, upvotedPromptIds, currentUser, spreadsheetId, bocas = [] }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState({
    title: prompt.title,
    description: prompt.description,
    tags: prompt.tags
  });
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    // Only sync form state when modal is closed to avoid overwriting user's edits
    if (!showEditModal) {
      setEditPrompt({
        title: prompt.title,
        description: prompt.description,
        tags: prompt.tags
      });
    }
  }, [prompt, showEditModal]);

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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Create any new tags that don't exist yet
    const newTags = editPrompt.tags.filter((tag: string) => !availableTags.includes(tag));
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

    const updatedPrompt: Prompt = {
      ...prompt,
      title: editPrompt.title.trim(),
      description: editPrompt.description.trim(),
      tags: editPrompt.tags
    };
    onUpdate(updatedPrompt);
    setShowEditModal(false);
  };

  const handleDeletePrompt = () => {
    if (!window.confirm('Delete this prompt? It will be hidden but can be restored later.')) return;
    onUpdate({ ...prompt, deletedAt: new Date().toISOString(), deletedBy: currentUser?.email || currentUser?.name || 'Unknown' });
    onNavigate('prompts');
  };

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
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
        <button
          onClick={() => setShowEditModal(true)}
          className="bg-indigo-600 text-white px-4 py-1.5 md:px-6 md:py-2.5 rounded-xl text-sm md:text-base font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-pen"></i>
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Prompt Context</h3>
            <div className="text-lg text-slate-700 leading-relaxed mb-6 border-l-4 border-indigo-200 pl-6">
              <MarkdownPreview content={prompt.description} />
            </div>
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
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">Songs Inspired by this Prompt</h3>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{submissions.length} Submissions</span>
              </div>
              {submissions.some(s => s.versions?.length > 0 && s.versions[0].id) && (
                <button
                  onClick={async () => {
                    const playable = submissions.map(s => trackFromSubmission(s)).filter((t): t is PlayableTrack => t !== null);
                    if (playable.length === 0) return;
                    await onPlayTrack(playable[0]);
                    for (let i = 1; i < playable.length; i++) {
                      onAddToQueue(playable[i]);
                    }
                  }}
                  disabled={!!playingTrackId}
                  className="bg-indigo-600 text-white px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-sm md:text-base font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  <i className={`fa-solid ${playingTrackId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
                  Play All ({submissions.filter(s => s.versions?.length > 0).length})
                </button>
              )}
            </div>
            <div className="space-y-4">
              {submissions.map(s => {
                const track = trackFromSubmission(s);
                const bocaCount = bocas.filter(b => b.submissionId === s.id).length;
                return (
                  <div
                    key={s.id}
                    onClick={() => onNavigate('song-detail', s.id)}
                    className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-6 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                      <i className="fa-solid fa-music"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800">{s.title}</h4>
                        {bocaCount > 0 && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                            <i className="fa-solid fa-star text-[8px]"></i>
                            {bocaCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">by {s.camperName}</p>
                    </div>
                    {track && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                          disabled={playingTrackId === track.versionId}
                          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                          title="Play"
                        >
                          <i className={`fa-solid ${playingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-play'} text-xs`}></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                          disabled={queueingTrackId === track.versionId}
                          className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                          title="Add to queue"
                        >
                          <i className={`fa-solid ${queueingTrackId === track.versionId ? 'fa-spinner fa-spin' : 'fa-list'} text-xs`}></i>
                        </button>
                      </div>
                    )}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Last Update</p>
                      <p className="text-xs font-semibold text-slate-700">{new Date(s.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
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
              <div className="py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Created By</span>
                <span className="text-sm text-slate-800 font-bold break-words">{prompt.createdBy}</span>
              </div>
              <div className="py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Creation Date</span>
                <span className="text-sm text-slate-800 font-bold">{prompt.createdAt}</span>
              </div>
              <div className="py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Status</span>
                {(() => {
                  const cs = getPromptStatus(prompt.id, assignments);
                  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase inline-block ${getPromptStatusStyle(cs)}`}>{cs}</span>;
                })()}
              </div>
              <div className="py-2">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block mb-1">Hearts</span>
                <button
                  onClick={() => onUpvote(prompt)}
                  disabled={upvotedPromptIds.includes(prompt.id)}
                  className={`text-sm font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                    upvotedPromptIds.includes(prompt.id)
                      ? 'bg-red-50 text-red-400 cursor-default'
                      : 'bg-red-50 text-red-500 hover:bg-red-100 hover:scale-105 active:scale-95'
                  }`}
                >
                  <i className={`fa-${upvotedPromptIds.includes(prompt.id) ? 'solid' : 'regular'} fa-heart`}></i>
                  {prompt.upvotes}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {currentUser && (
        <CommentsSection
          entityType="prompt"
          entityId={prompt.id}
          spreadsheetId={spreadsheetId}
          currentUser={currentUser}
        />
      )}

      {showEditModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800">Edit Prompt</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-visible">
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
                <MarkdownEditor
                  value={editPrompt.description}
                  onChange={(description) => setEditPrompt({ ...editPrompt, description })}
                  placeholder="Describe the challenge..."
                  required
                  minHeight="h-24"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags</label>
                <TagInput
                  value={editPrompt.tags}
                  onChange={(tags: string[]) => setEditPrompt({ ...editPrompt, tags })}
                  availableTags={availableTags}
                  onCreateTag={async () => {}} // No-op: tags created on form submit
                  placeholder="Type to add tags..."
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleDeletePrompt}
                className="w-full bg-white text-rose-600 border border-rose-200 py-3 rounded-xl font-bold hover:bg-rose-50 transition-all"
              >
                Delete Prompt
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

export default PromptDetail;
