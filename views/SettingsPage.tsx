import React from 'react';

interface SettingsPageProps {
  themePreference: 'light' | 'dark' | 'system';
  onThemeChange: (value: 'light' | 'dark' | 'system') => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ themePreference, onThemeChange }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <p className="text-slate-500 text-sm mt-2">Personalize your camp workspace.</p>
      </div>

      <section className="bg-white border border-slate-200 rounded-3xl p-8">
        <h3 className="text-lg font-bold text-slate-800">Appearance</h3>
        <p className="text-slate-500 text-sm mt-1">Choose how Koi Camp looks on this device.</p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <label
              key={mode}
              className={`border rounded-2xl p-4 cursor-pointer transition-all ${
                themePreference === mode ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 capitalize">{mode}</span>
                <input
                  type="radio"
                  name="theme"
                  value={mode}
                  checked={themePreference === mode}
                  onChange={() => onThemeChange(mode)}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {mode === 'light' && 'Always use the light theme.'}
                {mode === 'dark' && 'Always use the dark theme.'}
                {mode === 'system' && 'Match your system appearance.'}
              </p>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
