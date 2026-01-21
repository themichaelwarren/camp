import React, { useEffect, useState } from 'react';
import * as googleService from '../services/googleService';

interface SettingsPageProps {
  themePreference: 'light' | 'dark' | 'system';
  onThemeChange: (value: 'light' | 'dark' | 'system') => void;
  userProfile?: { name?: string; email?: string; picture?: string; location?: string; status?: string; pictureOverrideUrl?: string } | null;
  onProfileUpdate: (updates: { location?: string; status?: string; pictureOverrideUrl?: string }) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ themePreference, onThemeChange, userProfile, onProfileUpdate }) => {
  const [location, setLocation] = useState(userProfile?.location || '');
  const [status, setStatus] = useState(userProfile?.status || '');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLocation(userProfile?.location || '');
    setStatus(userProfile?.status || '');
  }, [userProfile?.location, userProfile?.status]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let pictureOverrideUrl = userProfile?.pictureOverrideUrl || '';
      if (profileFile) {
        const uploaded = await googleService.uploadProfilePhoto(profileFile);
        pictureOverrideUrl = uploaded.webViewLink;
      }
      await Promise.resolve(onProfileUpdate({
        location: location.trim(),
        status: status.trim(),
        pictureOverrideUrl: pictureOverrideUrl || undefined
      }));
      setProfileFile(null);
      setToast('Profile updated.');
      window.setTimeout(() => setToast(null), 2500);
    } catch (error) {
      console.error('Failed to upload profile photo', error);
      alert('Profile photo upload failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('Profile photo must be 5MB or smaller.');
        return;
      }
      setProfileFile(file);
    }
  };
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold">
          {toast}
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
        <p className="text-slate-500 text-sm mt-2">Personalize your camp workspace.</p>
      </div>

      <section className="bg-white border border-slate-200 rounded-3xl p-8">
        <h3 className="text-lg font-bold text-slate-800">Profile</h3>
        <p className="text-slate-500 text-sm mt-1">Update your public profile details.</p>
        <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden border border-indigo-100">
              {userProfile?.pictureOverrideUrl || userProfile?.picture ? (
                <img
                  src={userProfile?.pictureOverrideUrl || userProfile?.picture}
                  alt={userProfile?.name || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <i className="fa-solid fa-user"></i>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{userProfile?.name || 'Unknown Camper'}</p>
              <p className="text-xs text-slate-500">{userProfile?.email || 'No email on file'}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profile Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
              onChange={handlePhotoChange}
            />
            <p className="text-[10px] text-slate-400 mt-2">Overrides your Google profile photo. Max size 5MB.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Status</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="Writing, recording, experimenting..."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Saving Profile...
              </>
            ) : (
              <>
                <i className="fa-solid fa-check"></i>
                Save Profile
              </>
            )}
          </button>
        </form>
      </section>

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
