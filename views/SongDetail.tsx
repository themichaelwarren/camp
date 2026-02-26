
import React, { useState } from 'react';
import { Submission, Assignment, Prompt, ViewState, Boca, CamperProfile, Collaboration, CollaboratorRole, DocTextSegment, SongVersion } from '../types';
import { DateFormat, formatDate, getDisplayArtist, getArtistSegments, ArtistSegment, getPrimaryVersion } from '../utils';
import * as googleService from '../services/googleService';
import ArtworkImage from '../components/ArtworkImage';
import CommentsSection from '../components/CommentsSection';

interface SongDetailProps {
  submission: Submission;
  assignment?: Assignment;
  prompt?: Prompt;
  onNavigate: (view: ViewState, id?: string) => void;
  onUpdate?: (submission: Submission) => void;
  onPlayTrack: (track: { versionId: string; title: string; artist: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string }) => Promise<void>;
  onAddToQueue?: (track: { versionId: string; title: string; artist: string; submissionId?: string; artworkFileId?: string; artworkUrl?: string }) => Promise<void>;
  playingTrackId?: string | null;
  queueingTrackId?: string | null;
  currentUser?: { name: string; email: string };
  spreadsheetId?: string;
  bocas?: Boca[];
  currentUserEmail?: string;
  onGiveBoca?: (submissionId: string) => Promise<void>;
  campers?: CamperProfile[];
  dateFormat: DateFormat;
  isFavorited?: boolean;
  onToggleFavorite?: (submissionId: string) => void;
  collaborations?: Collaboration[];
  onAddCollaborator?: (submissionId: string, camperId: string, camperName: string, role: string) => Promise<void>;
  onRemoveCollaborator?: (collaboratorId: string) => Promise<void>;
}

const ROLE_OPTIONS: { value: CollaboratorRole; label: string }[] = [
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'featured', label: 'Featured' },
  { value: 'producer', label: 'Producer' },
];

const CollaboratorEditor: React.FC<{
  submissionId: string;
  collaborations: Collaboration[];
  campers: CamperProfile[];
  primaryCamperId: string;
  onAdd: (submissionId: string, camperId: string, camperName: string, role: string) => Promise<void>;
  onRemove: (collaboratorId: string) => Promise<void>;
}> = ({ submissionId, collaborations, campers, primaryCamperId, onAdd, onRemove }) => {
  const [selectedCamperId, setSelectedCamperId] = useState('');
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>('collaborator');
  const [isAdding, setIsAdding] = useState(false);

  const existingIds = new Set([primaryCamperId, ...collaborations.map(c => c.camperId)]);
  const availableCampers = campers.filter(c => !existingIds.has(c.email) && !existingIds.has(c.id));

  const handleAdd = async () => {
    const camper = campers.find(c => c.email === selectedCamperId || c.id === selectedCamperId);
    if (!camper) return;
    setIsAdding(true);
    try {
      await onAdd(submissionId, camper.email || camper.id, camper.name, selectedRole);
      setSelectedCamperId('');
      setSelectedRole('collaborator');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Collaborators</label>
      {collaborations.length > 0 && (
        <div className="space-y-2 mb-3">
          {collaborations.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">{c.camperName}</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">
                  {c.role || 'collaborator'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
          ))}
        </div>
      )}
      {availableCampers.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <select
              value={selectedCamperId}
              onChange={(e) => setSelectedCamperId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select camper...</option>
              {availableCampers.map(c => (
                <option key={c.id} value={c.email || c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as CollaboratorRole)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedCamperId || isAdding}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {isAdding ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Add'}
          </button>
        </div>
      )}
      {availableCampers.length === 0 && collaborations.length === 0 && (
        <p className="text-xs text-slate-400 italic">No other campers available to add.</p>
      )}
    </div>
  );
};

const SongDetail: React.FC<SongDetailProps> = ({ submission, assignment, prompt, onNavigate, onUpdate, onPlayTrack, onAddToQueue, playingTrackId, queueingTrackId, currentUser, spreadsheetId, bocas = [], currentUserEmail = '', onGiveBoca, campers = [], dateFormat, isFavorited = false, onToggleFavorite, collaborations = [], onAddCollaborator, onRemoveCollaborator }) => {
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
  const [docLyrics, setDocLyrics] = useState<DocTextSegment[] | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [isRefreshingLyrics, setIsRefreshingLyrics] = useState(false);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState('');

  const bocaCount = bocas.filter(b => b.submissionId === submission.id).length;
  const isOwnSong = currentUserEmail === submission.camperId;
  const isCollaborator = collaborations.some(c => c.submissionId === submission.id && c.camperId === currentUserEmail);
  const canManageVersions = isOwnSong || isCollaborator;
  const primaryVersion = getPrimaryVersion(submission);
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

  React.useEffect(() => {
    if (!submission.lyricsDocUrl) return;
    const docId = googleService.extractDocIdFromUrl(submission.lyricsDocUrl);
    if (!docId) {
      console.warn('Could not extract doc ID from lyricsDocUrl:', submission.lyricsDocUrl);
      return;
    }
    setDocLoading(true);
    googleService.fetchDocContent(docId)
      .then(setDocLyrics)
      .catch((err) => { console.error('Failed to fetch lyrics doc:', err, 'URL:', submission.lyricsDocUrl, 'docId:', docId); setDocLyrics(null); })
      .finally(() => setDocLoading(false));
  }, [submission.lyricsDocUrl]);

  const loadAudio = async (versionId: string) => {
    if (activeVersionId === versionId) return;
    try {
      await onPlayTrack({
        versionId,
        title: submission.title,
        artist: getDisplayArtist(submission, collaborations),
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

  const handleCreateLyricsDoc = async () => {
    setIsCreatingDoc(true);
    try {
      const userLabel = submission.camperName || 'Anonymous';
      const created = await googleService.createLyricsDoc(submission.title, userLabel, submission.lyrics, assignment?.driveFolderId);
      const updated: Submission = { ...submission, lyricsDocUrl: created.webViewLink, lyrics: '' };
      onUpdate?.(updated);
      const docId = googleService.extractDocIdFromUrl(created.webViewLink);
      if (docId) {
        googleService.fetchDocContent(docId).then(setDocLyrics).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to create lyrics doc', error);
      alert('Failed to create lyrics doc. Please try again.');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const handleUploadVersion = async () => {
    if (!newVersionFile) return;
    setIsUploadingVersion(true);
    try {
      const uploaded = await googleService.uploadAudioToDriveInFolder(newVersionFile, assignment?.driveFolderId);
      await googleService.shareFilePublicly(uploaded.id);
      const newVersion: SongVersion = {
        id: uploaded.id,
        timestamp: new Date().toISOString(),
        audioUrl: uploaded.webViewLink,
        fileName: newVersionFile.name,
        notes: newVersionNotes.trim() || 'New version'
      };
      const updatedSubmission: Submission = {
        ...submission,
        versions: [newVersion, ...submission.versions],
        updatedAt: new Date().toISOString()
      };
      onUpdate?.(updatedSubmission);
      setNewVersionFile(null);
      setNewVersionNotes('');
      setShowUploadForm(false);
    } catch (error) {
      console.error('Failed to upload new version', error);
      alert('Failed to upload new version. Please try again.');
    } finally {
      setIsUploadingVersion(false);
    }
  };

  const handleSetPrimary = (versionId: string) => {
    onUpdate?.({ ...submission, primaryVersionId: versionId, updatedAt: new Date().toISOString() });
  };

  const handleSaveNotes = (versionId: string) => {
    const updatedVersions = submission.versions.map(v =>
      v.id === versionId ? { ...v, notes: editingNotesText.trim() } : v
    );
    onUpdate?.({ ...submission, versions: updatedVersions, updatedAt: new Date().toISOString() });
    setEditingNotesId(null);
    setEditingNotesText('');
  };

  const handleDeleteVersion = (versionId: string) => {
    if (submission.versions.length <= 1) return;
    if (!window.confirm('Delete this version? The audio file will remain in Google Drive.')) return;
    const updatedVersions = submission.versions.filter(v => v.id !== versionId);
    const newPrimaryId = submission.primaryVersionId === versionId ? '' : (submission.primaryVersionId || '');
    onUpdate?.({ ...submission, versions: updatedVersions, primaryVersionId: newPrimaryId, updatedAt: new Date().toISOString() });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let artworkFileId = submission.artworkFileId || '';
      let artworkUrl = submission.artworkUrl || '';
      let lyricsDocUrl = submission.lyricsDocUrl || '';
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
        } else {
          const docId = googleService.extractDocIdFromUrl(lyricsDocUrl);
          if (docId) {
            await googleService.replaceDocContent(docId, editForm.lyrics);
          }
        }
      }

      const updated: Submission = {
        ...submission,
        title: editForm.title.trim(),
        lyrics: lyricsDocUrl ? '' : editForm.lyrics.trim(),
        details: editForm.details.trim(),
        artworkFileId,
        artworkUrl,
        lyricsDocUrl,
        updatedAt: new Date().toISOString()
      };
      onUpdate?.(updated);
      setShowEdit(false);
      setNewArtwork(null);
      if (lyricsChanged && lyricsDocUrl) {
        const docId = googleService.extractDocIdFromUrl(lyricsDocUrl);
        if (docId) {
          googleService.fetchDocContent(docId).then(setDocLyrics).catch(() => {});
        }
      }
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
        <div className="flex items-center gap-2">
          {canManageVersions && (
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
          )}
          {canManageVersions ? (
            <button
              onClick={() => {
                if (submission.status !== 'shared') {
                  if (!window.confirm('Share this song? It will become visible to all campers.')) return;
                }
                const newStatus = submission.status === 'shared' ? 'private' : 'shared';
                onUpdate?.({ ...submission, status: newStatus, updatedAt: new Date().toISOString() });
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                submission.status === 'shared'
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
              title={submission.status === 'shared' ? 'Click to make private' : 'Click to share'}
            >
              <i className={`fa-solid ${submission.status === 'shared' ? 'fa-globe' : 'fa-lock'}`}></i>
              {submission.status === 'shared' ? 'Shared' : 'Private'}
            </button>
          ) : currentUserEmail ? (
            <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
              submission.status === 'shared'
                ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              <i className={`fa-solid ${submission.status === 'shared' ? 'fa-globe' : 'fa-lock'}`}></i>
              {submission.status === 'shared' ? 'Shared' : 'Private'}
            </span>
          ) : null}
        </div>
      </div>

      {/* Hero section — album-page style */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        {/* Artwork */}
        <div className="relative w-full md:max-w-[280px] mx-auto md:mx-0 flex-shrink-0">
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
            {primaryVersion && (
              <button
                onClick={() => loadAudio(primaryVersion.id)}
                disabled={playingTrackId === primaryVersion.id}
                className={`absolute inset-0 w-full h-full flex items-center justify-center transition-colors ${playingTrackId === primaryVersion.id ? 'bg-black/20 opacity-100' : 'bg-black/0 hover:bg-black/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'}`}
                aria-label="Play song"
              >
                <div className="w-14 h-14 rounded-full bg-slate-900/90 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                  <i className={`fa-solid ${playingTrackId === primaryVersion.id ? 'fa-spinner fa-spin text-lg' : 'fa-play text-lg ml-0.5'}`}></i>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex-1 min-w-0 w-full space-y-4 overflow-hidden">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-slate-800">{submission.title}</h2>
              {onToggleFavorite && (
                <button
                  onClick={() => onToggleFavorite(submission.id)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    isFavorited
                      ? 'bg-red-50 text-red-500 hover:bg-red-100'
                      : 'bg-slate-100 text-slate-300 hover:text-red-400 hover:bg-red-50'
                  }`}
                  title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart text-lg`}></i>
                </button>
              )}
            </div>
            <p className="text-sm mt-1">
              {(() => {
                const segments = getArtistSegments(submission, collaborations);
                const primaries = segments.filter(s => !s.role || s.role === '' || s.role === 'collaborator');
                const featured = segments.filter(s => s.role === 'featured');
                const producers = segments.filter(s => s.role === 'producer');

                const renderName = (seg: ArtistSegment, i: number) => (
                  <button
                    key={`${seg.camperId}-${i}`}
                    onClick={() => onNavigate('camper-detail', seg.camperId)}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    {seg.name.includes('@') ? seg.name.split('@')[0] : seg.name}
                  </button>
                );

                const joinNames = (items: ArtistSegment[]) =>
                  items.map((seg, i) => (
                    <React.Fragment key={`${seg.camperId}-${i}`}>
                      {i > 0 && <span> & </span>}
                      {renderName(seg, i)}
                    </React.Fragment>
                  ));

                return (
                  <>
                    By {joinNames(primaries)}
                    {featured.length > 0 && <> ft. {joinNames(featured)}</>}
                    {producers.length > 0 && <> (prod. {joinNames(producers)})</>}
                  </>
                );
              })()}
            </p>
          </div>

          {/* Assignment & Prompt chips */}
          {(assignment || prompt) && (
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {assignment && (
                <button
                  onClick={() => onNavigate('assignment-detail', assignment.id)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 group transition-all w-full sm:w-auto overflow-hidden"
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
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 group transition-all w-full sm:w-auto overflow-hidden"
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
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-bold font-sans text-slate-400 uppercase tracking-widest">Lyrics</h3>
              {currentUserEmail && submission.lyricsDocUrl ? (
                <div className="flex items-center gap-1.5">
                  <a
                    href={submission.lyricsDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-sans font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    Open in Google Docs
                  </a>
                  <button
                    onClick={() => {
                      const docId = googleService.extractDocIdFromUrl(submission.lyricsDocUrl!);
                      if (!docId) return;
                      setIsRefreshingLyrics(true);
                      googleService.fetchDocContent(docId)
                        .then(setDocLyrics)
                        .catch(() => {})
                        .finally(() => setIsRefreshingLyrics(false));
                    }}
                    disabled={isRefreshingLyrics}
                    className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                    title="Refresh lyrics from Google Docs"
                  >
                    <i className={`fa-solid fa-arrows-rotate text-[10px] ${isRefreshingLyrics ? 'fa-spin' : ''}`}></i>
                  </button>
                </div>
              ) : isOwnSong ? (
                <button
                  onClick={handleCreateLyricsDoc}
                  disabled={isCreatingDoc}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-sans font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 disabled:opacity-50"
                >
                  <i className="fa-solid fa-file-circle-plus text-[10px]"></i>
                  {isCreatingDoc ? 'Creating...' : 'Create Lyrics Doc'}
                </button>
              ) : null}
            </div>
            {docLoading ? (
              <p className="text-slate-400 italic">Loading lyrics...</p>
            ) : docLyrics ? (
              <div className="text-lg text-slate-800 leading-relaxed max-w-lg">
                {docLyrics.map((seg, i) =>
                  seg.text === '\n' ? <br key={i} /> :
                  seg.bold && seg.italic ? <strong key={i}><em>{seg.text}</em></strong> :
                  seg.bold ? <strong key={i}>{seg.text}</strong> :
                  seg.italic ? <em key={i}>{seg.text}</em> :
                  <span key={i}>{seg.text}</span>
                )}
              </div>
            ) : submission.lyrics ? (
              <div className="text-lg text-slate-800 leading-relaxed whitespace-pre-wrap max-w-lg">
                {submission.lyrics}
              </div>
            ) : (
              <p className="text-slate-400 font-sans text-sm italic">No lyrics provided yet.</p>
            )}
          </section>

        </div>

        {/* Right column: Production Details + Version History */}
        <div className="space-y-6">
          {submission.details && (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Production Notes</h3>
              <p className="text-sm text-slate-700 leading-relaxed italic whitespace-pre-wrap">
                {submission.details}
              </p>
            </section>
          )}
          {currentUserEmail && <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Version History</h3>

            {canManageVersions && !showUploadForm && (
              <button
                onClick={() => setShowUploadForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors mb-4"
              >
                <i className="fa-solid fa-cloud-arrow-up"></i>
                Upload New Version
              </button>
            )}

            {showUploadForm && (
              <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 mb-4 space-y-3">
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.aac,.ogg,.flac"
                  onChange={(e) => { if (e.target.files?.[0]) setNewVersionFile(e.target.files[0]); }}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-bold file:bg-white file:text-slate-700 hover:file:bg-slate-50"
                />
                <input
                  type="text"
                  placeholder="Version notes (e.g., 'Added guitar solo')"
                  value={newVersionNotes}
                  onChange={(e) => setNewVersionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs placeholder:text-slate-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUploadVersion}
                    disabled={!newVersionFile || isUploadingVersion}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isUploadingVersion ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    onClick={() => { setShowUploadForm(false); setNewVersionFile(null); setNewVersionNotes(''); }}
                    className="px-4 py-2 bg-white text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {submission.versions.length > 0 ? (
                submission.versions.map((v, idx) => {
                  const isPrimary = v.id === primaryVersion?.id;
                  return (
                    <div key={v.id} className={`p-4 rounded-2xl border ${isPrimary ? 'border-green-200 bg-green-50/30' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${isPrimary ? 'text-green-700 bg-white border-green-200' : 'text-slate-500 bg-white border-slate-200'}`}>
                          {isPrimary ? 'Primary' : `v${submission.versions.length - idx}`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">{formatDate(v.timestamp, dateFormat)}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate mb-1">{v.fileName}</p>
                      {editingNotesId === v.id ? (
                        <div className="flex gap-1.5 mb-3">
                          <input
                            type="text"
                            value={editingNotesText}
                            onChange={(e) => setEditingNotesText(e.target.value)}
                            className="flex-1 px-2 py-1 rounded-lg border border-slate-200 text-[10px]"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNotes(v.id); if (e.key === 'Escape') setEditingNotesId(null); }}
                          />
                          <button onClick={() => handleSaveNotes(v.id)} className="text-[10px] text-indigo-600 font-bold px-1.5">Save</button>
                          <button onClick={() => setEditingNotesId(null)} className="text-[10px] text-slate-400 font-bold px-1.5">Cancel</button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic mb-3 group/notes">
                          "{v.notes}"
                          {canManageVersions && (
                            <button
                              onClick={() => { setEditingNotesId(v.id); setEditingNotesText(v.notes); }}
                              className="ml-1.5 text-slate-300 hover:text-slate-500 opacity-0 group-hover/notes:opacity-100 transition-opacity"
                              title="Edit notes"
                            >
                              <i className="fa-solid fa-pencil text-[8px]"></i>
                            </button>
                          )}
                        </p>
                      )}
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
                              artist: getDisplayArtist(submission, collaborations),
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
                      {canManageVersions && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
                          {!isPrimary && (
                            <button
                              onClick={() => handleSetPrimary(v.id)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold"
                            >
                              <i className="fa-solid fa-star mr-1"></i>Set Primary
                            </button>
                          )}
                          {submission.versions.length > 1 && (
                            <button
                              onClick={() => handleDeleteVersion(v.id)}
                              className="text-[10px] text-rose-500 hover:text-rose-700 font-bold ml-auto"
                            >
                              <i className="fa-solid fa-trash mr-1"></i>Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-400 text-sm italic text-center py-4">No audio versions yet.</p>
              )}
            </div>
          </section>}
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
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-xl text-slate-800">Edit Song</h3>
              <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto overflow-x-hidden flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Production Notes</label>
                  <textarea
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-24 text-base"
                    value={editForm.details}
                    onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Artwork (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-base text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
                    onChange={handleArtworkChange}
                  />
                  <p className="text-[10px] text-slate-400 mt-2">Max size 5MB.</p>
                </div>
                {onAddCollaborator && onRemoveCollaborator && (
                  <CollaboratorEditor
                    submissionId={submission.id}
                    collaborations={collaborations.filter(c => c.submissionId === submission.id)}
                    campers={campers}
                    primaryCamperId={submission.camperId}
                    onAdd={onAddCollaborator}
                    onRemove={onRemoveCollaborator}
                  />
                )}
              </div>
              <div className="p-6 border-t border-slate-100 shrink-0 space-y-3">
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
                    onUpdate?.({
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
              </div>
            </form>
        </div>
      </div>
    )}
    </>
  );
};

export default SongDetail;
