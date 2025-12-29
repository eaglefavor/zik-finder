'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Trash2, Info, CheckCircle, AlertTriangle, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Notification } from '@/lib/types';
import Link from 'next/link';

export default function NotificationsPage() {
  const { user } = useAppContext();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Subscribe to real-time notifications
      const channel = supabase
        .channel(`user-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error('Error marking as read:', error);
      // Revert if error (optional, but good practice)
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    // Optimistic
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user!.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all as read:', error);
    }
    setMarkingAll(false);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!confirm('Delete this notification?')) return;

    setNotifications(prev => prev.filter(n => n.id !== id));

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle size={20} className="text-green-500" />;
      case 'warning': return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'error': return <XCircle size={20} className="text-red-500" />;
      default: return <Info size={20} className="text-blue-500" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/95 backdrop-blur py-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            disabled={markingAll}
            className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
          >
            {markingAll ? 'Marking...' : 'Mark all read'}
          </button>
        )}
      </header>

      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div 
              key={n.id}
              onClick={() => !n.is_read && markAsRead(n.id)}
              className={`relative group bg-white p-4 rounded-2xl border transition-all ${
                n.is_read ? 'border-gray-100 opacity-70' : 'border-blue-100 shadow-sm ring-1 ring-blue-50'
              }`}
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                   n.type === 'success' ? 'bg-green-50' : 
                   n.type === 'warning' ? 'bg-yellow-50' : 
                   n.type === 'error' ? 'bg-red-50' : 'bg-blue-50'
                }`}>
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-bold text-sm ${n.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                      {n.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 font-medium mb-1">
                    {formatTime(n.created_at)}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">
                    {n.message}
                  </p>
                  
                  {n.link && (
                    <Link href={n.link} className="inline-flex items-center text-[10px] font-bold text-blue-600 hover:underline">
                      View Details <ChevronRight size={12} />
                    </Link>
                  )}
                </div>
              </div>

              {/* Delete Action (Always visible) */}
              <button 
                onClick={(e) => deleteNotification(n.id, e)}
                className="absolute top-3 right-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                aria-label="Delete notification"
              >
                <Trash2 size={16} />
              </button>

              {/* Unread Indicator */}
              {!n.is_read && (
                <div className="absolute top-5 right-12 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
            <Bell size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">All caught up!</h3>
          <p className="text-gray-500 text-sm max-w-[200px] mt-2">You have no new notifications at the moment.</p>
        </div>
      )}
    </div>
  );
}