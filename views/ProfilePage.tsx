import React from 'react';

interface ProfilePageProps {
  userProfile: { name?: string; email?: string; picture?: string } | null;
  spreadsheetId: string | null;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ userProfile, spreadsheetId }) => {
  const sheetUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-100/70">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
            {userProfile?.picture ? (
              <img src={userProfile.picture} alt={userProfile.name || 'User avatar'} className="w-full h-full object-cover" />
            ) : (
              <i className="fa-solid fa-user text-3xl text-slate-400"></i>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-black text-slate-900">Your Profile</h3>
            <p className="text-slate-500 mt-1">Account details and connected data sources.</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 w-24 uppercase text-[10px] font-bold tracking-widest">Name</span>
                <span className="font-semibold text-slate-800">{userProfile?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 w-24 uppercase text-[10px] font-bold tracking-widest">Email</span>
                <span className="font-semibold text-slate-800">{userProfile?.email || 'Unknown'}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Status: Connected
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8">
        <h4 className="text-lg font-bold text-slate-900">Camp Backend Sheet</h4>
        <p className="text-slate-500 text-sm mt-2">
          All prompts, assignments, and submissions are saved to the shared spreadsheet below.
        </p>
        <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Spreadsheet ID</p>
            <p className="text-sm font-mono text-slate-700 break-all mt-1">{spreadsheetId || 'Not connected'}</p>
          </div>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
            >
              Open Sheet
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
