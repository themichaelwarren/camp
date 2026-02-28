
import React from 'react';
import { Notification, NotificationType, ViewState } from '../types';

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (view: ViewState, id: string) => void;
  onClose: () => void;
}

const NOTIFICATION_ICONS: Record<NotificationType, { icon: string; color: string; bg: string }> = {
  comment_on_song: { icon: 'fa-comment', color: 'text-blue-600', bg: 'bg-blue-100' },
  reply_to_comment: { icon: 'fa-reply', color: 'text-indigo-600', bg: 'bg-indigo-100' },
  boca_received: { icon: 'fa-star', color: 'text-amber-600', bg: 'bg-amber-100' },
  reaction_on_comment: { icon: 'fa-face-smile', color: 'text-pink-600', bg: 'bg-pink-100' },
  new_assignment: { icon: 'fa-clipboard-list', color: 'text-green-600', bg: 'bg-green-100' },
  deadline_reminder: { icon: 'fa-clock', color: 'text-red-600', bg: 'bg-red-100' },
  mention_in_comment: { icon: 'fa-at', color: 'text-cyan-600', bg: 'bg-cyan-100' },
};

const getViewForEntityType = (entityType: string): ViewState => {
  switch (entityType) {
    case 'song': return 'song-detail';
    case 'assignment': return 'assignment-detail';
    case 'prompt': return 'prompt-detail';
    default: return 'song-detail';
  }
};

const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}) => {
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const unreadCount = sorted.filter(n => !n.read).length;

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    const view = getViewForEntityType(notification.entityType);
    onNavigate(view, notification.entityId);
  };

  return (
    <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <i className="fa-solid fa-bell-slash text-2xl mb-3 opacity-30"></i>
            <p className="text-sm font-medium">No notifications yet</p>
          </div>
        ) : (
          sorted.slice(0, 50).map(notification => {
            const iconConfig = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.comment_on_song;
            return (
              <button
                key={notification.id}
                onClick={() => handleClick(notification)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                  !notification.read ? 'bg-indigo-50' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${iconConfig.bg} ${iconConfig.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <i className={`fa-solid ${iconConfig.icon} text-xs`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!notification.read ? 'text-slate-800' : 'text-slate-600'}`}>
                    <span className="font-bold">{notification.triggerUserName}</span>{' '}
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.read && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2"></span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
