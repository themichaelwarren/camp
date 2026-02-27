
import React from 'react';
import { Assignment, Submission, Prompt } from '../types';
import { getTerm, getSeasonStyle } from '../utils';

interface SemestersPageProps {
  semesters: string[];
  assignments: Assignment[];
  submissions: Submission[];
  prompts: Prompt[];
  onViewDetail: (semester: string) => void;
  viewMode: 'cards' | 'list';
  onViewModeChange: (value: 'cards' | 'list') => void;
}

const SemestersPage: React.FC<SemestersPageProps> = ({ semesters, assignments, submissions, prompts, onViewDetail, viewMode, onViewModeChange }) => {
  const currentSemester = getTerm(new Date().toISOString());

  const getSubmissionDate = (sub: Submission): string => {
    return sub.versions?.length ? sub.versions[0].timestamp : sub.updatedAt;
  };

  const getStats = (semester: string) => {
    const semAssignments = assignments.filter(a => getTerm(a.dueDate) === semester);
    const semSubmissions = submissions.filter(s => getTerm(getSubmissionDate(s)) === semester);
    const promptIds = new Set<string>();
    semAssignments.forEach(a => {
      if (a.promptIds) a.promptIds.forEach(id => promptIds.add(id));
      if (a.promptId) promptIds.add(a.promptId);
    });
    const camperIds = new Set<string>(semSubmissions.map(s => s.camperId || s.camperName));
    return {
      assignments: semAssignments.length,
      songs: semSubmissions.length,
      prompts: promptIds.size,
      campers: camperIds.size,
    };
  };

  const renderCard = (semester: string) => {
    const stats = getStats(semester);
    const isCurrent = semester === currentSemester;
    const style = getSeasonStyle(semester);
    return (
      <button
        key={semester}
        onClick={() => onViewDetail(semester)}
        className="text-left bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl ${style.bg} ${style.text} flex items-center justify-center`}>
            <i className={`fa-solid ${style.icon} text-sm`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{semester}</h3>
          </div>
          {isCurrent && (
            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Current</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">{stats.campers}</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Campers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">{stats.assignments}</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Assignments</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">{stats.songs}</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Songs</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900">{stats.prompts}</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Prompts</p>
          </div>
        </div>
      </button>
    );
  };

  const renderRow = (semester: string) => {
    const stats = getStats(semester);
    const isCurrent = semester === currentSemester;
    const style = getSeasonStyle(semester);
    return (
      <tr
        key={semester}
        onClick={() => onViewDetail(semester)}
        className="hover:bg-slate-50 cursor-pointer transition-colors group"
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0`}>
              <i className={`fa-solid ${style.icon} text-xs`}></i>
            </div>
            <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{semester}</span>
            {isCurrent && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Current</span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-slate-600">{stats.campers}</td>
        <td className="px-6 py-4 text-sm text-slate-600">{stats.assignments}</td>
        <td className="px-6 py-4 text-sm text-slate-600">{stats.songs}</td>
        <td className="px-6 py-4 text-sm text-slate-600">{stats.prompts}</td>
      </tr>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Semesters</h1>
          <p className="text-sm text-slate-500 mt-1">{semesters.length} semester{semesters.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 w-fit mb-4">
        <button
          onClick={() => onViewModeChange('cards')}
          className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
            viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cards
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
            viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          List
        </button>
      </div>

      {semesters.length > 0 ? (
        viewMode === 'list' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Semester</th>
                  <th className="px-6 py-4">Campers</th>
                  <th className="px-6 py-4">Assignments</th>
                  <th className="px-6 py-4">Songs</th>
                  <th className="px-6 py-4">Prompts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {semesters.map(semester => renderRow(semester))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {semesters.map(semester => renderCard(semester))}
          </div>
        )
      ) : (
        <div className="text-center py-16 text-slate-400">
          <i className="fa-solid fa-graduation-cap text-4xl mb-4 block"></i>
          <p className="font-semibold">No semesters yet</p>
          <p className="text-sm mt-1">Semesters will appear once assignments or songs are added.</p>
        </div>
      )}
    </div>
  );
};

export default SemestersPage;
