import React from 'react';

const changelog: Array<{ hash: string; date: string; message: string }> = typeof __CHANGELOG__ !== 'undefined' ? __CHANGELOG__ : [];

const ChangelogPage: React.FC = () => {
  // Group entries by date
  const grouped = new Map<string, typeof changelog>();
  for (const entry of changelog) {
    const list = grouped.get(entry.date) || [];
    list.push(entry);
    grouped.set(entry.date, list);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800">What's New</h2>
        <p className="text-slate-500 text-sm mt-2">Recent updates to Camp.</p>
      </div>

      {changelog.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
          <p className="text-slate-400 text-sm">No changelog entries available.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-8">
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([date, entries]) => (
              <div key={date}>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{date}</h3>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.hash} className="flex items-start gap-3">
                      <span className="text-[10px] font-mono text-slate-300 mt-1 shrink-0">{entry.hash}</span>
                      <p className="text-sm text-slate-700">{entry.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangelogPage;
