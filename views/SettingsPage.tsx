import React, { useEffect, useState } from 'react';
import * as googleService from '../services/googleService';
import { Submission, Comment as CommentType, Boca, CamperProfile } from '../types';
import { DateFormat, formatDate } from '../utils';
import ArtworkImage from '../components/ArtworkImage';


const ADMIN_USER_ID = '107401200819936745460';

interface SettingsPageProps {
  themePreference: 'light' | 'dark' | 'system';
  onThemeChange: (value: 'light' | 'dark' | 'system') => void;
  dateFormat: DateFormat;
  onDateFormatChange: (value: DateFormat) => void;
  userProfile?: { id?: string; name?: string; email?: string; picture?: string; location?: string; status?: string; pictureOverrideUrl?: string; intakeSemester?: string } | null;
  onProfileUpdate: (updates: { location?: string; status?: string; pictureOverrideUrl?: string; intakeSemester?: string }) => void;
  rememberMe: boolean;
  onRememberMeChange: (value: boolean) => void;
  submissions?: Submission[];
  allSemesters?: string[];
  spreadsheetId?: string;
  comments?: CommentType[];
  bocas?: Boca[];
  campers?: CamperProfile[];
}

const SettingsPage: React.FC<SettingsPageProps> = ({ themePreference, onThemeChange, dateFormat, onDateFormatChange, userProfile, onProfileUpdate, rememberMe, onRememberMeChange, submissions = [], allSemesters = [], spreadsheetId, comments = [], bocas = [], campers = [] }) => {
  const [location, setLocation] = useState(userProfile?.location || '');
  const [status, setStatus] = useState(userProfile?.status || '');
  const [intakeSemester, setIntakeSemester] = useState(userProfile?.intakeSemester || '');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [driveProfilePhoto, setDriveProfilePhoto] = useState<{ id: string; name: string; url: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shareProgress, setShareProgress] = useState<string | null>(null);
  const isAdmin = userProfile?.id === ADMIN_USER_ID;

  useEffect(() => {
    setLocation(userProfile?.location || '');
    setStatus(userProfile?.status || '');
    setIntakeSemester(userProfile?.intakeSemester || '');
  }, [userProfile?.location, userProfile?.status, userProfile?.intakeSemester]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let pictureOverrideUrl = userProfile?.pictureOverrideUrl || '';
      if (driveProfilePhoto) {
        pictureOverrideUrl = driveProfilePhoto.url;
        googleService.shareFilePublicly(driveProfilePhoto.id).catch(() => {});
      } else if (profileFile) {
        const uploaded = await googleService.uploadProfilePhoto(profileFile);
        pictureOverrideUrl = uploaded.webViewLink;
      }
      await Promise.resolve(onProfileUpdate({
        location: location.trim(),
        status: status.trim(),
        pictureOverrideUrl: pictureOverrideUrl || undefined,
        intakeSemester: intakeSemester || undefined
      }));
      setProfileFile(null);
      setDriveProfilePhoto(null);
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
      setDriveProfilePhoto(null);
    }
  };

  const handlePickPhotoFromDrive = async () => {
    const files = await googleService.openDrivePicker({
      mimeTypes: 'image/jpeg,image/png,image/gif,image/webp',
      multiSelect: false,
      title: 'Select a profile photo',
    });
    if (files.length > 0) {
      setDriveProfilePhoto({ id: files[0].id, name: files[0].name, url: files[0].url });
      setProfileFile(null);
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
                <ArtworkImage
                  fileId={undefined}
                  fallbackUrl={userProfile?.pictureOverrideUrl || userProfile?.picture}
                  alt={userProfile?.name || 'Profile'}
                  className="w-full h-full object-cover"
                  fallback={<i className="fa-solid fa-user"></i>}
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
            {driveProfilePhoto ? (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-xl">
                <i className="fa-brands fa-google-drive text-green-600"></i>
                <span className="text-sm text-green-700 font-medium truncate flex-1">{driveProfilePhoto.name}</span>
                <button type="button" onClick={() => setDriveProfilePhoto(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                className="w-full text-base text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-600 hover:file:bg-slate-200"
                onChange={handlePhotoChange}
              />
            )}
            <button
              type="button"
              onClick={handlePickPhotoFromDrive}
              className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <i className="fa-brands fa-google-drive text-[10px]"></i>
              Choose from Google Drive
            </button>
            <p className="text-[10px] text-slate-400 mt-1">Overrides your Google profile photo. Max size 5MB.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Status</label>
              <textarea
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500 resize-none"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="Writing, recording, experimenting..."
                rows={2}
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Intake Semester</label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-base focus:ring-2 focus:ring-indigo-500"
                  value={intakeSemester}
                  onChange={(e) => setIntakeSemester(e.target.value)}
                >
                  <option value="">Not set</option>
                  {allSemesters.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
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
        <h3 className="text-lg font-bold text-slate-800">Login</h3>
        <p className="text-slate-500 text-sm mt-1">Control how this device remembers your session.</p>
        <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">Remember this device</p>
            <p className="text-xs text-slate-500">Attempts a silent sign-in on reload and uses your last email as a hint.</p>
          </div>
          <button
            type="button"
            onClick={() => onRememberMeChange(!rememberMe)}
            className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors flex-shrink-0 ${
              rememberMe ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
            aria-pressed={rememberMe}
          >
            <span
              className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform ${
                rememberMe ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
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
        <div className="mt-8">
          <h4 className="text-sm font-bold text-slate-800 mb-1">Date Format</h4>
          <p className="text-slate-500 text-xs mb-4">Choose how dates are displayed throughout the app.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {([
              { value: 'system' as DateFormat, label: 'System Default', example: formatDate(new Date(), 'system') },
              { value: 'yyyy-mm-dd' as DateFormat, label: 'ISO', example: formatDate(new Date(), 'yyyy-mm-dd') },
              { value: 'mm/dd/yyyy' as DateFormat, label: 'US', example: formatDate(new Date(), 'mm/dd/yyyy') },
              { value: 'dd/mm/yyyy' as DateFormat, label: 'International', example: formatDate(new Date(), 'dd/mm/yyyy') },
              { value: 'short' as DateFormat, label: 'Readable', example: formatDate(new Date(), 'short') },
            ]).map((opt) => (
              <label
                key={opt.value}
                className={`border rounded-2xl p-4 cursor-pointer transition-all ${
                  dateFormat === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{opt.label}</span>
                  <input
                    type="radio"
                    name="dateFormat"
                    value={opt.value}
                    checked={dateFormat === opt.value}
                    onChange={() => onDateFormatChange(opt.value)}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 font-mono">{opt.example}</p>
              </label>
            ))}
          </div>
        </div>
      </section>

      {isAdmin && submissions.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-3xl p-8">
          <h3 className="text-lg font-bold text-slate-800">Admin Tools</h3>
          <p className="text-slate-500 text-sm mt-1">One-time maintenance actions.</p>
          <div className="mt-6">
            <button
              type="button"
              disabled={!!shareProgress}
              onClick={async () => {
                const fileIds = new Set<string>();
                for (const sub of submissions) {
                  for (const v of sub.versions || []) {
                    if (v.id) fileIds.add(v.id);
                  }
                  if (sub.artworkFileId) fileIds.add(sub.artworkFileId);
                }
                const ids = Array.from(fileIds);
                setShareProgress(`Sharing 0/${ids.length} files...`);
                let done = 0;
                let failed = 0;
                for (const id of ids) {
                  try {
                    await googleService.shareFilePublicly(id);
                  } catch {
                    failed++;
                  }
                  done++;
                  setShareProgress(`Sharing ${done}/${ids.length} files...${failed ? ` (${failed} failed)` : ''}`);
                }
                setShareProgress(`Done! ${done - failed}/${ids.length} shared.${failed ? ` ${failed} failed.` : ''}`);
                setTimeout(() => setShareProgress(null), 5000);
              }}
              className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {shareProgress ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  {shareProgress}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-share-nodes"></i>
                  Share All Songs Publicly
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-400 mt-2">Sets "anyone with the link can view" on every audio file and artwork. Run this once to fix songs uploaded before public sharing was enabled.</p>
          </div>
          {spreadsheetId && (
            <div className="mt-4">
              <button
                type="button"
                disabled={!!shareProgress}
                onClick={async () => {
                  setShareProgress('Backfilling notifications...');
                  try {
                    const count = await googleService.backfillNotifications(spreadsheetId, {
                      comments, bocas, submissions, campers
                    });
                    setShareProgress(`Done! Created ${count} notifications (marked as read).`);
                  } catch (err) {
                    console.error('Backfill failed', err);
                    setShareProgress('Failed to backfill notifications.');
                  }
                  setTimeout(() => setShareProgress(null), 5000);
                }}
                className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {shareProgress ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    {shareProgress}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bell"></i>
                    Backfill Notifications from History
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-400 mt-2">Creates notification entries from existing comments, replies, reactions, and BOCAs. All are marked as read. Safe to run multiple times (will create duplicates if run again).</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default SettingsPage;
