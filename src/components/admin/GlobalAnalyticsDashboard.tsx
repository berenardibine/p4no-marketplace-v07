import { useState, useEffect } from 'react';
import { Globe, Users, Package, Store, TrendingUp, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CountryStats {
  country: string;
  sellers: number;
  products: number;
  shops: number;
}

// Get country flag emoji
const getCountryFlag = (countryName: string) => {
  // Map country names to codes for common countries
  const codeMap: Record<string, string> = {
    'Rwanda': 'RW', 'Kenya': 'KE', 'Uganda': 'UG', 'Tanzania': 'TZ',
    'Nigeria': 'NG', 'South Africa': 'ZA', 'Ghana': 'GH', 'Ethiopia': 'ET',
    'United States': 'US', 'United Kingdom': 'GB', 'Canada': 'CA',
    'France': 'FR', 'Germany': 'DE', 'India': 'IN', 'China': 'CN',
    'Japan': 'JP', 'Australia': 'AU', 'Brazil': 'BR', 'Mexico': 'MX',
  };
  
  const code = codeMap[countryName];
  if (!code || code.length !== 2) return '🌍';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
  );
};

const GlobalAnalyticsDashboard = () => {
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    countries: 0,
    sellers: 0,
    products: 0,
    shops: 0,
  });

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    setLoading(true);
    try {
      // Fetch sellers by country
      const { data: sellersData } = await supabase
        .from('profiles')
        .select('country')
        .eq('user_type', 'seller')
        .not('country', 'is', null);
      
      // Fetch products by country
      const { data: productsData } = await supabase
        .from('products')
        .select('country')
        .eq('status', 'active')
        .not('country', 'is', null);
      
      // Fetch shops by country
      const { data: shopsData } = await supabase
        .from('shops')
        .select('country')
        .eq('is_active', true)
        .not('country', 'is', null);

      // Aggregate by country
      const countryMap = new Map<string, CountryStats>();
      
      sellersData?.forEach(item => {
        const country = item.country || 'Unknown';
        const existing = countryMap.get(country) || { country, sellers: 0, products: 0, shops: 0 };
        existing.sellers++;
        countryMap.set(country, existing);
      });

      productsData?.forEach(item => {
        const country = item.country || 'Unknown';
        const existing = countryMap.get(country) || { country, sellers: 0, products: 0, shops: 0 };
        existing.products++;
        countryMap.set(country, existing);
      });

      shopsData?.forEach(item => {
        const country = item.country || 'Unknown';
        const existing = countryMap.get(country) || { country, sellers: 0, products: 0, shops: 0 };
        existing.shops++;
        countryMap.set(country, existing);
      });

      // Convert to array and sort by sellers
      const stats = Array.from(countryMap.values())
        .sort((a, b) => b.sellers - a.sellers);

      setCountryStats(stats);
      setTotals({
        countries: stats.length,
        sellers: stats.reduce((sum, s) => sum + s.sellers, 0),
        products: stats.reduce((sum, s) => sum + s.products, 0),
        shops: stats.reduce((sum, s) => sum + s.shops, 0),
      });
    } catch (error) {
      console.error('Error fetching global stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Globe className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.countries}</p>
                <p className="text-xs text-muted-foreground">Countries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.sellers}</p>
                <p className="text-xs text-muted-foreground">Total Sellers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.products}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Store className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.shops}</p>
                <p className="text-xs text-muted-foreground">Shops</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Country Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Per-Country Analytics
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchGlobalStats}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : countryStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No country data available yet.</p>
              <p className="text-sm">Sellers need to register with their country.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {countryStats.map((stat, index) => (
                <div 
                  key={stat.country}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl",
                    index % 2 === 0 ? "bg-muted/50" : "bg-background"
                  )}
                >
                  <span className="text-2xl">{getCountryFlag(stat.country)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{stat.country}</p>
                    <p className="text-xs text-muted-foreground">
                      {stat.sellers} sellers • {stat.products} products • {stat.shops} shops
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">
                      {((stat.sellers / (totals.sellers || 1)) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">market share</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GlobalAnalyticsDashboard;
