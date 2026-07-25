import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Row {
  day: string;
  notification_type: string;
  sent: number;
  failed: number;
  clicked: number;
  total: number;
}

const NotificationAnalytics = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("notification_analytics_daily" as any)
        .select("*")
        .gte("day", since)
        .order("day", { ascending: false })
        .limit(200);
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;

  // Totals by type (last 14d)
  const byType = new Map<string, { sent: number; failed: number; clicked: number }>();
  for (const r of rows) {
    const prev = byType.get(r.notification_type) || { sent: 0, failed: 0, clicked: 0 };
    prev.sent += r.sent || 0;
    prev.failed += r.failed || 0;
    prev.clicked += r.clicked || 0;
    byType.set(r.notification_type, prev);
  }

  const totals = Array.from(byType.entries())
    .map(([type, v]) => ({
      type,
      ...v,
      ctr: v.sent ? Math.round((v.clicked / v.sent) * 100) : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  const grandSent = totals.reduce((s, t) => s + t.sent, 0);
  const grandClicked = totals.reduce((s, t) => s + t.clicked, 0);
  const grandFailed = totals.reduce((s, t) => s + t.failed, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sent (14d)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{grandSent}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Clicked</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{grandClicked}</div>
            <div className="text-xs text-muted-foreground">{grandSent ? Math.round((grandClicked / grandSent) * 100) : 0}% CTR</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{grandFailed}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By type (14d)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Type</th>
                  <th>Sent</th>
                  <th>Clicked</th>
                  <th>CTR</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <tr key={t.type} className="border-t">
                    <td className="py-2 font-medium">{t.type}</td>
                    <td>{t.sent}</td>
                    <td>{t.clicked}</td>
                    <td>{t.ctr}%</td>
                    <td className="text-destructive">{t.failed}</td>
                  </tr>
                ))}
                {!totals.length && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationAnalytics;
