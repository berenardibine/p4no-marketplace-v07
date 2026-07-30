import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Power, Loader2, Database, Gauge, Cpu, Radio,
  HardDrive, Server, TrendingDown, Layers, ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAdmin } from "@/hooks/useAdmin";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useToast } from "@/hooks/use-toast";

const ASSUMED_DAILY_VISITS = 100_000;

const AdminFeatureToggles = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { features, flags, loading, saving, toggle } = useFeatureFlags();
  const { toast } = useToast();

  const savings = useMemo(() => {
    const off = features.filter((f) => flags[f.key] === false);
    const egressMbDay = off.reduce((s, f) => s + (f.egressKbPerVisit * ASSUMED_DAILY_VISITS) / 1024, 0);
    const readsDay = off.reduce((s, f) => s + f.readsPerVisit * ASSUMED_DAILY_VISITS, 0);
    const jobs = off.flatMap((f) => f.jobs);
    const staticPaths = off.flatMap((f) => f.staticPaths);
    const tables = new Set(off.flatMap((f) => f.tables));
    return {
      offCount: off.length,
      egressMbDay,
      egressGbMonth: (egressMbDay * 30) / 1024,
      readsDay,
      jobs,
      staticPaths,
      tables: Array.from(tables),
      cpuPct: Math.min(90, off.length * 7),
      monthlyUsd: ((egressMbDay * 30) / 1024) * 0.09,
    };
  }, [features, flags]);

  const onToggle = async (key: string, label: string, next: boolean) => {
    try {
      await toggle(key, next);
      toast({
        title: next ? `✅ ${label} enabled` : `🛑 ${label} shut down`,
        description: next
          ? "Frontend, APIs, jobs and generation resumed."
          : "UI hidden, routes blocked, APIs, workers, static generation, realtime and cache stopped.",
      });
    } catch {
      toast({ title: "Failed to update toggle", variant: "destructive" });
    }
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <ShieldOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Admins only.</p>
        <Button onClick={() => navigate("/")}>Go home</Button>
      </div>
    );
  }

  const metric = (icon: React.ReactNode, label: string, value: string) => (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-medium">
        {icon}<span>{label}</span>
      </div>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="container flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/system-usage")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-bold">Feature Toggles</h1>
            <p className="text-[11px] text-muted-foreground">Complete shutdown mode — a disabled module consumes zero backend resources</p>
          </div>
          <Badge variant={savings.offCount ? "destructive" : "secondary"}>
            {savings.offCount} off
          </Badge>
        </div>
      </header>

      <main className="container space-y-5 px-4 py-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-emerald-500" /> Savings Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metric(<Database className="h-3 w-3" />, "DB reads saved / day", savings.readsDay.toLocaleString())}
            {metric(<Gauge className="h-3 w-3" />, "Egress saved / day", `${savings.egressMbDay.toFixed(0)} MB`)}
            {metric(<Cpu className="h-3 w-3" />, "CPU saved", `${savings.cpuPct}%`)}
            {metric(<Server className="h-3 w-3" />, "Workers stopped", String(savings.jobs.length))}
            {metric(<Radio className="h-3 w-3" />, "Realtime / polling stopped", String(savings.tables.length))}
            {metric(<HardDrive className="h-3 w-3" />, "Static paths stopped", String(savings.staticPaths.length))}
            {metric(<Layers className="h-3 w-3" />, "Cache removed", `${savings.staticPaths.length} prefixes`)}
            {metric(<TrendingDown className="h-3 w-3" />, "Est. monthly saving", `${savings.egressGbMonth.toFixed(1)} GB · $${savings.monthlyUsd.toFixed(0)}`)}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {features.map((f) => {
            const on = flags[f.key] !== false;
            return (
              <Card key={f.key} className={on ? "" : "border-destructive/40 bg-destructive/5"}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Power className={`h-4 w-4 ${on ? "text-emerald-500" : "text-destructive"}`} />
                        <h3 className="text-sm font-bold">{f.label}</h3>
                        <Badge variant={on ? "secondary" : "destructive"} className="text-[9px]">
                          {on ? "RUNNING" : "SHUT DOWN"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {saving === f.key && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      <Switch checked={on} disabled={saving === f.key} onCheckedChange={(v) => onToggle(f.key, f.label, v)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-muted-foreground">DB savings</p>
                      <p className="font-semibold">{f.estDbSavings}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-muted-foreground">Egress savings</p>
                      <p className="font-semibold">{f.estEgressSavings}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-muted-foreground">Dependencies</p>
                      <p className="font-semibold">{f.dependencies.length ? f.dependencies.join(", ") : "none"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-muted-foreground">Running jobs</p>
                      <p className="font-semibold">{f.jobs.length ? (on ? f.jobs.join(", ") : "stopped") : "none"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default AdminFeatureToggles;
