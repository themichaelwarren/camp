
import React, { useEffect, useState } from 'react';
import { Submission, Assignment, Prompt, ViewState } from '../types';
import * as googleService from '../services/googleService';

interface SongDetailProps {
  submission: Submission;
  assignment?: Assignment;
  prompt?: Prompt;
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdate: (submission: Submission) => void;
}

const SongDetail: React.FC<SongDetailProps> = ({ submission, assignment, prompt, onNavigate, onUpdate }) => {
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: submission.title,
    lyrics: submission.lyrics,
    details: submission.details
  });
  const [newArtwork, setNewArtwork] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (activeAudioUrl) {
        URL.revokeObjectURL(activeAudioUrl);
      }
    };
  }, [activeAudioUrl]);

  const loadAudio = async (versionId: string) => {
    if (activeVersionId === versionId) return;
    setLoadingVersionId(versionId);
    try {
      const blob = await googleService.fetchDriveFile(versionId);
      const url = URL.createObjectURL(blob);
      if (activeAudioUrl) {
        URL.revokeObjectURL(activeAudioUrl);
      }
      setActiveVersionId(versionId);
      setActiveAudioUrl(url);
    } catch (error) {
      console.error('Failed to load audio', error);
      alert('Failed to load audio from Drive. Please try again.');
    } finally {
      setLoadingVersionId(null);
    }
  };

  const handleArtworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('Artwork image must be 5MB or smaller.');
        return;
      }
      setNewArtwork(file);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let artworkFileId = submission.artworkFileId || '';
      let artworkUrl = submission.artworkUrl || '';
      if (newArtwork) {
        const uploaded = await googleService.uploadArtworkToDriveInFolder(newArtwork, assignment?.driveFolderId);
        artworkFileId = uploaded.id;
        artworkUrl = uploaded.webViewLink;
      }

      const updated: Submission = {
        ...submission,
        title: editForm.title.trim(),
        lyrics: editForm.lyrics.trim(),
        details: editForm.details.trim(),
        artworkFileId,
        artworkUrl,
        updatedAt: new Date().toISOString()
      };
      onUpdate(updated);
      setShowEdit(false);
      setNewArtwork(null);
    } catch (error) {
      console.error('Failed to update submission', error);
      alert('Failed to update song. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('submissions')}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden border border-indigo-100">
            {submission.artworkUrl ? (
              <img src={submission.artworkUrl} alt={`${submission.title} artwork`} className="w-full h-full object-cover" />
            ) : (
              <i className="fa-solid fa-compact-disc"></i>
            )}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{submission.title}</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-indigo-600 font-bold text-sm">By {submission.camperName}</p>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <p className="text-slate-400 text-xs font-medium">Song ID: {submission.id}</p>
            </div>
            <button
              onClick={() => {
                setEditForm({
                  title: submission.title,
                  lyrics: submission.lyrics,
                  details: submission.details
                });
                setShowEdit(true);
              }}
              className="mt-3 inline-flex md:hidden items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
            >
              <i className="fa-solid fa-pen"></i>
              Edit Song
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setEditForm({
              title: submission.title,
              lyrics: submission.lyrics,
              details: submission.details
            });
            setShowEdit(true);
          }}
          className="hidden md:inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
        >
          <i className="fa-solid fa-pen"></i>
          Edit Song
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex gap-4">
            {assignment && (
              <button 
                onClick={() => onNavigate('assignment-detail', assignment.id)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 p-4 rounded-2xl flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600">
                    <i className="fa-solid fa-tasks"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Assignment</p>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{assignment.title}</p>
                  </div>
                </div>
                <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-slate-500"></i>
              </button>
            )}
            {prompt && (
              <button 
                onClick={() => onNavigate('prompt-detail', prompt.id)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 p-4 rounded-2xl flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500">
                    <i className="fa-solid fa-lightbulb"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Prompt</p>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{prompt.title}</p>
                  </div>
                </div>
                <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-slate-500"></i>
              </button>
            )}
          </div>

          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 font-serif">
            <h3 className="text-xs font-bold font-sans text-slate-400 uppercase tracking-widest mb-10">Lyrics</h3>
            <div className="text-lg text-slate-800 leading-relaxed whitespace-pre-wrap max-w-lg mx-auto">
              {submission.lyrics || "No lyrics provided yet."}
            </div>
          </section>

          {submission.details && (
            <section className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Production Details</h3>
              <p className="text-slate-700 leading-relaxed italic">
                {submission.details}
              </p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Version History</h3>
            <div className="space-y-4">
              {submission.versions.length > 0 ? (
                submission.versions.map((v, idx) => (
                  <div key={v.id} className={`p-4 rounded-2xl border ${idx === 0 ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                        {idx === 0 ? 'Latest' : `v${submission.versions.length - idx}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(v.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate mb-1">{v.fileName}</p>
                    <p className="text-[10px] text-slate-500 italic mb-3">"{v.notes}"</p>
                    <button
                      onClick={() => loadAudio(v.id)}
                      className="w-full flex items-center justify-center gap-2 bg-white text-indigo-600 py-2 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                    >
                      <i className={`fa-solid ${loadingVersionId === v.id ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
                      {activeVersionId === v.id ? 'Loaded' : 'Play in App'}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm italic text-center py-4">No audio versions yet.</p>
              )}
            </div>
            {activeAudioUrl && (
              <div className="mt-6 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Player</p>
                <audio controls src={activeAudioUrl} className="w-full"></audio>
              </div>
            )}
          </section>

          <section className="bg-slate-900 p-8 rounded-3xl text-white">
            <h4 className="font-bold mb-4 flex items-center gap-2">
               <i className="fa-brands fa-google-drive text-blue-400"></i>
               Google Drive Export
            </h4>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">This song is synced to your camp folder in Google Drive. All audio versions are stored securely in your account.</p>
            {submission.lyricsDocUrl ? (
              <a
                href={submission.lyricsDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-file-lines text-xs"></i>
                Open Lyrics Doc
              </a>
            ) : (
              <button className="w-full bg-white/10 text-white/70 font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                <i className="fa-solid fa-file-lines text-xs"></i>
                Lyrics Doc Pending
              </button>
            )}
          </section>
        </div>
      </div>
      </div>
      {showEdit && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-xl text-slate-800">Edit Song</h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lyrics</label>
                <textarea
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-48 font-serif text-sm"
                  value={editForm.lyrics}
                  onChange={(e) => setEditForm({ ...editForm, lyrics: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Production Notes</label>
                <textarea
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-24 text-sm"
                  value={editForm.details}
                  onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Artwork (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
                  onChange={handleArtworkChange}
                />
                <p className="text-[10px] text-slate-400 mt-2">Max size 5MB.</p>
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i>
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SongDetail;
