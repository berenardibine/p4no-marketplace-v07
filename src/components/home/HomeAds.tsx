import { useState, useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  type: string;
  image_url: string | null;
  link: string | null;
  bg_color: string | null;
  text_color: string | null;
  font_size: string | null;
  target_audience: string | null;
}

const HomeAds = () => {
  const { profile } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    fetchActiveAds();
  }, [profile]);

  // Auto-rotate ads every 5 seconds
  useEffect(() => {
    if (ads.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [ads.length]);

  const fetchActiveAds = async () => {
    const now = new Date().toISOString();
    
    let query = supabase
      .from('ads')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('priority', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      // Filter by target audience
      const userType = profile?.user_type || 'buyer';
      const filteredAds = data.filter(ad => {
        if (!ad.target_audience || ad.target_audience === 'all') return true;
        return ad.target_audience === userType;
      });
      setAds(filteredAds);
    }
  };

  const handleDismiss = (adId: string) => {
    setDismissed([...dismissed, adId]);
  };

  const visibleAds = ads.filter(ad => !dismissed.includes(ad.id));
  
  if (visibleAds.length === 0) return null;

  const currentAd = visibleAds[currentAdIndex % visibleAds.length];

  const getFontSize = (size: string | null) => {
    switch (size) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      default: return 'text-base';
    }
  };

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-2xl shadow-lg transition-all duration-500"
        style={{ 
          backgroundColor: currentAd.bg_color || '#f97316',
        }}
      >
        {currentAd.type === 'image' || currentAd.type === 'banner' ? (
          <a 
            href={currentAd.link || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block relative"
          >
            {currentAd.image_url && (
              <img 
                src={currentAd.image_url} 
                alt={currentAd.title}
                className="w-full object-cover max-h-48"
              />
            )}
            {/* Overlay with text */}
            <div 
              className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4"
              style={{ color: currentAd.text_color || '#ffffff' }}
            >
              <h3 className={cn("font-bold", getFontSize(currentAd.font_size))}>
                {currentAd.title}
              </h3>
              {currentAd.description && (
                <p className="text-sm opacity-90 line-clamp-1 mt-1">
                  {currentAd.description}
                </p>
              )}
            </div>
          </a>
        ) : (
          <a 
            href={currentAd.link || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block p-4"
            style={{ color: currentAd.text_color || '#ffffff' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className={cn("font-bold", getFontSize(currentAd.font_size))}>
                  {currentAd.title}
                </h3>
                {currentAd.description && (
                  <p className="text-sm opacity-90 line-clamp-2 mt-1">
                    {currentAd.description}
                  </p>
                )}
              </div>
              {currentAd.link && (
                <ExternalLink className="h-5 w-5 shrink-0 opacity-70" />
              )}
            </div>
          </a>
        )}

        {/* Dismiss button 
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDismiss(currentAd.id);
          }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
        >
          <X className="h-3 w-3" />
        </button> */}
      </div>

      {/* Pagination dots */}
      {visibleAds.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {visibleAds.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentAdIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentAdIndex % visibleAds.length
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeAds;
