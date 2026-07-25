import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Shield, Loader2, Database, HardDrive, Activity, AlertTriangle, CheckCircle2, RefreshCw, Wrench, FileWarning, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SystemStats {
  totalProducts: number;
  totalUsers: number;
  totalViews: number;
  totalImpressions: number;
  optimizedFiles: number;
  unoptimizedFiles: number;
  optimizationErrors: number;
  totalSpaceSaved: number;
  recentLogs: Array<{ id: string; job_type: string; details: Record<string, unknown>; status: string; created_at: string }>;
  auditItems: Array<{ id: string; file_name: string; file_url: string; status: string; original_size: number; current_size: number; detected_at: string }>;
  errorItems: Array<{ id: string; file_name: string; error_message: string; resolved: boolean; created_at: string }>;
}

const AdminSystemUsage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [
        productsRes, usersRes, viewsRes, impressionsRes,
        optimizedRes, unoptimizedRes, errorsRes,
        spaceSavedRes, logsRes, auditRes, errorItemsRes
      ] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('product_views').select('id', { count: 'exact', head: true }),
        supabase.from('product_impressions').select('id', { count: 'exact', head: true }),
        supabase.from('optimization_audit').select('id', { count: 'exact', head: true }).eq('status', 'optimized'),
        supabase.from('optimization_audit').select('id', { count: 'exact', head: true }).eq('status', 'not_optimized'),
        supabase.from('optimization_errors').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('file_optimization_logs').select('original_size, optimized_size'),
        supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('optimization_audit').select('*').eq('status', 'not_optimized').order('detected_at', { ascending: false }).limit(20),
        supabase.from('optimization_errors').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(20),
      ]);

      const totalSaved = (spaceSavedRes.data || []).reduce((sum, r) => sum + ((r.original_size || 0) - (r.optimized_size || 0)), 0);

      setStats({
        totalProducts: productsRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalViews: viewsRes.count || 0,
        totalImpressions: impressionsRes.count || 0,
        optimizedFiles: optimizedRes.count || 0,
        unoptimizedFiles: unoptimizedRes.count || 0,
        optimizationErrors: errorsRes.count || 0,
        totalSpaceSaved: totalSaved,
        recentLogs: (logsRes.data || []) as SystemStats['recentLogs'],
        auditItems: (auditRes.data || []) as SystemStats['auditItems'],
        errorItems: (errorItemsRes.data || []) as SystemStats['errorItems'],
      });
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchStats();
  }, [isAdmin, fetchStats]);

  const runMaintenance = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/system-maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const result = await res.json();
      toast({
        title: "🔧 Maintenance Complete",
        description: `Cleaned ${result.expiredBoosts || 0} boosts, ${result.expiredDiscounts || 0} discounts. Found ${result.unoptimizedFilesDetected || 0} unoptimized files.`,
      });
      fetchStats();
    } catch (err) {
      toast({ title: "Maintenance failed", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const resolveError = async (errorId: string) => {
    await supabase.from('optimization_errors')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', errorId);
    fetchStats();
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Estimate DB usage based on row counts (rough approximation for free plan monitoring)
  const estimatedDbMB = stats ? Math.round(
    (stats.totalProducts * 2 + stats.totalUsers * 1.5 + stats.totalViews * 0.3 + stats.totalImpressions * 0.2) / 1024
  ) : 0;
  const dbUsagePercent = Math.min(100, Math.round((estimatedDbMB / 500) * 100));

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg">System Usage</h1>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={runMaintenance} disabled={running} className="gap-2 rounded-xl">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            {running ? 'Running...' : 'Run Maintenance'}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
            <Home className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stats && (
          <>
            {/* DB Usage Estimate */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-5 w-5 text-primary" />
                  Database Usage (Estimated)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">~{estimatedDbMB} MB / 500 MB</span>
                    <span className={dbUsagePercent > 80 ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                      {dbUsagePercent}%
                    </span>
                  </div>
                  <Progress value={dbUsagePercent} className="h-3" />
                  {dbUsagePercent > 80 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> High usage — consider cleanup or upgrading
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="text-center p-3 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold">{stats.totalProducts.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Views</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-xl">
                    <p className="text-2xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Impressions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Optimization Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-5 w-5 text-primary" />
                  File Optimization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                    <p className="text-xl font-bold">{stats.optimizedFiles}</p>
                    <p className="text-xs text-muted-foreground">Optimized</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                    <FileWarning className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xl font-bold">{stats.unoptimizedFiles}</p>
                    <p className="text-xs text-muted-foreground">Unoptimized</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-xl">
                    <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <p className="text-xl font-bold">{stats.optimizationErrors}</p>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </div>
                </div>
                {stats.totalSpaceSaved > 0 && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-xl flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Total space saved: {formatBytes(stats.totalSpaceSaved)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unoptimized Files */}
            {stats.auditItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileWarning className="h-5 w-5 text-amber-500" />
                    Unoptimized Files ({stats.unoptimizedFiles})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.auditItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                        <span className="truncate flex-1 mr-2">{item.file_name}</span>
                        <Badge variant="outline" className="text-amber-600 border-amber-300">Not Optimized</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Optimization Errors */}
            {stats.errorItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Pending Errors ({stats.optimizationErrors})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.errorItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.file_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.error_message}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => resolveError(item.id)} className="shrink-0">
                          Resolve
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Maintenance Logs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Maintenance Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No maintenance logs yet. Click "Run Maintenance" above.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.recentLogs.map(log => (
                      <div key={log.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary">{log.job_type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminSystemUsage;
