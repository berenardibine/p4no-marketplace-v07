import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useFCMPush } from '@/hooks/useFCMPush';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Prefs = {
  qa_enabled: boolean;
  comments_enabled: boolean;
  follows_enabled: boolean;
  badges_enabled: boolean;
  messages_enabled: boolean;
  articles_enabled: boolean;
  services_enabled: boolean;
  seller_updates_enabled: boolean;
  promotions_enabled: boolean;
  marketplace_enabled: boolean;
  security_enabled: boolean;
  lifecycle_enabled: boolean;
};

const DEFAULTS: Prefs = {
  qa_enabled: true,
  comments_enabled: true,
  follows_enabled: true,
  badges_enabled: true,
  messages_enabled: true,
  articles_enabled: true,
  services_enabled: true,
  seller_updates_enabled: true,
  promotions_enabled: true,
  marketplace_enabled: true,
  security_enabled: true,
  lifecycle_enabled: true,
};

const ROWS: Array<{ key: keyof Prefs; label: string; desc: string }> = [
  { key: 'qa_enabled', label: 'Q&A Notifications', desc: 'Replies to your questions' },
  { key: 'comments_enabled', label: 'Comment Notifications', desc: 'Comments on your products' },
  { key: 'follows_enabled', label: 'Follow Notifications', desc: 'When someone follows you' },
  { key: 'badges_enabled', label: 'Badge Notifications', desc: 'When you earn an achievement' },
  { key: 'messages_enabled', label: 'Connect Messages', desc: 'Direct messages and inquiries' },
  { key: 'articles_enabled', label: 'Article Notifications', desc: 'New insights articles' },
  { key: 'services_enabled', label: 'Services', desc: 'Updates about services you follow' },
  { key: 'seller_updates_enabled', label: 'Seller Updates', desc: 'New & updated products from sellers you follow' },
  { key: 'promotions_enabled', label: 'Promotions & Flash Sales', desc: 'Deals, price drops and limited-time offers' },
  { key: 'marketplace_enabled', label: 'Marketplace News', desc: 'Announcements and tips from P4NO' },
  { key: 'security_enabled', label: 'Security Alerts', desc: 'Important account & security notices' },
  { key: 'lifecycle_enabled', label: 'Lifecycle Reminders', desc: 'Re-engagement and personalized nudges' },
];

export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSupported, isSubscribed, subscribe, unsubscribe } = useFCMPush();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          qa_enabled: data.qa_enabled ?? true,
          comments_enabled: data.comments_enabled ?? true,
          follows_enabled: data.follows_enabled ?? true,
          badges_enabled: data.badges_enabled ?? true,
          messages_enabled: data.messages_enabled ?? true,
          articles_enabled: data.articles_enabled ?? true,
          services_enabled: (data as any).services_enabled ?? true,
          seller_updates_enabled: (data as any).seller_updates_enabled ?? true,
          promotions_enabled: (data as any).promotions_enabled ?? true,
          marketplace_enabled: (data as any).marketplace_enabled ?? true,
          security_enabled: (data as any).security_enabled ?? true,
          lifecycle_enabled: (data as any).lifecycle_enabled ?? true,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const toggle = async (key: keyof Prefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast.error('Could not save preference');
      setPrefs(prefs);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">Please sign in to manage notification settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Notification Settings</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isSubscribed ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
            <div>
              <div className="font-medium">Push Notifications</div>
              <div className="text-xs text-muted-foreground">
                {!isSupported ? 'Not supported on this device' : isSubscribed ? 'Enabled on this device' : 'Disabled on this device'}
              </div>
            </div>
          </div>
          {isSupported && (
            <Button
              size="sm"
              variant={isSubscribed ? 'outline' : 'default'}
              onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
            >
              {isSubscribed ? 'Disable' : 'Enable'}
            </Button>
          )}
        </Card>

        <Card className="divide-y">
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between p-4">
              <div className="pr-4">
                <div className="font-medium text-sm">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.desc}</div>
              </div>
              <Switch
                checked={prefs[row.key]}
                disabled={loading || saving}
                onCheckedChange={(v) => toggle(row.key, v)}
              />
            </div>
          ))}
        </Card>

        <p className="text-xs text-muted-foreground px-1">
          Preferences apply to all your devices. You can disable push entirely above.
        </p>
      </div>
    </div>
  );
}