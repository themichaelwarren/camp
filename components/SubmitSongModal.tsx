
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Submission, SongVersion } from '../types';
import * as googleService from '../services/googleService';

interface SubmitSongModalProps {
  assignments: Assignment[];
  defaultAssignmentId?: string;
  lockAssignment?: boolean;
  userProfile?: { name?: string; email?: string } | null;
  onAdd: (submission: Submission) => void;
  onClose: () => void;
}

const SubmitSongModal: React.FC<SubmitSongModalProps> = ({ assignments, defaultAssignmentId, lockAssignment, userProfile, onAdd, onClose }) => {
  const [form, setForm] = useState({
    title: '',
    assignmentId: defaultAssignmentId || '',
    lyrics: '',
    details: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleArtworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('Artwork image must be 5MB or smaller.');
        return;
      }
      setArtworkFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return alert('Please select an audio file');

    setIsUploading(true);
    try {
      const assignmentFolderId = assignments.find(a => a.id === form.assignmentId)?.driveFolderId;
      const driveFile = await googleService.uploadAudioToDriveInFolder(selectedFile, assignmentFolderId);
      const userLabel = userProfile?.email || userProfile?.name || 'Anonymous';
      const lyricsDoc = await googleService.createLyricsDoc(form.title, userLabel, form.lyrics, assignmentFolderId);
      const artworkUpload = artworkFile
        ? await googleService.uploadArtworkToDriveInFolder(artworkFile, assignmentFolderId)
        : null;

      const newVersion: SongVersion = {
        id: driveFile.id,
        timestamp: new Date().toISOString(),
        audioUrl: driveFile.webViewLink,
        fileName: selectedFile.name,
        notes: 'Initial upload to Drive'
      };

      const submission: Submission = {
        id: Math.random().toString(36).substr(2, 9),
        assignmentId: form.assignmentId,
        camperId: userProfile?.email || userProfile?.name || 'anonymous',
        camperName: userProfile?.email || userProfile?.name || 'Anonymous',
        title: form.title,
        lyrics: form.lyrics,
        versions: [newVersion],
        details: form.details,
        updatedAt: new Date().toISOString(),
        lyricsDocUrl: lyricsDoc.webViewLink,
        lyricsRevisionCount: 1,
        artworkFileId: artworkUpload?.id || '',
        artworkUrl: artworkUpload?.webViewLink || ''
      };

      onAdd(submission);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Upload failed. Check console for details.');
    } finally {
      setIsUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-8">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-xl text-slate-800">Drive Submission</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Song Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                />
              </div>
              {!lockAssignment && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignment</label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    value={form.assignmentId}
                    onChange={e => setForm({...form, assignmentId: e.target.value})}
                  >
                    <option value="">Select project...</option>
                    {assignments.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Upload to Drive (.mp3/.wav)</label>
                <input
                  required
                  type="file"
                  accept=".mp3,.wav,.m4a"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={handleFileChange}
                />
              </div>
              <div className={lockAssignment ? '' : 'col-span-2'}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Artwork (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
                  onChange={handleArtworkChange}
                />
                <p className="text-[10px] text-slate-400 mt-2">Max size 5MB. JPG, PNG, or GIF.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lyrics</label>
              <textarea
                required
                placeholder="Verse 1: ..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-64 font-serif text-sm"
                value={form.lyrics}
                onChange={e => setForm({...form, lyrics: e.target.value})}
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Production Notes</label>
              <textarea
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-24 text-sm"
                value={form.details}
                onChange={e => setForm({...form, details: e.target.value})}
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
            >
              {isUploading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Uploading to Cloud...
                </>
              ) : (
                <>
                  <i className="fa-brands fa-google-drive"></i>
                  Sync to Song Vault
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SubmitSongModal;
