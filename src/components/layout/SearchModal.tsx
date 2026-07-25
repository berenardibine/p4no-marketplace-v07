import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Search, TrendingUp, Clock, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import TrackableProductCard from "@/components/home/TrackableProductCard";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchProduct {
  id: string;
  title: string;
  price: number;
  images: string[];
  slug: string | null;
  rental_unit: string | null;
  sponsored: boolean | null;
  admin_posted: boolean | null;
  is_negotiable: boolean | null;
  category: string | null;
  tags?: string[] | null;
  video_url?: string | null;
  video_thumbnail?: string | null;
}

const trendingSearches = ["Electronics", "Phones", "Vegetables", "Land for sale", "Motorcycles"];

const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('smart-market-recent-searches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const saveRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('smart-market-recent-searches', JSON.stringify(updated));
  };

  const searchDatabase = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setProducts([]);
      setRelatedProducts([]);
      return;
    }

    setLoading(true);
    try {
      const searchTerm = `%${searchQuery}%`;
      const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

      // Main search
      const { data: mainResults } = await supabase
        .from('products')
        .select('id, title, price, images, slug, rental_unit, sponsored, admin_posted, is_negotiable, category, tags, video_url, video_thumbnail, description, created_at')
        .eq('status', 'active')
        .or(
          `title.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm},tags.cs.{${searchQuery.toLowerCase()}}`
        )
        .limit(40);

      // Score results: title match > tag match > category > description, prefer sponsored
      const scored = (mainResults || []).map((p: any) => {
        const t = (p.title || '').toLowerCase();
        const d = (p.description || '').toLowerCase();
        const tags = (p.tags || []).map((x: string) => x.toLowerCase());
        let score = 0;
        for (const tok of tokens) {
          if (t.includes(tok)) score += 10;
          if (tags.includes(tok)) score += 6;
          if ((p.category || '').toLowerCase().includes(tok)) score += 4;
          if (d.includes(tok)) score += 1;
        }
        if (p.sponsored) score += 3;
        return { p, score };
      })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map(x => x.p);
      const results = scored;
      setProducts(results);
      saveRecentSearch(searchQuery);

      // Related products - fetch from same categories
      if (results.length > 0) {
        const categories = [...new Set(results.map(p => p.category).filter(Boolean))];
        const resultIds = results.map(p => p.id);
        
        if (categories.length > 0) {
          const { data: related } = await supabase
            .from('products')
            .select('id, title, price, images, slug, rental_unit, sponsored, admin_posted, is_negotiable, category')
            .eq('status', 'active')
            .in('category', categories)
            .not('id', 'in', `(${resultIds.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(10);
          
          setRelatedProducts(related || []);
        }
      } else {
        setRelatedProducts([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchDatabase(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchDatabase]);

  const handleQuickSearch = (term: string) => {
    setQuery(term);
    saveRecentSearch(term);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in">
      <div className="flex flex-col h-full">
        {/* Search Header */}
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-10 bg-muted border-0 focus-visible:ring-primary"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Results as Product Cards */}
          {query.length >= 2 && products.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-muted-foreground">
                  {products.length} result{products.length !== 1 ? 's' : ''} for "{query}"
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3" onClick={onClose}>
                {products.map((product) => (
                  <TrackableProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug || undefined}
                    title={product.title}
                    price={product.price}
                    images={product.images}
                    rentalUnit={product.rental_unit}
                    isSponsored={product.sponsored}
                    isAdminPosted={product.admin_posted}
                    isNegotiable={product.is_negotiable}
                    refSource="search"
                    videoUrl={product.video_url}
                    videoThumbnail={product.video_thumbnail}
                  />
                ))}
              </div>

              {/* Related Products */}
              {relatedProducts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Related Products</h3>
                  <div className="grid grid-cols-2 gap-3" onClick={onClose}>
                    {relatedProducts.map((product) => (
                      <TrackableProductCard
                        key={product.id}
                        id={product.id}
                        slug={product.slug || undefined}
                        title={product.title}
                        price={product.price}
                        images={product.images}
                        rentalUnit={product.rental_unit}
                        isSponsored={product.sponsored}
                        isAdminPosted={product.admin_posted}
                        isNegotiable={product.is_negotiable}
                        refSource="search_related"
                        videoUrl={product.video_url}
                        videoThumbnail={product.video_thumbnail}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Results */}
          {query.length >= 2 && !loading && products.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No results found for "{query}"</p>
              <p className="text-sm text-muted-foreground mt-1">Try different keywords</p>
            </div>
          )}

          {/* Recent Searches */}
          {query.length < 2 && recentSearches.length > 0 && (
            <div className="p-4 mb-2">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Recent</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => handleQuickSearch(search)}
                    className="px-3 py-1.5 rounded-full bg-muted text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending */}
          {query.length < 2 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Trending</span>
              </div>
              <div className="space-y-1">
                {trendingSearches.map((search, index) => (
                  <button
                    key={search}
                    onClick={() => handleQuickSearch(search)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <span className="text-sm font-semibold text-primary w-5">{index + 1}</span>
                    <span className="text-foreground">{search}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
