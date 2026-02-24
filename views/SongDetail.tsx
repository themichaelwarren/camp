
import React, { useState } from 'react';
import { Submission, Assignment, Prompt, ViewState, Boca, CamperProfile } from '../types';
import * as googleService from '../services/googleService';
import ArtworkImage from '../components/ArtworkImage';
import CommentsSection from '../components/CommentsSection';

interface SongDetailProps {
  submission: Submission;
  assignment?: Assignment;
  prompt?: Prompt;
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdate: (submission: Submission) => void;
  onPlayTrack: (track: { versionId: string; title: string; artist: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string }) => Promise<void>;
  onAddToQueue?: (track: { versionId: string; title: string; artist: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string }) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  currentUser?: { name: string; email: string };
  spreadsheetId: string;
  bocas?: Boca[];
  currentUserEmail?: string;
  onGiveBoca?: (submissionId: string) => Promise<void>;
  campers?: CamperProfile[];
}

const SongDetail: React.FC<SongDetailProps> = ({ submission, assignment, prompt, onNavigate, onUpdate, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, currentUser, spreadsheetId, bocas = [], currentUserEmail = '', onGiveBoca, campers = [] }) => {
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: submission.title,
    lyrics: submission.lyrics,
    details: submission.details
  });
  const [newArtwork, setNewArtwork] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGivingBoca, setIsGivingBoca] = useState(false);

  const bocaCount = bocas.filter(b => b.submissionId === submission.id).length;
  const isOwnSong = currentUserEmail === submission.camperId;
  const alreadyBocad = bocas.some(b => b.submissionId === submission.id && b.fromEmail === currentUserEmail);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthlyUsed = bocas.filter(b => b.fromEmail === currentUserEmail && new Date(b.awardedAt) >= monthStart && new Date(b.awardedAt) < monthEnd).length;
  const poolExhausted = monthlyUsed >= 3;

  React.useEffect(() => {
    // Only sync form state when modal is closed to avoid overwriting user's edits
    if (!showEdit) {
      setEditForm({
        title: submission.title,
        lyrics: submission.lyrics,
        details: submission.details
      });
    }
  }, [submission, showEdit]);

  const loadAudio = async (versionId: string) => {
    if (activeVersionId === versionId) return;
    try {
      await onPlayTrack({
        versionId,
        title: submission.title,
        artist: submission.camperName,
        camperId: submission.camperId,
        submissionId: submission.id,
        artworkFileId: submission.artworkFileId,
        artworkUrl: submission.artworkUrl
      });
      setActiveVersionId(versionId);
    } catch (error) {
      console.error('Failed to load audio', error);
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
      let lyricsDocUrl = submission.lyricsDocUrl || '';
      let lyricsRevisionCount = submission.lyricsRevisionCount ?? 0;
      if (newArtwork) {
        const uploaded = await googleService.uploadArtworkToDriveInFolder(newArtwork, assignment?.driveFolderId);
        artworkFileId = uploaded.id;
        artworkUrl = uploaded.webViewLink;
      }

      const lyricsChanged = editForm.lyrics.trim() !== submission.lyrics;
      if (lyricsChanged) {
        if (!lyricsDocUrl) {
          const userLabel = submission.camperName || 'Anonymous';
          const created = await googleService.createLyricsDoc(editForm.title, userLabel, editForm.lyrics, assignment?.driveFolderId);
          lyricsDocUrl = created.webViewLink;
          lyricsRevisionCount = 1;
        } else {
          const match = lyricsDocUrl.match(/document\/d\/([^/]+)/);
          const docId = match ? match[1] : '';
          if (docId) {
            const nextCount = Math.max(1, lyricsRevisionCount) + 1;
            const dateLabel = new Date().toISOString().slice(0, 10);
            await googleService.appendLyricsRevision(docId, `v${nextCount} ${dateLabel}`, editForm.lyrics);
            lyricsRevisionCount = nextCount;
          }
        }
      }

      const updated: Submission = {
        ...submission,
        title: editForm.title.trim(),
        lyrics: editForm.lyrics.trim(),
        details: editForm.details.trim(),
        artworkFileId,
        artworkUrl,
        lyricsDocUrl,
        lyricsRevisionCount,
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
      <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('submissions')}
          className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <button
          onClick={() => {
            setEditForm({
              title: submission.title,
              lyrics: submission.lyrics,
              details: submission.details
            });
            setShowEdit(true);
          }}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors"
        >
          <i className="fa-solid fa-pen"></i>
          Edit
        </button>
      </div>

      {/* Hero section — album-page style */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        {/* Artwork */}
        <div className="relative w-full max-w-[280px] mx-auto md:mx-0 flex-shrink-0">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-indigo-100 text-indigo-600 flex items-center justify-center border border-slate-200 shadow-sm group">
            <ArtworkImage
              fileId={submission.artworkFileId}
              fallbackUrl={submission.artworkUrl}
              alt={`${submission.title} artwork`}
              className="w-full h-full object-contain bg-indigo-100"
              fallback={<i className="fa-solid fa-compact-disc text-4xl"></i>}
            />
            {bocaCount > 0 && (
              <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg z-10">
                <i className="fa-solid fa-star"></i>
                {bocaCount} {bocaCount === 1 ? 'BOCA' : 'BOCAs'}
              </div>
            )}
            {submission.versions[0] && (
              <button
                onClick={() => loadAudio(submission.versions[0].id)}
                disabled={playingTrackId === submission.versions[0].id}
                className={`absolute inset-0 w-full h-full flex items-center justify-center transition-colors ${playingTrackId === submission.versions[0].id ? 'bg-black/20 opacity-100' : 'bg-black/0 hover:bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'}`}
                aria-label="Play song"
              >
                <div className="w-14 h-14 rounded-full bg-slate-900/90 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                  <i className={`fa-solid ${playingTrackId === submission.versions[0].id ? 'fa-spinner fa-spin text-lg' : 'fa-play text-lg ml-0.5'}`}></i>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{submission.title}</h2>
            <p className="text-sm mt-1">
              By{' '}
              <button
                onClick={() => onNavigate('camper-detail', submission.camperId)}
                className="text-indigo-600 font-bold hover:underline"
              >
                {submission.camperName.includes('@') ? submission.camperName.split('@')[0] : submission.camperName}
              </button>
            </p>
          </div>

          {/* Assignment & Prompt chips */}
          {(assignment || prompt) && (
            <div className="flex flex-wrap gap-3">
              {assignment && (
                <button
                  onClick={() => onNavigate('assignment-detail', assignment.id)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 group transition-all"
                >
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <i className="fa-solid fa-tasks text-sm"></i>
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Assignment</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{assignment.title}</p>
                  </div>
                  <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-slate-500 flex-shrink-0"></i>
                </button>
              )}
              {prompt && (
                <button
                  onClick={() => onNavigate('prompt-detail', prompt.id)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 group transition-all"
                >
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-amber-500 flex-shrink-0">
                    <i className="fa-solid fa-lightbulb text-sm"></i>
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Prompt</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{prompt.title}</p>
                  </div>
                  <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-slate-500 flex-shrink-0"></i>
                </button>
              )}
            </div>
          )}

          {/* BOCA button */}
          {currentUserEmail && onGiveBoca && (
            <div className="max-w-xs">
              {alreadyBocad ? (
                <div className="bg-amber-50 text-amber-700 border border-amber-200 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center gap-2">
                  <i className="fa-solid fa-star"></i>
                  You BOCA'd this
                </div>
              ) : isOwnSong ? (
                <button disabled className="bg-slate-50 text-slate-400 border border-slate-200 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center gap-2 cursor-not-allowed">
                  <i className="fa-solid fa-star"></i>
                  Can't BOCA your own song
                </button>
              ) : poolExhausted ? (
                <button disabled className="bg-slate-50 text-slate-400 border border-slate-200 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center gap-2 cursor-not-allowed">
                  <i className="fa-solid fa-star"></i>
                  No BOCAs left this month
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setIsGivingBoca(true);
                    try { await onGiveBoca(submission.id); } finally { setIsGivingBoca(false); }
                  }}
                  disabled={isGivingBoca}
                  className="bg-amber-400 hover:bg-amber-500 text-amber-900 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
                >
                  <i className={`fa-solid ${isGivingBoca ? 'fa-spinner fa-spin' : 'fa-star'}`}></i>
                  Give a BOCA
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Lyrics + Production Details */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 font-serif">
            <h3 className="text-xs font-bold font-sans text-slate-400 uppercase tracking-widest mb-8">Lyrics</h3>
            <div className="text-lg text-slate-800 leading-relaxed whitespace-pre-wrap max-w-lg">
              {submission.lyrics || "No lyrics provided yet."}
            </div>
          </section>

          {submission.details && (
            <section className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Production Details</h3>
              <p className="text-slate-700 leading-relaxed italic">
                {submission.details}
              </p>
            </section>
          )}
        </div>

        {/* Right column: Version History + Drive Export */}
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadAudio(v.id)}
                        disabled={playingTrackId === v.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-white text-indigo-600 py-2 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                      >
                        <i className={`fa-solid ${playingTrackId === v.id ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
                        {activeVersionId === v.id ? 'Loaded' : 'Play'}
                      </button>
                      {onAddToQueue && (
                        <button
                          onClick={() => onAddToQueue({
                            versionId: v.id,
                            title: submission.title,
                            artist: submission.camperName,
                            submissionId: submission.id,
                            artworkFileId: submission.artworkFileId,
                            artworkUrl: submission.artworkUrl
                          })}
                          disabled={queueingTrackId === v.id}
                          className="flex items-center justify-center gap-1.5 bg-white text-slate-500 py-2 px-3 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-all shadow-sm disabled:opacity-50"
                          title="Add to queue"
                        >
                          <i className={`fa-solid ${queueingTrackId === v.id ? 'fa-spinner fa-spin' : 'fa-list'}`}></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm italic text-center py-4">No audio versions yet.</p>
              )}
            </div>
          </section>

          <section className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-slate-800">
            <h4 className="font-bold mb-4 flex items-center gap-2">
               <i className="fa-brands fa-google-drive text-green-600"></i>
               Google Drive Export
            </h4>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">This song is synced to your camp folder in Google Drive. All audio versions are stored securely in your account.</p>
            {submission.lyricsDocUrl ? (
              <a
                href={submission.lyricsDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-slate-200"
              >
                <i className="fa-solid fa-file-lines text-xs"></i>
                Open Lyrics Doc
              </a>
            ) : (
              <button className="w-full bg-white text-slate-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200">
                <i className="fa-solid fa-file-lines text-xs"></i>
                Lyrics Doc Pending
              </button>
            )}
          </section>
        </div>
      </div>

      {currentUser && (
        <CommentsSection
          entityType="song"
          entityId={submission.id}
          spreadsheetId={spreadsheetId}
          currentUser={currentUser}
          campers={campers}
        />
      )}
      </div>
      {showEdit && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
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
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Delete this song? It will be hidden but can be restored later.')) return;
                onUpdate({
                  ...submission,
                  deletedAt: new Date().toISOString(),
                  deletedBy: currentUser?.email || currentUser?.name || 'Unknown'
                });
                onNavigate('submissions');
              }}
              className="w-full bg-white text-rose-600 border border-rose-200 py-3 rounded-xl font-bold hover:bg-rose-50 transition-all"
            >
              Delete Song
            </button>
          </form>
        </div>
      </div>
    )}
    </>
  );
};

export default SongDetail;
