
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Assignment, Submission, SongVersion, CamperProfile, CollaboratorRole } from '../types';
import * as googleService from '../services/googleService';

interface SubmitSongModalProps {
  assignments: Assignment[];
  defaultAssignmentId?: string;
  lockAssignment?: boolean;
  userProfile?: { name?: string; email?: string } | null;
  onAdd: (submission: Submission) => void;
  onClose: () => void;
  campers?: CamperProfile[];
  onAddCollaborators?: (submissionId: string, collaborators: Array<{ camperId: string; camperName: string; role: string }>) => void;
}

const SubmitSongModal: React.FC<SubmitSongModalProps> = ({ assignments, defaultAssignmentId, lockAssignment, userProfile, onAdd, onClose, campers = [], onAddCollaborators }) => {
  const [form, setForm] = useState({
    title: '',
    assignmentId: defaultAssignmentId || '',
    lyrics: '',
    details: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [driveAudioFile, setDriveAudioFile] = useState<{ id: string; name: string; url: string } | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [driveArtworkFile, setDriveArtworkFile] = useState<{ id: string; name: string; url: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<Array<{ camperId: string; camperName: string; role: CollaboratorRole }>>([]);
  const [collabCamperId, setCollabCamperId] = useState('');
  const [collabRole, setCollabRole] = useState<CollaboratorRole>('collaborator');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setDriveAudioFile(null);
    }
  };

  const handlePickAudioFromDrive = async () => {
    const files = await googleService.openDrivePicker({
      mimeTypes: 'audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/flac',
      multiSelect: false,
      title: 'Select your audio file',
    });
    if (files.length > 0) {
      setDriveAudioFile({ id: files[0].id, name: files[0].name, url: files[0].url });
      setSelectedFile(null);
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
      setDriveArtworkFile(null);
    }
  };

  const handlePickArtworkFromDrive = async () => {
    const files = await googleService.openDrivePicker({
      mimeTypes: 'image/jpeg,image/png,image/gif,image/webp',
      multiSelect: false,
      title: 'Select artwork image',
    });
    if (files.length > 0) {
      setDriveArtworkFile({ id: files[0].id, name: files[0].name, url: files[0].url });
      setArtworkFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !driveAudioFile) return alert('Please select an audio file');

    setIsUploading(true);
    try {
      const assignmentFolderId = assignments.find(a => a.id === form.assignmentId)?.driveFolderId;

      // Audio: use Drive-picked file directly, or upload local file
      const audioResult = driveAudioFile
        ? { id: driveAudioFile.id, webViewLink: driveAudioFile.url }
        : await googleService.uploadAudioToDriveInFolder(selectedFile!, assignmentFolderId);

      // Share Drive-picked audio so all campers can play it
      if (driveAudioFile) googleService.shareFilePublicly(audioResult.id).catch(() => {});

      const audioFileName = driveAudioFile ? driveAudioFile.name : selectedFile!.name;

      const userLabel = userProfile?.email || userProfile?.name || 'Anonymous';
      const lyricsDoc = await googleService.createLyricsDoc(form.title, userLabel, form.lyrics, assignmentFolderId);

      // Artwork: use Drive-picked file, upload local file, or skip
      let artworkResult: { id: string; webViewLink: string } | null = null;
      if (driveArtworkFile) {
        artworkResult = { id: driveArtworkFile.id, webViewLink: driveArtworkFile.url };
        googleService.shareFilePublicly(artworkResult.id).catch(() => {});
      } else if (artworkFile) {
        artworkResult = await googleService.uploadArtworkToDriveInFolder(artworkFile, assignmentFolderId);
      }

      const newVersion: SongVersion = {
        id: audioResult.id,
        timestamp: new Date().toISOString(),
        audioUrl: audioResult.webViewLink,
        fileName: audioFileName,
        notes: driveAudioFile ? 'Linked from Google Drive' : 'Initial upload to Drive'
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
        artworkFileId: artworkResult?.id || '',
        artworkUrl: artworkResult?.webViewLink || ''
      };

      onAdd(submission);
      if (selectedCollaborators.length > 0 && onAddCollaborators) {
        onAddCollaborators(submission.id, selectedCollaborators);
      }
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto overflow-x-hidden flex-1 p-6 space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Song Title</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                />
              </div>
              {!lockAssignment && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignment</label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Audio File (.mp3/.wav/.m4a)</label>
                {driveAudioFile ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-xl">
                    <i className="fa-brands fa-google-drive text-green-600"></i>
                    <span className="text-sm text-green-700 font-medium truncate flex-1">{driveAudioFile.name}</span>
                    <button type="button" onClick={() => setDriveAudioFile(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a"
                    className="w-full text-base text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={handleFileChange}
                  />
                )}
                <button
                  type="button"
                  onClick={handlePickAudioFromDrive}
                  className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  <i className="fa-brands fa-google-drive text-[10px]"></i>
                  Choose from Google Drive
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Artwork (optional)</label>
                {driveArtworkFile ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-xl">
                    <i className="fa-brands fa-google-drive text-green-600"></i>
                    <span className="text-sm text-green-700 font-medium truncate flex-1">{driveArtworkFile.name}</span>
                    <button type="button" onClick={() => setDriveArtworkFile(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-base text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
                    onChange={handleArtworkChange}
                  />
                )}
                <button
                  type="button"
                  onClick={handlePickArtworkFromDrive}
                  className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  <i className="fa-brands fa-google-drive text-[10px]"></i>
                  Choose from Google Drive
                </button>
                <p className="text-[10px] text-slate-400 mt-1">Max size 5MB. JPG, PNG, or GIF.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lyrics</label>
              <textarea
                required
                placeholder="Verse 1: ..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-64 font-serif text-base"
                value={form.lyrics}
                onChange={e => setForm({...form, lyrics: e.target.value})}
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Production Notes</label>
              <textarea
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 h-24 text-base"
                value={form.details}
                onChange={e => setForm({...form, details: e.target.value})}
              ></textarea>
            </div>

            {campers.length > 0 && onAddCollaborators && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Collaborators (optional)</label>
                {selectedCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedCollaborators.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium">
                        {c.camperName}
                        <span className="text-[10px] opacity-60 uppercase">{c.role}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCollaborators(prev => prev.filter((_, j) => j !== i))}
                          className="text-indigo-400 hover:text-indigo-700 ml-0.5"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <select
                      value={collabCamperId}
                      onChange={(e) => setCollabCamperId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select camper...</option>
                      {campers
                        .filter(c => {
                          const id = c.email || c.id;
                          const isCurrentUser = id === userProfile?.email;
                          const alreadyAdded = selectedCollaborators.some(sc => sc.camperId === id);
                          return !isCurrentUser && !alreadyAdded;
                        })
                        .map(c => (
                          <option key={c.id} value={c.email || c.id}>{c.name}</option>
                        ))
                      }
                    </select>
                  </div>
                  <select
                    value={collabRole}
                    onChange={(e) => setCollabRole(e.target.value as CollaboratorRole)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="collaborator">Collaborator</option>
                    <option value="featured">Featured</option>
                    <option value="producer">Producer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const camper = campers.find(c => c.email === collabCamperId || c.id === collabCamperId);
                      if (!camper) return;
                      setSelectedCollaborators(prev => [...prev, { camperId: camper.email || camper.id, camperName: camper.name, role: collabRole }]);
                      setCollabCamperId('');
                      setCollabRole('collaborator');
                    }}
                    disabled={!collabCamperId}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 shrink-0">
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
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default SubmitSongModal;
