
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Submission, Assignment, SongVersion } from '../types';
import * as googleService from '../services/googleService';
import ArtworkImage from '../components/ArtworkImage';

interface SubmissionsPageProps {
  submissions: Submission[];
  assignments: Assignment[];
  onAdd: (submission: Submission) => void;
  onViewDetail: (id: string) => void;
  userProfile?: { name?: string; email?: string } | null;
}

const SubmissionsPage: React.FC<SubmissionsPageProps> = ({ submissions, assignments, onAdd, onViewDetail, userProfile }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  
  const [form, setForm] = useState({
    title: '',
    assignmentId: '',
    lyrics: '',
    details: ''
  });

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
      setShowUpload(false);
      setForm({ title: '', assignmentId: '', lyrics: '', details: '' });
      setSelectedFile(null);
      setArtworkFile(null);
    } catch (e) {
      console.error(e);
      alert('Upload failed. Check console for details.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Song Vault</h2>
          <p className="text-slate-500 text-sm">Review, track versions, and refine your camp songs.</p>
        </div>
        <button 
          onClick={() => setShowUpload(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          <i className="fa-solid fa-cloud-arrow-up"></i>
          Submit New Song
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {submissions.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center col-span-full">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 text-3xl">
              <i className="fa-solid fa-music"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-xl">No songs found</h3>
            <p className="text-slate-500 mt-2 mb-6">You haven't uploaded any masterpieces yet. Start writing!</p>
            <button 
              onClick={() => setShowUpload(true)}
              className="text-indigo-600 font-bold hover:underline"
            >
              Upload your first draft
            </button>
          </div>
        ) : (
          submissions.map(sub => {
            const assignmentTitle = assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work';
            return (
            <div 
              key={sub.id} 
              onClick={() => onViewDetail(sub.id)}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
            >
              <div className="w-full aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                <ArtworkImage
                  fileId={sub.artworkFileId}
                  fallbackUrl={sub.artworkUrl}
                  alt={`${sub.title} artwork`}
                  className="w-full h-full object-contain bg-slate-100"
                  fallback={<i className="fa-solid fa-compact-disc text-4xl text-indigo-400"></i>}
                />
              </div>
              <div className="p-4">
                <h4 className="font-bold text-slate-800 text-lg leading-tight truncate">{sub.title}</h4>
                <p className="text-xs text-slate-500 mt-1">By {sub.camperName}</p>
                <div className="mt-4 text-xs text-slate-500 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Assignment</p>
                  <p className="font-semibold text-slate-700 truncate">{assignmentTitle}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-calendar"></i>
                    {new Date(sub.versions?.length ? sub.versions[0].timestamp : sub.updatedAt).toLocaleDateString()}
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 font-bold uppercase tracking-tighter">Synced</span>
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {showUpload && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-xl text-slate-800">Drive Submission</h3>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600">
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
                  <div className="col-span-2">
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
      )}
    </div>
  );
};

export default SubmissionsPage;
