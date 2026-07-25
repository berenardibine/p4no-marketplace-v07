import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, ChevronRight, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Motivation {
  id: string;
  quote: string;
  author: string | null;
}

const DailyMotivation = () => {
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMotivation = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('daily_motivations')
        .select('id, quote, author')
        .limit(10);
      
      if (data && data.length > 0) {
        // Pick a random one
        const randomIndex = Math.floor(Math.random() * data.length);
        setMotivation(data[randomIndex]);
      }
    } catch (error) {
      console.error('Error fetching motivation:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMotivation();
  }, []);

  const defaultQuote = {
    quote: "Your dream shop can start here. Every product you list brings you closer to success!",
    author: "Rwanda p4no"
  };

  const displayQuote = motivation?.quote || defaultQuote.quote;
  const displayAuthor = motivation?.author || defaultQuote.author;

  return (
    <div className="relative overflow-hidden rounded-2xl mx-1">
      {/* Gradient Background - matching the reference image */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600" />
      
      {/* Decorative elements */}
      <div className="absolute top-4 left-4 opacity-20">
        <Sparkles className="h-16 w-16 text-white" />
      </div>
      <div className="absolute bottom-4 right-8 opacity-10">
        <Quote className="h-24 w-24 text-white rotate-180" />
      </div>
      <div className="absolute bottom-12 left-12 opacity-30">
        <div className="flex gap-1">
          <Sparkles className="h-4 w-4 text-yellow-300" />
          <Sparkles className="h-3 w-3 text-pink-300" />
        </div>
      </div>
      
      {/* Content */}
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-white/90 font-semibold text-sm tracking-wide uppercase">
              Daily Inspiration
            </span>
          </div>
          <button 
            onClick={fetchMotivation}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Quote */}
        <div className="mb-4">
          <p className="text-white text-lg font-medium leading-relaxed italic">
            "{displayQuote}" <span className="not-italic">🙌</span>
          </p>
        </div>
        
        {/* Author */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🌟</span>
          <span className="text-white/80 font-medium text-sm">
            — {displayAuthor}
          </span>
        </div>
        
        {/* CTA Button */}
        <button 
          onClick={() => window.location.href = '/challenges'}
          className="flex items-center gap-2 text-white font-semibold text-sm hover:gap-3 transition-all duration-300"
        >
          <span>Explore Smart Academy</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DailyMotivation;
