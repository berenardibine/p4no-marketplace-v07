import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Users, MousePointer, 
  ExternalLink, Clock, Download, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSellerAnalytics } from '@/hooks/useLinkAnalytics';
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

const sourceEmojis: Record<string, string> = {
  facebook: '📘',
  whatsapp: '💬',
  twitter: '🐦',
  instagram: '📸',
  telegram: '✈️',
  google: '🔍',
  direct: '🔗',
  other: '🌐',
};

const LinkAnalytics = () => {
  const { fetchAllAnalytics } = useSellerAnalytics();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    const data = await fetchAllAnalytics();
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

  const exportCSV = () => {
    if (!analytics?.products) return;

    const headers = ['Product', 'Total Clicks', 'Unique Visitors', 'Top Source', 'Last Click'];
    const rows = analytics.products.map((p: any) => [
      p.title,
      p.totalClicks,
      p.uniqueVisitors,
      p.topSource,
      formatDate(p.lastClick)
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!analytics || analytics.products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border shadow-soft">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-lg mb-2">No Analytics Yet</h3>
        <p className="text-muted-foreground text-sm">
          Start sharing your product links to see analytics here.
        </p>
      </div>
    );
  }

  const { summary, products } = analytics;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-4 border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-3">
            <MousePointer className="h-5 w-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{summary.totalClicks}</p>
          <p className="text-xs text-muted-foreground font-medium">Total Clicks</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-4 border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center mb-3">
            <Users className="h-5 w-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{summary.uniqueVisitors}</p>
          <p className="text-xs text-muted-foreground font-medium">Unique Visitors</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-2xl p-4 border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-400 flex items-center justify-center mb-3">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{products.length}</p>
          <p className="text-xs text-muted-foreground font-medium">Products Tracked</p>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-4 border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center mb-3">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <p className="text-lg font-bold text-slate-800 capitalize">{Object.keys(summary.sources)[0] || 'Direct'}</p>
          <p className="text-xs text-muted-foreground font-medium">Top Source</p>
        </div>
      </div>

      {/* Source Distribution */}
      {Object.keys(summary.sources).length > 0 && (
        <div className="bg-white rounded-2xl p-4 border shadow-soft">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Traffic Sources
          </h3>
          <div className="space-y-3">
            {Object.entries(summary.sources)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .map(([source, count]) => {
                const percentage = Math.round(((count as number) / summary.totalClicks) * 100);
                return (
                  <div key={source} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 capitalize">
                        <span>{sourceEmojis[source] || '🔗'}</span>
                        {source}
                      </span>
                      <span className="font-medium">{String(count)} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", sourceColors[source] || 'bg-gray-400')}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Filters & Export */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Product Analytics Table */}
      <div className="bg-white rounded-2xl border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-semibold">Product</th>
                <th className="text-center p-4 text-sm font-semibold">Total Clicks</th>
                <th className="text-center p-4 text-sm font-semibold hidden sm:table-cell">Unique</th>
                <th className="text-center p-4 text-sm font-semibold hidden md:table-cell">Top Source</th>
                <th className="text-center p-4 text-sm font-semibold hidden lg:table-cell">Last Click</th>
                <th className="text-center p-4 text-sm font-semibold">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product: any) => (
                <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={product.images?.[0] || '/placeholder.svg'} 
                        alt={product.title}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <span className="font-medium text-sm line-clamp-1">{product.title}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <Badge variant="secondary" className="font-bold">
                      {product.totalClicks}
                    </Badge>
                  </td>
                  <td className="p-4 text-center hidden sm:table-cell">
                    {product.uniqueVisitors}
                  </td>
          <td className="p-4 text-center hidden md:table-cell">
                    <span className="flex items-center justify-center gap-1 capitalize text-sm">
                      {sourceEmojis[product.topSource as string] || '🔗'}
                      {product.topSource as string}
                    </span>
                  </td>
                  <td className="p-4 text-center hidden lg:table-cell text-sm text-muted-foreground">
                    <span className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(product.lastClick)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        const url = `${window.location.origin}/product/${product.slug || product.id}`;
                        navigator.clipboard.writeText(url);
                      }}
                      className="gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LinkAnalytics;
