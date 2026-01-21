import React, { useState } from 'react';
import { CamperProfile, ViewState } from '../types';

interface CampersPageProps {
  campers: CamperProfile[];
  onNavigate: (view: ViewState, id?: string) => void;
}

const CampersPage: React.FC<CampersPageProps> = ({ campers, onNavigate }) => {
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campers</h2>
          <p className="text-slate-500 text-sm">Meet the artists shaping this camp.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full p-1 w-fit">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
              viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
              viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-500'
            }`}
          >
            Cards
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Camper</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campers.map((camper) => (
                <tr
                  key={camper.id || camper.email}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onNavigate('camper-detail', camper.id || camper.email)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {camper.pictureOverrideUrl || camper.picture ? (
                        <img src={camper.pictureOverrideUrl || camper.picture} alt={camper.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {camper.name?.[0] || 'C'}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-800">{camper.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{camper.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{camper.location || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{camper.status || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {camper.lastSignedInAt ? new Date(camper.lastSignedInAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {campers.length === 0 && (
                <tr>
                  <td className="px-6 py-10 text-center text-slate-400" colSpan={4}>
                    No campers found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {campers.map((camper) => (
            <div
              key={camper.id || camper.email}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
              onClick={() => onNavigate('camper-detail', camper.id || camper.email)}
            >
              <div className="flex items-center gap-4 mb-4">
                {camper.pictureOverrideUrl || camper.picture ? (
                  <img src={camper.pictureOverrideUrl || camper.picture} alt={camper.name} className="w-14 h-14 rounded-2xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold">
                    {camper.name?.[0] || 'C'}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{camper.name || 'Unknown'}</h3>
                  <p className="text-xs text-slate-500">{camper.email}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Location</span>
                  <span className="text-slate-600">{camper.location || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Status</span>
                  <span className="text-slate-600">{camper.status || '—'}</span>
                </div>
              </div>
            </div>
          ))}
          {campers.length === 0 && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-400 col-span-full">
              No campers found yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CampersPage;
