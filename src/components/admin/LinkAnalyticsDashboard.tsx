import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Users, MousePointer, 
  AlertTriangle, Shield, Eye, Activity, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAnalytics } from '@/hooks/useLinkAnalytics';
import { cn } from '@/lib/utils';

const sourceColors: Record<string, string> = {
  facebook: 'bg-blue-500',
  whatsapp: 'bg-green-500',
  twitter: 'bg-sky-500',
  instagram: 'bg-pink-500',
  telegram: 'bg-cyan-500',
  google: 'bg-red-500',
  direct: 'bg-gray-500',
  other: 'bg-purple-500',
};

const LinkAnalyticsDashboard = () => {
  const { fetchSiteAnalytics } = useAdminAnalytics();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'fraud'>('overview');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    const data = await fetchSiteAnalytics();
    setAnalytics(data);
    setLoading(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-RW', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-lg mb-2">No Analytics Data</h3>
        <p className="text-muted-foreground text-sm">
          Analytics will appear here once users start clicking product links.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Link Analytics</h2>
          <p className="text-sm text-muted-foreground">Site-wide traffic analytics and fraud detection</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAnalytics} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-5 border">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-3">
            <MousePointer className="h-6 w-6 text-white" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{analytics.totalClicks}</p>
          <p className="text-sm text-muted-foreground font-medium">Total Clicks</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-5 border">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-white" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{analytics.uniqueVisitors}</p>
          <p className="text-sm text-muted-foreground font-medium">Unique Visitors</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-2xl p-5 border">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-400 flex items-center justify-center mb-3">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{analytics.topProducts.length}</p>
          <p className="text-sm text-muted-foreground font-medium">Products Tracked</p>
        </div>
        
        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-2xl p-5 border">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-400 flex items-center justify-center mb-3">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{analytics.invalidClicks.length}</p>
          <p className="text-sm text-muted-foreground font-medium">Suspicious Clicks</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "px-4 py-2 rounded-lg font-medium transition-all",
            activeTab === 'overview' 
              ? "bg-primary text-white" 
              : "hover:bg-muted"
          )}
        >
          <Eye className="h-4 w-4 inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('fraud')}
          className={cn(
            "px-4 py-2 rounded-lg font-medium transition-all",
            activeTab === 'fraud' 
              ? "bg-red-500 text-white" 
              : "hover:bg-muted"
          )}
        >
          <Shield className="h-4 w-4 inline mr-2" />
          Fraud Detection
          {analytics.invalidClicks.length > 0 && (
            <Badge variant="destructive" className="ml-2 text-xs">
              {analytics.invalidClicks.length}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Top Sources */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border shadow-soft">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Top Traffic Sources
              </h3>
              <div className="space-y-3">
                {analytics.topSources.map(([source, count]: [string, number]) => {
                  const percentage = Math.round((count / analytics.totalClicks) * 100);
                  return (
                    <div key={source} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize font-medium">{source}</span>
                        <span>{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", sourceColors[source] || 'bg-gray-400')}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-2xl p-5 border shadow-soft">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Top Products by Traffic
              </h3>
              <div className="space-y-3">
                {analytics.topProducts.slice(0, 5).map((product: any, index: number) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        by {product.seller?.full_name || 'Unknown'}
                      </p>
                    </div>
                    <Badge variant="secondary">{product.clicks} clicks</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border shadow-soft overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Recent Activity
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold">Product</th>
                    <th className="text-left p-4 text-sm font-semibold">Seller</th>
                    <th className="text-center p-4 text-sm font-semibold">Source</th>
                    <th className="text-center p-4 text-sm font-semibold">Device</th>
                    <th className="text-center p-4 text-sm font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analytics.recentAnalytics.slice(0, 20).map((record: any) => (
                    <tr key={record.id} className="hover:bg-muted/30">
                      <td className="p-4 text-sm font-medium">
                        {record.product?.title || 'Unknown Product'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {record.product?.seller?.full_name || '-'}
                      </td>
                      <td className="p-4 text-center">
                        <Badge 
                          className={cn(
                            "text-white text-xs capitalize",
                            sourceColors[record.source] || 'bg-gray-500'
                          )}
                        >
                          {record.source}
                        </Badge>
                      </td>
                      <td className="p-4 text-center text-sm capitalize">
                        {record.device_type || '-'}
                      </td>
                      <td className="p-4 text-center text-sm text-muted-foreground">
                        {formatDate(record.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'fraud' && (
        <div className="space-y-4">
          {analytics.invalidClicks.length === 0 ? (
            <div className="text-center py-12 bg-green-50 rounded-2xl border border-green-200">
              <Shield className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-lg text-green-800 mb-2">All Clear!</h3>
              <p className="text-green-600 text-sm">
                No suspicious activity detected. Your traffic is clean.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border shadow-soft overflow-hidden">
              <div className="p-4 border-b bg-red-50">
                <h3 className="font-semibold flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  Suspicious Activity Alerts
                </h3>
              </div>
              <div className="divide-y">
                {analytics.invalidClicks.map((click: any) => (
                  <div key={click.id} className="p-4 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">
                          {click.product?.title || 'Unknown Product'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Seller: {click.product?.seller?.full_name || 'Unknown'}
                        </p>
                        <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-100">
                          <p className="text-sm font-medium text-red-800">
                            ⚠️ Issue: {click.reason}
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            Risk Score: {click.risk_score}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="destructive">High Risk</Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(click.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LinkAnalyticsDashboard;
