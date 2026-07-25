import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, ArrowLeft, CheckCheck, Archive, Trash2,
  Megaphone, MessageCircle, ShoppingBag, AlertCircle,
  Shield, UserPlus, Bookmark, Tag, Package, Award,
  Briefcase, Sparkles, Star, ArchiveRestore
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { resolveNotificationUrl } from "@/lib/notificationDeepLink";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean | null;
  created_at: string | null;
  user_id: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  image_url?: string | null;
  action_url?: string | null;
  priority?: string | null;
  archived_at?: string | null;
  clicked_at?: string | null;
}

type Tab = 'unread' | 'read' | 'archived' | 'all';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('unread');

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const channel = supabase
      .channel(`notifications-page-${user.id}-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Notification;
        if (n.user_id === user.id || n.user_id === null) {
          setNotifications(prev => [n, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Notification;
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, ...n } : x));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read && !n.archived_at).map(n => n.id);
    if (!unreadIds.length) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, is_read: true } : n));
    toast({ title: "All caught up" });
  };

  const archive = async (id: string) => {
    const at = new Date().toISOString();
    await supabase.from('notifications').update({ archived_at: at, is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived_at: at, is_read: true } : n));
  };

  const unarchive = async (id: string) => {
    await supabase.from('notifications').update({ archived_at: null }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived_at: null } : n));
  };

  const remove = async (id: string) => {
    if (!isAdmin) {
      toast({ title: "Permission Denied", variant: "destructive" });
      return;
    }
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    // Record click
    // Record click on both notifications and notification_logs (for CTR analytics)
    supabase.rpc('mark_notification_clicked' as any, { _notification_id: n.id }).then(() => {});
    const url = await resolveNotificationUrl(n);
    navigate(url);
  };

  const getIcon = (type: string | null) => {
    switch (type) {
      case 'promotion': return Megaphone;
      case 'message': return MessageCircle;
      case 'order': return ShoppingBag;
      case 'alert': return AlertCircle;
      case 'admin': case 'push': return Shield;
      case 'follow': return UserPlus;
      case 'save': case 'saved': return Bookmark;
      case 'price_drop': case 'discount': return Tag;
      case 'new_product': case 'product': return Package;
      case 'badge': case 'achievement': return Award;
      case 'opportunity': return Briefcase;
      case 'recommendation': return Sparkles;
      case 'review': case 'rating': return Star;
      case 'qa_reply': case 'qa_question': case 'comment': return MessageCircle;
      case 'article': return MessageCircle;
      default: return Bell;
    }
  };

  const getIconColor = (type: string | null) => {
    switch (type) {
      case 'promotion': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'message': case 'qa_reply': case 'qa_question': case 'comment': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'order': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'alert': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'admin': case 'push': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
      case 'follow': return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';
      case 'save': case 'saved': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
      case 'price_drop': case 'discount': return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400';
      case 'new_product': case 'product': return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
      case 'badge': case 'achievement': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'opportunity': return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'recommendation': return 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400';
      case 'review': case 'rating': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-primary/10 text-primary';
    }
  };

  const counts = useMemo(() => ({
    unread: notifications.filter(n => !n.is_read && !n.archived_at).length,
    read: notifications.filter(n => n.is_read && !n.archived_at).length,
    archived: notifications.filter(n => !!n.archived_at).length,
    all: notifications.filter(n => !n.archived_at).length,
  }), [notifications]);

  const visible = useMemo(() => {
    switch (tab) {
      case 'unread': return notifications.filter(n => !n.is_read && !n.archived_at);
      case 'read': return notifications.filter(n => n.is_read && !n.archived_at);
      case 'archived': return notifications.filter(n => !!n.archived_at);
      case 'all': return notifications.filter(n => !n.archived_at);
    }
  }, [notifications, tab]);

  const isHtml = (msg: string) => /<[a-z][\s\S]*>/i.test(msg);
  const stripHtml = (msg: string) => msg.replace(/<[^>]*>/g, '');

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Bell className="h-16 w-16 text-primary/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to view notifications</h2>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'unread', label: `Unread${counts.unread ? ` · ${counts.unread}` : ''}` },
    { key: 'read', label: 'Read' },
    { key: 'archived', label: 'Archived' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg">Notifications</h1>
              {counts.unread > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0 min-w-[20px] h-5 flex items-center justify-center">
                  {counts.unread}
                </Badge>
              )}
            </div>
          </div>
          {counts.unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="gap-1.5 text-xs">
              <CheckCheck className="h-3.5 w-3.5" />
              Read all
            </Button>
          )}
        </div>
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap',
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Bell className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {tab === 'unread' ? "You're all caught up!" :
               tab === 'archived' ? 'Nothing archived' :
               tab === 'read' ? 'No read notifications' :
               'No notifications yet'}
            </h3>
            <p className="text-muted-foreground text-sm">
              We'll let you know when something happens.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(n => {
              const Icon = getIcon(n.type);
              const isHighPriority = n.priority === 'high';
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "group relative bg-card rounded-xl border shadow-sm transition-all cursor-pointer active:scale-[0.99]",
                    !n.is_read && "border-l-4 border-l-primary bg-primary/[0.02]",
                    isHighPriority && !n.is_read && "border-l-destructive bg-destructive/[0.03]"
                  )}
                >
                  <div className="p-3.5 flex gap-3">
                    {/* Image or icon */}
                    {n.image_url ? (
                      <img
                        src={n.image_url}
                        alt=""
                        loading="lazy"
                        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-muted"
                      />
                    ) : (
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        getIconColor(n.type)
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className={cn("font-semibold text-sm leading-tight line-clamp-1", !n.is_read && "text-foreground")}>
                              {n.title}
                            </h3>
                            {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {isHtml(n.message) ? stripHtml(n.message) : n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              {n.created_at && formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </span>
                            {n.type && (
                              <Badge variant="outline" className="text-[10px] capitalize h-4 px-1.5">
                                {n.type.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {!n.archived_at ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); archive(n.id); }}
                              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                              aria-label="Archive"
                              title="Archive"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); unarchive(n.id); }}
                              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                              aria-label="Restore"
                              title="Restore"
                            >
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                              className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive"
                              aria-label="Delete"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
