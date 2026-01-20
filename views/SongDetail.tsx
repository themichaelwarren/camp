
import React, { useEffect, useState } from 'react';
import { Submission, Assignment, Prompt, ViewState } from '../types';
import * as googleService from '../services/googleService';

interface SongDetailProps {
  submission: Submission;
  assignment?: Assignment;
  prompt?: Prompt;
  onNavigate: (view: ViewState, id?: string) => void;
}

const SongDetail: React.FC<SongDetailProps> = ({ submission, assignment, prompt, onNavigate }) => {
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

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
  return (
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
          </div>
        </div>
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
  );
};

export default SongDetail;
