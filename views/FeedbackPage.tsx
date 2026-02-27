
import React, { useState, useEffect, useMemo } from 'react';
import { GitHubIssue, ViewState } from '../types';

type LabelFilter = 'all' | 'bug' | 'enhancement';
type StateFilter = 'open' | 'closed' | 'all';
type SortOption = 'newest' | 'most-upvoted';

interface FeedbackPageProps {
  userProfile?: { name?: string; email?: string } | null;
  upvotedIssueNumbers: number[];
  upvoteCounts: Record<number, number>;
  onUpvote: (issueNumber: number) => void;
  onSubmit: (data: { type: 'bug' | 'feature'; title: string; body: string }) => Promise<void>;
  onLoadUpvoteCounts: () => void;
  onNavigate: (view: ViewState) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const FeedbackPage: React.FC<FeedbackPageProps> = ({ userProfile, upvotedIssueNumbers, upvoteCounts, onUpvote, onSubmit, onLoadUpvoteCounts, onNavigate }) => {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(true);
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showForm, setShowForm] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    onLoadUpvoteCounts();
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setIsLoadingIssues(true);
    try {
      const baseUrl = window.location.hostname === 'localhost' ? 'https://camp.themichaelwarren.com' : '';
      const resp = await fetch(`${baseUrl}/api/github/issues`);
      const data = await resp.json();
      const all = (Array.isArray(data) ? data : [])
        .map((i: any): GitHubIssue => ({
          number: i.number,
          title: i.title,
          body: i.body || '',
          state: i.state,
          labels: (i.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
          created_at: i.created_at,
          updated_at: i.updated_at,
          html_url: i.html_url,
          user: { login: i.user?.login || '', avatar_url: i.user?.avatar_url || '' },
          comments: i.comments || 0,
        }));
      setIssues(all);
    } catch (err) {
      console.error('Failed to fetch GitHub issues', err);
    } finally {
      setIsLoadingIssues(false);
    }
  };

  const handleSubmit = async () => {
    if (!feedbackTitle.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ type: feedbackType, title: feedbackTitle.trim(), body: feedbackBody.trim() });
      setFeedbackTitle('');
      setFeedbackBody('');
      setShowForm(false);
      await fetchIssues();
    } catch (err) {
      console.error('Failed to submit feedback', err);
      alert('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCount = issues.filter(i => i.state === 'open').length;
  const closedCount = issues.filter(i => i.state === 'closed').length;

  const filtered = useMemo(() => {
    let list = issues;

    if (stateFilter !== 'all') {
      list = list.filter(i => i.state === stateFilter);
    }

    if (labelFilter === 'bug') {
      list = list.filter(i => i.labels.some(l => l.name === 'bug'));
    } else if (labelFilter === 'enhancement') {
      list = list.filter(i => i.labels.some(l => l.name === 'enhancement'));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q));
    }

    if (sortBy === 'most-upvoted') {
      list = [...list].sort((a, b) => (upvoteCounts[b.number] || 0) - (upvoteCounts[a.number] || 0));
    } else {
      list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return list;
  }, [issues, stateFilter, labelFilter, search, sortBy, upvoteCounts]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Feedback & Requests</h2>
          <p className="text-sm text-slate-500 mt-1">Report bugs, request features, and upvote what matters to you.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {openCount} Open
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500">
            {closedCount} Closed
          </span>
        </div>
      </div>

      {/* Submit button / form */}
      {userProfile && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <span className="font-semibold text-sm text-slate-700 flex items-center gap-2">
              <i className="fa-solid fa-plus text-indigo-500"></i>
              Submit Feedback
            </span>
            <i className={`fa-solid fa-chevron-${showForm ? 'up' : 'down'} text-slate-400 text-xs`}></i>
          </button>

          {showForm && (
            <div className="px-6 pb-6 space-y-4 border-t border-slate-100">
              <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 w-fit mt-4">
                <button
                  onClick={() => setFeedbackType('bug')}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                    feedbackType === 'bug' ? 'bg-rose-500 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <i className="fa-solid fa-bug text-[9px]"></i>
                  Bug Report
                </button>
                <button
                  onClick={() => setFeedbackType('feature')}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                    feedbackType === 'feature' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <i className="fa-solid fa-lightbulb text-[9px]"></i>
                  Feature Request
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  {feedbackType === 'bug' ? 'What went wrong?' : 'What would you like to see?'}
                </label>
                <input
                  type="text"
                  value={feedbackTitle}
                  onChange={e => setFeedbackTitle(e.target.value)}
                  placeholder={feedbackType === 'bug' ? 'e.g. Player stops when switching pages' : 'e.g. Dark mode for the audio player'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Details <span className="text-slate-300 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={feedbackBody}
                  onChange={e => setFeedbackBody(e.target.value)}
                  placeholder={feedbackType === 'bug' ? 'Steps to reproduce, what you expected, what happened instead...' : 'Describe your idea in more detail...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleSubmit}
                  disabled={!feedbackTitle.trim() || isSubmitting}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    feedbackType === 'bug'
                      ? 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400'
                  }`}
                >
                  {isSubmitting ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> Submitting...</>
                  ) : (
                    <>{feedbackType === 'bug' ? 'Report Bug' : 'Request Feature'}</>
                  )}
                </button>
                <p className="text-[10px] text-slate-400">
                  Submitting as <strong>{userProfile.name}</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:w-auto">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
            {([
              { value: 'all' as LabelFilter, label: 'All' },
              { value: 'bug' as LabelFilter, label: 'Bugs', icon: 'fa-bug' },
              { value: 'enhancement' as LabelFilter, label: 'Features', icon: 'fa-lightbulb' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setLabelFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 ${
                  labelFilter === opt.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.icon && <i className={`fa-solid ${opt.icon} text-[9px]`}></i>}
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
            {([
              { value: 'open' as StateFilter, label: 'Open' },
              { value: 'closed' as StateFilter, label: 'Closed' },
              { value: 'all' as StateFilter, label: 'All' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setStateFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  stateFilter === opt.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 border-0 rounded-full px-3 py-2 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest</option>
            <option value="most-upvoted">Most Upvoted</option>
          </select>
        </div>
      </div>

      {/* Issues List */}
      {isLoadingIssues ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-400"></i>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="fa-solid fa-check-circle text-3xl mb-3 text-slate-300"></i>
          <p className="text-sm font-semibold">No issues found</p>
          <p className="text-xs mt-1">Try adjusting your filters or submit some feedback!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(issue => {
            const isBug = issue.labels.some(l => l.name === 'bug');
            const isFeature = issue.labels.some(l => l.name === 'enhancement');
            const hasUpvoted = upvotedIssueNumbers.includes(issue.number);
            const count = upvoteCounts[issue.number] || 0;

            // Extract "Submitted by: Name" from body
            const submittedByMatch = issue.body.match(/\*Submitted by: (.+?)\*/);
            const submittedBy = submittedByMatch ? submittedByMatch[1] : null;
            const bodyPreview = issue.body
              .replace(/---\n\*Submitted by:.*\*/, '')
              .trim()
              .slice(0, 200);

            return (
              <div key={issue.number} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Upvote button */}
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <button
                      onClick={() => !hasUpvoted && userProfile && onUpvote(issue.number)}
                      disabled={hasUpvoted || !userProfile}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        hasUpvoted
                          ? 'bg-indigo-100 text-indigo-600'
                          : userProfile
                            ? 'bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500'
                            : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                      title={hasUpvoted ? 'Already upvoted' : userProfile ? 'Upvote this issue' : 'Sign in to upvote'}
                    >
                      <i className={`fa-solid fa-chevron-up text-xs`}></i>
                    </button>
                    <span className={`text-xs font-bold ${count > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                      {count}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isBug && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-rose-100 text-rose-600">
                          <i className="fa-solid fa-bug text-[8px]"></i>
                          Bug
                        </span>
                      )}
                      {isFeature && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-600">
                          <i className="fa-solid fa-lightbulb text-[8px]"></i>
                          Feature
                        </span>
                      )}
                      {issue.state === 'closed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-purple-100 text-purple-600">
                          <i className="fa-solid fa-check text-[8px]"></i>
                          Done
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-slate-800">{issue.title}</h3>
                    </div>

                    {bodyPreview && (
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{bodyPreview}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-400">
                      <span>#{issue.number}</span>
                      <span>{timeAgo(issue.created_at)}</span>
                      {submittedBy && (
                        <span className="flex items-center gap-1">
                          <i className="fa-solid fa-campground text-[8px]"></i>
                          {submittedBy}
                        </span>
                      )}
                      {issue.comments > 0 && (
                        <span className="flex items-center gap-1">
                          <i className="fa-regular fa-comment text-[8px]"></i>
                          {issue.comments}
                        </span>
                      )}
                      <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-500 transition-colors flex items-center gap-1 ml-auto"
                      >
                        <i className="fa-brands fa-github text-[10px]"></i>
                        GitHub
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
