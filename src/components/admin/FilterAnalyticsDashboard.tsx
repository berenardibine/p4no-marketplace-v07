import { useState, useEffect } from 'react';
import { 
  Filter, MapPin, DollarSign, Calendar, 
  TrendingUp, BarChart2, Search, MousePointerClick
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays } from 'date-fns';

interface FilterStats {
  totalFilterUsages: number;
  locationFilters: number;
  priceFilters: number;
  sortFilters: number;
  filterToClickRatio: number;
  topLocations: { name: string; count: number }[];
  topPriceRanges: { name: string; count: number }[];
  filterTrend: { date: string; count: number }[];
}

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#06b6d4'];

const FilterAnalyticsDashboard = () => {
  const [stats, setStats] = useState<FilterStats>({
    totalFilterUsages: 0,
    locationFilters: 0,
    priceFilters: 0,
    sortFilters: 0,
    filterToClickRatio: 0,
    topLocations: [],
    topPriceRanges: [],
    filterTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  useEffect(() => {
    fetchFilterAnalytics();
  }, [timeRange]);

  const fetchFilterAnalytics = async () => {
    setLoading(true);
    
    try {
      const daysBack = timeRange === 'week' ? 7 : 30;
      const startDate = subDays(new Date(), daysBack);

      // Fetch filter analytics
      const { data: filterData, error } = await supabase
        .from('filter_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error fetching filter analytics:', error);
        setLoading(false);
        return;
      }

      const analytics = filterData || [];

      // Calculate stats
      const locationFilters = analytics.filter(f => f.filter_type === 'location').length;
      const priceFilters = analytics.filter(f => f.filter_type === 'price').length;
      const sortFilters = analytics.filter(f => f.filter_type === 'sort').length;

      // Top locations
      const locationCounts = new Map<string, number>();
      analytics
        .filter(f => f.filter_type === 'location')
        .forEach(f => {
          const loc = f.filter_value || 'Unknown';
          locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
        });

      const topLocations = Array.from(locationCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top price ranges
      const priceCounts = new Map<string, number>();
      analytics
        .filter(f => f.filter_type === 'price')
        .forEach(f => {
          const range = f.filter_value || 'Unknown';
          priceCounts.set(range, (priceCounts.get(range) || 0) + 1);
        });

      const topPriceRanges = Array.from(priceCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Filter trend by day
      const trendMap = new Map<string, number>();
      analytics.forEach(f => {
        const date = format(new Date(f.created_at || ''), 'MMM dd');
        trendMap.set(date, (trendMap.get(date) || 0) + 1);
      });

      const filterTrend = Array.from(trendMap.entries())
        .map(([date, count]) => ({ date, count }))
        .slice(-7);

      // Get product views for ratio calculation
      const { count: totalClicks } = await supabase
        .from('link_analytics')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString());

      const filterToClickRatio = totalClicks && analytics.length > 0
        ? Math.round((analytics.length / totalClicks) * 100)
        : 0;

      setStats({
        totalFilterUsages: analytics.length,
        locationFilters,
        priceFilters,
        sortFilters,
        filterToClickRatio,
        topLocations,
        topPriceRanges,
        filterTrend,
      });
    } catch (err) {
      console.error('Error in filter analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterTypeData = [
    { name: 'Location', value: stats.locationFilters, color: '#f97316' },
    { name: 'Price', value: stats.priceFilters, color: '#3b82f6' },
    { name: 'Sort', value: stats.sortFilters, color: '#22c55e' },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Filter Analytics</h2>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-xl p-1 border">
          {(['week', 'month'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                timeRange === range 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Search className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats.totalFilterUsages}</p>
          <p className="text-sm text-muted-foreground">Total Filter Uses</p>
        </div>

        <div className="bg-card rounded-2xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-orange-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats.locationFilters}</p>
          <p className="text-sm text-muted-foreground">Location Filters</p>
        </div>

        <div className="bg-card rounded-2xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats.priceFilters}</p>
          <p className="text-sm text-muted-foreground">Price Filters</p>
        </div>

        <div className="bg-card rounded-2xl p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MousePointerClick className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats.filterToClickRatio}%</p>
          <p className="text-sm text-muted-foreground">Filter-to-Click Ratio</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Filter Usage Trend */}
        <div className="bg-card rounded-2xl p-5 border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Filter Usage Trend</h3>
              <p className="text-sm text-muted-foreground">Daily filter usage</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.filterTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#f97316" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filter Type Distribution */}
        <div className="bg-card rounded-2xl p-5 border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Filter Types</h3>
              <p className="text-sm text-muted-foreground">Distribution by type</p>
            </div>
            <BarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filterTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {filterTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {filterTypeData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Searched Locations */}
        <div className="bg-card rounded-2xl p-5 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Most Searched Locations
          </h3>
          {stats.topLocations.length > 0 ? (
            <div className="space-y-3">
              {stats.topLocations.map((loc, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm capitalize">{loc.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{loc.count} uses</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No location filter data yet</p>
          )}
        </div>

        {/* Top Price Ranges */}
        <div className="bg-card rounded-2xl p-5 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Most Used Price Ranges
          </h3>
          {stats.topPriceRanges.length > 0 ? (
            <div className="space-y-3">
              {stats.topPriceRanges.map((range, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm">{range.name} RWF</span>
                  </div>
                  <span className="text-sm font-semibold">{range.count} uses</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No price filter data yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterAnalyticsDashboard;
