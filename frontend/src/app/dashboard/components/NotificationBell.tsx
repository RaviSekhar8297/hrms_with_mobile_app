'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getHeaders, getUrl } from '../utils/api';

export interface NotificationItem {
  id: string;
  company_id: string;
  sender_id?: string | null;
  recipient_id: string;
  sender_name?: string;
  module: string;
  event_code: string;
  reference_type?: string | null;
  reference_id?: string | null;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Helper to fetch notifications from backend
  const fetchNotifications = async () => {
    try {
      const res = await fetch(getUrl('/api/notifications?limit=25'), {
        headers: getHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  // Initial fetch and 30s Polling timer
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(getUrl(`/api/notifications/${id}/read`), {
        method: 'PUT',
        headers: getHeaders(),
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(getUrl('/api/notifications/read-all'), {
        method: 'PUT',
        headers: getHeaders(),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Delete single notification
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const target = notifications.find((n) => n.id === id);
      const res = await fetch(getUrl(`/api/notifications/${id}`), {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (res.ok) {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
        if (target && !target.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  // Notification item click handler
  const handleItemClick = (item: NotificationItem) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    setIsOpen(false);
    if (item.action_url) {
      router.push(item.action_url);
    }
  };

  // Format relative timestamp
  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const past = new Date(dateStr);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Filter notifications to last 3 days only
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setHours(0, 0, 0, 0);

  const recentNotifications = notifications.filter((n) => {
    if (!n.created_at) return true;
    const itemDate = new Date(n.created_at);
    return itemDate >= threeDaysAgo;
  });

  // Icon selector by type
  const renderBadgeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'SUCCESS':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/15">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
        );
      case 'DANGER':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 border border-rose-500/15">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'WARNING':
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 border border-amber-500/15">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM12 3l9 16.5H3L12 3Z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400 shrink-0 border border-brand-600/15">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* 🔔 BELL BUTTON */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all cursor-pointer flex items-center justify-center active:scale-95"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>

        {/* 🔴 UNREAD BADGE */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-semibold text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 📥 NOTIFICATION DROPDOWN DRAWER */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-xl bg-card border border-[#e4e7ec] dark:border-white/[0.08] shadow-[0_24px_64px_-16px_rgba(16,24,40,0.28)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65)] z-50 overflow-hidden text-left animate-slideDown">
          {/* Header */}
          <div className="p-4 border-b border-[#eaecf0] dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-brand-600/10 text-brand-700 dark:text-brand-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 cursor-pointer transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List (Last 3 Days) */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#f2f4f7] dark:divide-white/[0.05]">
            {recentNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  No notifications in the last 3 days
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Recent system alerts, approvals and updates will appear here.
                </p>
              </div>
            ) : (
              recentNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-4 transition-colors flex items-start gap-3.5 cursor-pointer relative group ${
                    !item.is_read
                      ? 'bg-brand-600/[0.05] dark:bg-brand-400/[0.07] hover:bg-brand-600/10 dark:hover:bg-brand-400/10'
                      : 'opacity-60 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Icon */}
                  {renderBadgeIcon(item.type)}

                  {/* Body */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex justify-between items-baseline gap-2 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          !item.is_read
                            ? 'font-semibold text-slate-900 dark:text-white'
                            : 'font-normal text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span
                        className={`text-[10px] shrink-0 ${
                          !item.is_read
                            ? 'font-medium text-brand-600 dark:text-brand-400'
                            : 'font-normal text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>

                    <p
                      className={`text-[11px] leading-snug line-clamp-2 ${
                        !item.is_read
                          ? 'font-normal text-slate-600 dark:text-slate-300'
                          : 'font-normal text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.message}
                    </p>

                    {item.sender_name && (
                      <p
                        className={`text-[10px] mt-1 ${
                          !item.is_read
                            ? 'font-medium text-brand-600 dark:text-brand-400'
                            : 'font-normal text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        By: {item.sender_name}
                      </p>
                    )}
                  </div>

                  {/* Actions: Unread dot & Delete button */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!item.is_read && (
                      <span
                        className="w-2 h-2 rounded-full bg-brand-600"
                        title="Unread"
                      />
                    )}

                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
