import { Sparkles, TrendingUp, Gift } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AIGreeting = () => {
  const { profile, user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || "Friend";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-5 shadow-glow">
      {/* Decorative elements */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-sm" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10 blur-sm" />
      <div className="absolute top-4 right-4 animate-float">
        <Gift className="h-8 w-8 text-white/30" />
      </div>
      
      <div className="relative flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-soft">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-white font-bold text-xl mb-1.5">
            {getGreeting()}, {displayName} 👋
          </h2>
          <p className="text-white/90 text-sm leading-relaxed">
            p4no is ready for you! 
            Discover amazing products from local sellers.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
              <span className="text-white text-xs font-medium">Trending now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIGreeting;
