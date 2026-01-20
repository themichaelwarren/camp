
import React, { useState } from 'react';
import { Submission, Assignment, SongVersion } from '../types';
import * as googleService from '../services/googleService';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return alert('Please select an audio file');
    
    setIsUploading(true);
    try {
      const assignmentFolderId = assignments.find(a => a.id === form.assignmentId)?.driveFolderId;
      const driveFile = await googleService.uploadAudioToDriveInFolder(selectedFile, assignmentFolderId);
      const userLabel = userProfile?.email || userProfile?.name || 'Anonymous';
      const lyricsDoc = await googleService.createLyricsDoc(form.title, userLabel, form.lyrics, assignmentFolderId);
      
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
        lyricsDocUrl: lyricsDoc.webViewLink
      };

      onAdd(submission);
      setShowUpload(false);
      setForm({ title: '', assignmentId: '', lyrics: '', details: '' });
      setSelectedFile(null);
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

      <div className="grid grid-cols-1 gap-6">
        {submissions.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
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
          submissions.map(sub => (
            <div 
              key={sub.id} 
              onClick={() => onViewDetail(sub.id)}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
            >
              <div className="md:w-64 bg-slate-50 p-6 border-r border-slate-200 shrink-0">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 text-xl mb-4 group-hover:scale-110 transition-transform">
                  <i className="fa-solid fa-compact-disc"></i>
                </div>
                <h4 className="font-bold text-slate-800 truncate mb-1 group-hover:text-indigo-600 transition-colors">{sub.title}</h4>
                <p className="text-xs text-slate-500 mb-4">By {sub.camperName}</p>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Latest Version</p>
                  <div className="flex items-center gap-2 text-xs bg-white p-2 rounded-lg border border-slate-100 truncate text-slate-600">
                    <i className="fa-solid fa-file-audio text-indigo-400"></i>
                    {sub.versions[0]?.fileName || 'Untitled.mp3'}
                  </div>
                </div>
              </div>
              <div className="flex-1 p-6 flex flex-col min-w-0">
                <div className="flex justify-between items-start mb-4">
                  <div>
                     <p className="text-[10px] font-bold text-indigo-500 uppercase">Assignment</p>
                     <p className="text-sm font-semibold text-slate-700 truncate max-w-xs">
                       {assignments.find(a => a.id === sub.assignmentId)?.title || 'Independent Work'}
                     </p>
                  </div>
                  <div className="flex gap-2">
                     <button className="text-xs font-bold text-slate-400 hover:text-indigo-600 px-3 py-1 rounded-lg border border-slate-100">
                        Details <i className="fa-solid fa-arrow-right ml-1"></i>
                     </button>
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-4 font-serif text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-hidden mb-4 border border-slate-100 italic opacity-80">
                  {sub.lyrics}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-auto">
                   <span className="flex items-center gap-1"><i className="fa-solid fa-code-merge"></i> v{sub.versions.length}</span>
                   <span className="flex items-center gap-1"><i className="fa-solid fa-calendar"></i> Updated {new Date(sub.updatedAt).toLocaleDateString()}</span>
                   <span className="ml-auto text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 font-bold uppercase tracking-tighter">Synced to Drive</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
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
        </div>
      )}
    </div>
  );
};

export default SubmissionsPage;
